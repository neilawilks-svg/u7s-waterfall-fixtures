import React from 'react';
import { MapPin } from '../icons';

export default function TeamDetail({ selectedTeam, teamFixtures, fixtures, zones }) {
  const refDuties = fixtures.filter(f => f.referee && f.referee.id === selectedTeam.id);

  // Build combined schedule
  const schedule = [];
  teamFixtures.forEach((f, idx) => {
    const opponent = f.team1.id === selectedTeam.id ? f.team2 : f.team1;
    schedule.push({ ...f, type: 'PLAY', opponent, matchNum: idx + 1 });
  });
  refDuties.forEach(f => {
    schedule.push({ ...f, type: 'REF' });
  });
  schedule.sort((a, b) => a.time.localeCompare(b.time) || (a.type === 'PLAY' ? -1 : 1));

  return (
    <div>
      <div className="bg-white rounded-lg shadow-lg mb-4 overflow-hidden">
        <div className="p-4">
          <h2 className="text-xl font-bold text-gray-900">{selectedTeam.name}</h2>
          <p className="text-gray-600">Club: {selectedTeam.club}</p>
          {selectedTeam.zone && (
            <p className="text-[#7c1229] font-semibold text-lg mt-1">
              Zone {selectedTeam.zone} (Pitches {zones.find(z => z.id === selectedTeam.zone)?.pitches.join(' & ')})
            </p>
          )}
          <p className="text-[#7c1229] font-medium mt-1">{teamFixtures.length} matches, {refDuties.length} ref duties</p>
          {selectedTeam.zone && (() => {
            const teamZone = zones.find(z => z.id === selectedTeam.zone);
            if (!teamZone) return null;
            const groupMembers = teamZone.teams.filter(t => t.id !== selectedTeam.id);
            if (groupMembers.length === 0) return null;
            return (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="text-xs font-semibold text-gray-500">Group {selectedTeam.zone}:</span>
                  {groupMembers.map(t => (
                    <span key={t.id} className="px-2 py-0.5 bg-[#7c1229]/10 text-[#7c1229] rounded-full text-xs font-medium">
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      <div className="space-y-3">
        {schedule.map((item) => {
          if (item.type === 'PLAY') {
            const isAway = selectedTeam.zone && item.zone !== selectedTeam.zone;
            return (
              <div key={item.id + '-play'} className={`rounded-lg shadow p-4 ${isAway ? 'bg-amber-50 border-2 border-amber-400' : 'bg-white'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold text-[#7c1229]">{item.time}</span>
                  <span className="text-lg font-medium text-gray-700">Match {item.matchNum}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={18} className={isAway ? 'text-amber-600' : 'text-gray-500'} />
                  <span className="font-medium text-gray-900">Pitch {item.pitch}</span>
                  {item.zone && (
                    isAway ? (
                      <span className="px-2 py-0.5 bg-amber-500 text-white rounded text-xs font-bold">
                        AWAY - Zone {item.zone}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-[#7c1229]/10 text-[#7c1229] rounded text-xs font-medium">
                        Zone {item.zone}
                      </span>
                    )
                  )}
                </div>
                <div className="text-gray-700">
                  <span className="font-medium">{item.team1.name}</span> <span className="text-gray-500">vs</span> <span className="font-medium">{item.team2.name}</span>
                </div>
                {item.referee && (
                  <div className="text-xs text-gray-500 mt-1">Referee: {item.referee.name}</div>
                )}
              </div>
            );
          } else {
            return (
              <div key={item.id + '-ref'} title={`A coach from ${selectedTeam.name} is required to referee this match`} className={`rounded-lg shadow p-4 border-2 ${item.refereeConflict ? 'bg-red-50 border-red-400' : 'bg-blue-50 border-blue-400'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold text-gray-600">{item.time}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.refereeConflict ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>
                    {item.refereeConflict ? 'REF DUTY - CONFLICT' : 'REF DUTY'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={18} className="text-gray-500" />
                  <span className="font-medium text-gray-900">Pitch {item.pitch}</span>
                  {item.zone && (
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-medium">
                      Zone {item.zone}
                    </span>
                  )}
                </div>
                <div className="text-gray-700 text-sm">
                  {item.team1.name} vs {item.team2.name}
                </div>
                <div className="text-xs text-blue-700 mt-1">Your coach is needed to referee this game</div>
                {item.refereeConflict && (
                  <div className="text-xs text-red-600 font-medium mt-1">Your team is also playing this round</div>
                )}
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}
