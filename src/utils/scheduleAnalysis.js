/**
 * Analyse a set of imported fixtures against common scheduling constraints.
 * Returns a structured report that can be displayed to the user.
 */
export function analyseSchedule(fixtures, teams) {
  // ── 1. Duplicate matchups (same two teams meet more than once) ─────────────
  const matchupSeen = new Map(); // canonical-key → round first seen
  const duplicates = [];
  for (const f of fixtures) {
    const a = f.team1.id <= f.team2.id ? f.team1 : f.team2;
    const b = f.team1.id <= f.team2.id ? f.team2 : f.team1;
    const key = `${a.id}::${b.id}`;
    if (matchupSeen.has(key)) {
      duplicates.push({
        team1: f.team1.name,
        team2: f.team2.name,
        rounds: [matchupSeen.get(key), f.round],
      });
    } else {
      matchupSeen.set(key, f.round);
    }
  }

  // ── 2. Same-club fixtures ──────────────────────────────────────────────────
  const sameClubFixtures = fixtures
    .filter(f => f.team1.club && f.team2.club && f.team1.club === f.team2.club)
    .map(f => ({ round: f.round, club: f.team1.club, team1: f.team1.name, team2: f.team2.name }));

  // ── 3. Repeat opponent club (a team faces the same club more than once) ────
  const teamClubFaced = new Map(); // teamId → Map(club → [opponentNames])
  for (const f of fixtures) {
    for (const [player, opponent] of [[f.team1, f.team2], [f.team2, f.team1]]) {
      if (!opponent.club) continue;
      if (!teamClubFaced.has(player.id)) teamClubFaced.set(player.id, new Map());
      const byClub = teamClubFaced.get(player.id);
      if (!byClub.has(opponent.club)) byClub.set(opponent.club, []);
      byClub.get(opponent.club).push(opponent.name);
    }
  }
  const repeatOpponentClub = [];
  for (const [teamId, byClub] of teamClubFaced) {
    const team = teams.find(t => t.id === teamId);
    for (const [club, opponents] of byClub) {
      if (opponents.length > 1) {
        repeatOpponentClub.push({ team: team?.name ?? teamId, club, count: opponents.length, opponents });
      }
    }
  }

  // ── 4. Match counts per team ───────────────────────────────────────────────
  const countMap = new Map();
  for (const t of teams) countMap.set(t.id, 0);
  for (const f of fixtures) {
    countMap.set(f.team1.id, (countMap.get(f.team1.id) ?? 0) + 1);
    countMap.set(f.team2.id, (countMap.get(f.team2.id) ?? 0) + 1);
  }
  const allCounts = [...countMap.values()];
  const minMatches = Math.min(...allCounts);
  const maxMatches = Math.max(...allCounts);
  const isBalanced = maxMatches - minMatches <= 1;
  // Build distribution: count → [teamNames]
  const distribution = {};
  for (const [teamId, count] of countMap) {
    const name = teams.find(t => t.id === teamId)?.name ?? teamId;
    if (!distribution[count]) distribution[count] = [];
    distribution[count].push(name);
  }

  // ── 5. Referee clashes ────────────────────────────────────────────────────
  const refereeClashes = fixtures
    .filter(f => f.refereeConflict && f.referee)
    .map(f => ({ round: f.round, referee: f.referee.name, team1: f.team1.name, team2: f.team2.name }));

  // ── 6. Extended breaks (gap > 2 rounds between consecutive matches) ────────
  const teamRoundSets = new Map();
  for (const f of fixtures) {
    for (const team of [f.team1, f.team2]) {
      if (!teamRoundSets.has(team.id)) teamRoundSets.set(team.id, new Set());
      teamRoundSets.get(team.id).add(f.round);
    }
  }
  const extendedBreaks = [];
  for (const [teamId, roundSet] of teamRoundSets) {
    const rounds = [...roundSet].sort((a, b) => a - b);
    let maxGap = 0;
    let gapRounds = null;
    for (let i = 1; i < rounds.length; i++) {
      const gap = rounds[i] - rounds[i - 1];
      if (gap > maxGap) {
        maxGap = gap;
        gapRounds = [rounds[i - 1], rounds[i]];
      }
    }
    // gap > 2 means more than one round sits between consecutive matches
    if (maxGap > 2) {
      const team = teams.find(t => t.id === teamId);
      extendedBreaks.push({ team: team?.name ?? teamId, maxGap, gapRounds });
    }
  }

  // ── 7. Intra-zone / cross-zone movement ───────────────────────────────────
  const crossZoneCount = fixtures.filter(f => f.isCrossZone).length;
  const crossZonePct = fixtures.length ? Math.round((crossZoneCount / fixtures.length) * 100) : 0;

  // ── 8. Club spread across rounds (clubs with 3+ teams in same round) ───────
  const uniqueRounds = [...new Set(fixtures.map(f => f.round))].sort((a, b) => a - b);
  const clubClusters = [];
  for (const round of uniqueRounds) {
    const rf = fixtures.filter(f => f.round === round);
    const clubTeams = new Map();
    for (const f of rf) {
      for (const team of [f.team1, f.team2]) {
        if (!team.club) continue;
        if (!clubTeams.has(team.club)) clubTeams.set(team.club, new Set());
        clubTeams.get(team.club).add(team.name);
      }
    }
    for (const [club, teamSet] of clubTeams) {
      if (teamSet.size >= 3) {
        clubClusters.push({ round, club, count: teamSet.size, teams: [...teamSet] });
      }
    }
  }

  return {
    duplicates,
    sameClubFixtures,
    repeatOpponentClub,
    matchCounts: { min: minMatches, max: maxMatches, isBalanced, distribution },
    refereeClashes,
    extendedBreaks,
    crossZone: { count: crossZoneCount, total: fixtures.length, pct: crossZonePct },
    clubSpread: clubClusters,
  };
}
