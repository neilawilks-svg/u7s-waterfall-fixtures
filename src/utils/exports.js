import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const downloadFixturesAsExcel = async (fixtures, teams, zones, setError) => {
  try {
    const XLSX = await import('xlsx');

    const wb = XLSX.utils.book_new();

    const fixtureData = [['Round', 'Time', 'Pitch', 'Zone', 'Team 1', 'Team 2', 'Club 1', 'Club 2', 'Cross-Zone', 'Referee', 'Referee Club', 'Ref Conflict']];
    fixtures.forEach(f => {
      fixtureData.push([f.round, f.time, f.pitch, f.zone || '', f.team1.name, f.team2.name, f.team1.club, f.team2.club, f.isCrossZone ? 'Yes' : '',
        f.referee ? f.referee.name : 'UNASSIGNED', f.referee ? f.referee.club : '', f.refereeConflict ? 'YES' : '']);
    });
    const wsFixtures = XLSX.utils.aoa_to_sheet(fixtureData);
    XLSX.utils.book_append_sheet(wb, wsFixtures, 'All Fixtures');

    const teamData = [['Team', 'Club', 'Home Zone', 'Round', 'Time', 'Pitch', 'Zone', 'Opponent', 'Opponent Club', 'Referee', 'Ref Conflict']];
    teams.forEach(team => {
      const teamFixtures = fixtures.filter(f => f.team1.id === team.id || f.team2.id === team.id)
        .sort((a, b) => a.time.localeCompare(b.time));
      teamFixtures.forEach(f => {
        const opponent = f.team1.id === team.id ? f.team2 : f.team1;
        teamData.push([team.name, team.club, team.zone || '', f.round, f.time, f.pitch, f.zone || '', opponent.name, opponent.club,
          f.referee ? f.referee.name : 'UNASSIGNED', f.refereeConflict ? 'YES' : '']);
      });
    });
    const wsTeams = XLSX.utils.aoa_to_sheet(teamData);
    XLSX.utils.book_append_sheet(wb, wsTeams, 'By Team');

    const rounds = [...new Set(fixtures.map(f => f.round))].sort((a, b) => a - b);
    const roundData = [['Round', 'Time', 'Pitch', 'Zone', 'Team 1', 'Team 2', 'Referee', 'Ref Conflict']];
    rounds.forEach(round => {
      const roundFixtures = fixtures.filter(f => f.round === round).sort((a, b) => a.pitch - b.pitch);
      roundFixtures.forEach(f => {
        roundData.push([f.round, f.time, f.pitch, f.zone || '', f.team1.name, f.team2.name,
          f.referee ? f.referee.name : 'UNASSIGNED', f.refereeConflict ? 'YES' : '']);
      });
      if (round < rounds.length) {
        roundData.push(['', '', '', '', '', '', '', '']);
      }
    });
    const wsRounds = XLSX.utils.aoa_to_sheet(roundData);
    XLSX.utils.book_append_sheet(wb, wsRounds, 'By Round');

    const pitches = [...new Set(fixtures.map(f => f.pitch))].sort((a, b) => a - b);
    const pitchData = [['Pitch', 'Zone', 'Time', 'Round', 'Team 1', 'Team 2', 'Referee', 'Ref Conflict']];
    pitches.forEach(pitch => {
      const pitchFixtures = fixtures.filter(f => f.pitch === pitch).sort((a, b) => a.time.localeCompare(b.time));
      const pitchZone = zones.find(z => z.pitches.includes(pitch));
      pitchFixtures.forEach(f => {
        pitchData.push([f.pitch, pitchZone ? pitchZone.id : '', f.time, f.round, f.team1.name, f.team2.name,
          f.referee ? f.referee.name : 'UNASSIGNED', f.refereeConflict ? 'YES' : '']);
      });
      if (pitch < pitches.length) {
        pitchData.push(['', '', '', '', '', '', '', '']);
      }
    });
    const wsPitches = XLSX.utils.aoa_to_sheet(pitchData);
    XLSX.utils.book_append_sheet(wb, wsPitches, 'By Pitch');

    const allTimes = [...new Set(fixtures.map(f => f.time))].sort();
    const matrixHeaders = ['Team', 'Zone'];
    allTimes.forEach(t => { matrixHeaders.push(t + ' (Play)'); matrixHeaders.push(t + ' (Ref)'); });
    const matrixData = [matrixHeaders];
    teams.forEach(team => {
      const row = [team.name, team.zone || ''];
      allTimes.forEach(time => {
        const playFixture = fixtures.find(f => f.time === time && (f.team1.id === team.id || f.team2.id === team.id));
        const refFixture = fixtures.find(f => f.time === time && f.referee && f.referee.id === team.id);
        if (playFixture) {
          const opponent = playFixture.team1.id === team.id ? playFixture.team2 : playFixture.team1;
          row.push('vs ' + opponent.name);
        } else {
          row.push('');
        }
        if (refFixture) {
          const label = refFixture.refereeConflict ? 'REF* (CONFLICT)' : 'REF';
          row.push(label);
        } else {
          row.push('');
        }
      });
      matrixData.push(row);
    });
    const wsMatrix = XLSX.utils.aoa_to_sheet(matrixData);
    XLSX.utils.book_append_sheet(wb, wsMatrix, 'Team Schedule Matrix');

    // Referee Schedule sheet
    const refData = [['Team', 'Club', 'Zone', 'Total Ref Duties', 'Round', 'Time', 'Pitch', 'Match', 'Conflict']];
    teams.forEach(team => {
      const refFixtures = fixtures.filter(f => f.referee && f.referee.id === team.id)
        .sort((a, b) => a.time.localeCompare(b.time));
      if (refFixtures.length === 0) {
        refData.push([team.name, team.club, team.zone || '', 0, '', '', '', '', '']);
      } else {
        refFixtures.forEach((f, idx) => {
          refData.push([
            idx === 0 ? team.name : '', idx === 0 ? team.club : '', idx === 0 ? (team.zone || '') : '',
            idx === 0 ? refFixtures.length : '',
            f.round, f.time, f.pitch,
            `${f.team1.name} vs ${f.team2.name}`,
            f.refereeConflict ? 'YES - team playing simultaneously' : '',
          ]);
        });
      }
    });
    const wsRef = XLSX.utils.aoa_to_sheet(refData);
    XLSX.utils.book_append_sheet(wb, wsRef, 'Referee Schedule');

    if (zones.length > 0) {
      const zoneSheetData = [['Zone', 'Pitches', 'Teams', 'Team Names', 'Clubs Represented', 'Intra-Zone Matches', 'Cross-Zone Matches', 'Referee Conflicts']];
      zones.forEach(zone => {
        const zoneFixtures = fixtures.filter(f => f.zone === zone.id);
        const intraCount = zoneFixtures.filter(f => !f.isCrossZone).length;
        const crossCount = zoneFixtures.filter(f => f.isCrossZone).length;
        const refConflicts = zoneFixtures.filter(f => f.refereeConflict).length;
        const clubs = [...new Set(zone.teams.map(t => t.club))];
        zoneSheetData.push([
          zone.id,
          zone.pitches.join(', '),
          zone.teams.length,
          zone.teams.map(t => t.name).join(', '),
          clubs.join(', '),
          intraCount,
          crossCount,
          refConflicts,
        ]);
      });
      const wsZones = XLSX.utils.aoa_to_sheet(zoneSheetData);
      XLSX.utils.book_append_sheet(wb, wsZones, 'Zone Summary');
    }

    XLSX.writeFile(wb, 'Rugby_Festival_Fixtures.xlsx');
  } catch (err) {
    setError('Error generating Excel file: ' + err.message);
    console.error(err);
  }
};

