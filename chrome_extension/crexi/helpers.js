// ── Grandview Sender — crexi/helpers.js ───────────────────────────────────────
// Shared DOM helpers for all Crexi steps.
'use strict';

window.CrexiHelpers = window.CrexiHelpers || {};

/** Sleep for ms milliseconds */
window.CrexiHelpers.sleep = function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
};

/** Wait for an element matching `selector` to appear in the DOM */
window.CrexiHelpers.waitForEl = function waitForEl(selector, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`[Crexi] Timeout waiting for "${selector}"`));
    }, timeoutMs);
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { clearTimeout(timer); observer.disconnect(); resolve(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
};

/** Wait for an element matching `selector` to disappear from the DOM */
window.CrexiHelpers.waitForElGone = function waitForElGone(selector, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    if (!document.querySelector(selector)) return resolve();
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`[Crexi] Timeout waiting for "${selector}" to disappear`));
    }, timeoutMs);
    const observer = new MutationObserver(() => {
      if (!document.querySelector(selector)) {
        clearTimeout(timer); observer.disconnect(); resolve();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
};

/** Wait for a URL change (SPA navigation) — resolves when location.href includes `fragment` */
window.CrexiHelpers.waitForNav = function waitForNav(fragment, timeoutMs = 20_000) {
  return new Promise((resolve, reject) => {
    if (location.href.includes(fragment)) return resolve();
    const timer = setTimeout(() => {
      clearInterval(poll);
      reject(new Error(`[Crexi] Timeout waiting for URL to include "${fragment}"`));
    }, timeoutMs);
    const poll = setInterval(() => {
      if (location.href.includes(fragment)) {
        clearTimeout(timer); clearInterval(poll); resolve();
      }
    }, 250);
  });
};

/**
 * Set a text input / textarea value using the native setter trick so Angular
 * picks up the change even when it ignores plain `.value =` assignments.
 */
window.CrexiHelpers.setInputValue = function setInputValue(el, value) {
  el.focus();
  const nativeSetter =
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  if (nativeSetter) nativeSetter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.blur();
};

/** Click an element after scrolling it into view (full event simulation for Angular CDK) */
window.CrexiHelpers.clickEl = function clickEl(el) {
  el.scrollIntoView({ behavior: 'instant', block: 'center' });
  const opts = { bubbles: true, cancelable: true };
  el.dispatchEvent(new PointerEvent('pointerdown', opts));
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new PointerEvent('pointerup', opts));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.click();
};

/**
 * Click a DOM element via the MAIN world helper (page-world.js).
 * Needed because Angular's Zone.js doesn't detect events from the ISOLATED world.
 * The content script tags the target element with a temporary ID, then sends
 * a CustomEvent to the MAIN world script which calls .click() in Angular's zone.
 *
 * @param {string|Element} selectorOrEl - CSS selector string, or a DOM element reference.
 */
window.CrexiHelpers.pageClick = async function pageClick(selectorOrEl) {
  let selector;
  if (typeof selectorOrEl === 'string') {
    selector = selectorOrEl;
  } else {
    // It's an element — assign a temp ID so the MAIN world script can find it
    const tempId = '__gv_click_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    selectorOrEl.setAttribute('data-gv-click', tempId);
    selector = `[data-gv-click="${tempId}"]`;
    // Clean up the attribute after a short delay
    setTimeout(() => selectorOrEl.removeAttribute('data-gv-click'), 2000);
  }
  // Scroll into view from our world (this part is fine from isolated world)
  const el = document.querySelector(selector);
  if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  // Dispatch to the MAIN world script
  window.dispatchEvent(new CustomEvent('gv-page-click', { detail: selector }));
  await window.CrexiHelpers.sleep(100);
};

/**
 * Select a mat-select / Angular Material dropdown option by visible text.
 * Opens the dropdown, waits for the overlay, picks the matching option.
 */
window.CrexiHelpers.selectMatOption = async function selectMatOption(triggerSelector, optionText, timeoutMs = 10_000) {
  const { waitForEl, sleep, clickEl } = window.CrexiHelpers;
  const trigger = await waitForEl(triggerSelector, timeoutMs);
  clickEl(trigger);
  await sleep(500);

  // Angular Material renders options inside a cdk-overlay
  const options = document.querySelectorAll('mat-option .mdc-list-item__primary-text, mat-option span.mat-option-text');
  const textLower = optionText.toLowerCase();
  let match = null;
  for (const opt of options) {
    if (opt.textContent.trim().toLowerCase() === textLower) {
      match = opt.closest('mat-option');
      break;
    }
  }
  if (match) {
    clickEl(match);
    await sleep(300);
  } else {
    console.warn(`[Crexi] No mat-option found matching "${optionText}"`);
  }
};

/**
 * Select option(s) in a Crexi CUI checkbox dropdown (cui-select).
 * Uses pageClick (MAIN world) for all clicks so Angular's Zone.js processes them.
 * The dropdown renders as a CDK overlay at the root of <body>.
 *
 * @param {string} triggerSelector - CSS selector for the cui-select element.
 * @param {string|string[]} labels - The label text(s) to check. e.g. 'Retail' or ['Retail', 'Office']
 */
window.CrexiHelpers.selectCuiCheckbox = async function selectCuiCheckbox(triggerSelector, labels, timeoutMs = 10_000) {
  const { waitForEl, sleep, pageClick, log, warn } = window.CrexiHelpers;

  const labelArray = Array.isArray(labels) ? labels : [labels];

  // Click the trigger to open the CDK overlay dropdown (via MAIN world)
  const trigger = await waitForEl(triggerSelector, timeoutMs);
  const triggerDiv = trigger.querySelector('.cui-select-trigger') || trigger;
  await pageClick(triggerDiv);
  await sleep(800);

  // Wait for the dropdown to appear in the CDK overlay
  let dropdown = document.querySelector('.cui-dropdown-list');
  if (!dropdown) {
    // Retry click
    await pageClick(triggerDiv);
    await sleep(800);
    dropdown = document.querySelector('.cui-dropdown-list');
  }
  if (!dropdown) {
    dropdown = await waitForEl('.cui-dropdown-list', 5_000);
  }

  // Find all dropdown items
  const items = document.querySelectorAll('.cui-dropdown-list .cui-dropdown-list-item');
  log(`CUI dropdown opened — ${items.length} items found`);

  for (const targetLabel of labelArray) {
    const targetLower = targetLabel.toLowerCase().trim();
    let found = false;

    for (const item of items) {
      const label = item.querySelector('.mdc-label');
      if (label && label.textContent.trim().toLowerCase() === targetLower) {
        const checkbox = item.querySelector('input[type="checkbox"]');
        const isSelected = checkbox?.checked
          || item.classList.contains('cui-dropdown-list-item-selected');
        if (!isSelected) {
          await pageClick(item);
          await sleep(300);
        }
        found = true;
        log(`CUI checkbox: selected "${targetLabel}"`);
        break;
      }
    }

    if (!found) {
      warn(`CUI dropdown: no item matching "${targetLabel}"`);
    }
  }

  // Click the "Apply" button at the bottom of the dropdown
  const applyBtn = document.querySelector('.cui-dropdown-button-section button');
  if (applyBtn) {
    await pageClick(applyBtn);
    log('Clicked Apply on CUI dropdown');
  } else {
    document.body.click();
    warn('Apply button not found — clicked outside to close');
  }
  await sleep(500);
};

/**
 * Select an option in an ng-select dropdown by its .ng-option-label text.
 * Uses pageClick (MAIN world) for Angular-compatible clicks.
 *
 * @param {string} triggerSelector - CSS selector for the ng-select or its container.
 * @param {string} optionLabel - The option label text to select.
 */
window.CrexiHelpers.selectNgOption = async function selectNgOption(triggerSelector, optionLabel, timeoutMs = 10_000) {
  const { waitForEl, sleep, pageClick, log, warn } = window.CrexiHelpers;

  // Click the ng-select to open it (via MAIN world)
  const trigger = await waitForEl(triggerSelector, timeoutMs);
  await pageClick(trigger);
  await sleep(600);

  // Wait for the dropdown panel to appear
  let panel = document.querySelector('ng-dropdown-panel');
  if (!panel) {
    // Retry click
    await pageClick(trigger);
    await sleep(600);
  }
  panel = await waitForEl('ng-dropdown-panel', 5_000);

  const options = document.querySelectorAll('ng-dropdown-panel .ng-option');
  const targetLower = optionLabel.toLowerCase().trim();
  let found = false;

  for (const opt of options) {
    const label = opt.querySelector('.ng-option-label');
    if (label && label.textContent.trim().toLowerCase() === targetLower) {
      await pageClick(opt);
      found = true;
      log(`ng-select: selected "${optionLabel}"`);
      await sleep(300);
      break;
    }
  }

  if (!found) {
    warn(`ng-select: no option matching "${optionLabel}"`);
  }
};

/**
 * Check or uncheck an Angular Material checkbox.
 */
window.CrexiHelpers.setMatCheckbox = function setMatCheckbox(checkboxEl, shouldCheck) {
  const isChecked = checkboxEl.classList.contains('mat-mdc-checkbox-checked')
    || checkboxEl.querySelector('input[type="checkbox"]')?.checked;
  if (!!isChecked !== !!shouldCheck) {
    checkboxEl.click();
  }
};

/**
 * Find a button by its label text (case-insensitive partial match).
 */
window.CrexiHelpers.findButtonByText = function findButtonByText(text) {
  const textLower = text.toLowerCase();
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.textContent.trim().toLowerCase().includes(textLower)) return btn;
  }
  return null;
};

