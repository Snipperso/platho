// Plain-script boot watchdog. Loaded before the module graph on purpose and
// written in ES5 so it runs on any browser the app itself cannot: when the
// module graph fails to parse or execute (old Safari, blocked resources),
// the page would otherwise stay a silent dark shell. After a timeout this
// shows what went wrong instead. CSP note: styles go through CSSOM property
// assignments because style-src 'self' forbids inline style attributes.
(function () {
  'use strict';

  var BOOT_TIMEOUT_MS = Number(document.documentElement.getAttribute('data-platho-boot-guard-timeout-ms')) || 8000;
  var bootErrors = [];

  function rememberBootError(text) {
    if (!text) return;
    if (bootErrors.length >= 4) return;
    bootErrors.push(String(text).slice(0, 300));
  }

  window.addEventListener('error', function (event) {
    if (event && event.message) {
      var where = '';
      if (event.filename) {
        var parts = String(event.filename).split('/');
        where = ' @ ' + parts[parts.length - 1] + ':' + (event.lineno || 0);
      }
      rememberBootError(event.message + where);
      return;
    }
    var target = event && event.target;
    var src = target && (target.src || target.href);
    if (src) {
      var srcParts = String(src).split('/');
      rememberBootError('resource failed: ' + srcParts[srcParts.length - 1]);
    }
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    rememberBootError('rejection: ' + (reason && reason.message ? reason.message : reason));
  });

  function styled(tag, styles) {
    var node = document.createElement(tag);
    for (var key in styles) {
      if (Object.prototype.hasOwnProperty.call(styles, key)) node.style[key] = styles[key];
    }
    return node;
  }

  setTimeout(function () {
    var state = document.documentElement.getAttribute('data-platho-app-js');
    // 'ready' is the terminal healthy marker set at the very end of the app
    // module, after every handler is wired; the app's own error hooks never
    // downgrade it. A missing marker means the module graph never ran;
    // 'started'/'error' without 'ready' means the boot died in the middle -
    // the page may render but stays partially or fully inert.
    if (state === 'ready') return;
    if (!document.body) return;

    var overlay = styled('div', {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      zIndex: '2147483000',
      background: '#0b0d0f',
      color: '#e8edf2',
      fontFamily: '-apple-system, system-ui, "Segoe UI", Roboto, sans-serif',
      fontSize: '15px',
      lineHeight: '1.5',
      padding: '32px 20px',
      overflow: 'auto',
      WebkitOverflowScrolling: 'touch',
      boxSizing: 'border-box',
    });
    overlay.id = 'plathoBootGuard';

    var midBoot = state === 'started' || state === 'error';
    var title = styled('div', { fontSize: '18px', fontWeight: '600', marginBottom: '12px' });
    title.textContent = midBoot
      ? 'Platho запустился не полностью · Platho boot did not finish'
      : 'Platho не запустился · Platho failed to start';
    overlay.appendChild(title);

    var hint = styled('div', { marginBottom: '16px', color: '#b7c0c9' });
    hint.textContent = midBoot
      ? 'Часть приложения может не отвечать. Пожалуйста, пришлите скриншот этого экрана. · Parts of the app may not respond. Please share a screenshot of this screen.'
      : 'Обновите iOS/Safari до последней версии и откройте platho.app в обычном Safari, не во встроенном браузере другого приложения. · Update iOS/Safari and open platho.app in standalone Safari, not an in-app browser.';
    overlay.appendChild(hint);

    var appError = document.documentElement.getAttribute('data-platho-app-error');
    if (appError) rememberBootError('app: ' + appError);

    if (bootErrors.length > 0) {
      var errorsTitle = styled('div', { fontWeight: '600', marginBottom: '6px' });
      errorsTitle.textContent = 'Технические детали · Details:';
      overlay.appendChild(errorsTitle);
      for (var i = 0; i < bootErrors.length; i += 1) {
        var line = styled('div', {
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '12px',
          color: '#ff9d9d',
          marginBottom: '4px',
          wordBreak: 'break-word',
        });
        line.textContent = bootErrors[i];
        overlay.appendChild(line);
      }
    }

    var meta = styled('div', { fontSize: '12px', color: '#7d8893', margin: '14px 0 18px' });
    meta.textContent = navigator.userAgent;
    overlay.appendChild(meta);

    var reload = styled('button', {
      background: '#2a6df4',
      color: '#ffffff',
      border: 'none',
      borderRadius: '10px',
      padding: '12px 18px',
      fontSize: '15px',
      fontWeight: '600',
      marginRight: '10px',
    });
    reload.type = 'button';
    reload.textContent = 'Перезагрузить · Reload';
    reload.addEventListener('click', function () {
      window.location.reload();
    });
    overlay.appendChild(reload);

    var dismiss = styled('button', {
      background: 'transparent',
      color: '#b7c0c9',
      border: '1px solid #2a3138',
      borderRadius: '10px',
      padding: '12px 18px',
      fontSize: '15px',
      fontWeight: '600',
    });
    dismiss.type = 'button';
    dismiss.textContent = 'Продолжить · Continue';
    dismiss.addEventListener('click', function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });
    overlay.appendChild(dismiss);

    document.body.appendChild(overlay);
  }, BOOT_TIMEOUT_MS);
})();
