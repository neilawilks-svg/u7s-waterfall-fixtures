import React from 'react';
import { Search } from '../icons';

export default function TeamSearch({ searchTerm, setSearchTerm, filteredTeams, setSelectedTeam }) {
  return (
    <>
      <div className="relative">
        <Search className="absolute left-3 top-3 text-[#7c1229]" size={20} />
        <input type="text" placeholder="Search for your team..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-lg text-gray-900 text-lg" />
      </div>
      {searchTerm && (
        <div className="mt-2 bg-white rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredTeams.map(team => (
            <button key={team.id} onClick={() => { setSelectedTeam(team); setSearchTerm(''); }} className="w-full px-4 py-3 text-left hover:bg-[#7c1229]/5 border-b border-gray-100 text-gray-900">
              <div className="font-medium">{team.name}</div>
              <div className="text-sm text-gray-600">Club: {team.club}</div>
              {team.zone && <div className="text-sm text-[#7c1229] font-medium">Zone {team.zone}</div>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