export const downloadClubPackPDF = async (clubName, fixtures, teams, setError) => {
  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 8;
    const clubTeams = teams.filter(t => t.club === clubName);

    // Title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(clubName + ' - Festival Pack', pageW / 2, margin + 4, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('Generated ' + new Date().toLocaleDateString(), pageW / 2, margin + 9, { align: 'center' });

    // Overview table
    const overviewHead = [['Team', 'Zone', 'Matches', 'Ref Duties', 'Conflicts']];
    const overviewBody = clubTeams.map(team => {
      const matchCount = fixtures.filter(f => f.team1.id === team.id || f.team2.id === team.id).length;
      const refCount = fixtures.filter(f => f.referee && f.referee.id === team.id).length;
      const conflictCount = fixtures.filter(f => f.referee && f.referee.id === team.id && f.refereeConflict).length;
      return [team.name, team.zone || '-', matchCount, refCount, conflictCount];
    });

    doc.autoTable({
      startY: margin + 12,
      head: overviewHead,
      body: overviewBody,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [124, 18, 41], fontSize: 7, cellPadding: 1.5 },
      margin: { left: margin, right: margin },
      tableWidth: 'wrap',
    });

    // Full schedule table
    const scheduleHead = [['Team', 'Time', 'Type', 'Pitch', 'Zone', 'Detail', 'Note']];
    const scheduleBody = [];
    clubTeams.forEach(team => {
      const items = [];
      fixtures.filter(f => f.team1.id === team.id || f.team2.id === team.id).forEach(f => {
        const opp = f.team1.id === team.id ? f.team2 : f.team1;
        items.push({ time: f.time, type: 'PLAY', pitch: f.pitch, zone: f.zone || '', detail: 'vs ' + opp.name + ' (' + opp.club + ')', note: '' });
      });
      fixtures.filter(f => f.referee && f.referee.id === team.id).forEach(f => {
        items.push({
          time: f.time, type: 'REF', pitch: f.pitch, zone: f.zone || '',
          detail: f.team1.name + ' vs ' + f.team2.name,
          note: f.refereeConflict ? 'CONFLICT' : '',
        });
      });
      items.sort((a, b) => a.time.localeCompare(b.time));
      items.forEach((s, idx) => {
        scheduleBody.push([idx === 0 ? team.name : '', s.time, s.type, s.pitch, s.zone, s.detail, s.note]);
      });
      scheduleBody.push(['', '', '', '', '', '', '']);
    });

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 4,
      head: scheduleHead,
      body: scheduleBody,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1.2 },
      headStyles: { fillColor: [124, 18, 41], fontSize: 6.5, cellPadding: 1.2 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 16 },
        2: { cellWidth: 12 },
        3: { cellWidth: 14 },
        4: { cellWidth: 14 },
        6: { cellWidth: 22 },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.raw[6] === 'CONFLICT') {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.section === 'body' && data.row.raw[2] === 'REF') {
          data.cell.styles.fillColor = [254, 243, 199];
        }
      },
    });

    const safeName = clubName.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(safeName + '_Festival_Pack.pdf');
  } catch (err) {
    setError('Error generating club pack PDF: ' + err.message);
    console.error(err);
  }
};

