import * as XLSX from 'xlsx';
import { analyseSchedule } from './scheduleAnalysis';

/** Download a blank import template with the correct headers and two example rows. */
export function downloadImportTemplate() {
  const headers = [
    'Round', 'Time', 'Pitch', 'Zone',
    'Team 1', 'Team 2', 'Club 1', 'Club 2',
    'Cross-Zone', 'Referee', 'Referee Club', 'Ref Conflict',
  ];

  const examples = [
    [1, '10:30', 1, 'A', 'Chester Kites', 'Macclesfield Starfighters', 'Chester', 'Macclesfield', '', 'Bowdon Bulldogs', 'Bowdon', ''],
    [1, '10:30', 2, 'A', 'Wilmslow Bears', 'Old Bedians Dragons', 'Wilmslow', 'Old Bedians', '', 'Helsby Spartans', 'Helsby', ''],
    [1, '10:30', 5, 'C', 'Bowdon Bobcats', 'Macclesfield Meteors', 'Bowdon', 'Macclesfield', 'Yes', 'Caldy Smashers', 'Caldy', ''],
    [2, '10:45', 1, 'A', 'Helsby Spartans', 'Sandbach Gladiators', 'Helsby', 'Sandbach', '', 'Chester Kites', 'Chester', 'Yes'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);

  // Column widths
  ws['!cols'] = [
    { wch: 7 },  // Round
    { wch: 7 },  // Time
    { wch: 7 },  // Pitch
    { wch: 6 },  // Zone
    { wch: 28 }, // Team 1
    { wch: 28 }, // Team 2
    { wch: 18 }, // Club 1
    { wch: 18 }, // Club 2
    { wch: 11 }, // Cross-Zone
    { wch: 28 }, // Referee
    { wch: 18 }, // Referee Club
    { wch: 12 }, // Ref Conflict
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fixtures');
  XLSX.writeFile(wb, 'Fixture_Import_Template.xlsx');
}

/**
 * Parse an Excel file in the standard import format and return fixture data
 * ready to be saved directly to storage.
 *
 * Columns (0-indexed):
 *  0  Round        1  Time         2  Pitch       3  Zone
 *  4  Team 1       5  Team 2       6  Club 1      7  Club 2
 *  8  Cross-Zone   9  Referee     10  Ref Club    11  Ref Conflict
 */
export function importFixturesFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (rows.length < 2) {
          throw new Error('No fixture rows found — file appears empty or header-only.');
        }

        const teamMap = new Map();   // name → team object
        const pitchZoneMap = new Map(); // zone letter → Set of pitch numbers
        // zone letter → Map of (teamName → count) for intra-zone fixtures
        const intraZoneCounts = new Map();
        const fixtures = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const round = Number(row[0]);
          if (!round) continue; // skip blank / non-numeric rows

          const time = parseTime(row[1]);
          const pitch = Number(row[2]);
          const zone = String(row[3]).trim().toUpperCase();
          const team1NameRaw = String(row[4]).trim();
          const team2NameRaw = String(row[5]).trim();
          const club1 = String(row[6]).trim();
          const club2 = String(row[7]).trim();
          const isCrossZone = parseBool(row[8]);
          const refName = row[9] ? String(row[9]).trim() : '';
          const refClub = row[10] ? String(row[10]).trim() : '';
          const refereeConflict = parseBool(row[11]);

          if (!team1NameRaw || !team2NameRaw) continue;

          // Keywords that indicate a referee is explicitly unavailable (not just unassigned)
          const UNAVAILABLE = new Set(['unavailable', 'n/a', 'none', 'no referee', 'unavail']);
          const refUnavailable = UNAVAILABLE.has(refName.toLowerCase());

          // Keywords that indicate a team slot has no opponent
          const PLACEHOLDER_TEAM = new Set(['unavailable', 'n/a', 'none', 'tbc', 'tbd', 'bye']);
          const isTeam1Placeholder = PLACEHOLDER_TEAM.has(team1NameRaw.toLowerCase());
          const isTeam2Placeholder = PLACEHOLDER_TEAM.has(team2NameRaw.toLowerCase());
          const team1Name = isTeam1Placeholder ? 'Opposition not Available' : team1NameRaw;
          const team2Name = isTeam2Placeholder ? 'Opposition not Available' : team2NameRaw;

          // Ensure team objects exist
          if (!teamMap.has(team1Name)) {
            teamMap.set(team1Name, { id: slugify(team1Name), name: team1Name, club: isTeam1Placeholder ? '' : club1, zone: null, ...(isTeam1Placeholder && { isPlaceholder: true }) });
          }
          if (!teamMap.has(team2Name)) {
            teamMap.set(team2Name, { id: slugify(team2Name), name: team2Name, club: isTeam2Placeholder ? '' : club2, zone: null, ...(isTeam2Placeholder && { isPlaceholder: true }) });
          }

          // Track zone→pitch mapping
          if (!pitchZoneMap.has(zone)) pitchZoneMap.set(zone, new Set());
          pitchZoneMap.get(zone).add(pitch);

          // Track intra-zone team counts for home-zone inference (skip placeholder slots)
          if (!isCrossZone && !isTeam1Placeholder && !isTeam2Placeholder) {
            if (!intraZoneCounts.has(zone)) intraZoneCounts.set(zone, new Map());
            const counts = intraZoneCounts.get(zone);
            counts.set(team1Name, (counts.get(team1Name) || 0) + 1);
            counts.set(team2Name, (counts.get(team2Name) || 0) + 1);
          }

          const team1 = teamMap.get(team1Name);
          const team2 = teamMap.get(team2Name);

          let referee = null;
          if (refName && !refUnavailable) {
            // Referee is a team — ensure they have a team entry too
            if (!teamMap.has(refName)) {
              teamMap.set(refName, { id: slugify(refName), name: refName, club: refClub, zone: null });
            }
            const refTeam = teamMap.get(refName);
            // Update club if we have more info
            if (refClub && !refTeam.club) refTeam.club = refClub;
            referee = { id: refTeam.id, name: refName, club: refClub || refTeam.club, zone: null };
          }

          fixtures.push({
            id: `fixture-import-${round}-${pitch}`,
            round,
            time,
            pitch,
            zone,
            isCrossZone,
            team1,
            team2,
            referee,
            refereeConflict,
            refereeUnavailable: refUnavailable,
          });
        }

        if (fixtures.length === 0) {
          throw new Error('No valid fixture rows could be parsed from the file.');
        }

        // Assign team home zones based on most frequent intra-zone appearance
        for (const [zoneId, counts] of intraZoneCounts) {
          for (const [teamName, count] of counts) {
            const team = teamMap.get(teamName);
            if (!team) continue;
            if (team.zone === null) {
              team.zone = zoneId;
            } else {
              // Replace if this zone has higher count
              const currentZoneCounts = intraZoneCounts.get(team.zone);
              const currentCount = currentZoneCounts ? (currentZoneCounts.get(teamName) || 0) : 0;
              if (count > currentCount) team.zone = zoneId;
            }
          }
        }

        // Propagate team zones to referee objects in fixtures
        for (const fixture of fixtures) {
          if (fixture.referee) {
            const refTeam = teamMap.get(fixture.referee.name);
            if (refTeam) fixture.referee.zone = refTeam.zone;
          }
        }

        // Build zones array (sorted alphabetically)
        const sortedZoneIds = [...pitchZoneMap.keys()].sort();
        const zones = sortedZoneIds.map(zoneId => ({
          id: zoneId,
          pitches: [...pitchZoneMap.get(zoneId)].sort((a, b) => a - b),
          teams: [...teamMap.values()].filter(t => t.zone === zoneId),
        }));

        const teams = [...teamMap.values()];
        const roundCount = new Set(fixtures.map(f => f.round)).size;
        const clubCount = new Set(teams.map(t => t.club)).size;
        const summary = `Successfully imported ${fixtures.length} fixtures across ${roundCount} rounds for ${teams.length} teams from ${clubCount} clubs.`;

        const analysis = analyseSchedule(fixtures, teams);

        resolve({ fixtures, teams, zones, summary, analysis });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsArrayBuffer(file);
  });
}

/** Convert an Excel cell value to "HH:MM" string. */
function parseTime(val) {
  if (typeof val === 'number') {
    // Excel stores time as fraction of 24h; may include integer date part
    const fraction = val % 1;
    const totalMinutes = Math.round(fraction * 24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  // Already a string — normalise padding
  const str = String(val).trim();
  const parts = str.split(':');
  if (parts.length >= 2) {
    return `${String(parseInt(parts[0], 10)).padStart(2, '0')}:${String(parseInt(parts[1], 10)).padStart(2, '0')}`;
  }
  return str;
}

/** Coerce a cell value to boolean. */
function parseBool(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return false;
}

/** Create a stable ID from a team name. */
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
