# My Ledger

A simple, private money ledger for your phone — **who owes whom**.

Record money you **give** to people and money you **receive** from them in a few seconds. Every person has their own ledger and running balance.

- 🟢 **Green** — they have to pay me (money I gave)
- 🔴 **Red** — I have to pay them (money I received)
- **AED, PKR, USD** — choose per entry; balances kept separately per currency
- Open balances on top, **settled people collapsed** below, long lists paged
- Every person has a **name and mobile number**; add people from your iPhone contacts
- **Share statement** as PDF or a WhatsApp summary
- **Account required** — everything **auto-syncs** to your private account; entries saved offline are marked “Not synced yet” until they upload
- **Face ID / PIN** lock; settling and deleting need your PIN; “Forgot PIN” recovery
- Your own **name, app title and colour** (follows your account to a new phone)
- Dates as **03-Nov-26**. Works **offline**. No ads, no tracking.

Made by **Attaullah Sher**.

---

## Install on iPhone

1. Open **https://attaullahsher.github.io/my-ledger/** in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Always open it from the Home Screen icon.

Private use for a small circle. Each person who installs it gets their own empty, private ledger.

## Your records are safe

Everything is saved automatically to your own private account. On a new phone: install, sign in, and everything comes back. If you need a copy for yourself, use the small **Download all data (Excel)** link at the bottom of Settings.

## Security

- **PIN** (4–6 digits): set on first use. Needed to **settle** a balance; *Clear all data* and *Delete person* also need a warning + PIN + typing `DELETE`.
- **Lock app when opened**: asks for Face ID or PIN; re-locks after 1 minute in the background.
- **Forgot PIN**: verify with Face ID or your account password.

---

## For developers

Requires Node.js 20+.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # automated tests
npm run build        # offline app (PWA) → dist/
npm run build:single # whole app in one HTML file → dist-single/my-ledger.html
```

Every push to `main` is tested, built and published to the `gh-pages` branch by `.github/workflows/deploy.yml`.

### Auto-sync setup (Firebase, free plan)

1. Create a Firebase project, add a **Web app**, and put its config in `src/config/firebase.ts`.
2. Authentication → enable **Email/Password**.
3. Firestore → create a database and publish the rules in `firestore.rules`
   (each user can only read/write `users/{their uid}/…`).

Without a config the app runs on the phone only, with no sign-in.

### Structure

```
src/
  lib/           logic (no UI)
    types.ts       data shapes
    db.ts          on-phone database (IndexedDB / Dexie) + schema versions
    money.ts       amounts in minor units (integers) — no rounding errors
    ledger.ts      balance rules per currency, settled/open split
    repo.ts        add / edit / delete / archive / clear balance / PIN
    backup.ts      all data (Excel) and clear-all
    sync.ts        auto-sync (outbox upload + live download, newest edit wins)
    security.ts    Face ID unlock (WebAuthn)
    contacts.ts    contact picker + .vcf import
    exporters.ts   PDF statement, WhatsApp text, Excel download
  components/    shared UI
  pages/         Home (people), Person profile, Settings
tests/           automated tests
```

**Balance** = total given − total received. Positive → they owe me. Negative → I owe them. **Clear balance** adds a settlement entry; history is never deleted.

© 2026 Attaullah Sher
