import React from 'react';
import { MapPin } from '../icons';

function FixtureCard({ f, variant }) {
  const borderClass = variant === 'current' ? 'bg-white rounded-lg shadow-lg p-4 border-l-4 border-red-500' :
    'bg-white rounded-lg shadow p-4';
  const timeClass = variant === 'current' ? 'text-xl font-bold text-gray-900' : 'text-xl font-bold text-[#7c1229]';
  const nameSize = variant === 'current' ? '' : 'text-sm';
  const refSize = variant === 'current' ? 'text-xs mt-2' : 'text-xs mt-1';

  return (
    <div className={borderClass}>
      <div className="flex items-center justify-between mb-2">
        <span className={timeClass}>{f.time}</span>
        <span className="flex items-center gap-1 font-medium text-gray-700">
          <MapPin size={16} />
          Pitch {f.pitch}
          {f.zone && <span className="text-xs text-[#7c1229] ml-1">(Zone {f.zone})</span>}
        </span>
      </div>
      <div className={`text-gray-900 ${nameSize}`}>
        <div className={variant === 'current' ? 'font-medium' : ''}>{f.team1.name}</div>
        <div className={`text-gray-500 ${variant === 'current' ? 'text-sm my-1' : 'my-1'}`}>vs</div>
        <div className={variant === 'current' ? 'font-medium' : ''}>{f.team2.name}</div>
      </div>
      {f.referee && (
        <div className={`${refSize} ${f.refereeConflict ? 'text-red-600 font-medium' : variant === 'current' ? 'text-gray-500' : 'text-gray-400'}`}>
          Ref: {f.referee.name}{f.refereeConflict ? ' (conflict)' : ''}
        </div>
      )}
    </div>
  );
}

export default function FixtureList({ current, upcoming, allFixtures, outsideSchedule }) {
  return (
    <>
      {outsideSchedule && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <p className="text-blue-800 font-medium">No matches currently in progress - showing all fixtures</p>
        </div>
      )}
      {current.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            Playing Now
          </h2>
          <div className="space-y-3">
            {current.map(f => <FixtureCard key={f.id} f={f} variant="current" />)}
          </div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Up Next</h2>
          <div className="space-y-3">
            {upcoming.map(f => <FixtureCard key={f.id} f={f} variant="upcoming" />)}
          </div>
        </div>
      )}
      {outsideSchedule && allFixtures.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">All Fixtures</h2>
          <div className="space-y-3">
            {allFixtures.map(f => <FixtureCard key={f.id} f={f} variant="all" />)}
          </div>
        </div>
      )}
    </>
  );
}
