// ── Grandview Sender — wordpress/step-type.js ───────────────────────────────
// Steps 3, 6, 6b: Sale/Lease checkboxes, property type + content-focus +
// transaction type, property subtype.
'use strict';

window.WPSteps = window.WPSteps || {};

window.WPSteps.type = async function type(prop) {
  const { wpStep, waitForNext, checkCheckbox, setSelectValue, sleep } = window.WPHelpers;
  const { RECORD_TYPE_MAP, SUBTYPE_MAP } = window.WPTypes;

  // ── 3. Type of View (sale/lease checkboxes) ────────────────────────────────
  wpStep('Sale / Lease type');
  const isForSale  = prop.saleOrLease === 'for-sale'  || prop.saleOrLease === 'for-auction';
  const isForLease = prop.saleOrLease === 'for-lease';

  const cbForLease     = document.querySelector('#in-type_of_view-76-2');
  const cbForSale      = document.querySelector('#in-type_of_view-75-2');
  const cbBoth         = document.querySelector('#in-type_of_view-78-2');
  const cbInvestment   = document.querySelector('#in-type_of_view-77-2');

  if (cbForSale)    checkCheckbox(cbForSale,    isForSale);
  if (cbForLease)   checkCheckbox(cbForLease,   isForLease);
  if (cbBoth)       checkCheckbox(cbBoth,        false);
  if (cbInvestment) checkCheckbox(cbInvestment,  false);

  await sleep(300);
  await waitForNext();

  // ── 6. New Property Type (ACF select) ──────────────────────────────────────
  wpStep('Property type');
  const propTypeEl = document.querySelector('#acf-field_5d8958189ff21');
  if (propTypeEl && prop.record_type) {
    const wpType = RECORD_TYPE_MAP[prop.record_type] || '';
    if (wpType) setSelectValue(propTypeEl, wpType);
    await sleep(200);
  }

  // Use content-focus layout — always check this by default
  const contentFocusEl = document.querySelector('#acf-field_68ac509fc7f44');
  if (contentFocusEl) checkCheckbox(contentFocusEl, true);

  // Transaction Type — "investment" by default, "leasing" if for-lease
  const transactionEl = document.querySelector('#acf-field_5e4c0ea5ed9b9');
  if (transactionEl) {
    const txVal = prop.saleOrLease === 'for-lease' ? 'leasing' : 'investment';
    setSelectValue(transactionEl, txVal);
  }
  await sleep(200);
  await waitForNext();

  // ── 6b. New Subtype (ACF select) ──────────────────────────────────────────
  wpStep('Property subtype');
  const subtypeEl = document.querySelector('#acf-field_5d8958d39ff22');
  if (subtypeEl && prop.subtype) {
    const normalized = prop.subtype.toLowerCase().trim();
    const wpSubtype  = SUBTYPE_MAP[normalized] || prop.subtype;
    setSelectValue(subtypeEl, wpSubtype);
    await sleep(200);
  }
  await waitForNext();
};
