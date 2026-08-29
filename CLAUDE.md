# Project notes

A one-page sign-up site for the BMS-02 Freshers event at IIM Kozhikode, Kochi campus.
BMS-02 are the freshers (the audience). The **senior batch, BMS-01, hosts the event
and fills the stage** — so the form is filled by BMS-01 students, saying whether they
want to **perform**, **volunteer**, or both (roll validation only accepts `BMS/01/…`).
Answers go to a private Google Sheet.

## Files

| File | What it is |
|---|---|
| `index.html` | The entire site — HTML, CSS and JS in one file. Everything lives here. |
| `apps-script.gs` | Backend. Gets pasted into Google Apps Script, not served by the site. |
| `fonts/` | Three self-hosted WOFF2 fonts. Do not delete — there is no CDN fallback. |
| `images/` | `004.jpeg` is the hero background, `images.png` the IIMK crest, `002/003.jpeg` section backgrounds, `005/006.jpeg` collage shots, `cover.jpg` the WhatsApp link preview. Only `001.jpeg` is unused. |
| `SETUP.md` | Human-facing setup and publishing steps. |

## Where to make changes

Everything editable is in three blocks near the bottom of `index.html`, inside `<script>`:

- **`CONFIG`** — date, time, venue, deadline, WhatsApp number, the Apps Script URL.
  Every date and name shown on the page reads from here via `data-cfg` attributes.
- **`ACTS`** — array of `[name, duration]`. Drives *both* the running-order list in the
  "Perform" section *and* the chips in the form. Edit once, both update.
- **`ROLES`** — volunteer job names. Display only; the form never asks people to pick one.
- **`AVAILABILITY`** — the time slots volunteers choose from.

## How it works

- Form submits via `fetch` to the Apps Script `/exec` URL with
  `Content-Type: text/plain` — this deliberately avoids a CORS preflight that
  Apps Script cannot answer. Do not change it to `application/json`.
- Apps Script upserts by email, so resubmitting updates the row instead of duplicating.
- A hidden `#website` input is a honeypot. Bots fill it, humans don't; filled = discarded.
- `showTicket()` renders the confirmation ticket. `hash4()` makes the pass code.
- The two yes/no groups set `performing` and `volunteering` (both start as `null`,
  which is how validation distinguishes "unanswered" from "no").

## Rules

- Keep everything in `index.html`. No build step, no bundler, no npm.
- Use **relative** paths for fonts and images — the site is served from a
  GitHub Pages subfolder (`/bms02-freshers/`), so absolute paths break.
- The **only** exception is the two `og:` meta tags, which need the full public URL
  or WhatsApp won't show a preview image.
- No `localStorage`, no external scripts, no analytics.
- Keep it working without JavaScript at least to the extent of the `<noscript>` notice.
- Test at 390px wide before shipping — most people open this on a phone.

## Common asks

- *"Add X to the act list"* → one line in `ACTS`.
- *"Change the date"* → `CONFIG.eventDate` and `CONFIG.deadline` / `deadlineShort`.
- *"Add a question to the form"* → add the field HTML, add the key to `collect()`,
  then add a matching row to `COLS` in `apps-script.gs` and redeploy a **new version**.
