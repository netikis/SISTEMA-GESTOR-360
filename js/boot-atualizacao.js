/* js/boot-atualizacao.js — edite este arquivo para alterar só este módulo */
    window.APP_BUILD = 24;
    window.addEventListener('DOMContentLoaded', function () {
      const elVer = document.getElementById('versao-app-ponto');
      if (elVer) elVer.textContent = 'versão ' + window.APP_BUILD;
    });
    (function () {
      function mostrarOverlayAtualizacaoApp() {
        if (document.getElementById('overlay-atualizacao-app')) return;
        const el = document.createElement('div');
        el.id = 'overlay-atualizacao-app';
        el.setAttribute('style', 'position:fixed;inset:0;background:rgba(26,42,67,.94);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;padding:24px;text-align:center;font-family:Poppins,sans-serif;');
        el.innerHTML = '<div style="font-size:22px;font-weight:700;margin-bottom:12px;">Atualizando o ponto</div><div style="font-size:14px;line-height:1.55;max-width:340px;">Baixando a versão nova, com <b>ENVIAR PONTO DO DIA ANTERIOR</b>.<br><br>Não precisa excluir o aplicativo. Aguarde alguns segundos.</div>';
        (document.body || document.documentElement).appendChild(el);
      }

      async function limparCachesDoApp() {
        if (!window.caches) return;
        const keys = await caches.keys();
        await Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }

      window.verificarAtualizacaoApp = async function () {
        if (!navigator.onLine) return false;
        try {
          const res = await fetch('./app-version.json?t=' + Date.now(), { cache: 'no-store' });
          if (!res.ok) return false;
          const data = await res.json();
          const remote = Number(data && data.build);
          if (!remote || remote === window.APP_BUILD) return false;
          const flag = 'app_upd_' + remote;
          if (sessionStorage.getItem(flag) === '1') return false;
          sessionStorage.setItem(flag, '1');
          mostrarOverlayAtualizacaoApp();
          await limparCachesDoApp();
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            regs.forEach(function (r) {
              if (r.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' });
              r.update();
            });
          }
          const u = new URL(location.href);
          u.searchParams.set('app', String(remote));
          setTimeout(function () { location.replace(u.href); }, 350);
          return true;
        } catch (_) {
          return false;
        }
      };

      if (!('serviceWorker' in navigator) || (location.protocol !== 'https:' && location.protocol !== 'http:')) {
        window.addEventListener('load', function () { window.verificarAtualizacaoApp(); });
        return;
      }

      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js?v=17').then(function (registration) {
          function pedirSkip(sw) {
            if (sw) sw.postMessage({ type: 'SKIP_WAITING' });
          }
          if (registration.waiting) pedirSkip(registration.waiting);
          registration.addEventListener('updatefound', function () {
            const sw = registration.installing;
            if (!sw) return;
            sw.addEventListener('statechange', function () {
              if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                mostrarOverlayAtualizacaoApp();
                pedirSkip(sw);
              }
            });
          });
          registration.update();
          setInterval(function () {
            registration.update();
            window.verificarAtualizacaoApp();
          }, 30000);
          console.log('ServiceWorker registado:', registration.scope);
        }, function (err) {
          console.log('Falha ao registar o ServiceWorker:', err);
        });
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          if (window.__gestorSwReload) return;
          window.__gestorSwReload = true;
          mostrarOverlayAtualizacaoApp();
          location.reload();
        });
        window.verificarAtualizacaoApp();
      });

      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
          window.verificarAtualizacaoApp();
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(function (r) { if (r) r.update(); });
          }
        }
      });
    })();
