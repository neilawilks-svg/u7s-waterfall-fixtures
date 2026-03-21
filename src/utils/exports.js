import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Pre-load site plan at module init. fetch → ArrayBuffer → FileReader gives
// a guaranteed data:image/png;base64,... URL without call-stack limits.
// Dimensions are read directly from the PNG IHDR binary header (bytes 16-23).
let _sitePlanCache = null;
const _sitePlanPromise = (async () => {
  try {
    const r = await fetch(import.meta.env.BASE_URL + 'site-plan.png');
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // PNG IHDR: width = bytes 16-19, height = bytes 20-23
    const w = ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
    const h = ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
    // FileReader encodes large binary data reliably without spread/btoa limits
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(new Blob([buf], { type: 'image/png' }));
    });
    _sitePlanCache = { dataUrl, width: w || 800, height: h || 600 };
    return _sitePlanCache;
  } catch (e) {
    console.warn('Site plan could not be loaded:', e.message);
    return null;
  }
})();

// Pre-load QR code image at module init, same pattern as site plan.
let _qrCodeCache = null;
const _qrCodePromise = (async () => {
  try {
    const r = await fetch(import.meta.env.BASE_URL + 'QR_View_Fixtures.jpeg');
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    // Parse JPEG dimensions from SOF marker
    const bytes = new Uint8Array(buf);
    let qrW = 200, qrH = 260; // sensible fallback matching known aspect
    let i = 2;
    while (i + 4 < bytes.length) {
      if (bytes[i] !== 0xFF) break;
      const marker = bytes[i + 1];
      const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
      if (marker >= 0xC0 && marker <= 0xC3 && marker !== 0xC4) {
        qrH = (bytes[i + 5] << 8) | bytes[i + 6];
        qrW = (bytes[i + 7] << 8) | bytes[i + 8];
        break;
      }
      i += 2 + segLen;
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(new Blob([buf], { type: 'image/jpeg' }));
    });
    _qrCodeCache = { dataUrl, width: qrW, height: qrH };
    return _qrCodeCache;
  } catch (e) {
    console.warn('QR code could not be loaded:', e.message);
    return null;
  }
})();

/**
 * Add the QR code to the current page of `doc`.
 *
 * If there is 25 mm or more below `contentEndY`, the QR is placed centred in
 * that space, sized as large as possible (capped at 75 mm wide).
 * If less space is available the QR falls back to a 20 mm wide thumbnail in
 * the top-right corner of the page — which is always blank because all page
 * titles are centre-aligned.
 * The function is a no-op when qrData is null (image failed to load).
 */
function addQrCode(doc, contentEndY, qrData) {
  if (!qrData) return;
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 10;
  const usableW = pageW - 2 * margin;
  const aspect = qrData.width / qrData.height; // ~0.767 for the 1024×1334 image

  const gap = 5;
  const availableH = pageH - margin - contentEndY - gap;

  if (availableH >= 25) {
    // Size to fill the available box, never exceeding 75 mm in either dimension
    let imgW = Math.min(usableW, 75);
    let imgH = imgW / aspect;
    if (imgH > availableH - 4) { imgH = availableH - 4; imgW = imgH * aspect; }
    const x = margin + (usableW - imgW) / 2;
    const y = contentEndY + gap + (availableH - 4 - imgH) / 2;
    doc.addImage(qrData.dataUrl, 'JPEG', x, y, imgW, imgH, undefined, 'FAST');
  } else {
    // Fallback: small thumbnail in the top-right corner, capped to 16 mm height so it
    // stays within the title area above the table (which starts at margin + 18 mm).
    const imgH = 16;
    const imgW = imgH * aspect;
    doc.addImage(qrData.dataUrl, 'JPEG', pageW - margin - imgW, margin + 1, imgW, imgH, undefined, 'FAST');
  }
}

