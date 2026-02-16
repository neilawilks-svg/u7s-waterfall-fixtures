export const assignReferees = (fixtureList, zoneList) => {
  // Build lookup: pitch number -> zone
  const pitchToZone = {};
  zoneList.forEach(z => z.pitches.forEach(p => { pitchToZone[p] = z; }));

  // Track how many times each team has refereed (for balancing)
  const refereeCounts = {};
  zoneList.forEach(z => z.teams.forEach(t => { refereeCounts[t.id] = 0; }));

  // Group fixtures by round
  const rounds = [...new Set(fixtureList.map(f => f.round))].sort((a, b) => a - b);

  rounds.forEach(round => {
    const roundFixtures = fixtureList.filter(f => f.round === round);
    const playingTeams = new Set();
    roundFixtures.forEach(f => {
      playingTeams.add(f.team1.id);
      playingTeams.add(f.team2.id);
    });

    const assignedRefsThisRound = new Set();

    // Sort fixtures so zones with fewer available referees are processed first
    const sortedFixtures = [...roundFixtures].sort((a, b) => {
      const zoneA = pitchToZone[a.pitch];
      const zoneB = pitchToZone[b.pitch];
      const availA = zoneA ? zoneA.teams.filter(t =>
        t.id !== a.team1.id && t.id !== a.team2.id
      ).length : 0;
      const availB = zoneB ? zoneB.teams.filter(t =>
        t.id !== b.team1.id && t.id !== b.team2.id
      ).length : 0;
      return availA - availB;
    });

    sortedFixtures.forEach(fixture => {
      const zone = pitchToZone[fixture.pitch];
      if (!zone) {
        fixture.referee = null;
        fixture.refereeConflict = true;
        return;
      }

      // Candidates: teams in the zone, not playing THIS match, not already refereeing this round
      const candidates = zone.teams.filter(t =>
        t.id !== fixture.team1.id &&
        t.id !== fixture.team2.id &&
        !assignedRefsThisRound.has(t.id)
      );

      // Split into preferred (not playing at all this round) and fallback (playing another match)
      const preferred = candidates.filter(t => !playingTeams.has(t.id));
      const fallback = candidates.filter(t => playingTeams.has(t.id));

      const pickLeastUsed = (list) => {
        return list.sort((a, b) => (refereeCounts[a.id] || 0) - (refereeCounts[b.id] || 0))[0];
      };

      if (preferred.length > 0) {
        const ref = pickLeastUsed(preferred);
        fixture.referee = { id: ref.id, name: ref.name, club: ref.club, zone: ref.zone };
        fixture.refereeConflict = false;
        refereeCounts[ref.id] = (refereeCounts[ref.id] || 0) + 1;
        assignedRefsThisRound.add(ref.id);
      } else if (fallback.length > 0) {
        const ref = pickLeastUsed(fallback);
        fixture.referee = { id: ref.id, name: ref.name, club: ref.club, zone: ref.zone };
        fixture.refereeConflict = true;
        refereeCounts[ref.id] = (refereeCounts[ref.id] || 0) + 1;
        assignedRefsThisRound.add(ref.id);
      } else {
        // No one available in zone
        fixture.referee = null;
        fixture.refereeConflict = true;
      }
    });
  });

  return fixtureList;
};
