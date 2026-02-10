import { createServerFn } from '@tanstack/react-start'
import { db } from '../lib/db'
import { calculateElo, calculateDecay } from '../lib/elo'
import {
  validateSetCounts,
  validatePingPongScore,
  getWinner,
  type SetScore,
} from '../lib/rules'

/**
 * Get all players sorted by ELO (leaderboard), with decay applied
 */
export const getLeaderboard = createServerFn({
  method: 'GET',
}).handler(async () => {
  const players = await db.getPlayers()
  const now = Date.now()
  const playersWithDecay = players.map((player) => {
    const { decayedElo, decayPoints } = calculateDecay(player.elo, player.last_match_at, now)
    return {
      ...player,
      effective_elo: decayedElo,
      decay_points: decayPoints,
    }
  })
  return playersWithDecay.sort((a, b) => b.effective_elo - a.effective_elo)
})

/**
 * Get all players (for dropdowns)
 */
export const getPlayers = createServerFn({
  method: 'GET',
}).handler(async () => {
  const players = await db.getPlayers()
  return players.sort((a, b) => a.name.localeCompare(b.name))
})

/**
 * Add a new player
 */
export const addPlayer = createServerFn({ method: 'POST' })
  .inputValidator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    const { name } = data

    if (!name || name.trim().length === 0) {
      throw new Error('Spelarnamn krävs')
    }

    const player = await db.addPlayer(name.trim())
    return player
  })

/**
 * Register a match and update ELO ratings
 * For Bo1: provide set_score with point values (e.g., 11-9)
 * For Bo3/Bo5: provide sets_won1/sets_won2 with set counts (e.g., 2-1)
 */
export const registerMatch = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      player1_id: number
      player2_id: number
      match_format: number
      // For Bo1 matches - point score
      set_score?: SetScore
      // For Bo3/Bo5 matches - set counts
      sets_won1?: number
      sets_won2?: number
    }) => data,
  )
  .handler(async ({ data }) => {
    const { player1_id, player2_id, match_format, set_score, sets_won1, sets_won2 } = data

    // Validate players are different
    if (player1_id === player2_id) {
      throw new Error('Spelarna måste vara olika')
    }

    let finalSetsWon1: number
    let finalSetsWon2: number
    let setScoresJson: string | null = null
    let winner: 'player1' | 'player2' | null

    if (match_format === 1) {
      // Bo1: validate point score
      if (!set_score) {
        throw new Error('Setresultat krävs för bäst av 1')
      }
      const validation = validatePingPongScore(set_score.score1, set_score.score2)
      if (!validation.valid) {
        throw new Error(validation.error)
      }
      winner = getWinner(set_score.score1, set_score.score2)
      finalSetsWon1 = winner === 'player1' ? 1 : 0
      finalSetsWon2 = winner === 'player2' ? 1 : 0
      setScoresJson = JSON.stringify([set_score])
    } else {
      // Bo3/Bo5: validate set counts
      if (sets_won1 === undefined || sets_won2 === undefined) {
        throw new Error('Setresultat krävs')
      }
      const validation = validateSetCounts(match_format, sets_won1, sets_won2)
      if (!validation.valid) {
        throw new Error(validation.error)
      }
      winner = getWinner(sets_won1, sets_won2)
      finalSetsWon1 = sets_won1
      finalSetsWon2 = sets_won2
    }

    if (!winner) {
      throw new Error('Kunde inte avgöra vinnare')
    }

    // Get current player data
    const player1 = await db.getPlayerById(player1_id)
    const player2 = await db.getPlayerById(player2_id)

    if (!player1 || !player2) {
      throw new Error('En eller båda spelarna hittades inte')
    }

    const now = Date.now()

    // Apply ELO decay for inactive players before calculating match ELO
    const p1Decay = calculateDecay(player1.elo, player1.last_match_at, now)
    const p2Decay = calculateDecay(player2.elo, player2.last_match_at, now)
    const p1EffectiveElo = p1Decay.decayedElo
    const p2EffectiveElo = p2Decay.decayedElo

    // Calculate new ELO ratings (based on match win, not individual sets)
    const player1Won = winner === 'player1'
    const { winner_new_elo, loser_new_elo } = player1Won
      ? calculateElo(p1EffectiveElo, p2EffectiveElo)
      : calculateElo(p2EffectiveElo, p1EffectiveElo)

    const player1_new_elo = player1Won ? winner_new_elo : loser_new_elo
    const player2_new_elo = player1Won ? loser_new_elo : winner_new_elo

    // Insert match record (elo_before reflects the effective ELO after decay)
    await db.addMatch({
      player1_id,
      player2_id,
      score1: finalSetsWon1,
      score2: finalSetsWon2,
      match_format,
      set_scores: setScoresJson,
      player1_elo_before: p1EffectiveElo,
      player2_elo_before: p2EffectiveElo,
      player1_elo_after: player1_new_elo,
      player2_elo_after: player2_new_elo,
    })

    // Update player stats (store new ELO and update last_match_at)
    await db.updatePlayer(player1_id, {
      elo: player1_new_elo,
      wins: player1.wins + (player1Won ? 1 : 0),
      losses: player1.losses + (player1Won ? 0 : 1),
      last_match_at: now,
    })

    await db.updatePlayer(player2_id, {
      elo: player2_new_elo,
      wins: player2.wins + (player1Won ? 0 : 1),
      losses: player2.losses + (player1Won ? 1 : 0),
      last_match_at: now,
    })

    return {
      success: true,
      player1_elo_change: player1_new_elo - p1EffectiveElo,
      player2_elo_change: player2_new_elo - p2EffectiveElo,
    }
  })

/**
 * Get recent matches
 */
export const getRecentMatches = createServerFn({
  method: 'GET',
}).handler(() => db.getMatchesWithNames())

/**
 * Get a player by ID, with decay info
 */
export const getPlayerById = createServerFn({ method: 'GET' })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const player = await db.getPlayerById(data.id)
    if (!player) {
      throw new Error('Spelaren hittades inte')
    }
    const { decayedElo, decayPoints } = calculateDecay(player.elo, player.last_match_at)
    return {
      ...player,
      effective_elo: decayedElo,
      decay_points: decayPoints,
    }
  })

/**
 * Get all matches for a specific player
 */
export const getPlayerMatches = createServerFn({ method: 'GET' })
  .inputValidator((data: { playerId: number }) => data)
  .handler(({ data }) => db.getPlayerMatches(data.playerId))
