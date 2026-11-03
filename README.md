# My Ledger

A simple, private money ledger for your phone — **who owes whom**.

Record money you **give** to people and money you **receive** from them in a few seconds. Every person has their own ledger and running balance.

- 🟢 **Green** — they have to pay me (money I gave)
- 🔴 **Red** — I have to pay them (money I received)
- Open balances on top, **settled people collapsed** below, long lists paged
- Person profiles; add people **from your iPhone contacts**
- **Share statement** as PDF or a WhatsApp summary
- **Auto-sync** to your own private account (optional) + backup files + daily on-phone snapshots
- **Face ID / PIN** app lock, PIN-protected danger zone, “Forgot PIN” recovery
- Your own **name, app title and colour**
- Works **offline**. No ads, no tracking.

Made by **Attaullah Sher**.

---

## Install on iPhone

1. Open **https://attaullahsher.github.io/my-ledger/** in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Always open it from the Home Screen icon.

Private use for a small circle. Each person who installs it gets their own empty, private ledger.

## Keep your records safe

| Protection | How |
|---|---|
| **Auto-sync** | Settings → Auto-sync → create an account with your email. Every change is saved automatically. On a new phone, sign in to get everything back. Each account can only see its own records. |
| **Backup file** | Settings → **Back up now** → Save to Files → iCloud Drive. Restore with **Restore** (merge or replace). |
| **Safety snapshots** | Automatic daily copies on the phone (last 14), plus one before every restore or “clear all”. |

Deleting the Home Screen app or clearing Safari website data erases the copy on that phone — sign in again or restore a backup.

## Security

- **PIN** (4–6 digits): Settings → Security. Required for *Clear all data*, *Replace from backup* and *Delete person permanently* (warning → PIN → type `DELETE`).
- **Lock app when opened**: asks for Face ID or PIN; re-locks after 1 minute in the background.
- **Forgot PIN**: verify with Face ID, or with your auto-sync account password, or reset the phone and restore from sync/backup.

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

Without a config the app runs fully offline and the sync section stays hidden.

### Structure

```
src/
  lib/           logic (no UI)
    types.ts       data shapes
    db.ts          on-phone database (IndexedDB / Dexie) + schema versions
    money.ts       amounts in fils (integers) — no rounding errors
    ledger.ts      balance rules, settled/open split
    repo.ts        add / edit / delete / archive / clear balance / PIN
    backup.ts      backup files, restore, merge, snapshots
    sync.ts        auto-sync (outbox upload + live download, newest edit wins)
    security.ts    Face ID unlock (WebAuthn)
    contacts.ts    contact picker + .vcf import
    exporters.ts   PDF, Excel, CSV, WhatsApp text
  components/    shared UI
  pages/         Home (people), Person profile, Settings
tests/           automated tests
```

**Balance** = total given − total received. Positive → they owe me. Negative → I owe them. **Clear balance** adds a settlement entry; history is never deleted.

© 2026 Attaullah Sher
