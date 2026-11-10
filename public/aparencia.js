(function () {
  var raiz = document.documentElement;
  var prefs = {};
  try {
    prefs = JSON.parse(localStorage.getItem('ocelo:preferencias') || '{}') || {};
  } catch (e) {
    prefs = {};
  }
  var escuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  raiz.setAttribute('data-tema', prefs.tema === 'claro' || prefs.tema === 'escuro' ? prefs.tema : escuro ? 'escuro' : 'claro');
  if (prefs.paleta === 'bento' || prefs.paleta === 'sonda' || prefs.paleta === 'nexo') raiz.setAttribute('data-paleta', prefs.paleta);
})();
