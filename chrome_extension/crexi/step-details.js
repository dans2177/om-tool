// ── Grandview Sender — crexi/step-details.js ─────────────────────────────────
// Step 3: Fill in property details on page 2 — square footage, year built,
// year renovated, lot size (acres), NOI, lease commencement/expiration.
// Selectors verified against the live Crexi DOM.
'use strict';

window.CrexiSteps = window.CrexiSteps || {};

/**
 * Fill property detail fields on page 2.
 *
 * Fields (all real selectors from the DOM):
 *   Square Feet:          input[name="squareFootage"]
 *   Year(s) Built:        input[name="yearBuilt"]
 *   Year(s) Renovated:    input[name="yearsRenovated"]
 *   Lot Size Measurement: select[name="lotSizeType"]  → pick "acres"
 *   Lot Size:             input[name="lotSize"]
 *   NOI:                  input[name="netOperatingIncome"]
 *   Lease Commencement:   input[name="leaseCommencement"]  (cui-datepicker)
 *   Lease Expiration:     input[name="leaseExpiration"]    (cui-datepicker)
 *
 * Clicks Continue at the end — subheader / highlights are on page 3.
 *
 * @param {Object} prop - Flattened property data from the API.
 */
window.CrexiSteps.details = async function details(prop) {
  const { sleep, setInputValue, clickEl, pageClick, log, warn } = window.CrexiHelpers;

  log('Filling property details (page 2)');

  // ── Square Feet ──────────────────────────────────────────────────────────
  const sqftEl = document.querySelector('input[name="squareFootage"]');
  if (sqftEl && prop.gross_sqft) {
    setInputValue(sqftEl, String(prop.gross_sqft));
    log(`Set square footage: ${prop.gross_sqft} SF`);
  }

  // ── Year Built ───────────────────────────────────────────────────────────
  const yearBuiltEl = document.querySelector('input[name="yearBuilt"]');
  if (yearBuiltEl && prop.year_built) {
    setInputValue(yearBuiltEl, String(prop.year_built));
    log(`Set year built: ${prop.year_built}`);
  }

  // ── Year Renovated ───────────────────────────────────────────────────────
  const yearRenovatedEl = document.querySelector('input[name="yearsRenovated"]');
  if (yearRenovatedEl && prop.year_renovated) {
    setInputValue(yearRenovatedEl, String(prop.year_renovated));
    log(`Set year renovated: ${prop.year_renovated}`);
  }

  // ── Lot Size Measurement (select "acres") ────────────────────────────────
  const lotTypeSelect = document.querySelector('select[name="lotSizeType"]');
  if (lotTypeSelect) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype, 'value'
    )?.set;
    if (nativeSetter) nativeSetter.call(lotTypeSelect, 'acres');
    else lotTypeSelect.value = 'acres';
    lotTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    log('Set lot size measurement: acres');
    await sleep(300);
  }

  // ── Lot Size ─────────────────────────────────────────────────────────────
  const lotSizeEl = document.querySelector('input[name="lotSize"]');
  if (lotSizeEl && prop.lot_size) {
    setInputValue(lotSizeEl, String(prop.lot_size));
    log(`Set lot size: ${prop.lot_size} acres`);
  }

  // ── NOI (Net Operating Income) ───────────────────────────────────────────
  const noiEl = document.querySelector('input[name="netOperatingIncome"]');
  if (noiEl && prop.noi) {
    const noiValue = typeof prop.noi === 'number'
      ? prop.noi
      : parseFloat(String(prop.noi).replace(/[$,]/g, ''));
    if (!isNaN(noiValue)) {
      setInputValue(noiEl, String(noiValue));
      log(`Set NOI: $${noiValue.toLocaleString()}`);
    }
  }

  // ── Lease Commencement (datepicker) ──────────────────────────────────────
  const leaseStartEl = document.querySelector('input[name="leaseCommencement"]');
  if (leaseStartEl && prop.lease_commencement) {
    setInputValue(leaseStartEl, prop.lease_commencement);
    log(`Set lease commencement: ${prop.lease_commencement}`);
  }

  // ── Lease Expiration (datepicker) ────────────────────────────────────────
  const leaseEndEl = document.querySelector('input[name="leaseExpiration"]');
  if (leaseEndEl && prop.lease_expiration) {
    setInputValue(leaseEndEl, prop.lease_expiration);
    log(`Set lease expiration: ${prop.lease_expiration}`);
  }

  await sleep(500);

  // ── Click Continue ─────────────────────────────────────────────────────────
  // Details is the last section on page 2 — subheader + highlights are on page 3.
  const nextBtn = window.CrexiHelpers.findButtonByText('continue')
    || window.CrexiHelpers.findButtonByText('next');
  if (nextBtn) {
    await pageClick(nextBtn);
    log('Clicked Continue — advancing to page 3');
  } else {
    warn('Continue button not found after details step');
  }

  await sleep(2000);
};
