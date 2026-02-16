import React from 'react';
import { computePitchGrid } from '../../utils/zones';

const ZONE_COLORS = {
  A: 'bg-red-100 border-red-400 text-red-800',
  B: 'bg-blue-100 border-blue-400 text-blue-800',
  C: 'bg-green-100 border-green-400 text-green-800',
  D: 'bg-yellow-100 border-yellow-400 text-yellow-800',
  E: 'bg-purple-100 border-purple-400 text-purple-800',
  F: 'bg-pink-100 border-pink-400 text-pink-800',
  G: 'bg-indigo-100 border-indigo-400 text-indigo-800',
  H: 'bg-orange-100 border-orange-400 text-orange-800',
};

export default function PitchLayoutViz({ zones }) {
  if (zones.length === 0) return null;

  const activePitchCount = zones.length * 2;
  const grid = computePitchGrid(activePitchCount);
  const numCols = Math.min(4, Math.ceil(activePitchCount / 4) > 0 ? 4 : 2);
  const numRows = Math.ceil(activePitchCount / numCols);
  const pitchToZone = {};
  zones.forEach(z => { z.pitches.forEach(p => { pitchToZone[p] = z.id; }); });
  const gridCells = [];
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const entry = Object.entries(grid).find(([_, pos]) => pos[0] === r && pos[1] === c);
      gridCells.push(entry ? { pitch: parseInt(entry[0]), row: r, col: c } : null);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Pitch Layout & Zones</h2>
      <div>
        <div className="inline-grid gap-2 mb-6" style={{ gridTemplateColumns: `repeat(${numCols}, 1fr)` }}>
          {gridCells.map((cell, idx) => {
            if (!cell) return <div key={idx}></div>;
            const zId = pitchToZone[cell.pitch];
            const colorClass = ZONE_COLORS[zId] || 'bg-gray-100 border-gray-300 text-gray-700';
            return (
              <div key={idx} className={`${colorClass} border-2 rounded-lg p-3 text-center min-w-[80px]`}>
                <div className="text-lg font-bold">P{cell.pitch}</div>
                <div className="text-xs font-medium">Zone {zId}</div>
              </div>
            );
          })}
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-3">Zone Assignments</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {zones.map(zone => {
            const colorClass = ZONE_COLORS[zone.id] || 'bg-gray-100 border-gray-300';
            return (
              <div key={zone.id} className={`${colorClass} border-2 rounded-lg p-3`}>
                <h4 className="font-bold text-lg">Zone {zone.id}</h4>
                <p className="text-sm mb-2">Pitches {zone.pitches.join(' & ')}</p>
                <ul className="text-sm space-y-1">
                  {zone.teams.map(t => (
                    <li key={t.id}>{t.name} <span className="opacity-60">({t.club})</span></li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
