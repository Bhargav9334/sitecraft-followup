# Follow Up Software — Bhargav

Automatic email follow-up CRM. Upload leads → system sends a 6-mail sequence on its own → the moment someone replies, their follow-ups stop and you continue the conversation in Gmail.

```
myfollowup/
├── backend/    Node.js API + automatic sender + IMAP reply reader (MongoDB) — port 5001
└── frontend/   Next.js (JSX, inline styles, no CSS files) — port 3000
```

## What it does

| Feature | How |
|---|---|
| Login | Admin is saved in MongoDB (`admins` collection, password hashed with scrypt). On first start it is seeded from `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env`. Username is not case-sensitive. 5 wrong tries → 15 min lock. |
| Sending | Gmail SMTP (`smtp.gmail.com`) — From: **Bhargav from SiteCraft**. |
| Signature | Every mail ends with **Best regards, / SiteCraft by Bhargav / your number** — From name, name and number are editable on the **Settings** page. |
| 6-mail sequence | Mail 1 → **+3 days** → **+7** → **+7** → **+10** → **+15**. Text and gaps editable on the **Sequence** page. Follow-ups go in the same thread (`Re:`). |
| Daily limit | **30 mails/day**, **1 every 18 minutes**, **9 AM – 7 PM IST**. `MAX_DAILY_LIMIT=30` is a hard cap — the UI can't go above it. Follow-ups get priority, then new leads. |
| Off days | Sundays + government holidays (Central Govt. 2026 list pre-loaded, editable in **Settings**). |
| Replies | IMAP checks the inbox every 5 min. A real reply → lead becomes **Replied**, remaining mails cancelled, reply shown in the app with an "Open in Gmail" button. Out-of-office auto-replies are ignored (sequence continues). Bounces are detected and stopped. |
| Unsubscribe | Every mail has an unsubscribe link (+ Gmail one-click header). Unsubscribed people are listed on the **Unsubscribed** page and never get mail again — not even if re-uploaded. |
| Stop anything | Stop/Resume one lead, bulk stop/resume/delete, or **Stop system** to pause everything instantly. |
| Tracking | Dashboard: today's 10 slots, who got which mail, upcoming mails, pipeline. Leads list: `x/6` mails sent per lead. Lead page: full timeline + mail history. |
| First email | Comes from each lead's own CSV row — `subject` and `message` columns, so every lead gets a different first email. Rows without a message get the default Email 1 from the Sequence page. It can be edited on the lead's page until it is sent. |
| CSV upload | Needs an `email` column; `name, company, phone, website, city` are recognised automatically. Any extra column (e.g. `website_issue`) can be used in mails as `{{website_issue}}`. Duplicates are skipped. |

Mail variables: `{{first_name|there}}`, `{{name}}`, `{{company|your business}}`, `{{city}}`, `{{website}}`, `{{sender_name}}`, plus any CSV column. Text after `|` is used when the value is empty.

## Run locally

Needs **Node.js 20.12+** and **MongoDB** (local or Atlas).

```bash
# 1) backend
cd backend
cp .env.example .env        # fill in login, MongoDB, SMTP, IMAP
npm install
npm test                    # automated tests (no MongoDB needed)
npm run seed                # saves admin login from .env into MongoDB
npm start                   # http://localhost:5001

# 2) frontend (new terminal)
cd frontend
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:5001
npm install
npm run dev                 # http://localhost:3000
```

Forgot the password / want a new one?
```bash
npm run seed -- SiteCraft MyNewPassword123   # creates or resets that admin
```

Want to try without sending real mails? Set `MAIL_DRY_RUN=true` in `backend/.env` — mails are only printed in the backend console.

### Gmail setup (sitecraft94@gmail.com)
1. Turn on 2-Step Verification on the Google account.
2. Create an **App Password** (Google Account → Security → App passwords).
3. Put the same Gmail in `FROM_EMAIL`, `SMTP_USER`, `IMAP_USER`, and the App Password (16 letters, no spaces) in `SMTP_PASS` and `IMAP_PASS`. Hosts are already set: `smtp.gmail.com:465`, `imap.gmail.com:993`.
4. Gmail → Settings → Forwarding and POP/IMAP → IMAP must be enabled.

## Going live (VPS)

- Backend: `npm start` behind Nginx (CloudPanel reverse proxy) with `pm2` or systemd. Set `TRUST_PROXY=true`.
- `PUBLIC_BACKEND_URL` is optional. Without a public domain (localhost), every mail says *reply with "unsubscribe"* and the inbox checker moves that lead to the Unsubscribed list automatically. If you set a public https address (e.g. `https://api.yourdomain.com`), mails get a one-click unsubscribe link as well.
- `FRONTEND_URL` = your frontend's address (only it can call the API).
- Frontend: `npm run build && npm start` (set `NEXT_PUBLIC_API_URL` to the backend's public URL before building).
- Use a long random `AUTH_SECRET` and a strong `ADMIN_PASSWORD`.

## Deliverability tips
- Add a profile photo to the Gmail account and keep an eye on spam/bounce rates at 30/day; raise `MAX_DAILY_LIMIT` slowly (free Gmail allows max ~500/day).
- Only email publicly listed business contacts, and keep the unsubscribe link (it's added automatically).

## Logo — `brand/`
| File | Use |
|---|---|
| `sitecraft-gmail-profile.png` | Gmail profile photo (round crop safe) |
| `sitecraft-logo.png` / `.svg` | Full logo on white |
| `sitecraft-logo-white.png` / `.svg` | Full logo on dark backgrounds |
| `sitecraft-icon-512.png`, `sitecraft-mark.svg` | Square icon (also used as the browser tab icon) |

## Free hosting (Render + Vercel, no card)

Free hosts block SMTP ports, so on Render the backend sends through the **Gmail API (HTTPS)**. Mail still comes from your Gmail, appears in Gmail "Sent" and stays in the same thread. Replies are still read over IMAP (port 993).

1. **Gmail API token (once, on your computer)**
   - console.cloud.google.com → new project → *APIs & Services → Library* → enable **Gmail API**.
   - *OAuth consent screen*: External, add your Gmail as a test user, then **Publish app** (otherwise the token expires after 7 days).
   - *Credentials → Create credentials → OAuth client ID → Desktop app*. Put the ID/secret in `backend/.env` as `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET`.
   - `cd backend && npm run gmail-auth` → choose your sending Gmail → Allow. `GMAIL_REFRESH_TOKEN` is saved into `.env`.
2. **GitHub**: push this folder to a private repo (`.env` files are ignored).
3. **Render** (backend): New → Blueprint → pick the repo (uses `render.yaml`). Fill in the secret values from `backend/.env`. `FRONTEND_URL` = your Vercel address, `PUBLIC_BACKEND_URL` = the Render address.
4. **Vercel** (frontend): New Project → pick the repo → Root Directory `frontend` → env `NEXT_PUBLIC_API_URL` = the Render address.
5. **MongoDB Atlas** → Network Access → allow `0.0.0.0/0` (Render has no fixed IP).
6. **Keep it awake**: Render free sleeps after 15 min without traffic. On cron-job.org create a job that opens `https://<render-address>/health` every 10 minutes.
