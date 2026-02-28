// ── Grandview Sender — popup.js ──────────────────────────────────────────────
(function () {
'use strict';
if (window.__gvPopupInit) return;
window.__gvPopupInit = true;

function init() {
const $ = (id) => document.getElementById(id);

const modeSelect      = $('mode-select');
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
const testModeCheck   = $('test-mode-check');
const statusBar       = $('status-bar');
const preview         = $('property-preview');
const previewTitle    = $('preview-title');
const previewAddr     = $('preview-address');
const progressEl      = $('progress');
const progressBar     = $('progress-bar');
const progressLbl     = $('progress-label');

// Guard: if core elements don't exist we're not in the popup document
if (!modeSelect || !goBtn) return;

let currentProperty = null;

// ── Persist / restore settings ───────────────────────────────────────────────
// ── Hard-coded defaults ──────────────────────────────────────────────────────
const DEFAULT_API_BASE   = 'http://localhost:3000';
const VERCEL_API_BASE    = 'https://grandview-placeholder.vercel.app'; // TODO: replace with real URL

chrome.storage.local.get(['apiBase', 'mode', 'wpUrl', 'testMode'], (data) => {
  apiBaseInput.value     = data.apiBase  || DEFAULT_API_BASE;
  if (data.mode)    modeSelect.value     = data.mode;
  if (data.wpUrl)   wpUrlInput.value     = data.wpUrl;
  if (data.testMode) {
    testModeCheck.checked = true;
    goBtn.disabled = false;
  }
  updateModeUI();
  loadRecentList();
});

apiBaseInput.addEventListener('change', () => {
  chrome.storage.local.set({ apiBase: apiBaseInput.value.trim() });
});
wpUrlInput.addEventListener('change', () => {
  chrome.storage.local.set({ wpUrl: wpUrlInput.value.trim() });
});
testModeCheck.addEventListener('change', () => {
  chrome.storage.local.set({ testMode: testModeCheck.checked });
  // In test mode, no property load needed — enable Go immediately
  if (testModeCheck.checked) {
    goBtn.disabled = false;
  } else if (!currentProperty) {
    goBtn.disabled = true;
  }
});
modeSelect.addEventListener('change', () => {
  chrome.storage.local.set({ mode: modeSelect.value });
  updateModeUI();
});

function updateModeUI() {
  wpUrlGroup.classList.toggle('hidden', modeSelect.value !== 'third-party');
}

// ── Paste-code toggle ─────────────────────────────────────────────────────────
codeToggle.addEventListener('click', () => {
  const open = !codeGroup.classList.contains('hidden');
  codeGroup.classList.toggle('hidden', open);
  codeToggle.textContent = open
    ? '▸ Paste code from review page'
    : '▾ Paste code from review page';
});

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

  propertySelect.innerHTML = '<option value="">— loading… —</option>';
  refreshBtn.disabled = true;

  try {
    const resp = await fetch(`${base}/api/phase1/recent`, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json();
    const snaps = data.snapshots || [];

    if (snaps.length === 0) {
      propertySelect.innerHTML = '<option value="">— no properties found —</option>';
      return;
    }

    propertySelect.innerHTML = snaps.map((s, i) => {
      const date = new Date(s.savedAt).toLocaleDateString();
      const label = [s.title, s.address ? `· ${s.address}` : '', `(${date})`].filter(Boolean).join(' ');
      return `<option value="${encodeURIComponent(s.snapshotUrl)}"${i === 0 ? ' selected' : ''}>${label}</option>`;
    }).join('');

  } catch (err) {
    propertySelect.innerHTML = '<option value="">— failed to load —</option>';
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

  // Decide which source to use
  const snapshotUrl = pastedCode || selectedUrl;

  if (!snapshotUrl && !base) {
    setStatus('Set your Grandview API base URL first.', 'error');
    return;
  }

  setStatus('Loading property…');
  loadBtn.disabled = true;

  try {
    let data;

    if (snapshotUrl) {
      // Fetch the raw blob JSON directly — works for both pasted code & dropdown
      const resp = await fetch(`${base}/api/phase1/properties?snapshot=${encodeURIComponent(snapshotUrl)}`, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`API returned ${resp.status}`);
      data = await resp.json();
    } else {
      // Fallback: fetch the latest
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
    codeInput.value = ''; // clear paste field after load
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

  const mode          = modeSelect.value;
  const sendWP        = mode === 'full' || mode === 'wp-only';
  const sendCrexi     = mode === 'full' || mode === 'third-party';
  const sendLoopNet   = mode === 'full' || mode === 'third-party';
  const existingWpUrl = mode === 'third-party' ? wpUrlInput.value.trim() : null;

  if (mode === 'third-party' && !existingWpUrl) {
    setStatus('Enter a WordPress property URL for Third-Party mode.', 'error');
    return;
  }

  goBtn.disabled  = true;
  loadBtn.disabled = true;
  setProgress(5, 'Starting…');
  clearStatus();

  const testMode = testModeCheck.checked;

  await new Promise((r) =>
    chrome.storage.local.set(
      {
        gvProperty:      currentProperty,
        gvMode:          mode,
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
        goBtn.disabled  = false;
        loadBtn.disabled = false;
      }
    }
  );
});

// ── Next Action button (test mode manual stepping) ────────────────────────────
nextActionBtn.addEventListener('click', () => {
  nextActionBtn.classList.add('hidden');
  nextActionBtn.disabled = true;
  chrome.runtime.sendMessage({ type: 'GV_NEXT_REQUEST' });
});

// ── Listen for progress/done/error from background ────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'GV_PROGRESS') setProgress(msg.pct, msg.label);
  if (msg.type === 'GV_WAITING') {
    nextActionBtn.classList.remove('hidden');
    nextActionBtn.disabled = false;
  }
  if (msg.type === 'GV_DONE') {
    setProgress(100, '✓ All done!');
    setStatus('Posting complete.', 'success');
    nextActionBtn.classList.add('hidden');
    goBtn.disabled  = false;
    loadBtn.disabled = false;
  }
  if (msg.type === 'GV_ERROR') {
    setStatus(`Error: ${msg.message}`, 'error');
    nextActionBtn.classList.add('hidden');
    progressEl.classList.add('hidden');
    goBtn.disabled  = false;
    loadBtn.disabled = false;
  }
});
} // end init

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
})();
