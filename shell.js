/* Shared page chrome: mobile menu and the "More" dropdown. No dependencies. */
(function () {
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  var more = document.querySelector('.nav-more');
  var moreBtn = more && more.querySelector('.nav-more-btn');

  function setMenu(open) {
    if (!toggle || !nav) return;
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.textContent = open ? 'Close' : 'Menu';
  }
  function setMore(open) {
    if (!more || !moreBtn) return;
    more.classList.toggle('open', open);
    moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (toggle) toggle.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
  if (moreBtn) {
    moreBtn.addEventListener('click', function (e) { e.stopPropagation(); setMore(!more.classList.contains('open')); });
    document.addEventListener('click', function (e) { if (!more.contains(e.target)) setMore(false); });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { setMore(false); setMenu(false); }
  });
})();
