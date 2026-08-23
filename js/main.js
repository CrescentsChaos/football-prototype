/*@CHUNK:c0608:START*/
  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
})();

// Start the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}

/*@CHUNK:c0608:END*/
