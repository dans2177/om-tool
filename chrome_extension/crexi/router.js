// ── Grandview Sender — crexi/router.js ────────────────────────────────────────
// Main orchestrator for the Crexi listing automation.
// Loaded LAST so all step files and helpers are already available.
'use strict';

(function () {

const { sleep, log, warn, reportProgress } = window.CrexiHelpers;
const { STEPS } = window.CrexiTypes;
const S = window.CrexiSteps;

// ── Step pipeline ────────────────────────────────────────────────────────────
// Each entry: [stepIndex, label, asyncFunction]
// The router runs them in order, reporting progress after each.
const PIPELINE = [
  [0, STEPS[0], S.choose],
  [1, STEPS[1], S.propertyType],
  [2, STEPS[2], S.address],
  [3, STEPS[3], S.financials],
  [4, STEPS[4], S.details],
  [5, STEPS[5], S.description],
  [6, STEPS[6], S.media],
  [7, STEPS[7], S.om],
  [8, STEPS[8], S.review],
];

/**
 * Run the full Crexi listing fill pipeline.
 *
 * @param {Object} prop  - Flattened property from /api/phase1/properties
 * @param {string} wpUrl - WordPress permalink (if available)
 */
async function fillCrexi(prop, wpUrl) {
  log('Starting Crexi fill pipeline…', prop.title || '(no title)');
  log(`Mode: ${prop.saleOrLease || 'for-sale'} | Type: ${prop.record_type || 'unknown'}`);

  for (const [idx, label, stepFn] of PIPELINE) {
    reportProgress(idx, label);
    log(`── Step ${idx}: ${label} ──`);
    try {
      await stepFn(prop);
    } catch (err) {
      warn(`Step ${idx} (${label}) failed: ${err.message}`);
      // Don't abort the whole pipeline — skip to next step
      // The user can fix the missed field manually
    }
    await sleep(500);
  }

  reportProgress(PIPELINE.length, 'Done');
  log('Crexi fill pipeline complete');
}

// ── Chrome message listener (entry point from background.js) ─────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'GV_CREXI_FILL') return;
  sendResponse({ ok: true });

  chrome.storage.local.get(['gvProperty', 'gvWpUrl', 'gvTestMode'], async ({ gvProperty, gvWpUrl, gvTestMode }) => {
    let prop = gvProperty;
    if (gvTestMode) {
      log('TEST MODE — using shared stub data');
      prop = window.GVTestData.TEST_PROP;
    }
    if (!prop) {
      chrome.runtime.sendMessage({
        type: 'GV_CREXI_FILL_ERROR',
        message: 'No property data in storage',
      });
      return;
    }
    try {
      await fillCrexi(prop, gvWpUrl || '');
      chrome.runtime.sendMessage({ type: 'GV_CREXI_FILL_DONE' });
    } catch (err) {
      console.error('[GV Crexi] Fatal error:', err);
      chrome.runtime.sendMessage({
        type: 'GV_CREXI_FILL_ERROR',
        message: err.message,
      });
    }
  });

  return true; // keep message channel open
});

log('Router loaded — listening for GV_CREXI_FILL');

})();
