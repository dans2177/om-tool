// ── Grandview Sender — wordpress/step-publish.js ────────────────────────────
// Steps 14–15: Private access checkbox + Publish and capture permalink.
'use strict';

window.WPSteps = window.WPSteps || {};

// ── Private helper: publish and capture permalink ───────────────────────────
async function clickPublish() {
  const { clickEl, waitForEl, sleep } = window.WPHelpers;

  const publishBtn = document.querySelector('#publish, #save-action input[type="submit"], input[name="publish"]');
  if (!publishBtn) {
    console.warn('[GV WP] Publish button not found — pausing for manual publish');
    return '';
  }
  clickEl(publishBtn);

  await sleep(3000);
  await waitForEl('#message.updated, #message.notice', 15_000).catch(() => {});
  await sleep(500);

  const viewLink = document.querySelector('#sample-permalink a, #view-post-btn a, .post-publish-panel a');
  return viewLink?.href || '';
}

window.WPSteps.publish = async function publish(prop) {
  const { wpStep, checkCheckbox, sleep } = window.WPHelpers;

  // ── 14. Private Access ────────────────────────────────────────────────────
  wpStep('Private Access');
  const privateAccessEl = document.querySelector('#acf-field_5f5a9ed0e21bc');
  if (privateAccessEl) checkCheckbox(privateAccessEl, true);

  // ── 15. Scroll to top and Publish ──────────────────────────────────────────
  wpStep('Publishing…');
  window.scrollTo(0, 0);
  await sleep(500);
  return await clickPublish();
};
