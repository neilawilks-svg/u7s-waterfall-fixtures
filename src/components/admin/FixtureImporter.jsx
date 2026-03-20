import React, { useRef, useState } from 'react';
import { Download, RefreshCw } from '../icons';
import { downloadImportTemplate } from '../../utils/fixtureImporter';

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 shrink-0">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 shrink-0">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function AnalysisRow({ ok, info, label, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`px-4 py-2.5 ${ok === false ? 'bg-amber-50' : ''}`}>
      <div
        className={`flex items-center gap-2 text-sm ${children ? 'cursor-pointer select-none' : ''}`}
        onClick={children ? () => setOpen(v => !v) : undefined}
      >
        {ok === true && <CheckIcon />}
        {ok === false && <WarnIcon />}
        {ok === 'info' && <InfoIcon />}
        <span className={`flex-1 ${ok === false ? 'font-medium text-amber-800' : ok === true ? 'text-gray-700' : 'text-gray-700'}`}>
          {label}
        </span>
        {children && (
          <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
        )}
      </div>
      {open && children && (
        <div className="mt-1.5 ml-6 text-xs text-gray-600 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

function AnalysisPanel({ analysis }) {
  const {
    duplicates,
    sameClubFixtures,
    repeatOpponentClub,
    matchCounts,
    refereeClashes,
    extendedBreaks,
    crossZone,
    clubSpread,
  } = analysis;

  // Match count distribution summary
  const distEntries = Object.entries(matchCounts.distribution).sort(([a], [b]) => Number(a) - Number(b));
  const distLabel = distEntries.map(([n, teams]) => `${teams.length} team${teams.length !== 1 ? 's' : ''} × ${n}`).join(', ');

  return (
    <div className="mt-5 border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800">Schedule Analysis</h3>
      </div>
      <div className="divide-y divide-gray-100">

        {/* 1. Duplicates */}
        <AnalysisRow
          ok={duplicates.length === 0}
          label={duplicates.length === 0 ? 'No duplicate matchups' : `${duplicates.length} duplicate matchup${duplicates.length !== 1 ? 's' : ''}`}
        >
          {duplicates.length > 0 && duplicates.map((d, i) => (
            <div key={i}>{d.team1} vs {d.team2} — rounds {d.rounds.join(' & ')}</div>
          ))}
        </AnalysisRow>

        {/* 2. Same-club fixtures */}
        <AnalysisRow
          ok={sameClubFixtures.length === 0}
          label={sameClubFixtures.length === 0 ? 'No same-club fixtures' : `${sameClubFixtures.length} same-club fixture${sameClubFixtures.length !== 1 ? 's' : ''}`}
        >
          {sameClubFixtures.length > 0 && sameClubFixtures.map((f, i) => (
            <div key={i}>Rd {f.round}: {f.team1} vs {f.team2} ({f.club})</div>
          ))}
        </AnalysisRow>

        {/* 3. Repeat opponent club */}
        <AnalysisRow
          ok={repeatOpponentClub.length === 0}
          label={repeatOpponentClub.length === 0
            ? 'No repeat opponent clubs'
            : `${repeatOpponentClub.length} team${repeatOpponentClub.length !== 1 ? 's' : ''} face a club more than once`}
        >
          {repeatOpponentClub.length > 0 && repeatOpponentClub.map((r, i) => (
            <div key={i}>{r.team} faces {r.club} × {r.count}</div>
          ))}
        </AnalysisRow>

        {/* 4. Match count balance */}
        <AnalysisRow
          ok={matchCounts.isBalanced}
          label={matchCounts.isBalanced
            ? `Balanced match counts — ${distLabel}`
            : `Unbalanced match counts (${matchCounts.min}–${matchCounts.max}) — ${distLabel}`}
        >
          {!matchCounts.isBalanced && distEntries.map(([n, teamList]) => (
            <div key={n}>{n} matches: {teamList.join(', ')}</div>
          ))}
        </AnalysisRow>

        {/* 5. Referee clashes */}
        <AnalysisRow
          ok={refereeClashes.length === 0}
          label={refereeClashes.length === 0 ? 'No referee clashes' : `${refereeClashes.length} referee clash${refereeClashes.length !== 1 ? 'es' : ''}`}
        >
          {refereeClashes.length > 0 && refereeClashes.map((c, i) => (
            <div key={i}>Rd {c.round}: {c.referee} refs {c.team1} vs {c.team2}</div>
          ))}
        </AnalysisRow>

        {/* 6. Extended breaks */}
        <AnalysisRow
          ok={extendedBreaks.length === 0}
          label={extendedBreaks.length === 0
            ? 'No extended breaks'
            : `${extendedBreaks.length} club${extendedBreaks.length !== 1 ? 's' : ''} with extended break (${'>'}2 rounds)`}
        >
          {extendedBreaks.length > 0 && extendedBreaks.map((b, i) => (
            <div key={i}>{b.team} — gap of {b.maxGap} rounds (rd {b.gapRounds[0]} → {b.gapRounds[1]})</div>
          ))}
        </AnalysisRow>

        {/* 7. Cross-zone movement */}
        <AnalysisRow
          ok="info"
          label={`Intra-zone movement — ${crossZone.count} of ${crossZone.total} fixtures cross-zone (${crossZone.pct}%)`}
        />

        {/* 8. Club spread */}
        <AnalysisRow
          ok={clubSpread.length === 0}
          label={clubSpread.length === 0
            ? 'Club spread across rounds — no club has 3+ teams in the same round'
            : `${clubSpread.length} round${clubSpread.length !== 1 ? 's' : ''} where a club has 3+ teams playing simultaneously`}
        >
          {clubSpread.length > 0 && clubSpread.map((c, i) => (
            <div key={i}>Rd {c.round}: {c.club} has {c.count} teams ({c.teams.join(', ')})</div>
          ))}
        </AnalysisRow>

      </div>
    </div>
  );
}

export default function FixtureImporter({ importFixtures, loading }) {
  const inputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0] || null);
    setAnalysis(null);
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    const result = await importFixtures(selectedFile);
    if (result) setAnalysis(result);
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Import Fixture Schedule</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload an Excel (.xlsx) file to replace the current fixtures. Each row is one fixture with columns:
            Round, Time, Pitch, Zone, Team 1, Team 2, Club 1, Club 2, Cross-Zone, Referee, Referee Club, Ref Conflict.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <button
          onClick={downloadImportTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium border border-gray-300"
        >
          <Download size={16} />
          Download Template
        </button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 text-sm font-medium border border-gray-300">
          <Download size={16} className="rotate-180" />
          {selectedFile ? selectedFile.name : 'Choose file…'}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
        <button
          onClick={handleImport}
          disabled={!selectedFile || loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#7c1229] text-white rounded-lg hover:bg-[#a01638] disabled:bg-gray-400 text-sm font-medium"
        >
          {loading ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Importing…
            </>
          ) : (
            'Import Fixtures'
          )}
        </button>
        {selectedFile && !loading && (
          <button
            onClick={() => { setSelectedFile(null); if (inputRef.current) inputRef.current.value = ''; }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>
      {analysis && <AnalysisPanel analysis={analysis} />}
    </div>
  );
}
