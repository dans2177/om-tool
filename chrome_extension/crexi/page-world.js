// ── Grandview Sender — crexi/page-world.js ──────────────────────────────────
// Runs in the MAIN world (page context) so clicks trigger Angular's Zone.js
// change detection.  Content scripts (ISOLATED world) communicate via
// CustomEvents on `window`.
//
// Protocol:
//   content script → window.dispatchEvent(new CustomEvent('gv-page-click', { detail: selector }))
//   → this script finds the element and clicks it in the page's JS context.
'use strict';

window.addEventListener('gv-page-click', (evt) => {
  try {
    const selector = typeof evt.detail === 'string' ? evt.detail : evt.detail?.selector;
    if (!selector) return;
    const el = document.querySelector(selector);
    if (el) {
      el.click();
    }
  } catch (_) {
    // Silently ignore — content script will handle timeouts
  }
});
