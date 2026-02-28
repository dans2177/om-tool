// ── Grandview Sender — background.js (MV3 service worker) ───────────────────
'use strict';

const WP_NEW_PROPERTY_URL =
  'https://live-matthewsreis.pantheonsite.io/wp-admin/post-new.php?post_type=property';
const CREXI_NEW_URL   = 'https://www.crexi.com/sell';
const LOOPNET_NEW_URL = 'https://www.loopnet.com/services/list-property/';

// ── Persistent popup window ────────────────────────────────────────────────────
let popupWindowId = null;
let currentWpTabId = null; // track so we can relay GV_NEXT to WP content script

chrome.action.onClicked.addListener(() => {
  const popupUrl = chrome.runtime.getURL('popup.html');
  if (popupWindowId !== null) {
    // Focus the existing window if it's still open
    chrome.windows.get(popupWindowId, (win) => {
      if (chrome.runtime.lastError || !win) {
        popupWindowId = null;
        openPopupWindow(popupUrl);
      } else {
        chrome.windows.update(popupWindowId, { focused: true });
      }
    });
  } else {
    openPopupWindow(popupUrl);
  }
});

function openPopupWindow(url) {
  chrome.windows.create(
    { url, type: 'popup', width: 400, height: 660, focused: true },
    (win) => { popupWindowId = win.id; }
  );
}

chrome.windows.onRemoved.addListener((id) => {
  if (id === popupWindowId) popupWindowId = null;
});

// ── Main message entry-point ──────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GV_START') {
    sendResponse({ ok: true });
    runSequence(msg).catch((err) => {
      broadcastAll({ type: 'GV_ERROR', message: err.message });
    });
    return true; // keep channel open
  }
  if (msg.type === 'GV_NEXT_REQUEST') {
    if (currentWpTabId !== null) {
      sendToTab(currentWpTabId, { type: 'GV_NEXT' }).catch(() => {});
    }
  }
});

// ── Content-script messaging helper ──────────────────────────────────────────
function sendToTab(tabId, payload) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, payload, (resp) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(resp);
    });
  });
}

// ── Broadcast to all extension views (popup) ──────────────────────────────────
function broadcastAll(payload) {
  chrome.runtime.sendMessage(payload).catch(() => {}); // popup may be closed — ignore
}

// ── Wait for a tab to finish loading ─────────────────────────────────────────
function waitForTabLoad(tabId, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error(`Tab ${tabId} load timed out`));
    }, timeoutMs);

    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ── Open a URL in a new tab and wait for load ─────────────────────────────────
async function openTab(url) {
  const tab = await chrome.tabs.create({ url, active: true });
  await waitForTabLoad(tab.id);
  // Extra buffer for JS-heavy pages (ACF, WP admin, etc.)
  await sleep(1500);
  return tab.id;
}

// ── Wait for content script to confirm it's done ─────────────────────────────
function runContentScript(tabId, type, extraWaitMs = 2000, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Content script ${type} timed out on tab ${tabId}`));
    }, timeoutMs);

    function listener(msg, sender) {
      if (sender.tab?.id === tabId && msg.type === `${type}_DONE`) {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(listener);
        resolve(msg);
      }
      if (sender.tab?.id === tabId && msg.type === `${type}_ERROR`) {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(listener);
        reject(new Error(msg.message));
      }
    }
    chrome.runtime.onMessage.addListener(listener);

    // Kick off the content script
    sendToTab(tabId, { type }).catch((err) => {
      clearTimeout(timeout);
      chrome.runtime.onMessage.removeListener(listener);
      reject(err);
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main posting sequence ─────────────────────────────────────────────────────
async function runSequence({ sendWP, sendCrexi, sendLoopNet, existingWpUrl, testMode }) {
  // Write testMode to storage so content scripts can read it
  await chrome.storage.local.set({ gvTestMode: !!testMode });

  let wpPermalink = existingWpUrl || '';
  let step = 0;
  const totalSteps = [sendWP, sendCrexi, sendLoopNet].filter(Boolean).length;

  function progress(label) {
    step++;
    const pct = Math.round((step / (totalSteps + 1)) * 100);
    broadcastAll({ type: 'GV_PROGRESS', pct, label });
  }

  // ── Step 1: WordPress ──────────────────────────────────────────────────────
  if (sendWP) {
    progress('Opening WordPress…');
    const wpTabId = await openTab(WP_NEW_PROPERTY_URL);
    currentWpTabId = wpTabId;

    progress('Filling WordPress form…');
    // Extended timeout in test mode since each step requires a manual click
    const result = await runContentScript(wpTabId, 'GV_WP_FILL', 2000, testMode ? 1_800_000 : 120_000);

    // The content script sends back the permalink after publish
    wpPermalink = result?.permalink || '';
    if (wpPermalink) {
      await chrome.storage.local.set({ gvLastWpUrl: wpPermalink });
    }
  }

  // ── Step 2: Crexi ──────────────────────────────────────────────────────────
  if (sendCrexi) {
    progress('Opening Crexi…');
    const crexiTabId = await openTab(CREXI_NEW_URL);
    await chrome.storage.local.set({ gvWpUrl: wpPermalink });

    progress('Filling Crexi form…');
    await runContentScript(crexiTabId, 'GV_CREXI_FILL');
  }

  // ── Step 3: LoopNet ────────────────────────────────────────────────────────
  if (sendLoopNet) {
    progress('Opening LoopNet…');
    const loopTabId = await openTab(LOOPNET_NEW_URL);
    await chrome.storage.local.set({ gvWpUrl: wpPermalink });

    progress('Filling LoopNet form…');
    await runContentScript(loopTabId, 'GV_LOOPNET_FILL');
  }

  broadcastAll({ type: 'GV_DONE' });
}
