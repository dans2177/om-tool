// ── Grandview Sender — wordpress/router.js ──────────────────────────────────
// Main orchestrator for the WordPress listing automation.
// Loaded LAST so all step files and helpers are already available.
'use strict';

(function () {

const H = window.WPHelpers;
const S = window.WPSteps;

// ── Step pipeline ────────────────────────────────────────────────────────────
// Each entry: [name, asyncFunction]
// The router runs them in order. Progress is handled inside each step via wpStep().
const PIPELINE = [
  ['title',      S.title],
  ['seo',        S.seo],
  ['type',       S.type],
  ['address',    S.address],
  ['financials', S.financials],
  ['broker',     S.broker],
  ['media',      S.media],
  ['publish',    S.publish],
];

/**
 * Run the full WordPress fill pipeline.
 *
 * @param {Object}  prop     - Flattened property from /api/phase1/properties
 * @param {boolean} testMode - If true, use shared test data + pause between steps
 */
async function fillWordPress(prop, testMode) {
  if (testMode) {
    H.log('TEST MODE — using stub data');
    prop = window.GVTestData.TEST_PROP;
  }

  // Initialize state for this run
  H.setTestMode(testMode);
  H.resetProgress();

  // Verify we're on the right page
  if (!location.pathname.includes('post-new.php')) {
    throw new Error('Not on post-new.php — wrong tab?');
  }

  // Wait for WP admin to finish loading
  await H.waitForEl('#title', 20_000);
  await H.sleep(800);

  let permalink = '';
  for (const [name, stepFn] of PIPELINE) {
    H.log(`── Step: ${name} ──`);
    try {
      const result = await stepFn(prop);
      if (name === 'publish' && result) permalink = result;
    } catch (err) {
      H.warn(`Step "${name}" failed: ${err.message}`);
    }
  }

  H.log('WordPress fill pipeline complete');
  return permalink;
}

// ── Entry point: listen for background message ──────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'GV_WP_FILL') return;
  sendResponse({ ok: true });

  chrome.storage.local.get(['gvProperty', 'gvTestMode'], async ({ gvProperty, gvTestMode }) => {
    if (!gvProperty && !gvTestMode) {
      chrome.runtime.sendMessage({ type: 'GV_WP_FILL_ERROR', message: 'No property data in storage' });
      return;
    }
    try {
      const permalink = await fillWordPress(gvProperty || {}, !!gvTestMode);
      chrome.runtime.sendMessage({
        type:      'GV_WP_FILL_DONE',
        permalink: permalink || '',
      });
    } catch (err) {
      console.error('[GV WP] Fill error:', err);
      chrome.runtime.sendMessage({
        type:    'GV_WP_FILL_ERROR',
        message: err.message,
      });
    }
  });

  return true;
});

H.log('Router loaded — listening for GV_WP_FILL');

})();