export const downloadFixturesAsExcel = async (fixtures, teams, zones, setError) => {
  try {
    const XLSX = await import('xlsx');

    const wb = XLSX.utils.book_new();

    const fixtureData = [['Round', 'Time', 'Pitch', 'Zone', 'Team 1', 'Team 2', 'Club 1', 'Club 2', 'Cross-Zone', 'Referee', 'Referee Club', 'Ref Conflict']];
    fixtures.forEach(f => {
      fixtureData.push([f.round, f.time, f.pitch, f.zone || '', f.team1.name, f.team2.name, f.team1.club, f.team2.club, f.isCrossZone ? 'Yes' : '',
        f.referee ? f.referee.name : f.refereeUnavailable ? `Unavailable (${f.team1.club} or ${f.team2.club} to officiate)` : 'UNASSIGNED', f.referee ? f.referee.club : '', f.refereeConflict ? 'YES' : '']);
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
          f.referee ? f.referee.name : f.refereeUnavailable ? `Unavailable (${f.team1.club} or ${f.team2.club} to officiate)` : 'UNASSIGNED', f.refereeConflict ? 'YES' : '']);
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
          f.referee ? f.referee.name : f.refereeUnavailable ? `Unavailable (${f.team1.club} or ${f.team2.club} to officiate)` : 'UNASSIGNED', f.refereeConflict ? 'YES' : '']);
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
          f.referee ? f.referee.name : f.refereeUnavailable ? `Unavailable (${f.team1.club} or ${f.team2.club} to officiate)` : 'UNASSIGNED', f.refereeConflict ? 'YES' : '']);
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

