GITHUB PAGES - teams.json not updating?

1. Confirm teams.json is in the SAME folder as index.html in your repo
2. After pushing, wait 1-2 minutes for GitHub Pages to rebuild
3. Open your site and hard refresh:
   - Android Chrome: tap the address bar menu or close tab and reopen
   - Or open the site in Incognito/Private mode
4. Check data source: open browser console (if possible) and look for:
   "Apex Sim ready: ... | source: teams.json"  = good
   "source: embedded" = teams.json not loaded
5. Direct-check the file:
   Visit: https://YOURUSER.github.io/YOURREPO/teams.json
   You should see your NEW data there
6. If the URL above still shows old data, GitHub Pages cache has not refreshed yet —
   wait, or make a tiny empty commit and push again to force rebuild