export const downloadTeamFixturePDF = async (team, fixtures, setPdfLoading) => {
  setPdfLoading(true);
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 10;

    // Title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(124, 18, 41);
    doc.text(team.name, pageW / 2, margin + 6, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(team.club + (team.zone ? '  |  Zone ' + team.zone : ''), pageW / 2, margin + 12, { align: 'center' });

    // Build combined schedule
    const teamMatches = fixtures.filter(f => f.team1.id === team.id || f.team2.id === team.id);
    const refDuties = fixtures.filter(f => f.referee && f.referee.id === team.id);
    const schedule = [];

    teamMatches.forEach((f, idx) => {
      const opp = f.team1.id === team.id ? f.team2 : f.team1;
      const isAway = team.zone && f.zone !== team.zone;
      schedule.push({
        time: f.time, type: 'MATCH ' + (idx + 1), pitch: 'Pitch ' + f.pitch,
        detail: 'vs ' + opp.name + ' (' + opp.club + ')',
        note: isAway ? 'AWAY - Zone ' + f.zone : (f.zone ? 'Zone ' + f.zone : ''),
        isRef: false, isConflict: false
      });
    });
    refDuties.forEach(f => {
      schedule.push({
        time: f.time, type: 'REF DUTY', pitch: 'Pitch ' + f.pitch,
        detail: f.team1.name + ' vs ' + f.team2.name,
        note: f.refereeConflict ? 'CONFLICT' : '',
        isRef: true, isConflict: f.refereeConflict
      });
    });
    schedule.sort((a, b) => a.time.localeCompare(b.time) || (a.isRef ? 1 : -1));

    const tableHead = [['Time', 'Type', 'Location', 'Detail', 'Note']];
    const tableBody = schedule.map(s => [s.time, s.type, s.pitch, s.detail, s.note]);

    doc.autoTable({
      startY: margin + 18,
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [124, 18, 41], fontSize: 9, cellPadding: 3, halign: 'center' },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 24, halign: 'center' },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 30 },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const row = data.row.raw;
          if (row[1] === 'REF DUTY') {
            data.cell.styles.fillColor = [219, 234, 254];
          }
          if (row[4] === 'CONFLICT') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
          if (typeof row[4] === 'string' && row[4].startsWith('AWAY')) {
            data.cell.styles.textColor = [180, 83, 9];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    // Footer
    const finalY = doc.lastAutoTable.finalY + 6;
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated ' + new Date().toLocaleDateString(), pageW / 2, finalY, { align: 'center' });

    const safeName = team.name.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(safeName + '_Fixtures.pdf');
  } catch (err) {
    console.error(err);
    alert('Unable to generate PDF. Please try again or use a different browser.\n\n' + err.message);
  } finally {
    setPdfLoading(false);
  }
};

