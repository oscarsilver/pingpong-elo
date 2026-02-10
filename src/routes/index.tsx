import { createFileRoute, Link } from '@tanstack/react-router'
import { Trophy, Plus, Swords } from 'lucide-react'
import { getLeaderboard, getRecentMatches } from './api.pingpong'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'

export const Route = createFileRoute('/')({
  component: Dashboard,
  loader: async () => {
    const [leaderboard, recentMatches] = await Promise.all([
      getLeaderboard(),
      getRecentMatches(),
    ])
    return { leaderboard, recentMatches }
  },
})

function Dashboard() {
  const { leaderboard, recentMatches } = Route.useLoaderData()

  return (
    <div className="min-h-screen bg-background">
      <section className="relative py-10 px-6 text-center overflow-hidden hero-gradient">
        <div className="relative max-w-7xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="w-12 h-12 text-link" />
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
              <span className="bg-gradient-to-r from-link to-[rgba(229,34,116,1)] bg-clip-text text-transparent">
                Ping Pong
              </span>{' '}
              <span className="text-muted-foreground font-semibold">ELO</span>
            </h1>
          </div>
          <p className="text-base text-muted-foreground mb-6 tracking-wide">
            Topplista för Pingis World Ranking
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/matches/new">
              <Button size="lg">
                <Swords className="w-4 h-4" />
                Registrera Match
              </Button>
            </Link>
            <Link to="/players/new">
              <Button size="lg" variant="outline" className="text-link">
                <Plus className="w-4 h-4" />
                Lägg till Spelare
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-6 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2 font-bold tracking-tight">
                <Trophy className="w-5 h-5 text-link" />
                Topplista
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Spelare</TableHead>
                    <TableHead className="text-right">ELO</TableHead>
                    <TableHead className="text-right">Vinster</TableHead>
                    <TableHead className="text-right">Förluster</TableHead>
                    <TableHead className="text-right">Win%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((player, index) => {
                    const totalGames = player.wins + player.losses
                    const winRate = totalGames > 0 ? ((player.wins / totalGames) * 100).toFixed(1) : '0.0'
                    return (
                      <TableRow key={player.id} className="border-border/30 hover:bg-table-row-hover transition-colors">
                        <TableCell className="font-semibold text-foreground">
                          {index === 0 && '🥇'}
                          {index === 1 && '🥈'}
                          {index === 2 && '🥉'}
                          {index > 2 && <span className="text-muted-foreground">#{index + 1}</span>}
                        </TableCell>
                        <TableCell className="font-semibold">
                          <Link to={`/players/${player.id}`} className="text-link hover:text-link/70 transition-colors">
                            {player.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className="text-link font-bold">{player.effective_elo}</span>
                          {player.decay_points > 0 && (
                            <span className="text-orange-400 text-xs ml-1" title={`${player.decay_points} ELO förlorat p.g.a. inaktivitet`}>
                              (-{player.decay_points})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-positive font-medium tabular-nums">{player.wins}</TableCell>
                        <TableCell className="text-right text-negative font-medium tabular-nums">{player.losses}</TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">{winRate}%</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-foreground font-bold tracking-tight">Senaste Matcher</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentMatches.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">Inga matcher än</p>
                ) : (
                  recentMatches.map((match) => {
                    const winner = match.score1 > match.score2 ? match.player1_name : match.player2_name
                    const isPlayer1Winner = match.score1 > match.score2
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
                        <div className="flex justify-between items-center mb-1.5">
                          <span className={`text-sm font-semibold ${isPlayer1Winner ? 'text-positive' : 'text-muted-foreground'}`}>
                            {match.player1_name}
                          </span>
                          <span className="text-xl font-bold text-foreground tabular-nums">
                            {match.score1} - {match.score2}
                          </span>
                          <span className={`text-sm font-semibold ${!isPlayer1Winner ? 'text-positive' : 'text-muted-foreground'}`}>
                            {match.player2_name}
                          </span>
                        </div>
                        {setScores && setScores.length > 0 && (
                          <div className="text-xs text-muted-foreground text-center mb-1 tabular-nums">
                            ({setScores.map((s) => `${s.score1}-${s.score2}`).join(', ')})
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground text-center">
                          <span className="bg-link/15 text-link/90 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider mr-2">{formatLabel}</span>
                          <span className="text-muted-foreground/80">Vinnare: {winner}</span>
                        </div>
                        <div className="flex justify-between text-xs mt-2 font-medium tabular-nums">
                          <span className={match.player1_elo_after > match.player1_elo_before ? 'text-positive' : 'text-negative'}>
                            {match.player1_elo_after > match.player1_elo_before ? '+' : ''}
                            {match.player1_elo_after - match.player1_elo_before} ELO
                          </span>
                          <span className={match.player2_elo_after > match.player2_elo_before ? 'text-positive' : 'text-negative'}>
                            {match.player2_elo_after > match.player2_elo_before ? '+' : ''}
                            {match.player2_elo_after - match.player2_elo_before} ELO
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
