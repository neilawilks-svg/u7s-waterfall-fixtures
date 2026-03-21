import React, { useState, useEffect, useRef } from 'react';
import { Download, MapPin, Users, AlertTriangle, RefreshCw, WhatsApp } from '../icons';
import { openClubPackPDFInTab, shareClubPackPDF } from '../../utils/exports';

function Tooltip({ text, children, align = 'left' }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!visible) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setVisible(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [visible]);

  return (
    <div ref={ref} className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => setVisible(v => !v)}>
      {children}
      {visible && (
        <div className={`absolute bottom-full mb-2 w-60 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 z-50 shadow-xl leading-relaxed pointer-events-none ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {text}
          <div className={`absolute top-full border-4 border-transparent border-t-gray-900 ${align === 'right' ? 'right-4' : 'left-4'}`} />
        </div>
      )}
    </div>
  );
}

const canShareFiles = () => navigator.canShare?.({ files: [new File([], 'test.pdf', { type: 'application/pdf' })] }) ?? false;

function getClubWarnings(clubName, fixtures, teams) {
  const clubTeams = teams.filter(t => t.club === clubName);
  let hasAwayGames = false;
  let hasRefIssues = false;
  for (const f of fixtures) {
    const team = clubTeams.find(t => t.id === f.team1.id || t.id === f.team2.id);
    if (!team) continue;
    if (team.zone && f.zone !== team.zone) hasAwayGames = true;
    if (f.refereeUnavailable || f.refereeConflict) hasRefIssues = true;
  }
  return { hasAwayGames, hasRefIssues };
}

function getTeamPitches(team, zones) {
  return (zones.find(z => z.id === team.zone)?.pitches ?? []).slice().sort((a, b) => a - b);
}

function formatGeneratedAt(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

function ClubTile({ clubName, clubTeams, fixtures, zones, lunchEnabled, lunchStart, lunchEnd, allFixtures, allTeams }) {
  const [loading, setLoading] = useState(false);
  const { hasAwayGames, hasRefIssues } = getClubWarnings(clubName, fixtures, allTeams);
  const hasWarning = hasAwayGames || hasRefIssues;

  const handleDownload = () => {
    openClubPackPDFInTab(clubName, allFixtures, allTeams, setLoading, lunchEnabled, lunchStart, lunchEnd);
  };

  const handleWhatsApp = () => {
    shareClubPackPDF(clubName, allFixtures, allTeams, setLoading, lunchEnabled, lunchStart, lunchEnd);
  };

  return (
    <div className={`bg-white rounded-xl shadow-md border flex flex-col gap-0 overflow-hidden transition-shadow hover:shadow-lg ${hasWarning ? 'border-amber-200' : 'border-gray-100'}`}>
      {/* Card header */}
      <div className={`px-5 py-4 ${hasWarning ? 'bg-amber-50' : 'bg-[#7c1229]/5'}`}>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{clubName}</h2>
          {hasWarning && (
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
          <Users size={13} className="flex-shrink-0" />
          <span>{clubTeams.length} {clubTeams.length === 1 ? 'team' : 'teams'}</span>
        </div>
      </div>

      {/* Card body */}
      <div className="px-5 py-4 flex flex-col gap-3 flex-1">
        {/* Warning badges */}
        {(hasAwayGames || hasRefIssues) && (
          <div className="flex flex-wrap gap-1.5">
            {hasAwayGames && (
              <Tooltip text="One or more of this club's teams play at least one match on a pitch outside their home zone.">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 cursor-help select-none">
                  <AlertTriangle size={11} />
                  Away fixtures
                </span>
              </Tooltip>
            )}
            {hasRefIssues && (
              <Tooltip align="right" text="One or more fixtures involving this club have no available referee — the club may be asked to provide an official.">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 cursor-help select-none">
                  <AlertTriangle size={11} />
                  Referee issue
                </span>
              </Tooltip>
            )}
          </div>
        )}

        {/* Teams */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Teams</p>
            <Tooltip align="right" text="The pitch number(s) shown next to each team are their home pitches for the day.">
              <span className="inline-flex items-center gap-1 text-xs text-gray-400 cursor-help select-none">
                <MapPin size={10} className="text-[#7c1229]" />
                <span>= home pitch</span>
              </span>
            </Tooltip>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {clubTeams.map(t => {
              const teamPitches = getTeamPitches(t, zones);
              return (
                <span key={t.id} className="inline-flex items-center gap-1 px-2 py-1 bg-[#7c1229]/8 text-[#7c1229] rounded-full text-xs font-medium border border-[#7c1229]/15">
                  {t.name}
                  {teamPitches.length > 0 && (
                    <>
                      <span className="text-[#7c1229]/25 mx-0.5">|</span>
                      <MapPin size={9} className="flex-shrink-0 opacity-60" />
                      <span className="font-bold">{teamPitches.join('·')}</span>
                    </>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-5 flex flex-col gap-2">
        <button
          onClick={handleDownload}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-colors ${
            loading
              ? 'bg-[#7c1229]/50 text-white cursor-wait'
              : 'bg-[#7c1229] text-white hover:bg-[#a01638]'
          }`}
        >
          {loading ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {loading ? 'Generating PDF…' : 'Download Club Pack'}
        </button>

        {canShareFiles() && (
          <button
            onClick={handleWhatsApp}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm bg-[#25D366] text-white hover:bg-[#1ebe5d] transition-colors"
          >
            <WhatsApp size={16} />
            Share via WhatsApp
          </button>
        )}
      </div>
    </div>
  );
}

export default function ClubPacksView({ fixtures, teams, zones, generatedAt, lunchEnabled, lunchStart, lunchEnd }) {
  const clubs = [...new Set(teams.map(t => t.club))].filter(Boolean).sort();
  const generatedFormatted = formatGeneratedAt(generatedAt);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <div className="bg-[#7c1229] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <h1 className="text-2xl font-bold">U7's Waterfall</h1>
          <p className="text-white/80 text-sm mt-0.5">Club Fixture Packs</p>
        </div>
      </div>

      {/* Generated timestamp */}
      {generatedFormatted && (
        <div className="bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-2 text-sm text-gray-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>Schedule generated: <span className="font-medium text-gray-700">{generatedFormatted}</span></span>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6">
        {fixtures.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-xl shadow-lg p-10 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Download size={28} className="text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Fixtures Available</h2>
            <p className="text-gray-500">Club packs will appear here once the fixture schedule has been generated.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {clubs.length} {clubs.length === 1 ? 'club' : 'clubs'} · Click a club pack to open the PDF in a new tab
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clubs.map(club => (
                <ClubTile
                  key={club}
                  clubName={club}
                  clubTeams={teams.filter(t => t.club === club)}
                  fixtures={fixtures.filter(f =>
                    teams.filter(t => t.club === club).some(t => t.id === f.team1.id || t.id === f.team2.id)
                  )}
                  zones={zones}
                  lunchEnabled={lunchEnabled}
                  lunchStart={lunchStart}
                  lunchEnd={lunchEnd}
                  allFixtures={fixtures}
                  allTeams={teams}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