/**
 * Report step progress back to the popup via the background service worker.
 */
window.CrexiHelpers.reportProgress = function reportProgress(stepIndex, stepLabel) {
  const totalSteps = (window.CrexiTypes?.STEPS?.length) || 8;
  const pct = Math.round(((stepIndex + 1) / (totalSteps + 1)) * 90);
  chrome.runtime.sendMessage({
    type: 'GV_PROGRESS',
    pct,
    label: `Crexi: ${stepLabel}`,
  }).catch(() => {});
};

/**
 * Pause automation and wait for human confirmation via the popup.
 * Sends GV_WAITING with a message to the popup (shows "Next Action" button),
 * then blocks until the user clicks Continue (GV_NEXT).
 * Same pattern as wordpress.js waitForManualStep.
 *
 * @param {string} message - Instruction text shown in the popup.
 */
window.CrexiHelpers.waitForManualStep = function waitForManualStep(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GV_WAITING', message }).catch(() => {});
    const listener = (msg) => {
      if (msg.type === 'GV_NEXT') {
        chrome.runtime.onMessage.removeListener(listener);
        resolve();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
  });
};

/**
 * Log a prefixed message to the console.
 */
window.CrexiHelpers.log = function log(...args) {
  console.log('[GV Crexi]', ...args);
};

window.CrexiHelpers.warn = function warn(...args) {
  console.warn('[GV Crexi]', ...args);
};