// Shared helper: writes one club's summary page + per-team pages into an existing doc.
// Call with addPageFirst=false for the first club in a document, true for subsequent clubs.
const writeClubPages = (doc, clubName, fixtures, teams, sitePlanData, lunchEnabled, lunchStart, lunchEnd, addPageFirst, includeSitePlan = true, qrData = null) => {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const usableW = pageW - 2 * margin;
  const clubTeams = teams.filter(t => t.club === clubName);

  if (addPageFirst) doc.addPage();

  // Summary page
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(124, 18, 41);
  doc.text(clubName, pageW / 2, margin + 9, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Festival Pack', pageW / 2, margin + 16, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Generated ' + new Date().toLocaleDateString(), pageW / 2, margin + 21, { align: 'center' });

  const overviewHead = [['Team', 'Zone', 'Matches', 'Ref Duties']];
  const overviewBody = clubTeams.map(team => {
    const matchCount = fixtures.filter(f => f.team1.id === team.id || f.team2.id === team.id).length;
    const refCount = fixtures.filter(f => f.referee && f.referee.id === team.id).length;
    return [team.name, team.zone || '-', matchCount, refCount];
  });
  doc.autoTable({
    startY: margin + 25,
    head: overviewHead,
    body: overviewBody,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [124, 18, 41], fontSize: 10, cellPadding: 3, textColor: [255, 255, 255] },
    margin: { left: margin, right: margin },
  });
  addQrCode(doc, doc.lastAutoTable.finalY + 2, qrData);

  // One page per team
  for (const team of clubTeams) {
    doc.addPage();
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(124, 18, 41);
    doc.text(team.name, pageW / 2, margin + 8, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(team.club + (team.zone ? '  |  Zone ' + team.zone : ''), pageW / 2, margin + 14, { align: 'center' });

    const teamMatches = fixtures
      .filter(f => f.team1.id === team.id || f.team2.id === team.id)
      .sort((a, b) => a.time.localeCompare(b.time));
    const refDuties = fixtures.filter(f => f.referee && f.referee.id === team.id);
    const schedule = [];
    teamMatches.forEach((f, idx) => {
      const opp = f.team1.id === team.id ? f.team2 : f.team1;
      const isAway = team.zone && f.zone !== team.zone;
      schedule.push({
        time: f.time, type: 'MATCH ' + (idx + 1), pitch: 'Pitch ' + f.pitch,
        detail: 'vs ' + opp.name + ' (' + opp.club + ')',
        note: isAway ? 'AWAY - Zone ' + f.zone : (f.zone ? 'Zone ' + f.zone : ''),
        referee: f.referee ? f.referee.name : f.refereeUnavailable ? `${f.team1.club} or ${f.team2.club}` : '\u2014',
        refereeUnavailable: !!f.refereeUnavailable,
        isRef: false, isLunch: false,
      });
    });
    refDuties.forEach(f => {
      schedule.push({
        time: f.time, type: 'REF DUTY', pitch: 'Pitch ' + f.pitch,
        detail: f.team1.name + ' vs ' + f.team2.name,
        note: f.refereeConflict ? 'CONFLICT' : (f.zone ? 'Zone ' + f.zone : ''),
        referee: '', refereeUnavailable: false,
        isRef: true, isConflict: f.refereeConflict, isLunch: false,
      });
    });
    schedule.sort((a, b) => a.time.localeCompare(b.time) || (a.isRef ? 1 : -1));

    if (lunchEnabled && lunchStart && lunchEnd) {
      const lunchRow = { time: lunchStart, type: 'LUNCH', pitch: '', detail: 'Lunch Break', note: lunchStart + ' \u2013 ' + lunchEnd, referee: '', refereeUnavailable: false, isRef: false, isLunch: true };
      const idx = schedule.findIndex(s => s.time >= lunchStart);
      idx === -1 ? schedule.push(lunchRow) : schedule.splice(idx, 0, lunchRow);
    }

    doc.autoTable({
      startY: margin + 18,
      head: [['Time', 'Type', 'Location', 'Detail', 'Note', 'Referee']],
      body: schedule.map(s => [s.time, s.type, s.pitch, s.detail, s.note, s.referee]),
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [124, 18, 41], fontSize: 8.5, cellPadding: 2.5, halign: 'center', textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 25 },
        5: { cellWidth: 28 },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const row = data.row.raw;
          if (row[1] === 'REF DUTY') data.cell.styles.fillColor = [219, 234, 254];
          if (row[1] === 'LUNCH') { data.cell.styles.fillColor = [254, 243, 199]; data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = [146, 64, 14]; }
          if (row[4] === 'CONFLICT') { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; }
          if (typeof row[4] === 'string' && row[4].startsWith('AWAY')) { data.cell.styles.textColor = [180, 83, 9]; data.cell.styles.fontStyle = 'bold'; }
          if (data.column.index === 5 && schedule[data.row.index]?.refereeUnavailable) {
            data.cell.styles.textColor = [180, 120, 0];
            data.cell.styles.fontStyle = 'italic';
          }
        }
      },
    });

    let postContentY = doc.lastAutoTable.finalY;
    if (sitePlanData && includeSitePlan) {
      const tableBottomY = postContentY + 5;
      const availableH = pageH - margin - tableBottomY;
      if (availableH > 40) {
        const aspect = sitePlanData.width / sitePlanData.height;
        let imgW = usableW;
        let imgH = imgW / aspect;
        if (imgH > availableH) { imgH = availableH; imgW = imgH * aspect; }
        doc.addImage(sitePlanData.dataUrl, 'PNG', margin + (usableW - imgW) / 2, tableBottomY, imgW, imgH, undefined, 'FAST');
        postContentY = tableBottomY + imgH;
      }
    }
    addQrCode(doc, postContentY, qrData);
  }
};

export const downloadClubPackPDF = async (clubName, fixtures, teams, setError, lunchEnabled, lunchStart, lunchEnd) => {
  try {
    const [sitePlanData, qrData] = await Promise.all([
      _sitePlanCache ?? _sitePlanPromise,
      _qrCodeCache   ?? _qrCodePromise,
    ]);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    writeClubPages(doc, clubName, fixtures, teams, sitePlanData, lunchEnabled, lunchStart, lunchEnd, false, true, qrData);
    doc.save(clubName.replace(/[^a-zA-Z0-9]/g, '_') + '_Festival_Pack.pdf');
  } catch (err) {
    setError('Error generating club pack PDF: ' + err.message);
    console.error(err);
  }
};

