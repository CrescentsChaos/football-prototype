## 2025-02-14 - Direct edit of `dist/app.js` alongside source chunks
**Learning:** Running `node build.js` rebuilds `dist/app.js` from split source files, but `manifest.json` contains chunk entries missing from split source files (such as `bestPositionalOverall`), causing `node build.js` to strip existing logic from `dist/app.js`.
**Action:** Always edit both the split source file (`data/teamDatabase.js`) and `dist/app.js` directly using git merge diffs rather than running `node build.js`.
