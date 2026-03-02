// ── Grandview Sender — wordpress/helpers.js ─────────────────────────────────
// Shared DOM helpers for all WordPress steps.
'use strict';

window.WPHelpers = window.WPHelpers || {};

// ── Private state (set by router before pipeline runs) ──────────────────────
let _testMode = false;
let _stepNum  = 0;
const _TOTAL_STEPS = 18;

window.WPHelpers.setTestMode = function (flag) { _testMode = !!flag; };
window.WPHelpers.resetProgress = function () { _stepNum = 0; };

/** Sleep for ms milliseconds */
window.WPHelpers.sleep = function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
};

/** Wait for an element matching `selector` to appear in the DOM */
window.WPHelpers.waitForEl = function waitForEl(selector, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for "${selector}"`));
    }, timeoutMs);
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearTimeout(timer);
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
};

/**
 * Robustly set a text input / textarea value and fire React/native change events.
 * Handles WP ACF inputs which may ignore plain .value assignment.
 */
window.WPHelpers.setInputValue = function setInputValue(el, value) {
  try { el.focus(); } catch (_) {}
  try { el.select?.(); } catch (_) {}

  try {
    const isTextarea = el.tagName === 'TEXTAREA';
    const proto = isTextarea
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(el, value);
    } else {
      el.value = value;
    }
  } catch (_) {
    el.value = value;
  }

  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  try { el.blur(); } catch (_) {}
};

window.WPHelpers.setSelectValue = function setSelectValue(el, value) {
  const opts = Array.from(el.options);
  const match = opts.find(
    (o) => o.value === value || o.text.trim().toLowerCase() === value.toLowerCase()
  );
  if (match) {
    el.value = match.value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    try { window.jQuery && window.jQuery(el).trigger('change'); } catch(e) {}
  } else {
    console.warn(`[GV WP] No option matching "${value}" in select`, el.id);
  }
};

/** Click an element after scrolling it into view */
window.WPHelpers.clickEl = function clickEl(el) {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.click();
};

/** Copy text to clipboard — tries navigator.clipboard first, falls back to execCommand */
window.WPHelpers.copyToClipboard = async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch(e) { /* fall through */ }
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
  document.body.appendChild(el);
  el.select();
  try { document.execCommand('copy'); } catch(e2) {}
  document.body.removeChild(el);
};

window.WPHelpers.checkCheckbox = function checkCheckbox(el, shouldCheck) {
  if (el.checked !== shouldCheck) el.click();
};

/**
 * In test mode: pause and wait for the popup "Next Action" button to be clicked.
 * In normal mode: resolves immediately.
 */
window.WPHelpers.waitForNext = function waitForNext() {
  if (!_testMode) return Promise.resolve();
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GV_WAITING' }).catch(() => {});
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
 * Always pause — shows an instruction in the popup regardless of testMode.
 */
window.WPHelpers.waitForManualStep = function waitForManualStep(message) {
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

/** Broadcast step progress back to the popup window */
window.WPHelpers.wpStep = function wpStep(label) {
  _stepNum++;
  const pct = Math.round((_stepNum / _TOTAL_STEPS) * 90);
  chrome.runtime.sendMessage({ type: 'GV_PROGRESS', pct, label: `WP: ${label}` }).catch(() => {});
};

window.WPHelpers.log  = function log(...args)  { console.log('[GV WP]', ...args); };
window.WPHelpers.warn = function warn(...args) { console.warn('[GV WP]', ...args); };
