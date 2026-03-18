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

export const generateFixtureSet = ({ teams, numPitches, numRounds, minMatches, matchDuration, startTime, endTime, lunchEnabled, lunchStart, lunchEnd }) => {
  const effectiveMin = (minMatches != null && minMatches > 0) ? minMatches : numRounds;
  const teamList = (teams.length > 0 ? [...teams] : generateSampleTeams())
    .sort(() => Math.random() - 0.5);

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

  const teamLastPlayedRound = {};
  teamList.forEach(t => {
    teamFixtureCounts[t.id] = 0;
    clubMatchupsPerTeam[t.id] = new Set();
    teamLastPlayedRound[t.id] = -1;
  });

  let totalRounds = 0;
  const maxRounds = numRounds * 3;
  let currentTime = startTime;

  const recordMatch = (t1, t2, matchupKey, usedSet, clubUsage, roundNum) => {
    playedMatchups.add(matchupKey);
    teamFixtureCounts[t1.id]++;
    teamFixtureCounts[t2.id]++;
    usedSet.add(t1.id);
    usedSet.add(t2.id);
    clubMatchupsPerTeam[t1.id].add(t2.club);
    clubMatchupsPerTeam[t2.id].add(t1.club);
    clubUsage[t1.club] = (clubUsage[t1.club] || 0) + 1;
    clubUsage[t2.club] = (clubUsage[t2.club] || 0) + 1;
    teamLastPlayedRound[t1.id] = roundNum;
    teamLastPlayedRound[t2.id] = roundNum;
  };

  // Phase 1 & 2: Round-by-round generation
  let stoppedByEndTime = false;
  while (totalRounds < maxRounds) {
    // Stop if this round would finish after the end time
    if (endTime) {
      const roundEndTime = addMinutes(currentTime, matchDuration);
      if (roundEndTime > endTime) {
        stoppedByEndTime = true;
        break;
      }
    }

    const teamsNeedingMatches = teamList.filter(t => teamFixtureCounts[t.id] < numRounds);
    if (teamsNeedingMatches.length === 0) break;

    const usedTeamsThisRound = new Set();
    const clubUsageThisRound = {};
    const isPreLunch = lunchEnabled && currentTime < lunchStart;
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

        const match = findBestMatch(availableInZone, playedMatchups, clubMatchupsPerTeam, teamFixtureCounts, numRounds, adjacency, clubUsageThisRound, teamLastPlayedRound, totalRounds, isPreLunch);
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
        recordMatch(t1, t2, matchupKey, usedTeamsThisRound, clubUsageThisRound, totalRounds);
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

        const match = findBestMatch(candidates, playedMatchups, clubMatchupsPerTeam, teamFixtureCounts, numRounds, adjacency, clubUsageThisRound, teamLastPlayedRound, totalRounds, isPreLunch);
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
        recordMatch(t1, t2, matchupKey, usedTeamsThisRound, clubUsageThisRound, totalRounds);
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

  // Minimum match enforcement: backfill spare pitch slots for under-served teams
  const allPitches = zoneList.flatMap(z => z.pitches);
  let relaxedMatchCount = 0;

  // Build per-round state from generated fixtures
  const roundsMap = new Map();
  allFixtures.forEach(f => {
    if (!roundsMap.has(f.round)) {
      roundsMap.set(f.round, { filledPitches: new Set(), usedTeams: new Set(), time: f.time });
    }
    const rd = roundsMap.get(f.round);
    rd.filledPitches.add(f.pitch);
    rd.usedTeams.add(f.team1.id);
    rd.usedTeams.add(f.team2.id);
  });

  // Sort rounds by fewest fixtures (most spare capacity first)
  const sortedRounds = [...roundsMap.entries()].sort(
    (a, b) => a[1].filledPitches.size - b[1].filledPitches.size
  );

  for (const [roundNum, roundData] of sortedRounds) {
    const sparePitches = allPitches.filter(p => !roundData.filledPitches.has(p));
    if (sparePitches.length === 0) continue;

    for (const pitch of sparePitches) {
      const eligibleTeams = teamList.filter(
        t => teamFixtureCounts[t.id] < effectiveMin && !roundData.usedTeams.has(t.id)
      );
      if (eligibleTeams.length < 2) break;

      // Try strict matching first (no exact rematches)
      let match = findBestMatch(eligibleTeams, playedMatchups, clubMatchupsPerTeam, teamFixtureCounts, numRounds, adjacency, {}, teamLastPlayedRound, roundNum - 1, false);

      // Relax: allow rematches if strict yields nothing
      if (!match) {
        match = findBestMatch(eligibleTeams, new Set(), clubMatchupsPerTeam, teamFixtureCounts, numRounds, adjacency, {}, teamLastPlayedRound, roundNum - 1, false);
        if (match) relaxedMatchCount++;
      }

      if (!match) continue;

      const { t1, t2, matchupKey } = match;
      const zone = zoneList.find(z => z.pitches.includes(pitch)) || zoneList[0];
      allFixtures.push({
        id: `fixture-backfill-${roundNum}-${pitch}`,
        round: roundNum,
        pitch,
        time: roundData.time,
        team1: t1,
        team2: t2,
        zone: zone.id,
        isCrossZone: t1.zone !== t2.zone,
      });
      recordMatch(t1, t2, matchupKey, roundData.usedTeams, {}, roundNum - 1);
      roundData.filledPitches.add(pitch);
    }
  }

  // Pass B: Aggressive guarantee — pair under-minimum teams with ANY available partner
  let passB = 0;
  let changed = true;
  while (changed) {
    changed = false;
    const underMin = teamList.filter(t => teamFixtureCounts[t.id] < effectiveMin);
    if (underMin.length === 0) break;

    for (const team of underMin) {
      if (teamFixtureCounts[team.id] >= effectiveMin) continue;

      for (const [roundNum, roundData] of sortedRounds) {
        if (teamFixtureCounts[team.id] >= effectiveMin) break;
        if (roundData.usedTeams.has(team.id)) continue;

        const sparePitches = allPitches.filter(p => !roundData.filledPitches.has(p));
        if (sparePitches.length === 0) continue;

        const partners = teamList.filter(
          t => t.id !== team.id && !roundData.usedTeams.has(t.id)
              && t.club !== team.club
        );
        if (partners.length === 0) continue;

        let match = null;
        for (const p of partners) {
          const key = [team.id, p.id].sort().join('-');
          if (!playedMatchups.has(key)) {
            match = { t1: team, t2: p, matchupKey: key };
            break;
          }
        }

        if (!match) {
          const p = partners[0];
          const key = [team.id, p.id].sort().join('-');
          match = { t1: team, t2: p, matchupKey: key };
          relaxedMatchCount++;
        }

        const pitch = sparePitches[0];
        const zone = zoneList.find(z => z.pitches.includes(pitch)) || zoneList[0];
        allFixtures.push({
          id: `fixture-backfill2-${roundNum}-${pitch}`,
          round: roundNum,
          pitch,
          time: roundData.time,
          team1: match.t1,
          team2: match.t2,
          zone: zone.id,
          isCrossZone: match.t1.zone !== match.t2.zone,
        });
        recordMatch(match.t1, match.t2, match.matchupKey, roundData.usedTeams, {}, roundNum - 1);
        roundData.filledPitches.add(pitch);
        passB++;
        changed = true;
      }
    }
  }

  // Pass C: Create extra round(s) for teams still below minimum when all pitch slots are full
  let passC = 0;
  const stillUnderC = () => teamList.filter(t => teamFixtureCounts[t.id] < effectiveMin);
  if (stillUnderC().length > 0) {
    const maxRound = Math.max(...[...roundsMap.keys()]);
    const lastTime = roundsMap.get(maxRound).time;
    let extraRoundNum = maxRound + 1;
    let extraTime = getNextAvailableTime(addMinutes(lastTime, matchDuration), lunchEnabled, lunchStart, lunchEnd);

    let under = stillUnderC();
    while (under.length > 0) {
      const usedTeams = new Set();
      const usedPitches = new Set();
      let addedAny = false;

      for (const team of under) {
        if (usedTeams.has(team.id)) continue;

        // Prefer under-minimum partners; fall back to any different-club team
        const partners = teamList
          .filter(t => t.id !== team.id && t.club !== team.club && !usedTeams.has(t.id))
          .sort((a, b) => teamFixtureCounts[a.id] - teamFixtureCounts[b.id]);
        if (partners.length === 0) continue;

        const pitch = allPitches.find(p => !usedPitches.has(p));
        if (!pitch) break;

        const partner = partners[0];
        const matchupKey = [team.id, partner.id].sort().join('-');
        const zone = zoneList.find(z => z.pitches.includes(pitch)) || zoneList[0];

        allFixtures.push({
          id: `fixture-passc-${extraRoundNum}-${pitch}`,
          round: extraRoundNum,
          pitch,
          time: extraTime,
          team1: team,
          team2: partner,
          zone: zone.id,
          isCrossZone: team.zone !== partner.zone,
        });
        usedTeams.add(team.id);
        usedTeams.add(partner.id);
        usedPitches.add(pitch);
        teamFixtureCounts[team.id]++;
        teamFixtureCounts[partner.id]++;
        playedMatchups.add(matchupKey);
        passC++;
        addedAny = true;
      }

      if (!addedAny) break;
      under = stillUnderC();
      if (under.length > 0) {
        extraRoundNum++;
        extraTime = getNextAvailableTime(addMinutes(extraTime, matchDuration), lunchEnabled, lunchStart, lunchEnd);
      }
    }
  }

  // Assign referees to all fixtures
  assignReferees(allFixtures, zoneList);

  // Build summary
  const fixtureCounts = Object.values(teamFixtureCounts);
  const minFixtures = Math.min(...fixtureCounts);
  const maxFixtures = Math.max(...fixtureCounts);
  const avgFixtures = (fixtureCounts.reduce((a, b) => a + b, 0) / fixtureCounts.length).toFixed(1);
  const teamsWithTarget = fixtureCounts.filter(c => c === numRounds).length;
  const teamsUnderMinimum = teamList.filter(t => teamFixtureCounts[t.id] < effectiveMin);

  const intraZoneCount = allFixtures.filter(f => !f.isCrossZone).length;
  const crossZoneCount = allFixtures.filter(f => f.isCrossZone).length;
  const intraPercent = allFixtures.length > 0 ? Math.round(intraZoneCount / allFixtures.length * 100) : 0;

  const conflictCount = allFixtures.filter(f => f.refereeConflict).length;
  const unassignedCount = allFixtures.filter(f => !f.referee).length;

  const displayRounds = new Set(allFixtures.map(f => f.round)).size;

  let summary = `Generated ${allFixtures.length} fixtures across ${displayRounds} rounds in ${zoneList.length} zones. `;
  summary += `Teams have ${minFixtures}-${maxFixtures} matches (avg: ${avgFixtures}). `;
  summary += `${teamsWithTarget}/${teamList.length} teams have exactly ${numRounds} matches. `;
  summary += `${intraPercent}% intra-zone, ${100 - intraPercent}% cross-zone. `;
  summary += `Referees: ${allFixtures.length - conflictCount} clean, ${conflictCount - unassignedCount} conflicts, ${unassignedCount} unassigned.`;
  if (stoppedByEndTime) {
    summary += ` Schedule limited by end time (${endTime}).`;
  }
  if (relaxedMatchCount > 0) {
    summary += ` Backfill used ${relaxedMatchCount} rematch(es) to meet minimum.`;
  }
  if (passB > 0) {
    summary += ` Pass B added ${passB} match(es) to guarantee minimum.`;
  }
  if (passC > 0) {
    summary += ` Pass C added ${passC} match(es) in an extra round to guarantee minimum.`;
  }
  if (teamsUnderMinimum.length > 0) {
    summary += ` WARNING: ${teamsUnderMinimum.length} team(s) could not reach the minimum of ${effectiveMin} matches even after backfill: ${teamsUnderMinimum.map(t => t.name).join(', ')}.`;
  }

  return { fixtures: allFixtures, teams: teamList, zones: zoneList, summary, teamsUnderMinimum };
};
