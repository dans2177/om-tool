// ── Grandview Sender — popup.js ──────────────────────────────────────────────
(function () {
'use strict';
if (window.__gvPopupInit) return;
window.__gvPopupInit = true;

function init() {
const $ = (id) => document.getElementById(id);

const sendWpCheck      = $('send-wp');
const sendCrexiCheck   = $('send-crexi');
const sendLoopNetCheck = $('send-loopnet');
const wpUrlGroup      = $('wp-url-group');
const wpUrlInput      = $('wp-url-input');
const apiBaseInput    = $('api-base-input');
const propertySelect  = $('property-select');
const refreshBtn      = $('refresh-btn');
const codeToggle      = $('code-toggle');
const codeGroup       = $('code-group');
const codeInput       = $('code-input');
const loadBtn         = $('load-btn');
const goBtn           = $('go-btn');
const nextActionBtn   = $('next-action-btn');
const restartBtn      = $('restart-btn');
const testModeCheck   = $('test-mode-check');
const statusBar       = $('status-bar');
const preview         = $('property-preview');
const previewTitle    = $('preview-title');
const previewAddr     = $('preview-address');
const progressEl      = $('progress');
const progressBar     = $('progress-bar');
const progressLbl     = $('progress-label');

// Guard: if core elements don't exist we're not in the popup document
if (!sendWpCheck || !goBtn) return;

let currentProperty = null;

// ── Persist / restore settings ───────────────────────────────────────────────
const DEFAULT_API_BASE = 'http://localhost:3000';

chrome.storage.local.get(
  ['apiBase', 'sendWP', 'sendCrexi', 'sendLoopNet', 'wpUrl', 'testMode'],
  (data) => {
    apiBaseInput.value = data.apiBase || DEFAULT_API_BASE;
    if (data.sendWP !== undefined)      sendWpCheck.checked      = data.sendWP;
    if (data.sendCrexi !== undefined)   sendCrexiCheck.checked   = data.sendCrexi;
    if (data.sendLoopNet !== undefined) sendLoopNetCheck.checked = data.sendLoopNet;
    if (data.wpUrl)   wpUrlInput.value = data.wpUrl;
    if (data.testMode) {
      testModeCheck.checked = true;
      goBtn.disabled = false;
    }
    updatePlatformUI();
    loadRecentList();
  }
);

apiBaseInput.addEventListener('change', () => {
  chrome.storage.local.set({ apiBase: apiBaseInput.value.trim() });
});
wpUrlInput.addEventListener('change', () => {
  chrome.storage.local.set({ wpUrl: wpUrlInput.value.trim() });
});
testModeCheck.addEventListener('change', () => {
  chrome.storage.local.set({ testMode: testModeCheck.checked });
  if (testModeCheck.checked) {
    goBtn.disabled = false;
  } else if (!currentProperty) {
    goBtn.disabled = true;
  }
});

// ── Platform checkbox handlers ───────────────────────────────────────────────
function updatePlatformUI() {
  const wpOn      = sendWpCheck.checked;
  const crexiOn   = sendCrexiCheck.checked;
  const loopNetOn = sendLoopNetCheck.checked;
  // Show WP URL input when WP is off but at least one third-party is on
  wpUrlGroup.classList.toggle('hidden', wpOn || (!crexiOn && !loopNetOn));
}

function savePlatformState() {
  chrome.storage.local.set({
    sendWP:      sendWpCheck.checked,
    sendCrexi:   sendCrexiCheck.checked,
    sendLoopNet: sendLoopNetCheck.checked,
  });
  updatePlatformUI();
}

sendWpCheck.addEventListener('change', savePlatformState);
sendCrexiCheck.addEventListener('change', savePlatformState);
sendLoopNetCheck.addEventListener('change', savePlatformState);

// ── Paste-code toggle ─────────────────────────────────────────────────────────
codeToggle.addEventListener('click', () => {
  const open = !codeGroup.classList.contains('hidden');
  codeGroup.classList.toggle('hidden', open);
  codeToggle.textContent = 'Paste a snapshot URL instead';
});

// ── Advanced settings toggle ───────────────────────────────────────────────────
const advToggle = $('adv-toggle');
const advGroup  = $('adv-group');
if (advToggle && advGroup) {
  advToggle.addEventListener('click', () => {
    advGroup.classList.toggle('hidden');
  });
}

// ── Status helpers ────────────────────────────────────────────────────────────
function setStatus(msg, type = 'info') {
  statusBar.textContent = msg;
  statusBar.className   = 'status-bar';
  if (type !== 'info') statusBar.classList.add(type);
  statusBar.classList.remove('hidden');
}
function clearStatus() { statusBar.classList.add('hidden'); }

function setProgress(pct, label) {
  progressEl.classList.remove('hidden');
  progressBar.style.width = `${pct}%`;
  progressLbl.textContent = label;
}

// ── Load recent property list into dropdown ───────────────────────────────────
async function loadRecentList() {
  const base = apiBaseInput.value.trim();
  if (!base) return;

  propertySelect.innerHTML = '<option value="">-- loading... --</option>';
  refreshBtn.disabled = true;

  try {
    const resp = await fetch(`${base}/api/phase1/recent`, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json();
    const snaps = data.snapshots || [];

    if (snaps.length === 0) {
      propertySelect.innerHTML = '<option value="">-- no properties found --</option>';
      return;
    }

    propertySelect.innerHTML = snaps.map((s, i) => {
      const date = new Date(s.savedAt).toLocaleDateString();
      const label = [s.title, s.address ? `\u00b7 ${s.address}` : '', `(${date})`].filter(Boolean).join(' ');
      return `<option value="${encodeURIComponent(s.snapshotUrl)}"${i === 0 ? ' selected' : ''}>${label}</option>`;
    }).join('');

  } catch (err) {
    propertySelect.innerHTML = '<option value="">-- failed to load --</option>';
    setStatus(`Could not load list: ${err.message}`, 'error');
  } finally {
    refreshBtn.disabled = false;
  }
}

refreshBtn.addEventListener('click', loadRecentList);

// ── Load selected / pasted property ──────────────────────────────────────────
loadBtn.addEventListener('click', loadProperty);

async function loadProperty() {
  const base        = apiBaseInput.value.trim();
  const pastedCode  = codeInput.value.trim();
  const selectedUrl = propertySelect.value ? decodeURIComponent(propertySelect.value) : '';

  const snapshotUrl = pastedCode || selectedUrl;

  if (!snapshotUrl && !base) {
    setStatus('Set your Grandview API base URL first.', 'error');
    return;
  }

  setStatus('Loading property...');
  loadBtn.disabled = true;

  try {
    let data;

    if (snapshotUrl) {
      const resp = await fetch(`${base}/api/phase1/properties?snapshot=${encodeURIComponent(snapshotUrl)}`, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`API returned ${resp.status}`);
      data = await resp.json();
    } else {
      const resp = await fetch(`${base}/api/phase1/properties`, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`API returned ${resp.status}`);
      data = await resp.json();
    }

    if (data.error) throw new Error(data.error);
    currentProperty = data;

    previewTitle.textContent = data.title || '(no title)';
    previewAddr.textContent  = data.full_address || '';
    preview.classList.remove('hidden');

    setStatus(`Loaded: ${data.title}`, 'success');
    goBtn.disabled = false;
    codeInput.value = '';
  } catch (err) {
    setStatus(`Load failed: ${err.message}`, 'error');
  } finally {
    loadBtn.disabled = false;
  }
}

// ── Go button ─────────────────────────────────────────────────────────────────
goBtn.addEventListener('click', async () => {
  if (!currentProperty && !testModeCheck.checked) {
    setStatus('Load a property first.', 'error');
    return;
  }

  const sendWP      = sendWpCheck.checked;
  const sendCrexi   = sendCrexiCheck.checked;
  const sendLoopNet = sendLoopNetCheck.checked;

  if (!sendWP && !sendCrexi && !sendLoopNet) {
    setStatus('Select at least one platform.', 'error');
    return;
  }

  const existingWpUrl = !sendWP && (sendCrexi || sendLoopNet)
    ? wpUrlInput.value.trim()
    : null;

  if (!sendWP && (sendCrexi || sendLoopNet) && !existingWpUrl) {
    setStatus('Enter a WordPress property URL for third-party posting.', 'error');
    return;
  }

  goBtn.disabled   = true;
  loadBtn.disabled = true;
  setProgress(5, 'Starting...');
  clearStatus();

  const testMode = testModeCheck.checked;

  await new Promise((r) =>
    chrome.storage.local.set(
      {
        gvProperty:      currentProperty,
        gvExistingWpUrl: existingWpUrl || '',
        gvSendCrexi:     sendCrexi,
        gvSendLoopNet:   sendLoopNet,
        gvTestMode:      testMode,
      },
      r
    )
  );

  chrome.runtime.sendMessage(
    { type: 'GV_START', sendWP, sendCrexi, sendLoopNet, existingWpUrl, testMode },
    (resp) => {
      if (chrome.runtime.lastError) {
        setStatus(`Error: ${chrome.runtime.lastError.message}`, 'error');
        goBtn.disabled   = false;
        loadBtn.disabled = false;
      }
    }
  );
});

// ── Next Action button (test mode manual stepping) ────────────────────────────
nextActionBtn.addEventListener('click', () => {
  nextActionBtn.classList.add('hidden');
  nextActionBtn.disabled = true;
  const instrEl = $('manual-instruction');
  if (instrEl) instrEl.classList.add('hidden');
  chrome.runtime.sendMessage({ type: 'GV_NEXT_REQUEST' });
});

// ── Restart button — reset UI so Go can be clicked again ─────────────────────
function resetPopupUI() {
  nextActionBtn.classList.add('hidden');
  nextActionBtn.disabled = true;
  restartBtn.classList.add('hidden');
  const instrEl = $('manual-instruction');
  if (instrEl) instrEl.classList.add('hidden');
  progressEl.classList.add('hidden');
  goBtn.disabled   = !currentProperty && !testModeCheck.checked;
  loadBtn.disabled = false;
}
restartBtn.addEventListener('click', () => {
  clearStatus();
  resetPopupUI();
});

// ── Listen for progress/done/error from background ────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'GV_PROGRESS') {
    setProgress(msg.pct, msg.label);
    restartBtn.classList.remove('hidden');
  }
  if (msg.type === 'GV_WAITING') {
    const instrEl = $('manual-instruction');
    if (instrEl) {
      if (msg.message) {
        instrEl.textContent = msg.message;
        instrEl.classList.remove('hidden');
      } else {
        instrEl.classList.add('hidden');
      }
    }
    nextActionBtn.classList.remove('hidden');
    nextActionBtn.disabled = false;
    restartBtn.classList.remove('hidden');
  }
  if (msg.type === 'GV_DONE') {
    setProgress(100, 'All done!');
    setStatus('Posting complete.', 'success');
    resetPopupUI();
  }
  if (msg.type === 'GV_ERROR') {
    setStatus(`Error: ${msg.message}`, 'error');
    progressEl.classList.add('hidden');
    resetPopupUI();
  }
});
} // end init

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
})();
