export const loadTeamsFromCSV = (csvText) => {
  const lines = csvText.split('\n');
  const loadedTeams = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split(',').map(col => col.replace(/^"|"$/g, '').trim());

    const clubName = columns[0];
    const numTeams = parseInt(columns[1]) || 0;

    for (let t = 0; t < numTeams && t < 5; t++) {
      const teamName = columns[2 + t];
      if (teamName && teamName.trim() !== '') {
        loadedTeams.push({
          id: `team-${loadedTeams.length}`,
          name: teamName.trim(),
          club: clubName,
          pitchAssignment: null
        });
      }
    }
  }

  return loadedTeams;
};
