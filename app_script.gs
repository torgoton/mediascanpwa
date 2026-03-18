const COLUMNS = {
  barcode: 2,
  artist: 3,
  title: 4,
  format: 5,
  label: 6,
  catalogNumber: 7,
  packaging: 8,
  releaseDate: 9,
  primaryType: 10,
  country: 11
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('MusicBrainz')
    .addItem('Fill Missing Data', 'fillMissingData')
    .addToUi();
}

function needsFill(value) {
  return !value || value.toString().trim() === '';
}

function fetchRelease(barcode) {
  const url = `https://musicbrainz.org/ws/2/release?query=barcode:${barcode}&fmt=json&inc=release-groups`;
  const response = UrlFetchApp.fetch(url, {
    headers: { 'User-Agent': 'UPCSpreadsheetFiller/1.0' },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) return null;
  const data = JSON.parse(response.getContentText());
  if (!data.releases || data.releases.length === 0) return null;
  const r = data.releases[0];
  return {
    artist: r['artist-credit']?.[0]?.name,
    title: r.title,
    format: r.media?.[0]?.format,
    label: r['label-info']?.[0]?.label?.name,
    catalogNumber: r['label-info']?.[0]?.['catalog-number'],
    packaging: r.packaging,
    releaseDate: r.date,
    primaryType: r['release-group']?.['primary-type'],
    country: r.country
  };
}

function fillMissingData() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const range = sheet.getRange(2, 1, lastRow - 1, Object.keys(COLUMNS).length + 1);
  const rows = range.getValues();
  const total = rows.filter(row => row[COLUMNS.barcode - 1]).length;
  let processed = 0;
  let filled = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const barcode = row[COLUMNS.barcode - 1];
    if (!barcode) continue;

    processed++;
    spreadsheet.toast(`Checking row ${i + 2} (${processed}/${total})...`, 'Fill Missing Data', 3);

    const hasMissing = Object.entries(COLUMNS)
      .filter(([key]) => key !== 'barcode')
      .some(([, col]) => needsFill(row[col - 1]));
    if (!hasMissing) continue;

    Utilities.sleep(1000); // respect MusicBrainz rate limit
    const release = fetchRelease(barcode);
    const fallback = release ? null : '??';

    let changed = false;
    for (const [key, col] of Object.entries(COLUMNS)) {
      if (key === 'barcode') continue;
      if (needsFill(row[col - 1])) {
        sheet.getRange(i + 2, col).setValue(fallback ?? (release[key] || 'Unknown'));
        changed = true;
      }
    }
    if (changed) filled++;
  }

  spreadsheet.toast(`Updated ${filled} row(s).`, 'Fill Missing Data', 10);
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    sheet.appendRow([
      new Date(),
      data.barcode,
      data.artist,
      data.album,
      data.format,
      data.label,
      data.catalogNumber,
      data.packaging,
      data.releaseDate,
      data.primaryType,
      data.country
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({success: true}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
