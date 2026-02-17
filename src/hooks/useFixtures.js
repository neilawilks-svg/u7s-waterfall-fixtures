import { useState, useEffect } from 'react';
import { storageGet, storageSet } from '../storage';
import { DEFAULT_SHEET_URL } from '../config';
import { addMinutes } from '../utils/time';
import { computePitchGrid, computeZoneAdjacency } from '../utils/zones';
import { findBestMatch } from '../utils/teamAssignment';
import { assignReferees } from '../utils/referees';
import { loadTeamsFromCSV } from '../utils/csvParser';
import { generateFixtureSet, generateSampleTeams } from '../utils/fixtureGenerator';

export function useFixtures() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialView = urlParams.get('view') === 'public' ? 'public' : 'admin';

  const [view] = useState(initialView);
  const [teams, setTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [zones, setZones] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showSitePlan, setShowSitePlan] = useState(false);
  const [sitePlanZoom, setSitePlanZoom] = useState(1);
  const [numPitches, setNumPitches] = useState(16);
  const [matchDuration, setMatchDuration] = useState(15);
  const [startTime, setStartTime] = useState('10:30');
  const [numRounds, setNumRounds] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sheetUrl, setSheetUrl] = useState(DEFAULT_SHEET_URL);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [uploadMethod, setUploadMethod] = useState('url');
  const [lunchEnabled, setLunchEnabled] = useState(true);
  const [lunchStart, setLunchStart] = useState('11:45');
  const [lunchEnd, setLunchEnd] = useState('12:30');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [fixtureHistory, setFixtureHistory] = useState([]);
  const [swapMode, setSwapMode] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifiedFixtures, setNotifiedFixtures] = useState(new Set());

  const loadFixtures = async () => {
    try {
      const result = await storageGet('rugby-fixtures');
      if (result && result.value) {
        const data = JSON.parse(result.value);
        if (data.fixtures && data.fixtures.length > 0) {
          setFixtures(data.fixtures || []);

          const teamMap = new Map();
          data.fixtures.forEach(f => {
            if (!teamMap.has(f.team1.id)) {
              teamMap.set(f.team1.id, f.team1);
            }
            if (!teamMap.has(f.team2.id)) {
              teamMap.set(f.team2.id, f.team2);
            }
          });
          setTeams(Array.from(teamMap.values()));

          if (data.zones && data.zones.length > 0) {
            const restoredZones = data.zones.map(z => ({
              id: z.id,
              pitches: z.pitches,
              teams: z.teamIds.map(id => teamMap.get(id)).filter(Boolean),
            }));
            setZones(restoredZones);
          }
        }
      }
    } catch (err) {
      console.log('No existing fixtures found');
    }
  };

  const saveFixtures = async (fixtureData, teamData, zoneData, skipHistory = false) => {
    try {
      if (!skipHistory && fixtures.length > 0) {
        setFixtureHistory(prev => {
          const entry = {
            fixtures: [...fixtures],
            teams: [...teams],
            zones: [...zones],
            timestamp: new Date().toISOString(),
          };
          const next = [entry, ...prev].slice(0, 10);
          return next;
        });
      }

      console.log('Attempting to save fixtures...', fixtureData.length);
      const payload = {
        fixtures: fixtureData,
        teams: teamData,
        zones: zoneData ? zoneData.map(z => ({ id: z.id, pitches: z.pitches, teamIds: z.teams.map(t => t.id) })) : [],
        generated: new Date().toISOString()
      };
      console.log('Payload:', payload);

      const result = await storageSet('rugby-fixtures', JSON.stringify(payload));
      console.log('Save result:', result);

      if (!result) {
        console.error('Failed to save - no result returned');
      } else {
        console.log('Successfully saved fixtures');
      }
    } catch (err) {
      console.error('Error saving fixtures:', err);
    }
  };

  const restoreFromHistory = async (index) => {
    const entry = fixtureHistory[index];
    if (!entry) return;
    setFixtures(entry.fixtures);
    setTeams(entry.teams);
    setZones(entry.zones);
    await saveFixtures(entry.fixtures, entry.teams, entry.zones, true);
    setFixtureHistory(prev => prev.filter((_, i) => i !== index));
    setError(`Restored fixtures from ${new Date(entry.timestamp).toLocaleTimeString()}`);
  };

  const swapTeamsInFixture = async (fixtureId, newTeamId) => {
    if (!swapMode) return;
    const { fixtureId: srcFixtureId, slot: srcSlot } = swapMode;

    const srcFixture = fixtures.find(f => f.id === srcFixtureId);
    const destFixture = fixtures.find(f => f.id === fixtureId);
    if (!srcFixture || !destFixture) return;

    const srcTeam = srcSlot === 1 ? srcFixture.team1 : srcFixture.team2;
    const destTeam = destFixture.team1.id === newTeamId ? destFixture.team1 : destFixture.team2;
    const destSlot = destFixture.team1.id === newTeamId ? 1 : 2;

    const updated = fixtures.map(f => {
      if (f.id === srcFixtureId) {
        return { ...f, [srcSlot === 1 ? 'team1' : 'team2']: destTeam };
      }
      if (f.id === fixtureId) {
        return { ...f, [destSlot === 1 ? 'team1' : 'team2']: srcTeam };
      }
      return f;
    });

    setFixtures(updated);
    await saveFixtures(updated, teams, zones);
    setSwapMode(null);
    setError(`Swapped ${srcTeam.name} with ${destTeam.name}`);
  };

  const regenerateRound = async (roundNum) => {
    setLoading(true);
    try {
      const roundFixtures = fixtures.filter(f => f.round === roundNum);
      const otherFixtures = fixtures.filter(f => f.round !== roundNum);

      const playedMatchups = new Set();
      const clubMatchupsPerTeam = {};
      const teamFixtureCounts = {};
      teams.forEach(t => {
        teamFixtureCounts[t.id] = 0;
        clubMatchupsPerTeam[t.id] = new Set();
      });
      otherFixtures.forEach(f => {
        const key = [f.team1.id, f.team2.id].sort().join('-');
        playedMatchups.add(key);
        teamFixtureCounts[f.team1.id] = (teamFixtureCounts[f.team1.id] || 0) + 1;
        teamFixtureCounts[f.team2.id] = (teamFixtureCounts[f.team2.id] || 0) + 1;
        clubMatchupsPerTeam[f.team1.id].add(f.team2.club);
        clubMatchupsPerTeam[f.team2.id].add(f.team1.club);
      });

      const activePitchCount = zones.length * 2;
      const pitchGrid = computePitchGrid(activePitchCount);
      const adjacency = computeZoneAdjacency(zones, pitchGrid);

      const roundTime = roundFixtures[0]?.time || startTime;
      const usedTeams = new Set();
      const newRoundFixtures = [];
      const filledPitches = new Set();

      // Intra-zone
      for (const zone of zones) {
        for (let pitchSlot = 0; pitchSlot < 2; pitchSlot++) {
          const pitch = zone.pitches[pitchSlot];
          const available = zone.teams.filter(t => !usedTeams.has(t.id) && teamFixtureCounts[t.id] < numRounds);
          if (available.length < 2) break;
          const match = findBestMatch(available, playedMatchups, clubMatchupsPerTeam, teamFixtureCounts, numRounds, adjacency);
          if (!match) break;
          newRoundFixtures.push({
            id: `fixture-${roundNum - 1}-${pitch}`,
            round: roundNum, pitch, time: roundTime,
            team1: match.t1, team2: match.t2,
            zone: zone.id, isCrossZone: false,
          });
          playedMatchups.add(match.matchupKey);
          usedTeams.add(match.t1.id);
          usedTeams.add(match.t2.id);
          filledPitches.add(pitch);
        }
      }

      // Cross-zone backfill
      for (const zone of zones) {
        for (const pitch of zone.pitches) {
          if (filledPitches.has(pitch)) continue;
          const zoneOrder = [zone.id, ...(adjacency[zone.id] || [])];
          const candidates = [];
          for (const zId of zoneOrder) {
            const z = zones.find(zz => zz.id === zId);
            if (!z) continue;
            z.teams.forEach(t => {
              if (!usedTeams.has(t.id) && teamFixtureCounts[t.id] < numRounds) candidates.push(t);
            });
          }
          if (candidates.length < 2) continue;
          const match = findBestMatch(candidates, playedMatchups, clubMatchupsPerTeam, teamFixtureCounts, numRounds, adjacency);
          if (!match) continue;
          newRoundFixtures.push({
            id: `fixture-${roundNum - 1}-${pitch}`,
            round: roundNum, pitch, time: roundTime,
            team1: match.t1, team2: match.t2,
            zone: zone.id, isCrossZone: match.t1.zone !== match.t2.zone,
          });
          playedMatchups.add(match.matchupKey);
          usedTeams.add(match.t1.id);
          usedTeams.add(match.t2.id);
          filledPitches.add(pitch);
        }
      }

      const allFixtures = [...otherFixtures, ...newRoundFixtures].sort((a, b) =>
        a.time.localeCompare(b.time) || a.pitch - b.pitch
      );
      assignReferees(allFixtures, zones);
      setFixtures(allFixtures);
      await saveFixtures(allFixtures, teams, zones);
      const conflictCount = allFixtures.filter(f => f.refereeConflict).length;
      setError(`Re-generated round ${roundNum} with ${newRoundFixtures.length} fixtures. Referee conflicts: ${conflictCount}`);
    } catch (err) {
      setError('Error re-generating round: ' + err.message);
    }
    setLoading(false);
  };

  const handleFileUpload = (event) => {
    setLoadingSheet(true);
    setError('');

    const file = event.target.files[0];
    if (!file) {
      setLoadingSheet(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target.result;
        let loadedTeams = [];

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const csvText = XLSX.utils.sheet_to_csv(firstSheet);
          loadedTeams = loadTeamsFromCSV(csvText);
        } else {
          const csvText = new TextDecoder().decode(data);
          loadedTeams = loadTeamsFromCSV(csvText);
        }

        if (loadedTeams.length === 0) {
          throw new Error('No teams found in file');
        }

        setTeams(loadedTeams);
        setError(`Successfully loaded ${loadedTeams.length} teams from ${new Set(loadedTeams.map(t => t.club)).size} clubs`);
      } catch (err) {
        setError('Error reading file: ' + err.message);
        console.error(err);
      }
      setLoadingSheet(false);
    };

    reader.onerror = () => {
      setError('Error reading file');
      setLoadingSheet(false);
    };

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const loadTeamsFromSheet = async () => {
    setLoadingSheet(true);
    setError('');

    try {
      let sheetId = '';
      const urlMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (urlMatch) {
        sheetId = urlMatch[1];
      } else {
        throw new Error('Invalid Google Sheets URL');
      }

      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;

      const response = await fetch(csvUrl, {
        method: 'GET',
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sheet');
      }

      const csvText = await response.text();
      const loadedTeams = loadTeamsFromCSV(csvText);

      if (loadedTeams.length === 0) {
        throw new Error('No teams found in sheet');
      }

      setTeams(loadedTeams);
      setError(`Successfully loaded ${loadedTeams.length} teams from ${new Set(loadedTeams.map(t => t.club)).size} clubs`);

    } catch (err) {
      setError('Error loading sheet: ' + err.message);
      console.error(err);
    }

    setLoadingSheet(false);
  };

  const handleGenerateFixtures = async () => {
    setLoading(true);
    setError('');

    try {
      const result = generateFixtureSet({
        teams,
        numPitches,
        numRounds,
        matchDuration,
        startTime,
        lunchEnabled,
        lunchStart,
        lunchEnd,
      });

      if (!result) {
        setError('Failed to generate fixtures. Try adjusting the number of pitches or rounds.');
      } else {
        setFixtures(result.fixtures);
        setTeams(result.teams);
        setZones(result.zones);
        await saveFixtures(result.fixtures, result.teams, result.zones);
        setError(result.summary);
        console.log(result.summary);
      }
    } catch (err) {
      setError('Error generating fixtures: ' + err.message);
      console.error(err);
    }

    setLoading(false);
  };

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Notifications are not supported in this browser');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      setNotificationsEnabled(true);
      new Notification('Notifications Enabled', { body: "You'll be notified 2 minutes before your team's matches." });
    }
  };

  // Effects
  useEffect(() => {
    loadFixtures();
  }, []);

  // Auto-refresh public view every 60 seconds
  useEffect(() => {
    if (view !== 'public') return;
    const interval = setInterval(() => {
      setRefreshTick(t => t + 1);
      loadFixtures();
    }, 60000);
    return () => clearInterval(interval);
  }, [view]);

  useEffect(() => {
    if (showSitePlan) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') setShowSitePlan(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
        setSitePlanZoom(1);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [showSitePlan]);

  useEffect(() => {
    if (selectedTeam) {
      window.scrollTo(0, 0);
    }
  }, [selectedTeam]);

  // Push notifications
  useEffect(() => {
    if (!notificationsEnabled || !selectedTeam || view !== 'public') return;
    const interval = setInterval(() => {
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      const teamFix = fixtures.filter(f => f.team1.id === selectedTeam.id || f.team2.id === selectedTeam.id);
      teamFix.forEach(f => {
        const [h, m] = f.time.split(':').map(Number);
        const fixMins = h * 60 + m;
        const diff = fixMins - currentMins;
        if (diff >= 0 && diff <= 2 && !notifiedFixtures.has(f.id)) {
          const opponent = f.team1.id === selectedTeam.id ? f.team2 : f.team1;
          new Notification('Match Starting Soon!', {
            body: `${selectedTeam.name} vs ${opponent.name} on Pitch ${f.pitch} at ${f.time}`,
            icon: '\u{1F3C9}',
            tag: f.id,
          });
          setNotifiedFixtures(prev => new Set([...prev, f.id]));
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [notificationsEnabled, selectedTeam, fixtures, view, notifiedFixtures]);

  // Computed values
  const filteredTeams = teams.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTeamFixtures = (teamId) => {
    return fixtures.filter(f =>
      f.team1.id === teamId || f.team2.id === teamId
    ).sort((a, b) => a.time.localeCompare(b.time));
  };

  const getCurrentAndNext = () => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const current = fixtures.filter(f => f.time <= currentTime &&
      currentTime < addMinutes(f.time, matchDuration));
    const upcoming = fixtures.filter(f => f.time > currentTime)
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(0, numPitches);

    if (current.length === 0 && upcoming.length === 0 && fixtures.length > 0) {
      const allSorted = [...fixtures].sort((a, b) => a.time.localeCompare(b.time));
      return { current: [], upcoming: [], allFixtures: allSorted, outsideSchedule: true };
    }

    return { current, upcoming, allFixtures: [], outsideSchedule: false };
  };

  return {
    view,
    teams, setTeams,
    fixtures, setFixtures,
    zones, setZones,
    searchTerm, setSearchTerm,
    selectedTeam, setSelectedTeam,
    showSitePlan, setShowSitePlan,
    sitePlanZoom, setSitePlanZoom,
    numPitches, setNumPitches,
    matchDuration, setMatchDuration,
    startTime, setStartTime,
    numRounds, setNumRounds,
    loading, setLoading,
    error, setError,
    sheetUrl, setSheetUrl,
    loadingSheet, setLoadingSheet,
    uploadMethod, setUploadMethod,
    lunchEnabled, setLunchEnabled,
    lunchStart, setLunchStart,
    lunchEnd, setLunchEnd,
    isAuthenticated, setIsAuthenticated,
    passwordInput, setPasswordInput,
    fixtureHistory, setFixtureHistory,
    swapMode, setSwapMode,
    pdfLoading, setPdfLoading,
    notificationsEnabled, setNotificationsEnabled,
    filteredTeams,
    loadFixtures,
    saveFixtures,
    restoreFromHistory,
    swapTeamsInFixture,
    regenerateRound,
    handleFileUpload,
    loadTeamsFromSheet,
    generateFixtures: handleGenerateFixtures,
    enableNotifications,
    getTeamFixtures,
    getCurrentAndNext,
  };
}