export const downloadClubPack = async (clubName, fixtures, teams, setError) => {
  try {
    const XLSX = await import('xlsx');

    const wb = XLSX.utils.book_new();
    const clubTeams = teams.filter(t => t.club === clubName);

    // Sheet 1: Club Overview
    const overviewData = [
      [clubName + ' - Festival Pack'],
      [''],
      ['Team', 'Zone', 'Total Matches', 'Total Ref Duties', 'Ref Conflicts'],
    ];
    clubTeams.forEach(team => {
      const matchCount = fixtures.filter(f => f.team1.id === team.id || f.team2.id === team.id).length;
      const refCount = fixtures.filter(f => f.referee && f.referee.id === team.id).length;
      const conflictCount = fixtures.filter(f => f.referee && f.referee.id === team.id && f.refereeConflict).length;
      overviewData.push([team.name, team.zone || '', matchCount, refCount, conflictCount]);
    });
    const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, wsOverview, 'Overview');

    // Sheet 2: Full Schedule
    const scheduleData = [['Team', 'Time', 'Activity', 'Pitch', 'Zone', 'Detail', 'Conflict']];
    clubTeams.forEach(team => {
      const schedule = [];
      const teamFixtures = fixtures.filter(f => f.team1.id === team.id || f.team2.id === team.id);
      teamFixtures.forEach(f => {
        const opp = f.team1.id === team.id ? f.team2 : f.team1;
        schedule.push({ time: f.time, activity: 'PLAY', pitch: f.pitch, zone: f.zone, detail: `vs ${opp.name} (${opp.club})`, conflict: '' });
      });
      const refFixtures = fixtures.filter(f => f.referee && f.referee.id === team.id);
      refFixtures.forEach(f => {
        schedule.push({
          time: f.time, activity: 'REFEREE', pitch: f.pitch, zone: f.zone,
          detail: `${f.team1.name} vs ${f.team2.name}`,
          conflict: f.refereeConflict ? 'YES - your team playing simultaneously' : '',
        });
      });
      schedule.sort((a, b) => a.time.localeCompare(b.time));
      schedule.forEach((s, idx) => {
        scheduleData.push([idx === 0 ? team.name : '', s.time, s.activity, s.pitch, s.zone || '', s.detail, s.conflict]);
      });
      scheduleData.push(['', '', '', '', '', '', '']);
    });
    const wsSchedule = XLSX.utils.aoa_to_sheet(scheduleData);
    XLSX.utils.book_append_sheet(wb, wsSchedule, 'Full Schedule');

    // Sheet 3: Match Fixtures only
    const matchData = [['Team', 'Round', 'Time', 'Pitch', 'Zone', 'Opponent', 'Opponent Club', 'Referee']];
    clubTeams.forEach(team => {
      const teamFixtures = fixtures.filter(f => f.team1.id === team.id || f.team2.id === team.id)
        .sort((a, b) => a.time.localeCompare(b.time));
      teamFixtures.forEach((f, idx) => {
        const opp = f.team1.id === team.id ? f.team2 : f.team1;
        matchData.push([idx === 0 ? team.name : '', f.round, f.time, f.pitch, f.zone || '', opp.name, opp.club,
          f.referee ? f.referee.name : 'UNASSIGNED']);
      });
      matchData.push(['', '', '', '', '', '', '', '']);
    });
    const wsMatches = XLSX.utils.aoa_to_sheet(matchData);
    XLSX.utils.book_append_sheet(wb, wsMatches, 'Matches');

    // Sheet 4: Referee Duties only
    const refDutyData = [['Team', 'Round', 'Time', 'Pitch', 'Zone', 'Match', 'Conflict']];
    clubTeams.forEach(team => {
      const refFixtures = fixtures.filter(f => f.referee && f.referee.id === team.id)
        .sort((a, b) => a.time.localeCompare(b.time));
      if (refFixtures.length === 0) {
        refDutyData.push([team.name, '', '', '', '', 'No referee duties assigned', '']);
      } else {
        refFixtures.forEach((f, idx) => {
          refDutyData.push([
            idx === 0 ? team.name : '', f.round, f.time, f.pitch, f.zone || '',
            `${f.team1.name} vs ${f.team2.name}`,
            f.refereeConflict ? 'YES - team playing simultaneously' : '',
          ]);
        });
      }
      refDutyData.push(['', '', '', '', '', '', '']);
    });
    const wsRefDuties = XLSX.utils.aoa_to_sheet(refDutyData);
    XLSX.utils.book_append_sheet(wb, wsRefDuties, 'Referee Duties');

    const safeName = clubName.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `${safeName}_Festival_Pack.xlsx`);
  } catch (err) {
    setError('Error generating club pack: ' + err.message);
    console.error(err);
  }
};

