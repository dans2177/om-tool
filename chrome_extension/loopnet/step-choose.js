// ── Grandview Sender — loopnet/step-choose.js ────────────────────────────────
// Step 0: On the CoStar listing manager (/my-listings), click "Add a Listing",
// expand the correct For Sale / For Lease collapsible, then pick the property
// type sub-item that matches the record type.
'use strict';

window.LoopNetSteps = window.LoopNetSteps || {};

// ── Map Matthews record_type → CoStar dropdown label ─────────────────────────
// For Sale options:  Building | Condo | Land | Portfolio | Business
// For Lease options: Building or Condo | Land
function costarPropertyTypeLabel(recordType, isLease) {
  const rt = (recordType || '').toLowerCase();
  if (rt === 'land') return isLease ? 'Land' : 'Land';
  // default
  return isLease ? 'Building or Condo' : 'Building';
}

window.LoopNetSteps.choose = async function choose(prop) {
  const { sleep, waitForEl, clickEl, updateGuidePanel, waitForManualStep, log, warn } =
    window.LoopNetHelpers;

  const isLease      = (prop.saleOrLease || '').toLowerCase().includes('lease');
  const typeLabel    = isLease ? 'For Lease' : 'For Sale';
  const subTypeLabel = costarPropertyTypeLabel(prop.record_type, isLease);

  // Show guide panel immediately
  updateGuidePanel('Add Listing', [
    { label: 'Property',   value: prop.title        || '' },
    { label: 'Address',    value: prop.full_address  || '' },
    { label: 'List Type',  value: typeLabel },
    { label: 'Prop Type',  value: subTypeLabel },
    { label: 'Price',      value: prop.price         || '' },
  ], 0);

  log(`Starting CoStar/LoopNet listing — ${typeLabel} › ${subTypeLabel}`);

  // ── 1. Click the "Add a Listing" dropdown trigger ─────────────────────────
  // Selector from the real page: button.dropdown-menu-button[title="Add a Listing"]
  // Also try the data-testid wrapper as a fallback.
  let addBtn =
    document.querySelector('button.dropdown-menu-button[title="Add a Listing"]') ||
    document.querySelector('[data-testid="test-nav-header-add-listing-button"] button') ||
    document.querySelector('button.dropdown-menu-button');

  if (!addBtn) {
    warn('"Add a Listing" button not found — waiting for manual click');
    await waitForManualStep(
      'Please click the "Add a Listing" button on this page, then click Continue.'
    );
  } else {
    log('Clicking "Add a Listing" button');
    clickEl(addBtn);
    await sleep(800);
  }

  // ── 2. Expand the For Sale / For Lease collapsible ────────────────────────
  // The dropdown renders: <button class="collapsible-toggle btn btn-secondary">For Sale</button>
  const collapsibles = document.querySelectorAll('button.collapsible-toggle');
  let collapsibleBtn = null;
  for (const btn of collapsibles) {
    if (btn.textContent.trim().toLowerCase() === typeLabel.toLowerCase()) {
      collapsibleBtn = btn;
      break;
    }
  }

  if (!collapsibleBtn) {
    warn(`"${typeLabel}" collapsible not found — waiting for manual selection`);
    await waitForManualStep(
      `Please expand "${typeLabel}" in the dropdown and select "${subTypeLabel}", then click Continue.`
    );
    return;
  }

  log(`Expanding "${typeLabel}" collapsible`);
  clickEl(collapsibleBtn);
  await sleep(600);

  // ── 3. Click the correct property-type item ───────────────────────────────
  // Items are <a class="dropdown-item"> inside the expanded <ul class="collapsible-menu">
  const menuItems = collapsibleBtn
    .closest('.dropdown-menu-collapsible')
    ?.querySelectorAll('a.dropdown-item') || [];

  let targetItem = null;
  for (const item of menuItems) {
    if (item.textContent.trim().toLowerCase() === subTypeLabel.toLowerCase()) {
      targetItem = item;
      break;
    }
  }

  if (!targetItem) {
    warn(`Property type "${subTypeLabel}" not found in menu — waiting for manual selection`);
    await waitForManualStep(
      `Please select "${subTypeLabel}" from the "${typeLabel}" menu, then click Continue.`
    );
    return;
  }

  log(`Clicking "${subTypeLabel}"`);
  clickEl(targetItem);
  await sleep(1500);
};
