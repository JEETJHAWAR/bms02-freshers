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

/* The /exec URL is public. Anything checked only in the browser is not checked at
 * all — a script can POST here directly — so the rules from index.html are
 * repeated here. Keep them in step with CONFIG.emailDomain / rollPrefix / rollDigits. */
const EMAIL_DOMAIN = 'iimk.ac.in';
const ROLL_RE      = /^BMS\/01\/\d{3}$/i;

/** Google Sheets runs any cell that starts with = + - or @ as a formula. A public
 *  endpoint must never be able to write one: an injected =IMAGE("...") would fire
 *  the moment an organiser opened the sheet and could send every signer's name,
 *  roll, phone and email to whoever planted it. Prefixing with ' keeps it as text. */
function safeCell(v) {
  const s = String(v == null ? '' : v).slice(0, 1200);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/** exactly one @, and the domain is ours */
function emailAllowed(v) {
  const e = String(v == null ? '' : v).trim().toLowerCase();
  const parts = e.split('@');
  return parts.length === 2 && parts[0].length > 0 && parts[1] === EMAIL_DOMAIN;
}


/* ================= receive a sign-up ================= */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'admin')        return adminList(body.pass);   // read-only: no lock
    if (body.action === 'admin-delete') return adminDelete(body.pass, body.email);
    if (body.action === 'admin-closed') return adminSetClosed(body.pass, body.closed);
    return saveSignup(body);
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function saveSignup(body) {
  if (signupsClosed()) return json({ ok: false, closed: true, error: 'Sign-ups are closed' });
  if (body.website) return json({ ok: true });          // honeypot: a bot
  if (!body.name || !body.email) return json({ ok: false, error: 'Missing name or email' });

  // re-check the browser's rules here; see EMAIL_DOMAIN above for why
  if (!emailAllowed(body.email))
    return json({ ok: false, error: 'Use your institute email address' });
  if (!ROLL_RE.test(String(body.roll || '').trim()))
    return json({ ok: false, error: 'That roll number is not in the BMS/01/123 format' });

  const lock = LockService.getScriptLock();
  let wasUpdate = false;
  try {
    lock.waitLock(20000);

    const sheet = getSheet();
    const now   = new Date();
    const email = String(body.email).trim().toLowerCase();

    const row = COLS.map(function (c) {
      if (c[1] === 'timestamp' || c[1] === 'updated') return now;
      return safeCell(body[c[1]]);
    });

    // same email again = update, not a duplicate row
    const at = findRowByEmail(sheet, email);
    if (at > 0) {
      wasUpdate = true;
      row[0] = sheet.getRange(at, 1).getValue();          // keep the first timestamp
      sheet.getRange(at, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }

  // outside the lock: sending the emails must not hold up other requests
  notify(body, wasUpdate);
  confirmMail(body, wasUpdate);
  return json({ ok: true });
}


/* ================= live counter (a number, nothing else) ================= */
function doGet(e) {
  if (e && e.parameter && e.parameter.stats) {
    try {
      return json({ ok: true, count: Math.max(0, getSheet().getLastRow() - 1),
                    closed: signupsClosed() });
    } catch (err) {
      return json({ ok: false });
    }
  }
  return ContentService.createTextOutput('Freshers sign-up endpoint is live.')
                       .setMimeType(ContentService.MimeType.TEXT);
}


/* ================= the pause switch =================
 * A checkbox in the sheet: Settings tab, cell B1. Tick it and the site stops
 * accepting sign-ups (the page swaps the form for a closed notice). Untick to
 * reopen. No redeploy needed to flip it — this reads the cell on every request.
 * The tab creates itself on the first request after this code is deployed.
 */
function settingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName('Settings');
  if (!s) {
    s = ss.insertSheet('Settings');
    s.getRange('A1').setValue('Sign-ups closed?').setFontWeight('bold');
    s.getRange('B1').insertCheckboxes();
    s.getRange('A3').setValue('Tick B1 to close sign-ups. You can also do this from the admin page.')
                    .setFontColor('#888');
    s.setColumnWidth(1, 160);
  }
  return s;
}

function signupsClosed() {
  try {
    return settingsSheet().getRange('B1').getValue() === true;
  } catch (err) {
    return false;   // if anything is off, fail open — better than losing sign-ups
  }
}

/** Flip the switch from the admin page. */
function adminSetClosed(pass, closed) {
  if (sha256hex(String(pass || '')) !== ADMIN_PASS_SHA256)
    return json({ ok: false, error: 'Wrong password' });
  const want = (closed === true);
  settingsSheet().getRange('B1').setValue(want);
  return json({ ok: true, closed: want });
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


/* ================= admin page: the full list ================= */
/**
 * Only the SHA-256 of the admin password lives here — admin.html sends the
 * password, we hash it and compare. The password itself is never in the repo.
 */
const ADMIN_PASS_SHA256 = 'c17938773a4d4bef02efd39d4ccbd3ad9d9ff6965b5799c5760c2714a2daad7f';

function adminList(pass) {
  if (sha256hex(String(pass || '')) !== ADMIN_PASS_SHA256)
    return json({ ok: false, error: 'Wrong password' });
  const sheet = getSheet();
  const last  = sheet.getLastRow();
  const rows  = last < 2 ? [] : sheet.getRange(2, 1, last - 1, COLS.length).getDisplayValues();
  return json({ ok: true, keys: COLS.map(function (c) { return c[1]; }), rows: rows,
                closed: signupsClosed() });
}

function adminDelete(pass, email) {
  if (sha256hex(String(pass || '')) !== ADMIN_PASS_SHA256)
    return json({ ok: false, error: 'Wrong password' });
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const sheet = getSheet();
    const at = findRowByEmail(sheet, String(email || '').trim().toLowerCase());
    if (at < 2) return json({ ok: false, error: 'Not found' });
    sheet.deleteRow(at);
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
  return json({ ok: true });
}

function sha256hex(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ((b & 0xFF) + 0x100).toString(16).slice(1); }).join('');
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

/** Confirmation mail to the person who signed up. */
function confirmMail(body, wasUpdate) {
  try {
    const what = [];
    if (body.performing   === 'Yes') what.push('perform' + (body.acts ? ' (' + body.acts + ')' : ''));
    if (body.volunteering === 'Yes') what.push('volunteer');
    MailApp.sendEmail({
      to: String(body.email),
      name: 'BMS-02 Freshers',
      subject: (wasUpdate ? 'Updated — ' : '') + "You're on the list · Freshers " + (body.year || ''),
      body:
        'Hi ' + body.name + ',\n\n' +
        (wasUpdate
          ? 'Your sign-up has been updated. Here is where it stands now:\n\n'
          : 'You are on the list for Freshers' + (body.eventDate ? ' — ' + body.eventDate : '') + '.\n\n') +
        'You signed up to ' + (what.join(' and ') || 'help out') + '.\n\n' +
        'The organisers will contact you on WhatsApp with your slot or your job.\n' +
        'Change of plans? Submit the form again with this email — it replaces your old answers.\n\n' +
        '— BMS-01 · Students’ Council'
    });
  } catch (ignore) {}   // over quota or a bad address — the sign-up itself is already saved
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}
