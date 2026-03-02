// ── Grandview Sender — crexi/step-address.js ─────────────────────────────────
// Step 2: Enter the property address using the Google Places autocomplete,
// then pause for human verification of the map / street view.
// Selectors verified against the live Crexi DOM.
'use strict';

window.CrexiSteps = window.CrexiSteps || {};

/**
 * Fill the Street Address field (Google Places autocomplete), select the
 * first suggestion, then pause and wait for a human to confirm the map
 * pin / street view looks correct before proceeding.
 *
 * Address input: crx-address-autocomplete input[data-cy="addressInput"]
 *   → Has class .pac-target-input (Google Places Autocomplete)
 *   → placeholder="Enter a location"
 *   → Autocomplete suggestions appear as .pac-container .pac-item
 *
 * @param {Object} prop - Flattened property data from the API.
 */
window.CrexiSteps.address = async function address(prop) {
  const { sleep, waitForEl, setInputValue, clickEl, pageClick, waitForManualStep, log, warn } = window.CrexiHelpers;

  log('Filling address');

  const fullAddress = prop.full_address
    || [prop.street, prop.city, prop.state_abbr, prop.zip].filter(Boolean).join(', ');

  if (!fullAddress) {
    warn('No address data available — manual entry needed');
    await waitForManualStep(
      'No address found in property data.\nPlease enter the address manually, then click Continue.'
    );
    return;
  }

  // ── Fill the Google Places autocomplete input ──────────────────────────────
  // Selector: crx-address-autocomplete input[data-cy="addressInput"]
  const addressInput = await waitForEl(
    'crx-address-autocomplete input[data-cy="addressInput"]', 15_000
  );

  // Focus and type the address to trigger Google Places autocomplete
  addressInput.focus();
  setInputValue(addressInput, fullAddress);
  log(`Typed address: ${fullAddress}`);

  // Wait for Google Places autocomplete suggestions (.pac-container)
  await sleep(2000);

  // Click the first autocomplete suggestion
  const suggestion = document.querySelector('.pac-container .pac-item');
  if (suggestion) {
    await pageClick(suggestion);
    log('Clicked first autocomplete suggestion');
  } else {
    warn('No Google Places suggestion appeared — address may need manual selection');
  }

  // Wait for the map to update after address selection
  await sleep(2000);

  // ── PAUSE: Human must verify the map / street view ─────────────────────────
  // This sends GV_WAITING to the popup, which shows the "Next Action" button.
  // The automation halts here until the user clicks Continue in the popup.
  await waitForManualStep(
    `Address entered: ${fullAddress}\n\n`
    + 'Please verify the map pin and street view are correct.\n'
    + 'If the pin is wrong, adjust it manually.\n'
    + 'Click Continue when the location looks good.'
  );
  log('Human confirmed address — continuing');

  await sleep(500);
  // No Next click — asking price is the next field on the same page.
};