export const openClubPackPDFInTab = async (clubName, fixtures, teams, setLoading, lunchEnabled, lunchStart, lunchEnd) => {
  setLoading(true);
  try {
    const [sitePlanData, qrData] = await Promise.all([
      _sitePlanCache ?? _sitePlanPromise,
      _qrCodeCache   ?? _qrCodePromise,
    ]);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    writeClubPages(doc, clubName, fixtures, teams, sitePlanData, lunchEnabled, lunchStart, lunchEnd, false, true, qrData);
    window.open(doc.output('bloburi'), '_blank');
  } catch (err) {
    console.error('Error generating club pack PDF:', err);
  } finally {
    setLoading(false);
  }
};


export const downloadAllClubPacksPDF = async (fixtures, teams, setError, lunchEnabled, lunchStart, lunchEnd, includeSitePlan = true) => {
  try {
    const [sitePlanData, qrData] = await Promise.all([
      includeSitePlan ? (_sitePlanCache ?? _sitePlanPromise) : Promise.resolve(null),
      _qrCodeCache ?? _qrCodePromise,
    ]);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const clubs = [...new Set(teams.map(t => t.club))].sort();
    clubs.forEach((club, i) => {
      writeClubPages(doc, club, fixtures, teams, sitePlanData, lunchEnabled, lunchStart, lunchEnd, i > 0, includeSitePlan, qrData);
    });
    doc.save(includeSitePlan ? 'All_Clubs_Festival_Pack.pdf' : 'All_Clubs_Festival_Pack_No_Site_Plan.pdf');
  } catch (err) {
    setError('Error generating all club packs PDF: ' + err.message);
    console.error(err);
  }
};

export const downloadTeamFixturePDF = async (team, fixtures, setPdfLoading) => {
  setPdfLoading(true);
  try {
    const [doc, qrData] = [
      new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }),
      _qrCodeCache ?? await _qrCodePromise,
    ];
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
        referee: f.referee ? f.referee.name : f.refereeUnavailable ? `${f.team1.club} or ${f.team2.club}` : '\u2014',
        refereeUnavailable: !!f.refereeUnavailable,
        isRef: false, isConflict: false
      });
    });
    refDuties.forEach(f => {
      schedule.push({
        time: f.time, type: 'REF DUTY', pitch: 'Pitch ' + f.pitch,
        detail: f.team1.name + ' vs ' + f.team2.name,
        note: f.refereeConflict ? 'CONFLICT' : '',
        referee: '', refereeUnavailable: false,
        isRef: true, isConflict: f.refereeConflict
      });
    });
    schedule.sort((a, b) => a.time.localeCompare(b.time) || (a.isRef ? 1 : -1));

    const tableHead = [['Time', 'Type', 'Location', 'Detail', 'Note', 'Referee']];
    const tableBody = schedule.map(s => [s.time, s.type, s.pitch, s.detail, s.note, s.referee]);

    doc.autoTable({
      startY: margin + 18,
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [124, 18, 41], fontSize: 9, cellPadding: 3, halign: 'center', textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 25 },
        5: { cellWidth: 28 },
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
          if (data.column.index === 5 && schedule[data.row.index]?.refereeUnavailable) {
            data.cell.styles.textColor = [180, 120, 0];
            data.cell.styles.fontStyle = 'italic';
          }
        }
      },
    });

    // Footer
    const finalY = doc.lastAutoTable.finalY + 6;
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated ' + new Date().toLocaleDateString(), pageW / 2, finalY, { align: 'center' });

    addQrCode(doc, finalY + 3, qrData);

    window.open(doc.output('bloburi'), '_blank');
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
          f.referee ? f.referee.name : f.refereeUnavailable ? `Unavailable (${f.team1.club} or ${f.team2.club} to officiate)` : 'UNASSIGNED']);
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
        const refText = f.referee ? f.referee.name : f.refereeUnavailable ? `Unavailable (${f.team1.club} or ${f.team2.club} to officiate)` : 'UNASSIGNED';
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
        const refText = f.referee ? f.referee.name : f.refereeUnavailable ? `Unavailable (${f.team1.club} or ${f.team2.club} to officiate)` : 'UNASSIGNED';
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