export const printFixtures = (mode, fixtures, teams, zones) => {
  const printWindow = window.open('', '_blank');
  const rounds = [...new Set(fixtures.map(f => f.round))].sort((a, b) => a - b);
  const pitches = [...new Set(fixtures.map(f => f.pitch))].sort((a, b) => a - b);
  let html = `<!DOCTYPE html><html><head><title>Rugby Fixtures - Print</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      .print-header { text-align: center; margin-bottom: 15px; }
      .print-header h1 { font-size: 18pt; margin: 0; }
      .print-header p { font-size: 10pt; margin: 2px 0; color: #666; }
      table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 20px; }
      th, td { border: 1px solid #333; padding: 4px 6px; text-align: left; }
      th { background: #333; color: #fff; font-weight: bold; }
      tr:nth-child(even) { background: #f0f0f0; }
      .conflict { background: #fee2e2 !important; }
      .ref-duty { background: #fef3c7 !important; }
      .page-break { page-break-after: always; }
      h2 { font-size: 14pt; margin: 15px 0 8px 0; border-bottom: 2px solid #333; padding-bottom: 4px; }
      h3 { font-size: 12pt; margin: 10px 0 5px 0; }
      .legend { font-size: 8pt; color: #666; margin-bottom: 10px; }
      @media print { body { margin: 10px; } .conflict { background: #fee2e2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .ref-duty { background: #fef3c7 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body>`;

  if (mode === 'byRound') {
    html += `<div class="print-header"><h1>U7's Waterfall - Fixtures by Round</h1><p>Generated ${new Date().toLocaleDateString()}</p></div>`;
    html += `<p class="legend">* = Referee conflict (referee's team also playing this round)</p>`;
    rounds.forEach((round, idx) => {
      const rf = fixtures.filter(f => f.round === round).sort((a, b) => a.pitch - b.pitch);
      html += `<h2>Round ${round} - ${rf[0]?.time || ''}</h2>`;
      html += `<table><tr><th>Pitch</th><th>Zone</th><th>Team 1</th><th>Team 2</th><th>Referee</th></tr>`;
      rf.forEach(f => {
        const refText = f.referee ? f.referee.name : 'UNASSIGNED';
        const rowClass = f.refereeConflict ? ' class="conflict"' : '';
        html += `<tr${rowClass}><td>${f.pitch}</td><td>${f.zone || ''}</td><td>${f.team1.name}</td><td>${f.team2.name}</td><td>${refText}${f.refereeConflict ? ' *' : ''}</td></tr>`;
      });
      html += `</table>`;
      if (idx < rounds.length - 1 && idx % 3 === 2) html += `<div class="page-break"></div>`;
    });
  } else if (mode === 'byPitch') {
    html += `<div class="print-header"><h1>U7's Waterfall - Pitch Schedules</h1><p>Generated ${new Date().toLocaleDateString()}</p></div>`;
    html += `<p class="legend">* = Referee conflict (referee's team also playing this round)</p>`;
    pitches.forEach((pitch, idx) => {
      const pf = fixtures.filter(f => f.pitch === pitch).sort((a, b) => a.time.localeCompare(b.time));
      const zone = zones.find(z => z.pitches.includes(pitch));
      html += `<h2>Pitch ${pitch}${zone ? ` (Zone ${zone.id})` : ''}</h2>`;
      html += `<table><tr><th>Time</th><th>Round</th><th>Team 1</th><th>Team 2</th><th>Referee</th></tr>`;
      pf.forEach(f => {
        const refText = f.referee ? f.referee.name : 'UNASSIGNED';
        const rowClass = f.refereeConflict ? ' class="conflict"' : '';
        html += `<tr${rowClass}><td>${f.time}</td><td>${f.round}</td><td>${f.team1.name}</td><td>${f.team2.name}</td><td>${refText}${f.refereeConflict ? ' *' : ''}</td></tr>`;
      });
      html += `</table>`;
      if (idx < pitches.length - 1 && idx % 2 === 1) html += `<div class="page-break"></div>`;
    });
  } else if (mode === 'byTeam') {
    html += `<div class="print-header"><h1>U7's Waterfall - Team Schedules</h1><p>Generated ${new Date().toLocaleDateString()}</p></div>`;
    html += `<p class="legend">* = Referee conflict (your team also playing this round). Highlighted rows = referee duty.</p>`;
    const sortedTeams = [...teams].sort((a, b) => a.club.localeCompare(b.club) || a.name.localeCompare(b.name));
    let currentClub = '';
    sortedTeams.forEach((team, idx) => {
      if (team.club !== currentClub) { currentClub = team.club; html += `<h2>${currentClub}</h2>`; }
      const tf = fixtures.filter(f => f.team1.id === team.id || f.team2.id === team.id).sort((a, b) => a.time.localeCompare(b.time));
      const refDuties = fixtures.filter(f => f.referee && f.referee.id === team.id).sort((a, b) => a.time.localeCompare(b.time));
      html += `<h3>${team.name}${team.zone ? ` (Zone ${team.zone})` : ''} - ${tf.length} matches, ${refDuties.length} ref duties</h3>`;
      const schedule = [];
      tf.forEach(f => {
        const opp = f.team1.id === team.id ? f.team2 : f.team1;
        schedule.push({ time: f.time, pitch: f.pitch, zone: f.zone, type: 'PLAY', detail: `vs ${opp.name}`, conflict: false });
      });
      refDuties.forEach(f => {
        schedule.push({ time: f.time, pitch: f.pitch, zone: f.zone, type: 'REF', detail: `${f.team1.name} vs ${f.team2.name}`, conflict: f.refereeConflict });
      });
      schedule.sort((a, b) => a.time.localeCompare(b.time) || (a.type === 'PLAY' ? -1 : 1));
      html += `<table><tr><th>Time</th><th>Pitch</th><th>Zone</th><th>Activity</th><th>Detail</th></tr>`;
      schedule.forEach(s => {
        const rowClass = s.conflict ? ' class="conflict"' : s.type === 'REF' ? ' class="ref-duty"' : '';
        html += `<tr${rowClass}><td>${s.time}</td><td>${s.pitch}</td><td>${s.zone || ''}</td><td>${s.type}${s.conflict ? ' *' : ''}</td><td>${s.detail}</td></tr>`;
      });
      html += `</table>`;
      if (idx < sortedTeams.length - 1 && idx % 6 === 5) html += `<div class="page-break"></div>`;
    });
  }

  html += `</body></html>`;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 500);
};
