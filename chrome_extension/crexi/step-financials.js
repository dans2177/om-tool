// ── Grandview Sender — crexi/step-financials.js ──────────────────────────────
// Step 4: Fill in the Asking Price (or mark as unpriced with a searchable range).
// This is the LAST field on the first form page — clicks Continue afterward.
// Selectors verified against the live Crexi DOM.
'use strict';

window.CrexiSteps = window.CrexiSteps || {};

/**
 * Fill the Asking Price field, or check "unpriced" and fill the searchable
 * price range if the price is not a valid number.
 *
 * Asking Price:       input[name="askingPrice"][formcontrolname="askingPrice"]
 * Unpriced checkbox:  cui-checkbox[formcontrolname="bestOffer"] → input[name="bestOffer"]
 * Searchable Min:     input[name="searchPriceMin"][formcontrolname="searchPriceMin"]
 * Searchable Max:     input[name="searchPriceMax"][formcontrolname="searchPriceMax"]
 *
 * Logic:
 *   - If prop.price is a positive number → fill askingPrice
 *   - If price is missing, zero, "contact broker", or non-numeric →
 *       check "unpriced", then set searchPriceMin=1, searchPriceMax=100000000
 *
 * After price, this is the last field on page 1 — clicks Continue.
 *
 * @param {Object} prop - Flattened property data from the API.
 */
window.CrexiSteps.financials = async function financials(prop) {
  const { sleep, setInputValue, clickEl, pageClick, log, warn } = window.CrexiHelpers;

  log('Filling asking price');

  // Determine if we have a valid numeric price
  const rawPrice = prop.price;
  const numericPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice).replace(/[$,]/g, ''));
  const hasValidPrice = !isNaN(numericPrice) && numericPrice > 0;

  if (hasValidPrice) {
    // ── Fill Asking Price ────────────────────────────────────────────────────
    const priceEl = document.querySelector('input[name="askingPrice"]');
    if (priceEl) {
      setInputValue(priceEl, String(numericPrice));
      log(`Set asking price: $${numericPrice.toLocaleString()}`);
    } else {
      warn('Asking price input not found');
    }
  } else {
    // ── Check "unpriced" and fill searchable range ───────────────────────────
    log(`Price not numeric ("${rawPrice}") — marking as unpriced`);

    // Click the "unpriced" checkbox
    // The checkbox is inside cui-checkbox[formcontrolname="bestOffer"]
    // The actual clickable element is the mat-checkbox
    const unpricedCheckbox = document.querySelector('cui-checkbox[formcontrolname="bestOffer"] mat-checkbox');
    if (unpricedCheckbox) {
      const isAlreadyChecked = unpricedCheckbox.classList.contains('mat-mdc-checkbox-checked');
      if (!isAlreadyChecked) {
        await pageClick(unpricedCheckbox);
        log('Checked "unpriced"');
        await sleep(500); // wait for the searchable range fields to appear
      }
    } else {
      // Fallback: try clicking the checkbox input directly
      const fallbackCb = document.querySelector('input[name="bestOffer"]');
      if (fallbackCb && !fallbackCb.checked) {
        fallbackCb.click();
        log('Checked "unpriced" (fallback)');
        await sleep(500);
      } else {
        warn('Unpriced checkbox not found');
      }
    }

    // Fill searchable price range: min = 1, max = 100,000,000
    const minEl = document.querySelector('input[name="searchPriceMin"]');
    const maxEl = document.querySelector('input[name="searchPriceMax"]');

    if (minEl) {
      setInputValue(minEl, '1');
      log('Set searchable min price: $1');
    } else {
      warn('Searchable min price input not found');
    }

    if (maxEl) {
      setInputValue(maxEl, '100000000');
      log('Set searchable max price: $100,000,000');
    } else {
      warn('Searchable max price input not found');
    }
  }

  await sleep(500);

  // ── Click Continue ─────────────────────────────────────────────────────────
  // Price is the last field on this page (type + name + address + price).
  const nextBtn = window.CrexiHelpers.findButtonByText('continue')
    || window.CrexiHelpers.findButtonByText('next');
  if (nextBtn) {
    await pageClick(nextBtn);
    log('Clicked Continue — advancing to next page');
  } else {
    warn('Continue button not found after price step');
  }

  await sleep(2000);
};
