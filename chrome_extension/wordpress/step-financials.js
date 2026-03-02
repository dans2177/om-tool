// ── Grandview Sender — wordpress/step-financials.js ─────────────────────────
// Step 9: All financial ACF fields.
'use strict';

window.WPSteps = window.WPSteps || {};

window.WPSteps.financials = async function financials(prop) {
  const { wpStep, waitForNext, setInputValue } = window.WPHelpers;

  // ── 9. Financial fields ────────────────────────────────────────────────────
  wpStep('Financial fields');
  const financialFields = [
    ['#acf-field_55d37ee611133',  prop.price],           // Price
    ['#acf-field_55d37fe811134',  prop.cap_rate],        // Cap Rate
    ['#acf-field_69316c0a19fc9',  ''],                   // Proforma Cap (leave blank)
    ['#acf-field_69316bfa19fc8',  ''],                   // Proforma NOI (leave blank)
    ['#acf-field_55d3803011135',  prop.noi],             // NOI
    ['#acf-field_55d3805911136',  prop.price_per_sf],    // Price Per SF
    ['#acf-field_56fd6c014b641',  prop.units],           // Units
    ['#acf-field_56fd6c434b642',  ''],                   // Price Per Unit (leave blank)
    ['#acf-field_56fd6d224b644',  prop.gross_sqft],      // Gross Sq. Footage
    ['#acf-field_55d380df11137',  ''],                   // Leasable Area
    ['#acf-field_69316b5a22e33',  prop.lot_size],        // Lot Size
    ['#acf-field_55d3882811138',  prop.term_remaining],  // Term Remaining
    ['#acf-field_55d3884411139',  prop.year_built],      // Year Built
    ['#acf-field_55d388881113a',  prop.occupancy],       // Occupancy
  ];
  for (const [sel, val] of financialFields) {
    const el = document.querySelector(sel);
    if (el && val !== '' && val != null) setInputValue(el, String(val));
  }
  await waitForNext();
};
