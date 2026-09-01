# Setup — about 20 minutes

Three things to do: build the response sheet, connect it, publish.

---

## 1. Build the response sheet (10 min)

1. Go to **[sheets.new](https://sheets.new)**. Name it `BMS-02 Freshers`.
2. **Extensions → Apps Script**.
3. Delete everything in the editor. Copy all of `apps-script.gs` from this folder,
   paste it in, **Save**.
4. Pick **`setup`** in the function dropdown → **Run**.
   - Google asks for permission: **Review permissions → your account → Advanced →
     Go to (project name) (unsafe) → Allow**. The "unsafe" warning is Google's
     standard message for a script you wrote yourself. It's your script, your sheet.
   - Your sheet now has three tabs: **Responses**, **Performers**, **Volunteers**.
5. **Deploy → New deployment** → gear icon → **Web app**:

   | Setting | Value |
   |---|---|
   | Execute as | **Me** |
   | Who has access | **Anyone** |

   "Anyone" means anyone can *submit*. Nobody can *read* your sheet.

6. **Deploy**, then copy the **Web app URL**. It ends in `/exec`.

---

## 2. Connect it (2 min)

Open `index.html`, scroll to the bottom, find `CONFIG`:

```js
const CONFIG = {
  endpoint: "https://script.google.com/macros/s/AKfy…/exec",   // ← paste here

  hostBatch:     "BMS-01",
  year:          "2026",
  eventDate:     "Sun 20 September",
  eventTime:     "5:30 PM onwards",
  venue:         "IIMK Kochi Campus",
  deadline:      "Thursday 10 September",
  deadlineShort: "Sign-ups close 10 Sept",

  contactName:     "Students' Council",
  contactWhatsApp: "919XXXXXXXXX",   // country code + number, digits only, no +

  showCounter: true
};
```

Every date, name and venue on the page reads from this block. Nothing else to edit.

**Now open `index.html` in your browser and submit a test entry.** If a ticket appears
and a row lands in your sheet, the hard part is over.

---

## 3. Publish on GitHub Pages (5 min)

1. Create a repo: **New repository** → `bms02-freshers` → **Public** → Create.
   It has to be public — free GitHub Pages only serves public repos. The *page* is
   public; the *responses* are not.
2. **Add file → Upload files**. Drag in everything: `index.html`, `admin.html`,
   `SETUP.md`, `CLAUDE.md`, `LICENSE-FONTS.txt`, and the `images` and `fonts`
   **folders**. Commit.
3. **Settings → Pages** → Source: **Deploy from a branch**, branch **main**,
   folder **/ (root)**. Save.
4. Wait 1–2 minutes. Your link appears: `https://YOURNAME.github.io/bms02-freshers/`
5. **One last edit:** open `index.html`, find the two `YOURNAME.github.io` URLs near
   the top, replace with your real address, re-upload. WhatsApp needs the full URL
   to show the preview image.

### Using Claude Code instead

Open this folder in Claude Code and it'll read `CLAUDE.md` automatically, so it
already knows the structure. Useful for things like *"change the deadline to the 5th"*
or *"add Bharatanatyam to the act list"*.

To publish from the terminal:

```bash
git init && git add . && git commit -m "Freshers sign-up site"
git branch -M main
git remote add origin https://github.com/YOURNAME/bms02-freshers.git
git push -u origin main
```

Then do step 3 above once. After that every update is
`git add . && git commit -m "update" && git push`.

---

## Getting responses out

Open your Google Sheet. Three tabs: **Responses** (everything), **Performers**,
**Volunteers** — the last two filter themselves.

**Admin page:** `https://YOURNAME.github.io/bms02-freshers/admin.html` shows every
entry on your phone — stats, performer/volunteer tabs, search, WhatsApp links.
The ✕ on a card deletes that entry from the sheet (with a confirm — there's no
undo). **Excel (CSV)** downloads whichever tab you're looking at as a file Excel
opens directly; **Save PDF** opens the print dialog, where "Save as PDF" is an
option on both phone and laptop. It asks for the admin password. The password is **not** written anywhere in this
repo; only its SHA-256 fingerprint lives in `apps-script.gs` (`ADMIN_PASS_SHA256`),
and the script checks it server-side. To change the password, run this once in the
Apps Script editor and paste the result into `ADMIN_PASS_SHA256`:

```js
function newHash(){ Logger.log(sha256hex('your-new-password')); }
```

**Excel:** `File → Download → Microsoft Excel (.xlsx)`. Downloads whichever tab
you're on.

**Email alerts:** in Apps Script set `NOTIFY_EMAIL = 'you@example.com'`, save, then
**Deploy → Manage deployments → pencil → Version: New version → Deploy**.

> Any time you edit `apps-script.gs` you must redeploy as a **New version**, or the
> site keeps running the old code. This catches everyone out once.

---

## If something breaks

| What you see | Fix |
|---|---|
| "This form isn't connected yet" | `CONFIG.endpoint` still says `PASTE_YOUR…` |
| "That didn't go through" every time | Deployment isn't **Execute as: Me** + **Anyone**. Redeploy. |
| Ticket shows but sheet stays empty | You edited the script and didn't redeploy a new version |
| Fonts look wrong live | The `fonts` folder didn't upload |
| No WhatsApp preview image | The `og:image` URL isn't your real address yet |
| Someone submits twice | Already handled — same email overwrites their old row |

---

## Privacy

The endpoint URL is visible in the page source. Without the admin password all it
can do is add a row and report a total count, which powers the "47 signed up" pill.
Set `showCounter: false` to switch that off. The full list only comes back to
whoever knows the admin password (see *Getting responses out*). If you ever get
spammed, delete the deployment and create a new one; the old URL dies instantly.
