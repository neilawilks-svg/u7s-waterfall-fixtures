import React from 'react';

export default function FixtureHistory({ fixtureHistory, restoreFromHistory }) {
  if (fixtureHistory.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-3">Fixture History (Undo)</h2>
      <div className="space-y-2">
        {fixtureHistory.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <span className="text-sm font-medium text-gray-700">{entry.fixtures.length} fixtures</span>
              <span className="text-sm text-gray-500 ml-2">saved {new Date(entry.timestamp).toLocaleTimeString()}</span>
            </div>
            <button onClick={() => restoreFromHistory(idx)} className="px-3 py-1 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600">
              Restore
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
