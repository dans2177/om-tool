// ── Grandview Sender — crexi/step-choose.js ──────────────────────────────────
// Step 0: On /add-properties, click "Add A Listing" for Sale or Lease.
// Selectors derived from the live DOM of https://www.crexi.com/add-properties.
'use strict';

window.CrexiSteps = window.CrexiSteps || {};

/**
 * Click the correct "Add A Listing" button based on prop.saleOrLease.
 * The page has two <crx-add-properties-card> components, each with a .header
 * reading "For Sale" or "For Lease" and a .get-started-btn button.
 *
 * @param {Object} prop - Flattened property data from the API.
 */
window.CrexiSteps.choose = async function choose(prop) {
  const { sleep, pageClick, waitForEl, log, warn } = window.CrexiHelpers;

  const isLease = prop.saleOrLease === 'for-lease';
  const targetHeader = isLease ? 'For Lease' : 'For Sale';
  log(`Choosing listing type: ${targetHeader}`);

  // Wait for the page to render the cards
  await waitForEl('crx-add-properties-card', 20_000);
  await sleep(800);

  // Find all property cards and match by header text
  const cards = document.querySelectorAll('crx-add-properties-card');
  let clicked = false;

  for (const card of cards) {
    const header = card.querySelector('.header');
    if (header && header.textContent.trim() === targetHeader) {
      const btn = card.querySelector('.get-started-btn');
      if (btn) {
        await pageClick(btn);
        clicked = true;
        log(`Clicked "${targetHeader}" → Add A Listing`);
        break;
      }
    }
  }

  if (!clicked) {
    warn(`Could not find card with header "${targetHeader}", trying fallback`);
    const fallbackBtn = document.querySelector('crx-add-properties-card .get-started-btn');
    if (fallbackBtn) {
      await pageClick(fallbackBtn);
      log('Clicked fallback "Add A Listing" button');
    } else {
      throw new Error(`No "Add A Listing" button found on the page`);
    }
  }

  // Wait for the SPA to navigate away from /add-properties
  await sleep(2000);
};
