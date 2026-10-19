/* ServiceHub development notice. Self-contained; does not depend on the main app script. */
(function () {
  'use strict';
  function mountNotice() {
    if (document.getElementById('sh-dev-notice-launcher') || !document.body) return;

    var launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.id = 'sh-dev-notice-launcher';
    launcher.setAttribute('aria-haspopup', 'dialog');
    launcher.setAttribute('aria-controls', 'sh-dev-notice-modal');
    launcher.setAttribute('aria-label', 'Open ServiceHub development notice');
    launcher.innerHTML = '<span class="sh-dev-kicker">SERVICEHUB // BETA</span><span class="sh-dev-title">STILL BUILDING…</span><span class="sh-dev-status">● NOT FULLY LIVE</span>';

    var backdrop = document.createElement('div');
    backdrop.id = 'sh-dev-notice-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.innerHTML = '<section id="sh-dev-notice-modal" role="dialog" aria-modal="true" aria-labelledby="sh-dev-notice-heading" aria-describedby="sh-dev-notice-copy"><button class="sh-dev-close" type="button" aria-label="Close notice">×</button><p class="sh-dev-modal-kicker">SERVICEHUB // EARLY ACCESS</p><h2 id="sh-dev-notice-heading">A little heads-up 🚧</h2><p id="sh-dev-notice-copy">🚧 SERVICEHUB IS CURRENTLY UNDER DEVELOPMENT. Feel free to explore and test the platform! Our marketing team is not yet active, so some services and business activities may not be fully operational. Thanks for being an early visitor!</p></section>';
    document.body.appendChild(launcher);
    document.body.appendChild(backdrop);

    var closeButton = backdrop.querySelector('.sh-dev-close');
    function openModal() {
      backdrop.classList.add('sh-dev-open');
      backdrop.setAttribute('aria-hidden', 'false');
      document.body.classList.add('sh-dev-modal-visible');
      closeButton.focus();
    }
    function closeModal() {
      backdrop.classList.remove('sh-dev-open');
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('sh-dev-modal-visible');
      launcher.focus();
    }
    launcher.addEventListener('click', openModal);
    closeButton.addEventListener('click', closeModal);
    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop) closeModal();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && backdrop.classList.contains('sh-dev-open')) closeModal();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountNotice);
  else mountNotice();
})();
