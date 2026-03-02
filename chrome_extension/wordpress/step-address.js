// ── Grandview Sender — wordpress/step-address.js ────────────────────────────
// Steps 7–8: Address fields + Geo coordinates.
'use strict';

window.WPSteps = window.WPSteps || {};

window.WPSteps.address = async function address(prop) {
  const { wpStep, waitForNext, setInputValue } = window.WPHelpers;

  // ── 7. Address fields ──────────────────────────────────────────────────────
  wpStep('Address fields');
  const addressFields = [
    ['#acf-field_55d37e771112f',  prop.street],
    ['#acf-field_55d37e9c11130',  prop.city],
    ['#acf-field_55d37eab11131',  prop.state_abbr],
    ['#acf-field_610c73327fb0d',  prop.state_full],
    ['#acf-field_55d37ebc11132',  prop.zip],
  ];
  for (const [sel, val] of addressFields) {
    const el = document.querySelector(sel);
    if (el && val) setInputValue(el, String(val));
  }
  await waitForNext();

  // ── 8. Geo ─────────────────────────────────────────────────────────────────
  wpStep('Geo coordinates');
  const lngEl = document.querySelector('#acf-field_55e622bfaf26a');
  const latEl = document.querySelector('#acf-field_55e622f3af26b');
  if (lngEl && prop.lng) setInputValue(lngEl, String(prop.lng));
  if (latEl && prop.lat) setInputValue(latEl, String(prop.lat));
  await waitForNext();
};
