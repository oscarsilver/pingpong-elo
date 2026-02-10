import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, User, Trophy, TrendingUp, TrendingDown, Skull } from 'lucide-react'
import { getPlayerById, getPlayerMatches } from '../api.pingpong'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { calculateNemesis } from '../../lib/stats'

export const Route = createFileRoute('/players/$id')({
  component: PlayerDetail,
  loader: async ({ params }) => {
    const playerId = parseInt(params.id, 10)
    const [player, matches] = await Promise.all([
      getPlayerById({ data: { id: playerId } }),
      getPlayerMatches({ data: { playerId } }),
    ])
    const nemesis = calculateNemesis(playerId, matches)
    return { player, matches, nemesis }
  },
})

function PlayerDetail() {
  const { player, matches, nemesis } = Route.useLoaderData()

  const totalGames = player.wins + player.losses
  const winRate = totalGames > 0 ? ((player.wins / totalGames) * 100).toFixed(1) : '0.0'

  return (
    <div className="min-h-screen bg-background">
      <div className="py-8 px-6 max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center text-link hover:text-link/70 transition-colors mb-5 text-sm font-medium">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Tillbaka till Översikt
        </Link>

        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="text-xl text-foreground flex items-center gap-2 font-bold tracking-tight">
              <User className="w-5 h-5 text-link" />
              {player.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-table-row rounded p-4 border border-border/50 text-center">
                <div className="text-2xl font-bold text-link tabular-nums">{player.effective_elo}</div>
                {player.decay_points > 0 && (
                  <div className="text-xs text-orange-400 font-medium mt-0.5 tabular-nums">-{player.decay_points} decay</div>
                )}
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-1">ELO</div>
              </div>
              <div className="bg-table-row rounded p-4 border border-border/50 text-center">
                <div className="text-2xl font-bold text-positive tabular-nums">{player.wins}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-1">Vinster</div>
              </div>
              <div className="bg-table-row rounded p-4 border border-border/50 text-center">
                <div className="text-2xl font-bold text-negative tabular-nums">{player.losses}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-1">Förluster</div>
              </div>
              <div className="bg-table-row rounded p-4 border border-border/50 text-center">
                <div className="text-2xl font-bold text-foreground tabular-nums">{winRate}%</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-1">Win%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {nemesis && (
          <Card className="mb-5 relative overflow-hidden">
            {/* Animated glow border */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-500/20 via-orange-500/10 to-red-500/20 animate-nemesis-pulse" />
            <div className="absolute inset-[1px] rounded-[11px] bg-card" />

            <CardHeader className="relative">
              <CardTitle className="text-lg text-foreground flex items-center gap-2 font-bold tracking-tight">
                <div className="relative">
                  <Skull className="w-5 h-5 text-red-500" />
                  <div className="absolute inset-0 blur-sm bg-red-500/50 animate-pulse" />
                </div>
                <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                  Nemesis
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="relative">
              <div className="bg-gradient-to-br from-red-950/30 to-orange-950/20 rounded-lg p-4 border border-red-500/20">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      to={`/players/${nemesis.opponentId}`}
                      className="text-lg font-bold text-foreground hover:text-red-400 transition-colors truncate block"
                    >
                      {nemesis.opponentName}
                    </Link>
                    <p className="text-xs text-red-400/80 mt-1 font-medium tracking-wide">
                      Din svåraste motståndare
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-3xl font-black text-red-400 tabular-nums tracking-tighter">
                      {nemesis.winRate.toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums mt-1">
                      <span className="text-positive">{nemesis.wins}V</span>
                      <span className="mx-1">–</span>
                      <span className="text-negative">{nemesis.losses}F</span>
                      <span className="text-muted-foreground/60 ml-1">
                        ({nemesis.totalMatches})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-foreground flex items-center gap-2 font-bold tracking-tight">
              <Trophy className="w-5 h-5 text-link" />
              Matchhistorik
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {matches.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-sm">Inga matcher än</p>
              ) : (
                matches.map((match) => {
                  const isPlayer1 = match.player1_id === player.id
                  const playerScore = isPlayer1 ? match.score1 : match.score2
                  const opponentScore = isPlayer1 ? match.score2 : match.score1
                  const opponentName = isPlayer1 ? match.player2_name : match.player1_name
                  const playerEloBefore = isPlayer1 ? match.player1_elo_before : match.player2_elo_before
                  const playerEloAfter = isPlayer1 ? match.player1_elo_after : match.player2_elo_after
                  const eloChange = playerEloAfter - playerEloBefore
                  const won = playerScore > opponentScore
                  const setScores = match.set_scores
                    ? (JSON.parse(match.set_scores) as { score1: number; score2: number }[])
                    : null
                  const formatLabel =
                    match.match_format === 5 ? 'Bo5' : match.match_format === 3 ? 'Bo3' : 'Bo1'

                  return (
                    <div
                      key={match.id}
                      className="bg-table-row rounded p-3 border border-border/50 hover:bg-table-row-hover hover:border-border transition-all duration-150"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2.5">
                          {won ? (
                            <TrendingUp className="w-4 h-4 text-positive" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-negative" />
                          )}
                          <div>
                            <div className="text-foreground font-semibold text-sm">
                              vs {opponentName}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <span className="bg-link/15 text-link/90 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">{formatLabel}</span>
                              <span>{won ? 'Vinst' : 'Förlust'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-foreground tabular-nums">
                            {playerScore} - {opponentScore}
                          </div>
                          {setScores && setScores.length > 0 && (
                            <div className="text-xs text-muted-foreground tabular-nums">
                              ({setScores
                                .map((s) =>
                                  isPlayer1
                                    ? `${s.score1}-${s.score2}`
                                    : `${s.score2}-${s.score1}`
                                )
                                .join(', ')})
                            </div>
                          )}
                          <div className={`text-sm font-semibold tabular-nums ${eloChange > 0 ? 'text-positive' : 'text-negative'}`}>
                            {eloChange > 0 ? '+' : ''}{eloChange} ELO
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
