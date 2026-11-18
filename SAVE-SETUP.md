# Saving & Google Drive sync

Your progress is no longer limited to the browser's 5 MB `localStorage`. A **Saves** pill (bottom-right of every page) opens the Save Manager.

## What changed
| Before | Now |
|---|---|
| ~5 MB limit; a failed write silently left an OLD copy that loaded after refresh | IndexedDB (hundreds of MB). Writes are verified; a failed write is reported |
| One copy only | Rolling **snapshots** (auto every ~20 min, plus before every import / reset / cloud load) you can restore |
| Closing a page right after a change could lose it | Small values are also mirrored to localStorage; newest timestamp wins at load |
| Two tabs overwrote each other with stale data | A tab whose data went stale stops saving and shows a red "Reload" bar |
| Unreadable save item → deleted on next autosave | Left untouched, you get a warning, restore from a snapshot |
| Browser only | **Google Drive** sync (hidden app folder, compressed, with backups) |

The game's own **Export / Import** still works; the Save Manager reads and writes the same file format.

## Google Drive setup (once, ~5 min, free)
1. https://console.cloud.google.com/projectcreate → create a project.
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **OAuth consent screen** → External → app name + your email → **Test users: add your Google account** → add scope `.../auth/drive.appdata`.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   **Authorized JavaScript origins:** `https://YOUR-USERNAME.github.io` (origin only, no `/repo` path). Add `http://localhost:8000` too if you test locally.
5. Copy the Client ID (`…apps.googleusercontent.com`) and either paste it in **Saves → Google Drive**, or put it in `apex-config.js` (`googleClientId`) so every device picks it up. The ID is public by design and safe to commit.
6. **Saves → Connect Google Drive** and approve. Done.

Only the hidden `drive.appdata` folder is accessible: the game cannot see your other Drive files, and nothing shows in your normal Drive list.

## How sync behaves
- Files in the cloud: `apex-save-main.json.gz` (live), `apex-backup-*.json.gz` (the last 6 overwritten saves), `apex-slot-<name>.json.gz` (named saves you make).
- Auto-sync pushes ~60 s after you stop changing things. A new device with no local save downloads the cloud save automatically.
- If the cloud has a newer save you haven't loaded, or **both** sides changed, nothing is overwritten: you choose (cloud / this device / decide later). A backup is always made first.
- Google sign-in tokens last ~1 hour (apps in "Testing" mode). When it expires the pill shows "reconnect"; one tap renews it. Changes keep saving locally meanwhile.

## Notes
- After deploying, `apex-store.js?v=1` may be cached by the browser; bump the `?v=` in the HTML pages if an old copy sticks.
- `dist/app.js` is patched directly AND the same edits are in `simulation/seasonEngine.js`, `ui/statisticsUI.js`, `ui/matchUI.js`, so `node build.js` reproduces it from the full sources.
- Tests: `npm i jsdom fake-indexeddb` then `node test/save-harness.js` (36 checks incl. a mocked Drive).
