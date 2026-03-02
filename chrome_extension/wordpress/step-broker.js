// ── Grandview Sender — wordpress/step-broker.js ─────────────────────────────
// Steps 10–11: Broker of record fields + Listing agents (Select2).
'use strict';

window.WPSteps = window.WPSteps || {};

// ── Private helper: Select2 agent picker ────────────────────────────────────
async function addAgentSelect2(agentName) {
  const { sleep, clickEl } = window.WPHelpers;

  const addAgentBtn = document.querySelector('div.acf-field-55d38abe7fb9a a.acf-repeater-add-row');
  if (!addAgentBtn) { console.warn('[GV WP] Add Agent button not found'); return; }
  clickEl(addAgentBtn);
  await sleep(800);

  const realRows = document.querySelectorAll('div.acf-field-55d38abe7fb9a .acf-row:not(.acf-clone)');
  const newRow = realRows[realRows.length - 1];
  if (!newRow) { console.warn('[GV WP] No real row found after Add Agent'); return; }

  const selection = newRow.querySelector('.select2-selection');
  if (!selection) { console.warn('[GV WP] Select2 selection widget not found in new row'); return; }
  clickEl(selection);
  await sleep(500);

  const searchInput = document.querySelector('.select2-container--open .select2-search__field');
  if (!searchInput) { console.warn('[GV WP] Select2 search input not found'); return; }

  searchInput.value = agentName;
  if (window.jQuery) {
    window.jQuery(searchInput).trigger('input');
  } else {
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  await sleep(1500);

  const allResults = document.querySelectorAll('.select2-results__option:not([aria-disabled="true"])');
  const nameLower  = agentName.toLowerCase();
  const match = Array.from(allResults).find(
    (r) => r.textContent.trim().toLowerCase().includes(nameLower)
  );

  if (match) {
    clickEl(match);
    await sleep(400);
  } else if (allResults.length > 0) {
    console.warn(`[GV WP] No exact match for "${agentName}", clicking first result`);
    clickEl(allResults[0]);
    await sleep(400);
  } else {
    console.warn('[GV WP] No Select2 results found for agent:', agentName);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }
}

window.WPSteps.broker = async function broker(prop) {
  const { wpStep, waitForNext, setInputValue, sleep } = window.WPHelpers;

  // ── 10. Broker of Record fields ────────────────────────────────────────────
  wpStep('Broker of record');
  const bor = prop.broker || {};
  const brokerFields = [
    ['#acf-field_58773f9d896d6',  bor.name],
    ['#acf-field_58773fab896d7',  bor.license_number],
    ['#acf-field_5878a4b24bd77',  bor.company],
    ['#acf-field_5878a4c14bd78',  bor.address],
    ['#acf-field_5878a4ca4bd79',  bor.phone],
  ];
  for (const [sel, val] of brokerFields) {
    const el = document.querySelector(sel);
    if (el && val) setInputValue(el, String(val));
  }
  await waitForNext();

  // ── 11. Listing Agents (Select2) ───────────────────────────────────────────
  wpStep('Listing agents');
  const agents = prop.listing_agents || [];
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    if (!agent?.name) continue;
    await addAgentSelect2(agent.name);
    await sleep(400);
  }
};
