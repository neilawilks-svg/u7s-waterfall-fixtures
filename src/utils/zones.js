export const computePitchGrid = (totalPitches, numColumns = 4) => {
  const pitchesPerColumn = Math.ceil(totalPitches / numColumns);
  const positions = {};
  let pitchNum = 1;
  for (let col = 0; col < numColumns && pitchNum <= totalPitches; col++) {
    for (let row = 0; row < pitchesPerColumn && pitchNum <= totalPitches; row++) {
      const actualRow = (col % 2 === 0)
        ? (pitchesPerColumn - 1 - row)
        : row;
      positions[pitchNum] = [actualRow, col];
      pitchNum++;
    }
  }
  return positions;
};

export const computeZones = (totalPitches) => {
  const numZones = Math.floor(totalPitches / 2);
  const zoneLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const zoneList = [];
  for (let z = 0; z < numZones; z++) {
    zoneList.push({
      id: zoneLabels[z],
      pitches: [z * 2 + 1, z * 2 + 2],
      teams: [],
    });
  }
  return zoneList;
};

export const computeZoneAdjacency = (zoneList, pitchGrid) => {
  const zoneCenters = zoneList.map(z => {
    const p1 = pitchGrid[z.pitches[0]] || [0, 0];
    const p2 = pitchGrid[z.pitches[1]] || [0, 0];
    return { id: z.id, row: (p1[0] + p2[0]) / 2, col: (p1[1] + p2[1]) / 2 };
  });
  const adjacencyMap = {};
  zoneCenters.forEach(zc => {
    adjacencyMap[zc.id] = zoneCenters
      .filter(other => other.id !== zc.id)
      .sort((a, b) => {
        const distA = Math.abs(a.row - zc.row) + Math.abs(a.col - zc.col);
        const distB = Math.abs(b.row - zc.row) + Math.abs(b.col - zc.col);
        return distA - distB;
      })
      .map(other => other.id);
  });
  return adjacencyMap;
};
