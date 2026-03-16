import React from 'react';
import { Download, RefreshCw } from '../icons';
import { downloadFixturesAsExcel, downloadClubPackPDF, downloadAllClubPacksPDF, printFixtures } from '../../utils/exports';

export default function FixturesTable({
  fixtures, teams, zones,
  loading, swapMode, setSwapMode,
  swapTeamsInFixture, regenerateRound,
  fixtureSwapMode, setFixtureSwapMode,
  swapFixturesBetweenRounds,
  setError,
  lunchEnabled, lunchStart, lunchEnd,
}) {
  if (fixtures.length === 0) return null;

  const rounds = [...new Set(fixtures.map(f => f.round))].sort((a, b) => a - b);
  const clubs = [...new Set(teams.map(t => t.club))].sort();

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Generated Fixtures ({fixtures.length} matches)</h2>
        <div className="flex gap-2 flex-wrap">
          <div className="text-sm text-gray-600 self-center">{teams.length} teams</div>
          <button onClick={() => downloadFixturesAsExcel(fixtures, teams, zones, setError)} className="flex items-center gap-2 px-4 py-2 bg-[#7c1229] text-white rounded-lg hover:bg-[#a01638]">
            <Download size={18} />
            Excel
          </button>
          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800">
              <Download size={18} />
              Club Pack
            </button>
            <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-10 w-56 max-h-72 overflow-y-auto">
              <button
                onClick={() => downloadAllClubPacksPDF(fixtures, teams, setError, lunchEnabled, lunchStart, lunchEnd)}
                className="w-full flex items-center gap-2 px-4 py-2 border-b-2 border-gray-300 hover:bg-green-50 text-sm text-green-800 font-semibold"
              >
                <Download size={14} className="flex-shrink-0" />
                Download All Clubs
              </button>
              {clubs.map(club => (
                <button
                  key={club}
                  onClick={() => downloadClubPackPDF(club, fixtures, teams, setError, lunchEnabled, lunchStart, lunchEnd)}
                  className="w-full flex items-center gap-2 px-4 py-2 border-b border-gray-100 hover:bg-gray-50 text-sm text-gray-900 font-medium"
                >
                  <Download size={14} className="text-gray-500 flex-shrink-0" />
                  {club}
                </button>
              ))}
            </div>
          </div>
          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800">
              Print
            </button>
            <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-10 w-48">
              <button onClick={() => printFixtures('byRound', fixtures, teams, zones)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 rounded-t-lg">By Round</button>
              <button onClick={() => printFixtures('byPitch', fixtures, teams, zones)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">By Pitch</button>
              <button onClick={() => printFixtures('byTeam', fixtures, teams, zones)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 rounded-b-lg">By Team</button>
            </div>
          </div>
        </div>
      </div>

      {swapMode && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <span className="text-blue-800 text-sm font-medium">
            Swap mode: Click another team to swap with {swapMode.teamName}
          </span>
          <button onClick={() => setSwapMode(null)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Cancel</button>
        </div>
      )}
      {fixtureSwapMode && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between">
          <span className="text-purple-800 text-sm font-medium">
            Fixture swap: click any other fixture to swap its round position with{' '}
            <strong>{fixtureSwapMode.team1Name} vs {fixtureSwapMode.team2Name}</strong>{' '}
            (currently Round {fixtureSwapMode.round})
          </span>
          <button onClick={() => setFixtureSwapMode(null)} className="px-3 py-1 bg-purple-600 text-white rounded text-sm">Cancel</button>
        </div>
      )}

      {rounds.map(round => {
        const roundFixtures = fixtures.filter(f => f.round === round).sort((a, b) => a.pitch - b.pitch);
        return (
          <div key={round} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-gray-800">Round {round} - {roundFixtures[0]?.time}</h3>
              <button
                onClick={() => regenerateRound(round)}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:bg-gray-400"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Re-generate
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Pitch</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Zone</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Team 1</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Team 2</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Referee</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 w-16">Swap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {roundFixtures.map(f => (
                    <tr
                      key={f.id}
                      className={`hover:bg-gray-50 ${f.refereeConflict ? 'bg-red-50' : ''} ${swapMode && swapMode.fixtureId !== f.id && swapMode.round === round ? 'bg-blue-50/50' : ''} ${fixtureSwapMode && fixtureSwapMode.fixtureId !== f.id ? 'bg-purple-50/40 cursor-pointer' : ''}`}
                      onClick={fixtureSwapMode && fixtureSwapMode.fixtureId !== f.id ? () => swapFixturesBetweenRounds(f.id) : undefined}
                    >
                      <td className="px-4 py-2 text-sm font-medium">Pitch {f.pitch}</td>
                      <td className="px-4 py-2 text-sm">
                        {f.zone && <span className={f.isCrossZone ? 'text-amber-600 font-medium' : 'font-medium'}>Zone {f.zone}{f.isCrossZone ? ' *' : ''}</span>}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {swapMode && swapMode.fixtureId !== f.id && swapMode.round === round ? (
                          <button onClick={() => swapTeamsInFixture(f.id, f.team1.id)} className="text-blue-600 underline hover:text-blue-800">{f.team1.name}</button>
                        ) : f.team1.name}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {swapMode && swapMode.fixtureId !== f.id && swapMode.round === round ? (
                          <button onClick={() => swapTeamsInFixture(f.id, f.team2.id)} className="text-blue-600 underline hover:text-blue-800">{f.team2.name}</button>
                        ) : f.team2.name}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {f.referee ? (
                          <span className={f.refereeConflict ? 'text-red-600 font-medium' : 'text-green-700'}>
                            {f.referee.name}{f.refereeConflict ? ' !' : ''}
                          </span>
                        ) : (
                          <span className="text-red-500 font-medium">NONE</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setSwapMode({ fixtureId: f.id, slot: 1, teamName: f.team1.name, round })}
                            className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300 disabled:opacity-40"
                            title={`Swap ${f.team1.name}`}
                            disabled={!!fixtureSwapMode}
                          >1</button>
                          <button
                            onClick={() => setSwapMode({ fixtureId: f.id, slot: 2, teamName: f.team2.name, round })}
                            className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300 disabled:opacity-40"
                            title={`Swap ${f.team2.name}`}
                            disabled={!!fixtureSwapMode}
                          >2</button>
                          <button
                            onClick={() => setFixtureSwapMode({ fixtureId: f.id, team1Name: f.team1.name, team2Name: f.team2.name, round })}
                            className="px-1.5 py-0.5 bg-purple-200 text-purple-800 rounded text-xs hover:bg-purple-300 disabled:opacity-40"
                            title="Swap this fixture's round position with another fixture"
                            disabled={!!swapMode}
                          >↕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
