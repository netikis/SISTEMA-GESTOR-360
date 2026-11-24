/* js/boot-erro.js — edite este arquivo para alterar só este módulo */
  // Fallback: se o JavaScript principal falhar, ao menos mostra a tela inicial.
  window.addEventListener('error', function (e) {
    try {
      var el = document.getElementById('fatal-error');
      var msg = document.getElementById('fatal-error-msg');
      if (msg) msg.textContent = (e && e.message) ? e.message : String(e);
      if (el) el.style.display = 'block';
      // Só mostra a tela inicial se nenhuma outra tela estiver visível,
      // para não sobrepor telas como "Relógio de Ponto".
      var telas = [
        'tela-relogio',
        'tela-login',
        'tela-patrao',
        'tela-selecao-empresa',
        'tela-selecao-empresa-funcionario',
        'tela-pedido-material',
        'tela-meus-vales',
        'tela-funcionario'
      ];
      var algumaVisivel = telas.some(function (id) {
        var x = document.getElementById(id);
        if (!x) return false;
        var st = window.getComputedStyle(x);
        return st && st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
      });
      if (!algumaVisivel) {
        var tela = document.getElementById('tela-escolha-inicial');
        if (tela) tela.style.display = 'block';
      }
    } catch (_) {}
  });
