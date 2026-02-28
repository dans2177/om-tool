// ── Grandview Sender — loopnet.js ─────────────────────────────────────────────
// Content script for: https://*.loopnet.com/*
// TODO: Run Chrome Recorder on LoopNet's "List a Property" flow and paste selectors below.
'use strict';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function waitForEl(selector, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for "${selector}"`));
    }, timeoutMs);
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { clearTimeout(timer); observer.disconnect(); resolve(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

function setInputValue(el, value) {
  el.focus();
  const nativeSetter =
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (nativeSetter) nativeSetter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.blur();
}

// ── Main fill function ─────────────────────────────────────────────────────────
async function fillLoopNet(prop, wpUrl) {
  console.log('[GV LoopNet] Starting fill…', prop.title);

  // ── TODO: Replace each selector below with the real one from your Chrome Recording ──

  // Property name / title
  // const titleEl = await waitForEl('TODO_LOOPNET_TITLE_SELECTOR');
  // if (titleEl) setInputValue(titleEl, prop.title || '');

  // Address
  // const addressEl = document.querySelector('TODO_LOOPNET_ADDRESS_SELECTOR');
  // if (addressEl) setInputValue(addressEl, prop.full_address || '');

  // Price
  // const priceEl = document.querySelector('TODO_LOOPNET_PRICE_SELECTOR');
  // if (priceEl) setInputValue(priceEl, String(prop.price || ''));

  // Highlights / tags
  // LoopNet supports highlight tags (from prop.highlights or prop.loopnet_highlights)
  // const tagsEl = document.querySelector('TODO_LOOPNET_HIGHLIGHTS_SELECTOR');

  // Description
  // const descEl = document.querySelector('TODO_LOOPNET_DESCRIPTION_SELECTOR');
  // if (descEl) setInputValue(descEl, prop.meta_description || '');

  // Source URL (WP listing link)
  // const sourceUrlEl = document.querySelector('TODO_LOOPNET_SOURCE_URL_SELECTOR');
  // if (sourceUrlEl && wpUrl) setInputValue(sourceUrlEl, wpUrl);

  // Images
  // for (const img of prop.final_images || []) {
  //   const url = img.watermarkedUrl || img.originalUrl;
  //   // TODO: implement image upload for LoopNet
  // }

  // Submit
  // const submitBtn = document.querySelector('TODO_LOOPNET_SUBMIT_SELECTOR');
  // if (submitBtn) submitBtn.click();

  console.warn('[GV LoopNet] Fill not yet implemented — awaiting CSS selectors from Chrome Recorder');
  await sleep(500);
}

// ── Entry point ────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'GV_LOOPNET_FILL') return;
  sendResponse({ ok: true });

  chrome.storage.local.get(['gvProperty', 'gvWpUrl'], async ({ gvProperty, gvWpUrl }) => {
    if (!gvProperty) {
      chrome.runtime.sendMessage({ type: 'GV_LOOPNET_FILL_ERROR', message: 'No property data in storage' });
      return;
    }
    try {
      await fillLoopNet(gvProperty, gvWpUrl || '');
      chrome.runtime.sendMessage({ type: 'GV_LOOPNET_FILL_DONE' });
    } catch (err) {
      console.error('[GV LoopNet] Error:', err);
      chrome.runtime.sendMessage({ type: 'GV_LOOPNET_FILL_ERROR', message: err.message });
    }
  });

  return true;
});
