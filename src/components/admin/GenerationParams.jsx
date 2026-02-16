import React from 'react';
import { RefreshCw } from '../icons';

export default function GenerationParams({
  numRounds, setNumRounds,
  numPitches, setNumPitches,
  matchDuration, setMatchDuration,
  startTime, setStartTime,
  lunchEnabled, setLunchEnabled,
  lunchStart, setLunchStart,
  lunchEnd, setLunchEnd,
  loading, generateFixtures,
}) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Number of Rounds</label>
          <input type="number" value={numRounds} onChange={(e) => setNumRounds(parseInt(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" min="4" max="12" />
          <p className="text-xs text-gray-600 mt-1">Matches per team</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Number of Pitches</label>
          <input type="number" value={numPitches} onChange={(e) => setNumPitches(parseInt(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" min="4" max="20" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Match Duration (mins)</label>
          <input type="number" value={matchDuration} onChange={(e) => setMatchDuration(parseInt(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" min="10" max="20" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
      </div>
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <input type="checkbox" id="lunchEnabled" checked={lunchEnabled} onChange={(e) => setLunchEnabled(e.target.checked)} className="w-4 h-4" />
          <label htmlFor="lunchEnabled" className="font-semibold text-amber-900">Schedule Lunch Break</label>
        </div>
        {lunchEnabled && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lunch Start</label>
              <input type="time" value={lunchStart} onChange={(e) => setLunchStart(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lunch End</label>
              <input type="time" value={lunchEnd} onChange={(e) => setLunchEnd(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>
        )}
      </div>
      <button onClick={generateFixtures} disabled={loading} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Generating...' : 'Generate Fixtures'}
      </button>
    </>
  );
}
