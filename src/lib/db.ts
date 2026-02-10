import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Available env vars:', Object.keys(process.env))
  throw new Error('DATABASE_URL environment variable is not set')
}

console.log('Connecting to database:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'))

// Create PostgreSQL connection
const sql = postgres(DATABASE_URL, {
  max: 10, // Maximum number of connections
  idle_timeout: 20,
  connect_timeout: 10,
})

// Initialize database schema
async function initializeDatabase() {
  try {
    // Create tables if they don't exist
    await sql`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        elo INTEGER NOT NULL DEFAULT 1000,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL,
        last_match_at BIGINT
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        player1_id INTEGER NOT NULL REFERENCES players(id),
        player2_id INTEGER NOT NULL REFERENCES players(id),
        score1 INTEGER NOT NULL,
        score2 INTEGER NOT NULL,
        match_format INTEGER NOT NULL DEFAULT 1,
        set_scores TEXT,
        player1_elo_before INTEGER NOT NULL,
        player2_elo_before INTEGER NOT NULL,
        player1_elo_after INTEGER NOT NULL,
        player2_elo_after INTEGER NOT NULL,
        timestamp BIGINT NOT NULL
      )
    `

    // Add new columns if they don't exist (migration for existing databases)
    await sql`
      DO $$ BEGIN
        ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_format INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE matches ADD COLUMN IF NOT EXISTS set_scores TEXT;
        ALTER TABLE players ADD COLUMN IF NOT EXISTS last_match_at BIGINT;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `

    // Backfill last_match_at from existing match data
    await sql`
      UPDATE players SET last_match_at = sub.last_match
      FROM (
        SELECT player_id, MAX(timestamp) as last_match
        FROM (
          SELECT player1_id AS player_id, timestamp FROM matches
          UNION ALL
          SELECT player2_id AS player_id, timestamp FROM matches
        ) all_matches
        GROUP BY player_id
      ) sub
      WHERE players.id = sub.player_id AND players.last_match_at IS NULL
    `

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_matches_timestamp ON matches(timestamp DESC)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_players_elo ON players(elo DESC)
    `

    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Failed to initialize database:', error)
    throw error
  }
}

// Initialize on module load
initializeDatabase().catch(console.error)

export type Player = {
  id: number
  name: string
  elo: number
  wins: number
  losses: number
  created_at: number
  last_match_at: number | null
}

export type SetScore = {
  score1: number
  score2: number
}

export type Match = {
  id: number
  player1_id: number
  player2_id: number
  score1: number
  score2: number
  match_format: number
  set_scores: string | null
  player1_elo_before: number
  player2_elo_before: number
  player1_elo_after: number
  player2_elo_after: number
  timestamp: number
}

export type MatchWithNames = Match & {
  player1_name: string
  player2_name: string
}

export const db = {
  async getPlayers(): Promise<Player[]> {
    const players = await sql<Player[]>`
      SELECT * FROM players ORDER BY elo DESC
    `
    return players
  },

  async getPlayerById(id: number): Promise<Player | undefined> {
    const players = await sql<Player[]>`
      SELECT * FROM players WHERE id = ${id}
    `
    return players[0]
  },

  async addPlayer(name: string): Promise<Player> {
    // Check for duplicate name
    const existing = await sql<Player[]>`
      SELECT id FROM players WHERE name = ${name}
    `
    
    if (existing.length > 0) {
      throw new Error('En spelare med detta namn finns redan')
    }

    const now = Date.now()
    const players = await sql<Player[]>`
      INSERT INTO players (name, elo, wins, losses, created_at)
      VALUES (${name}, 1000, 0, 0, ${now})
      RETURNING *
    `
    
    return players[0]
  },

  async updatePlayer(id: number, updates: Partial<Omit<Player, 'id'>>): Promise<void> {
    const sets: string[] = []
    const values: any[] = []

    if (updates.elo !== undefined) {
      sets.push(`elo = ${updates.elo}`)
    }
    if (updates.wins !== undefined) {
      sets.push(`wins = ${updates.wins}`)
    }
    if (updates.losses !== undefined) {
      sets.push(`losses = ${updates.losses}`)
    }
    if (updates.last_match_at !== undefined) {
      sets.push(`last_match_at = ${updates.last_match_at}`)
    }

    if (sets.length > 0) {
      await sql`
        UPDATE players
        SET ${sql(updates)}
        WHERE id = ${id}
      `
    }
  },

  async getMatches(): Promise<Match[]> {
    const matches = await sql<Match[]>`
      SELECT * FROM matches 
      ORDER BY timestamp DESC 
      LIMIT 10
    `
    return matches
  },

  async getMatchesWithNames(): Promise<MatchWithNames[]> {
    const matches = await sql<MatchWithNames[]>`
      SELECT
        m.*,
        p1.name as player1_name,
        p2.name as player2_name
      FROM matches m
      JOIN players p1 ON m.player1_id = p1.id
      JOIN players p2 ON m.player2_id = p2.id
      ORDER BY m.timestamp DESC
      LIMIT 10
    `
    return matches
  },

  async getPlayerMatches(playerId: number): Promise<MatchWithNames[]> {
    const matches = await sql<MatchWithNames[]>`
      SELECT
        m.*,
        p1.name as player1_name,
        p2.name as player2_name
      FROM matches m
      JOIN players p1 ON m.player1_id = p1.id
      JOIN players p2 ON m.player2_id = p2.id
      WHERE m.player1_id = ${playerId} OR m.player2_id = ${playerId}
      ORDER BY m.timestamp DESC
    `
    return matches
  },

  async addMatch(match: Omit<Match, 'id' | 'timestamp'>): Promise<Match> {
    const now = Date.now()

    const matches = await sql<Match[]>`
      INSERT INTO matches
      (player1_id, player2_id, score1, score2, match_format, set_scores, player1_elo_before, player2_elo_before, player1_elo_after, player2_elo_after, timestamp)
      VALUES (
        ${match.player1_id},
        ${match.player2_id},
        ${match.score1},
        ${match.score2},
        ${match.match_format},
        ${match.set_scores},
        ${match.player1_elo_before},
        ${match.player2_elo_before},
        ${match.player1_elo_after},
        ${match.player2_elo_after},
        ${now}
      )
      RETURNING *
    `

    return matches[0]
  },
}

// Export the sql instance for cleanup if needed
export { sql }
