/**
 * FRESHERS SIGN-UP — BACKEND
 * ------------------------------------------------------------------
 * Saves sign-ups from the website into this spreadsheet.
 * Only you can read it.
 *
 * SETUP (once):
 *   1. Run setup()
 *   2. Deploy > New deployment > Web app
 *        Execute as:     Me
 *        Who has access: Anyone
 *   3. Copy the /exec URL into CONFIG.endpoint in index.html
 *
 * If you ever edit this file, redeploy with
 *   Deploy > Manage deployments > pencil > Version: New version > Deploy
 * or the site keeps running the old code.
 */

const SHEET_NAME = 'Responses';

/** Want an email on every sign-up? Put your address here. Leave '' for none. */
const NOTIFY_EMAIL = 'jeetjhawar700@gmail.com';

/** Sheet columns. Left = header, right = key sent by the website. */
const COLS = [
  ['Timestamp',    'timestamp'],
  ['Name',         'name'],
  ['Roll no',      'roll'],
  ['WhatsApp',     'phone'],
  ['Email',        'email'],
  ['Performing',   'performing'],
  ['Acts',         'acts'],
  ['Group size',   'teamSize'],
  ['Duration',     'duration'],
  ['Act notes',    'actNotes'],
  ['Volunteering', 'volunteering'],
  ['Available',    'availability'],
  ['Volunteer notes', 'volNotes'],
  ['Updated',      'updated']
];

const EMAIL_COL = 5;   // column E


/* ================= receive a sign-up ================= */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    const body = JSON.parse(e.postData.contents);
    if (body.website) return json({ ok: true });          // honeypot: a bot
    if (!body.name || !body.email) return json({ ok: false, error: 'Missing name or email' });

    const sheet = getSheet();
    const now   = new Date();
    const email = String(body.email).trim().toLowerCase();

    const row = COLS.map(function (c) {
      if (c[1] === 'timestamp' || c[1] === 'updated') return now;
      return String(body[c[1]] == null ? '' : body[c[1]]).slice(0, 1200);
    });

    // same email again = update, not a duplicate row
    const at = findRowByEmail(sheet, email);
    if (at > 0) {
      row[0] = sheet.getRange(at, 1).getValue();          // keep the first timestamp
      sheet.getRange(at, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    notify(body, at > 0);
    return json({ ok: true });

  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}


/* ================= live counter (a number, nothing else) ================= */
function doGet(e) {
  if (e && e.parameter && e.parameter.stats) {
    try {
      return json({ ok: true, count: Math.max(0, getSheet().getLastRow() - 1) });
    } catch (err) {
      return json({ ok: false });
    }
  }
  return ContentService.createTextOutput('Freshers sign-up endpoint is live.')
                       .setMimeType(ContentService.MimeType.TEXT);
}


/* ================= one-time setup ================= */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME, 0);
  const headers = COLS.map(function (c) { return c[0]; });
  sheet.getRange(1, 1, 1, headers.length)
       .setValues([headers]).setFontWeight('bold')
       .setBackground('#221038').setFontColor('#F7F0E6');
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 34);
  sheet.getRange(2, 3, sheet.getMaxRows() - 1, 2).setNumberFormat('@');   // roll + phone as text
  for (let i = 1; i <= headers.length; i++) sheet.setColumnWidth(i, 150);
  sheet.setColumnWidth(2, 190);
  sheet.setColumnWidth(5, 230);

  makeView(ss, 'Performers',
    '=IFERROR(QUERY(' + SHEET_NAME + '!A2:N, "select B,C,D,E,G,H,I,J where F = \'Yes\' order by B", 0), "Nobody yet.")',
    ['Name','Roll no','WhatsApp','Email','Acts','Group size','Duration','Notes']);

  makeView(ss, 'Volunteers',
    '=IFERROR(QUERY(' + SHEET_NAME + '!A2:N, "select B,C,D,E,L,M where K = \'Yes\' order by B", 0), "Nobody yet.")',
    ['Name','Roll no','WhatsApp','Email','Available','Notes']);

  SpreadsheetApp.getUi().alert(
    'Ready.\n\nNow: Deploy > New deployment > Web app\n' +
    'Execute as: Me\nWho has access: Anyone\n\n' +
    'Then paste the /exec URL into index.html.');
}

function makeView(ss, name, formula, headers) {
  const s = ss.getSheetByName(name) || ss.insertSheet(name);
  s.clear();
  s.getRange(1, 1, 1, headers.length)
   .setValues([headers]).setFontWeight('bold')
   .setBackground('#2B1646').setFontColor('#F7F0E6');
  s.setFrozenRows(1);
  s.getRange(2, 1).setFormula(formula);
  for (let i = 1; i <= headers.length; i++) s.setColumnWidth(i, 165);
}


/* ================= helpers ================= */
function getSheet() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!s) throw new Error('Run setup() first.');
  return s;
}

function findRowByEmail(sheet, email) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const vals = sheet.getRange(2, EMAIL_COL, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toLowerCase() === email) return i + 2;
  }
  return 0;
}

function notify(body, wasUpdate) {
  if (!NOTIFY_EMAIL) return;
  try {
    const what = [];
    if (body.performing   === 'Yes') what.push('performing');
    if (body.volunteering === 'Yes') what.push('volunteering');
    MailApp.sendEmail(NOTIFY_EMAIL,
      (wasUpdate ? 'Updated: ' : 'New sign-up: ') + body.name,
      ['Name:      ' + body.name,
       'Roll:      ' + body.roll,
       'WhatsApp:  ' + body.phone,
       'Email:     ' + body.email,
       'Doing:     ' + (what.join(' + ') || 'neither'),
       'Acts:      ' + (body.acts || '-'),
       'Available: ' + (body.availability || '-')].join('\n'));
  } catch (ignore) {}
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}
