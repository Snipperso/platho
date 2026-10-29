(function () {
  'use strict';

  try {
    var plathoTheme = localStorage.getItem('platho.theme.v1');
    if (plathoTheme === 'light' || plathoTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', plathoTheme);
    }
  } catch (e) { }

  try {
    var plathoGift = JSON.parse(localStorage.getItem('platho.giftTheme.v1') || 'null');
    var plathoGiftChoice = localStorage.getItem('platho.giftTheme.choice.v1');
    var plathoWearsGiftTheme = plathoGiftChoice === 'true'
      || (plathoGiftChoice !== 'false' && !!plathoGift && plathoGift.theme === true);
    if (plathoGift && plathoWearsGiftTheme && plathoGift.tint && plathoGift.tint.length === 3) {
      var glow = (plathoGift.inner && plathoGift.inner.length === 3) ? plathoGift.inner : plathoGift.tint;
      var root = document.documentElement;
      root.setAttribute('data-gift-theme', 'true');
      root.style.setProperty('--aurora-rgb', glow[0] + ', ' + glow[1] + ', ' + glow[2]);
      if (typeof plathoGift.patternTile === 'string' && plathoGift.patternTile) {
        root.style.setProperty('--gift-pattern', 'url("' + plathoGift.patternTile + '")');
        root.style.setProperty('--gift-pattern-size', '256px');
        root.setAttribute('data-gift-pattern', 'true');
      }
    }
  } catch (e) { }

  try {
    var plathoBackground = localStorage.getItem('platho.background.v1');
    document.documentElement.setAttribute(
      'data-background',
      (plathoBackground === 'plasma' || plathoBackground === 'nodes') ? plathoBackground : 'none',
    );
  } catch (e) { }

  var GRACE_MS = Number(document.documentElement.getAttribute('data-platho-boot-guard-timeout-ms')) || 6000;
  var STALL_MS = 12000;
  var MIN_WAIT_MS = 10000;
  var HARD_CAP_MS = 60000;
  var bootErrors = [];
  var guardFired = false;
  var lastProgressAt = Date.now();
  var busySeen = false;
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      var progressObserver = new PerformanceObserver(function (list) {
        if (list.getEntries && list.getEntries().length) lastProgressAt = Date.now();
      });
      progressObserver.observe({ type: 'resource', buffered: true });
    } catch (observerError) { }
  }

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

  function collectNetworkDiagnostics() {
    var lines = [];
    try {
      var entries = (window.performance && performance.getEntriesByType) ? performance.getEntriesByType('resource') : [];
      var lastEntry = null;
      var failedCount = 0;
      for (var i = 0; i < entries.length; i += 1) {
        var entry = entries[i];
        if (!lastEntry || (entry.responseEnd || 0) > (lastEntry.responseEnd || 0)) lastEntry = entry;
        var status = entry.responseStatus;
        if (status === 0 || (typeof status === 'number' && status >= 400)) {
          failedCount += 1;
          if (lines.length < 3) {
            var nameParts = String(entry.name).split('/');
            lines.push('failed to load: ' + nameParts[nameParts.length - 1] + (status ? ' (HTTP ' + status + ')' : ' (network)'));
          }
        }
      }
      if (failedCount > 3) lines.push('...and ' + (failedCount - 3) + ' more files failed');
      if (lastEntry) {
        var lastParts = String(lastEntry.name).split('/');
        var ago = Math.round(((Date.now() - (performance.timeOrigin || 0)) - (lastEntry.responseEnd || 0)) / 1000);
        lines.push('files arrived: ' + entries.length + '; last: ' + lastParts[lastParts.length - 1] + (ago >= 0 && ago < 100000 ? ' (' + ago + 's ago)' : ''));
      }
    } catch (diagError) { }
    return lines;
  }

  function styled(tag, styles) {
    var node = document.createElement(tag);
    for (var key in styles) {
      if (Object.prototype.hasOwnProperty.call(styles, key)) node.style[key] = styles[key];
    }
    return node;
  }

  function showGuard() {
    if (guardFired) return;
    if (document.documentElement.getAttribute('data-platho-boot-busy') === '1') { busySeen = true; setTimeout(showGuard, 2000); return; }
    if (busySeen) { busySeen = false; setTimeout(showGuard, GRACE_MS); return; }
    var state = document.documentElement.getAttribute('data-platho-app-js');
    if (state === 'ready') return;
    if (!document.body) return;
    guardFired = true;

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
      ? 'Platho boot did not finish'
      : 'Platho did not finish loading';
    overlay.appendChild(title);

    var hint = styled('div', { marginBottom: midBoot ? '16px' : '8px', color: '#b7c0c9' });
    hint.textContent = midBoot
      ? 'Parts of the app may not respond. Please share a screenshot of this screen.'
      : 'A file did not finish downloading. Tap Reload to try again - this usually fixes it.';
    overlay.appendChild(hint);

    if (!midBoot) {
      var hint2 = styled('div', { marginBottom: '16px', color: '#7d8893', fontSize: '13px' });
      hint2.textContent = 'Still stuck after a few tries? Check your connection, update your browser, or open platho.app directly if you opened this inside another app.';
      overlay.appendChild(hint2);
    }

    var appError = document.documentElement.getAttribute('data-platho-app-error');
    if (appError) rememberBootError('app: ' + appError);

    if (bootErrors.length > 0) {
      var errorsTitle = styled('div', { fontWeight: '600', marginBottom: '6px' });
      errorsTitle.textContent = 'Details:';
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

    var netLines = collectNetworkDiagnostics();
    if (netLines.length > 0) {
      var netTitle = styled('div', { fontWeight: '600', margin: '10px 0 6px' });
      netTitle.textContent = 'Network:';
      overlay.appendChild(netTitle);
      for (var n = 0; n < netLines.length; n += 1) {
        var netLine = styled('div', {
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '12px',
          color: '#e8c07a',
          marginBottom: '4px',
          wordBreak: 'break-word',
        });
        netLine.textContent = netLines[n];
        overlay.appendChild(netLine);
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
    reload.textContent = 'Reload';
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
    dismiss.textContent = 'Continue';
    dismiss.addEventListener('click', function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });
    overlay.appendChild(dismiss);

    document.body.appendChild(overlay);
  }

  var startedAt = Date.now();
  function hardCapCheck() {
    if (guardFired) return;
    if (document.documentElement.getAttribute('data-platho-app-js') === 'ready') return;
    if (document.readyState === 'complete') return;
    var now = Date.now();
    var elapsed = now - startedAt;
    var stalled = (now - lastProgressAt) >= STALL_MS;
    if ((elapsed >= MIN_WAIT_MS && stalled) || elapsed >= HARD_CAP_MS) {
      showGuard();
      return;
    }
    setTimeout(hardCapCheck, 2000);
  }
  setTimeout(hardCapCheck, 2000);

  function afterLoad() {
    setTimeout(showGuard, GRACE_MS);
  }

  if (document.readyState === 'complete') {
    afterLoad();
  } else {
    window.addEventListener('load', afterLoad);
  }
})();
