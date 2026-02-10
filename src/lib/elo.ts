// Decay constants
export const DECAY_THRESHOLD_DAYS = 14
export const DECAY_POINTS_PER_WEEK = 5
export const DECAY_FLOOR = 1000

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_WEEK = 7 * MS_PER_DAY

/**
 * Calculate ELO decay for an inactive player.
 * After DECAY_THRESHOLD_DAYS of inactivity, players lose DECAY_POINTS_PER_WEEK
 * per week. ELO never decays below DECAY_FLOOR.
 */
export function calculateDecay(
  currentElo: number,
  lastMatchAt: number | null,
  now: number = Date.now(),
): { decayedElo: number; decayPoints: number } {
  if (lastMatchAt === null || currentElo <= DECAY_FLOOR) {
    return { decayedElo: currentElo, decayPoints: 0 }
  }

  const inactiveDays = (now - lastMatchAt) / MS_PER_DAY
  if (inactiveDays <= DECAY_THRESHOLD_DAYS) {
    return { decayedElo: currentElo, decayPoints: 0 }
  }

  const decayableMs = now - lastMatchAt - DECAY_THRESHOLD_DAYS * MS_PER_DAY
  const decayWeeks = decayableMs / MS_PER_WEEK
  const decayPoints = Math.floor(decayWeeks * DECAY_POINTS_PER_WEEK)

  if (decayPoints <= 0) {
    return { decayedElo: currentElo, decayPoints: 0 }
  }

  const decayedElo = Math.max(DECAY_FLOOR, currentElo - decayPoints)
  const actualDecay = currentElo - decayedElo

  return { decayedElo, decayPoints: actualDecay }
}

/**
 * Calculate new ELO ratings for two players after a match
 * @param winner_elo - Current ELO of the winner
 * @param loser_elo - Current ELO of the loser
 * @param k_factor - K-factor (default 32 for standard chess/competitive games)
 * @returns Object with new ELO ratings for both players
 */
export function calculateElo(
  winner_elo: number,
  loser_elo: number,
  k_factor: number = 32,
): { winner_new_elo: number; loser_new_elo: number } {
  // Calculate expected scores
  const expected_winner = 1 / (1 + Math.pow(10, (loser_elo - winner_elo) / 400))
  const expected_loser = 1 / (1 + Math.pow(10, (winner_elo - loser_elo) / 400))

  // Calculate new ratings
  // Winner gets 1 point, loser gets 0 points
  const winner_new_elo = Math.round(winner_elo + k_factor * (1 - expected_winner))
  const loser_new_elo = Math.round(loser_elo + k_factor * (0 - expected_loser))

  return {
    winner_new_elo,
    loser_new_elo,
  }
}

