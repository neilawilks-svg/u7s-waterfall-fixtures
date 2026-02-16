import { addMinutes, getNextAvailableTime } from './time';
import { computePitchGrid, computeZones, computeZoneAdjacency } from './zones';
import { assignTeamsToZones, findBestMatch } from './teamAssignment';
import { assignReferees } from './referees';

export const generateSampleTeams = () => {
  const clubs = ['Rovers', 'United', 'Wasps', 'Tigers', 'Saints', 'Warriors', 'Chiefs', 'Dragons'];
  const sampleTeams = [];

  for (let i = 0; i < 64; i++) {
    const clubIndex = Math.floor(i / 8);
    const teamNumber = (i % 8) + 1;
    sampleTeams.push({
      id: `team-${i}`,
      name: `${clubs[clubIndex]} U7 Team ${teamNumber}`,
      club: clubs[clubIndex],
      pitchAssignment: null
    });
  }

  return sampleTeams;
};

export const generateFixtureSet = ({ teams, numPitches, numRounds, matchDuration, startTime, lunchEnabled, lunchStart, lunchEnd }) => {
  const teamList = teams.length > 0 ? [...teams] : generateSampleTeams();

  // Phase 0: Zone setup
  const minTeamsPerZone = 3;
  const maxZonesByPitches = Math.floor(numPitches / 2);
  const maxZonesByTeams = Math.floor(teamList.length / minTeamsPerZone);
  const activeZoneCount = Math.min(maxZonesByPitches, maxZonesByTeams);
  const activePitchCount = activeZoneCount * 2;

  const zoneList = computeZones(activePitchCount);
  const pitchGrid = computePitchGrid(activePitchCount);
  const adjacency = computeZoneAdjacency(zoneList, pitchGrid);
  assignTeamsToZones(teamList, zoneList);

  // Tracking structures
  const allFixtures = [];
  const teamFixtureCounts = {};
  const playedMatchups = new Set();
  const clubMatchupsPerTeam = {};

  teamList.forEach(t => {
    teamFixtureCounts[t.id] = 0;
    clubMatchupsPerTeam[t.id] = new Set();
  });

  let totalRounds = 0;
  const maxRounds = numRounds * 3;
  let currentTime = startTime;

  const recordMatch = (t1, t2, matchupKey, usedSet) => {
    playedMatchups.add(matchupKey);
    teamFixtureCounts[t1.id]++;
    teamFixtureCounts[t2.id]++;
    usedSet.add(t1.id);
    usedSet.add(t2.id);
    clubMatchupsPerTeam[t1.id].add(t2.club);
    clubMatchupsPerTeam[t2.id].add(t1.club);
  };

  // Phase 1 & 2: Round-by-round generation
  while (totalRounds < maxRounds) {
    const teamsNeedingMatches = teamList.filter(t => teamFixtureCounts[t.id] < numRounds);
    if (teamsNeedingMatches.length === 0) break;

    const usedTeamsThisRound = new Set();
    const roundFixtures = [];
    const filledPitches = new Set();

    // Phase 1: Intra-zone matches
    for (const zone of zoneList) {
      for (let pitchSlot = 0; pitchSlot < 2; pitchSlot++) {
        const pitch = zone.pitches[pitchSlot];
        const availableInZone = zone.teams.filter(
          t => !usedTeamsThisRound.has(t.id) && teamFixtureCounts[t.id] < numRounds
        );
        if (availableInZone.length < 2) break;

        const match = findBestMatch(availableInZone, playedMatchups, clubMatchupsPerTeam, teamFixtureCounts, numRounds, adjacency);
        if (!match) break;

        const { t1, t2, matchupKey } = match;
        roundFixtures.push({
          id: `fixture-${totalRounds}-${pitch}`,
          round: totalRounds + 1,
          pitch,
          time: currentTime,
          team1: t1,
          team2: t2,
          zone: zone.id,
          isCrossZone: false,
        });
        recordMatch(t1, t2, matchupKey, usedTeamsThisRound);
        filledPitches.add(pitch);
      }
    }

    // Phase 2: Cross-zone backfill for unfilled pitch slots
    for (const zone of zoneList) {
      for (const pitch of zone.pitches) {
        if (filledPitches.has(pitch)) continue;

        const zoneOrder = [zone.id, ...(adjacency[zone.id] || [])];
        const candidates = [];
        for (const zId of zoneOrder) {
          const z = zoneList.find(zz => zz.id === zId);
          if (!z) continue;
          z.teams.forEach(t => {
            if (!usedTeamsThisRound.has(t.id) && teamFixtureCounts[t.id] < numRounds) {
              candidates.push(t);
            }
          });
        }
        if (candidates.length < 2) continue;

        const match = findBestMatch(candidates, playedMatchups, clubMatchupsPerTeam, teamFixtureCounts, numRounds, adjacency);
        if (!match) continue;

        const { t1, t2, matchupKey } = match;
        roundFixtures.push({
          id: `fixture-${totalRounds}-${pitch}`,
          round: totalRounds + 1,
          pitch,
          time: currentTime,
          team1: t1,
          team2: t2,
          zone: zone.id,
          isCrossZone: t1.zone !== t2.zone,
        });
        recordMatch(t1, t2, matchupKey, usedTeamsThisRound);
        filledPitches.add(pitch);
      }
    }

    if (roundFixtures.length > 0) {
      allFixtures.push(...roundFixtures);
    } else {
      break;
    }

    totalRounds++;
    let nextTime = addMinutes(currentTime, matchDuration);
    currentTime = getNextAvailableTime(nextTime, lunchEnabled, lunchStart, lunchEnd);
  }

  if (allFixtures.length === 0) {
    return null;
  }

  // Assign referees to all fixtures
  assignReferees(allFixtures, zoneList);

  // Build summary
  const fixtureCounts = Object.values(teamFixtureCounts);
  const minFixtures = Math.min(...fixtureCounts);
  const maxFixtures = Math.max(...fixtureCounts);
  const avgFixtures = (fixtureCounts.reduce((a, b) => a + b, 0) / fixtureCounts.length).toFixed(1);
  const teamsWithTarget = fixtureCounts.filter(c => c === numRounds).length;

  const intraZoneCount = allFixtures.filter(f => !f.isCrossZone).length;
  const crossZoneCount = allFixtures.filter(f => f.isCrossZone).length;
  const intraPercent = allFixtures.length > 0 ? Math.round(intraZoneCount / allFixtures.length * 100) : 0;

  const conflictCount = allFixtures.filter(f => f.refereeConflict).length;
  const unassignedCount = allFixtures.filter(f => !f.referee).length;

  let summary = `Generated ${allFixtures.length} fixtures across ${totalRounds} rounds in ${zoneList.length} zones. `;
  summary += `Teams have ${minFixtures}-${maxFixtures} matches (avg: ${avgFixtures}). `;
  summary += `${teamsWithTarget}/${teamList.length} teams have exactly ${numRounds} matches. `;
  summary += `${intraPercent}% intra-zone, ${100 - intraPercent}% cross-zone. `;
  summary += `Referees: ${allFixtures.length - conflictCount} clean, ${conflictCount - unassignedCount} conflicts, ${unassignedCount} unassigned.`;

  return { fixtures: allFixtures, teams: teamList, zones: zoneList, summary };
};
