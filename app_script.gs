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
  country: 11,
  wantCount: 16
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Fetch Data')
    .addItem('Fill Missing Data', 'fillMissingData')
    .addSeparator()
    .addItem('Fetch Discogs Want Counts', 'fetchDiscogsWantCounts')
    .addItem('Set Discogs API Token', 'setDiscogsToken')
    .addItem('Debug Discogs Search', 'debugDiscogsSearch')
    .addToUi();
}

function setDiscogsToken() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Discogs API Token',
    'Enter your Discogs personal access token\n(discogs.com → Settings → Developers → Generate Token):',
    ui.ButtonSet.OK_CANCEL
  );
  if (result.getSelectedButton() !== ui.Button.OK) return;
  const token = result.getResponseText().trim();
  if (!token) { ui.alert('No token entered.'); return; }
  PropertiesService.getUserProperties().setProperty('DISCOGS_TOKEN', token);
  ui.alert('Discogs token saved.');
}

function debugDiscogsSearch() {
  const ui = SpreadsheetApp.getUi();
  const token = PropertiesService.getUserProperties().getProperty('DISCOGS_TOKEN');

  const artistResult = ui.prompt('Debug: Artist', 'Enter artist name to test:', ui.ButtonSet.OK_CANCEL);
  if (artistResult.getSelectedButton() !== ui.Button.OK) return;
  const titleResult = ui.prompt('Debug: Title', 'Enter release title to test:', ui.ButtonSet.OK_CANCEL);
  if (titleResult.getSelectedButton() !== ui.Button.OK) return;

  const artist = artistResult.getResponseText().trim();
  const title = titleResult.getResponseText().trim();
  const params = encodeURIComponent(artist) + '&release_title=' + encodeURIComponent(title) + '&type=release';
  const url = 'https://api.discogs.com/database/search?artist=' + params + (token ? '&token=' + token : '');

  const response = UrlFetchApp.fetch(url, {
    headers: { 'User-Agent': 'UPCSpreadsheetFiller/1.0' },
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const body = JSON.parse(response.getContentText());
  const first = body.results?.[0];

  let masterWant = 'n/a';
  const masterId = first?.master_id;
  if (masterId) {
    Utilities.sleep(1000);
    const masterResp = UrlFetchApp.fetch('https://api.discogs.com/masters/' + masterId + (token ? '?token=' + token : ''), {
      headers: { 'User-Agent': 'UPCSpreadsheetFiller/1.0' },
      muteHttpExceptions: true
    });
    if (masterResp.getResponseCode() === 200) {
      masterWant = JSON.parse(masterResp.getContentText()).community?.want ?? 'not present';
    }
  }

  const msg = [
    'Token set: ' + !!token,
    'HTTP status: ' + status,
    'Results found: ' + (body.results?.length ?? 0),
    first ? 'Top result: ' + (first.title ?? 'n/a') : '',
    first ? 'master_id: ' + (masterId ?? 'none') : '',
    first ? 'Release community.want: ' + (first.community?.want ?? 'not present') : '',
    first ? 'Master community.want: ' + masterWant : ''
  ].filter(Boolean).join('\n');

  ui.alert('Discogs Debug', msg, ui.ButtonSet.OK);
}

function searchDiscogs(artist, title, token) {
  const authParam = token ? '&token=' + token : '';
  const params = encodeURIComponent(artist) + '&release_title=' + encodeURIComponent(title) + '&type=release';
  const searchUrl = 'https://api.discogs.com/database/search?artist=' + params + authParam;
  const searchResp = UrlFetchApp.fetch(searchUrl, {
    headers: { 'User-Agent': 'UPCSpreadsheetFiller/1.0' },
    muteHttpExceptions: true
  });
  if (searchResp.getResponseCode() !== 200) return null;
  const searchData = JSON.parse(searchResp.getContentText());
  if (!searchData.results || searchData.results.length === 0) return null;

  const masterId = searchData.results[0].master_id;
  if (!masterId) return searchData.results[0].community?.want ?? null;

  Utilities.sleep(1000); // second call, respect rate limit
  const masterUrl = 'https://api.discogs.com/masters/' + masterId + '?' + authParam.slice(1);
  const masterResp = UrlFetchApp.fetch(masterUrl, {
    headers: { 'User-Agent': 'UPCSpreadsheetFiller/1.0' },
    muteHttpExceptions: true
  });
  if (masterResp.getResponseCode() !== 200) return searchData.results[0].community?.want ?? null;
  const masterData = JSON.parse(masterResp.getContentText());
  return masterData.community?.want ?? searchData.results[0].community?.want ?? null;
}

function fetchDiscogsWantCounts() {
  const token = PropertiesService.getUserProperties().getProperty('DISCOGS_TOKEN');
  if (!token) {
    SpreadsheetApp.getUi().alert('No Discogs token set. Use "Set Discogs API Token" first.');
    return;
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const range = sheet.getRange(2, 1, lastRow - 1, COLUMNS.wantCount);
  const rows = range.getValues();
  let updated = 0;

  for (let i = 0; i < rows.length; i++) {
    const artist = rows[i][COLUMNS.artist - 1];
    const title = rows[i][COLUMNS.title - 1];
    if (!artist || !title || artist === '??' || title === '??') continue;
    if (!needsFill(rows[i][COLUMNS.wantCount - 1])) continue;

    spreadsheet.toast(`Fetching want count for row ${i + 2}...`, 'Discogs', 3);
    Utilities.sleep(1000); // respect Discogs rate limit (60 req/min)

    const want = searchDiscogs(artist, title, token);
    sheet.getRange(i + 2, COLUMNS.wantCount).setValue(want !== null ? want : '??');
    updated++;
  }

  spreadsheet.toast(`Updated ${updated} row(s) with Discogs want counts.`, 'Discogs', 10);
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
