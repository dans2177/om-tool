// ── Grandview Sender — crexi/step-property-type.js ────────────────────────────
// Step 1: Select property type + subtype, and fill the Property Name field.
// All three fields (type, name, address) are on the same form page.
// Selectors verified against the live Crexi DOM.
'use strict';

window.CrexiSteps = window.CrexiSteps || {};

/**
 * 1. Select property type from the CUI checkbox dropdown.
 * 2. Pick the subtype from the ng-select dropdown (if applicable).
 * 3. Fill the "Property Name" input.
 *
 * Does NOT click Next — the address step handles that after the human pause.
 *
 * @param {Object} prop - Flattened property data from the API.
 */
window.CrexiSteps.propertyType = async function propertyType(prop) {
  const { sleep, waitForManualStep, setInputValue, log, warn } = window.CrexiHelpers;
  const { PROPERTY_TYPE_MAP, SUBTYPE_MAP } = window.CrexiTypes;

  const crexiType = PROPERTY_TYPE_MAP[prop.record_type] || 'Retail';

  // ── Property Type (manual) ─────────────────────────────────────────────────
  await waitForManualStep(
    `Please select Property Type: "${crexiType}"\n`
    + 'Open the "Property Type" dropdown and check the correct option, then click Apply.\n'
    + 'Click Continue when done.'
  );
  log(`User confirmed property type: ${crexiType}`);

  // ── Sub-type (manual) ──────────────────────────────────────────────────────
  if (prop.subtype) {
    const crexiSubtype = SUBTYPE_MAP[prop.subtype.toLowerCase().trim()] || prop.subtype;
    await waitForManualStep(
      `Please select Sub-type: "${crexiSubtype}"\n`
      + 'Open the sub-type dropdown and pick the correct option.\n'
      + 'Click Continue when done.'
    );
    log(`User confirmed subtype: ${crexiSubtype}`);
  }

  // ── Property Name ──────────────────────────────────────────────────────────
  const propertyName = prop.title || '';
  if (propertyName) {
    const nameEl = document.querySelector('input[name="propertyName"]');
    if (nameEl) {
      setInputValue(nameEl, propertyName);
      log(`Set property name: ${propertyName}`);
    } else {
      warn('Property Name input not found');
    }
  }

  await waitForManualStep(
    `Property Name has been set to: "${propertyName}"\n`
    + 'Verify it looks correct (edit if needed).\n'
    + 'Click Continue when done.'
  );
  log('User confirmed property name');

  await sleep(300);
  // No Next click — address step is next on the same page.
};
