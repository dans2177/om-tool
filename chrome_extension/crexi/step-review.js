// ── Grandview Sender — crexi/step-review.js ──────────────────────────────────
// Step 7: Review and submit the listing.
'use strict';

window.CrexiSteps = window.CrexiSteps || {};

/**
 * Handle the final review/submit step.
 * Clicks the publish/submit button.
 *
 * @param {Object} prop - Flattened property data from the API.
 */
window.CrexiSteps.review = async function review(prop) {
  const { sleep, clickEl, pageClick, log, warn } = window.CrexiHelpers;

  log('Review step — looking for submit button');

  // ── Submit / Publish ───────────────────────────────────────────────────────
  // TODO: Replace with the real selector from Chrome Recorder.
  // Crexi may have a "Submit", "Publish", "Post Listing", or "List Property" button.
  const submitBtn = window.CrexiHelpers.findButtonByText('submit')
    || window.CrexiHelpers.findButtonByText('publish')
    || window.CrexiHelpers.findButtonByText('post listing')
    || window.CrexiHelpers.findButtonByText('list property')
    || window.CrexiHelpers.findButtonByText('save');

  if (submitBtn) {
    await pageClick(submitBtn);
    log('Clicked Submit / Publish');
    await sleep(3000);
  } else {
    warn('Submit button not found — manual submission needed');
  }

  // Wait for confirmation page/modal
  await sleep(2000);
  log('Crexi fill complete');
};
