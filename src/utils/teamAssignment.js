export const assignTeamsToZones = (teamList, zoneList) => {
  const numZones = zoneList.length;
  const maxPerZone = Math.ceil(teamList.length / numZones);
  const clubGroups = {};
  teamList.forEach(t => {
    if (!clubGroups[t.club]) clubGroups[t.club] = [];
    clubGroups[t.club].push(t);
  });
  const sortedClubs = Object.keys(clubGroups).sort(
    (a, b) => clubGroups[b].length - clubGroups[a].length
  );
  zoneList.forEach(z => { z.teams = []; });
  let globalOffset = 0;
  sortedClubs.forEach(club => {
    const clubTeams = clubGroups[club];
    let zoneIdx = globalOffset;
    clubTeams.forEach(team => {
      let placed = false;
      for (let attempt = 0; attempt < numZones; attempt++) {
        const candidateIdx = (zoneIdx + attempt) % numZones;
        if (zoneList[candidateIdx].teams.length < maxPerZone) {
          zoneList[candidateIdx].teams.push(team);
          team.zone = zoneList[candidateIdx].id;
          zoneIdx = (candidateIdx + 1) % numZones;
          placed = true;
          break;
        }
      }
      if (!placed) {
        const leastFull = zoneList.reduce((a, b) => a.teams.length <= b.teams.length ? a : b);
        leastFull.teams.push(team);
        team.zone = leastFull.id;
      }
    });
    globalOffset = (globalOffset + 1) % numZones;
  });
  return zoneList;
};

export const findBestMatch = (candidates, playedMatchups, clubMatchupsPerTeam, teamFixtureCounts, targetRounds, adjacency) => {
  let bestMatch = null;
  let bestScore = -Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const t1 = candidates[i];
    for (let j = i + 1; j < candidates.length; j++) {
      const t2 = candidates[j];
      const matchupKey = [t1.id, t2.id].sort().join('-');
      if (t1.club === t2.club) continue;
      if (playedMatchups.has(matchupKey)) continue;
      const t1PlayedClub = clubMatchupsPerTeam[t1.id].has(t2.club);
      const t2PlayedClub = clubMatchupsPerTeam[t2.id].has(t1.club);
      let score = 1000;
      if (!t1PlayedClub && !t2PlayedClub) score += 100;
      else if (!t1PlayedClub || !t2PlayedClub) score += 50;
      else score -= 100;
      score += (targetRounds - teamFixtureCounts[t1.id]) * 20;
      score += (targetRounds - teamFixtureCounts[t2.id]) * 20;
      score += (10 - clubMatchupsPerTeam[t1.id].size) * 5;
      score += (10 - clubMatchupsPerTeam[t2.id].size) * 5;
      if (t1.zone && t2.zone) {
        if (t1.zone === t2.zone) {
          score += 200;
        } else if (adjacency && adjacency[t1.zone] && adjacency[t1.zone].indexOf(t2.zone) < 2) {
          score += 50;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { t1, t2, matchupKey };
      }
    }
  }
  return bestMatch;
};
