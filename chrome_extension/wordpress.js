// ── Grandview Sender — wordpress.js ──────────────────────────────────────────
// Content script for: https://live-matthewsreis.pantheonsite.io/wp-admin/*
// Injected on post-new.php?post_type=property
'use strict';

// ── Test-mode stub data ───────────────────────────────────────────────────────
const TEST_PROP = {
  title:           'TEST',
  focus_keyphrase: 'TEST',
  seo_title:       'TEST',
  slug:            'test',
  saleOrLease:     'for-sale',
  record_type:     'retail',
  street:          'TEST',
  city:            'TEST',
  state_abbr:      'TX',
  state_full:      'Texas',
  zip:             '12345',
  lng:             '-97.123',
  lat:             '30.123',
  meta_description: 'TEST meta description for this property.',
  price:           '123',
  cap_rate:        '123',
  noi:             '123',
  price_per_sf:    '123',
  units:           '123',
  gross_sqft:      '123',
  lot_size:        '123',
  term_remaining:  '123',
  year_built:      '1234',
  occupancy:       '123',
  subtype:         'Bank',
  broker: {
    name:           'TEST',
    license_number: '123',
    company:        'TEST',
    address:        'TEST',
    phone:          '1234567890',
  },
  listing_agents: [],
  locked_pdf_url:  null,
  final_images:    [],
};

// ── RecordType → WP "New Property Type" select value ────────────────────────
const RECORD_TYPE_MAP = {
  stnl:                   'Retail',
  sc:                     'Shopping Centers',
  industrial:             'Industrial',
  mf:                     'Multifamily',
  leasing:                'Retail',
  hc:                     'Healthcare',
  hospitality:            'Hospitality',
  'self-storage':         'Self Storage',
  land:                   'Land',
  office:                 'Office',
  'mixed-use':            'Mixed Use',
  'manufactured-housing': 'Manufactured Housing',
};

// ── Subtype → WP "New Subtype" select value ──────────────────────────────────
const SUBTYPE_MAP = {
  'bank':                           'Bank',
  'convenience store':              'Convenience Stores/Gas Station',
  'convenience stores/gas station': 'Convenience Stores/Gas Station',
  'gas station':                    'Convenience Stores/Gas Station',
  'c-store':                        'Convenience Stores/Gas Station',
  'dollar store':                   'Dollar Store',
  'dollar general':                 'Dollar Store',
  'dollar tree':                    'Dollar Store',
  'drugstore':                      'Drugstore',
  'drug store':                     'Drugstore',
  'pharmacy':                       'Drugstore',
  'cvs':                            'Drugstore',
  'walgreens':                      'Drugstore',
  'education':                      'Education',
  'school':                         'Education',
  'childcare':                      'Education',
  'daycare':                        'Education',
  'grocery store':                  'Grocery Store',
  'grocery':                        'Grocery Store',
  'supermarket':                    'Grocery Store',
  'lifestyle':                      'Lifestyle',
  'lifestyle center':               'Lifestyle',
  'mass merchant':                  'Mass Merchant',
  'big box':                        'Mass Merchant',
  'discount':                       'Mass Merchant',
  'restaurant':                     'Restaurant',
  'qsr':                            'Restaurant',
  'fast food':                      'Restaurant',
  'casual dining':                  'Restaurant',
  'other':                          'Other',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** Wait for an element matching selector to appear in the DOM */
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
      if (el) {
        clearTimeout(timer);
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

/**
 * Robustly set a text input / textarea value and fire React/native change events.
 * Handles WP ACF inputs which may ignore plain .value assignment.
 */
function setInputValue(el, value) {
  el.focus();
  el.select?.();
  // Clear existing content
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.blur();
}

function setSelectValue(el, value) {
  // Try to find by text if exact value doesn't match
  const opts = Array.from(el.options);
  const match = opts.find(
    (o) => o.value === value || o.text.trim().toLowerCase() === value.toLowerCase()
  );
  if (match) {
    el.value = match.value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    console.warn(`[GV WP] No option matching "${value}" in select`, el.id);
  }
}

function clickEl(el) {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.click();
}

function checkCheckbox(el, shouldCheck) {
  if (el.checked !== shouldCheck) el.click();
}

// ── Main fill function ────────────────────────────────────────────────────────
async function fillWordPress(prop, testMode = false) {
  if (testMode) {
    console.log('[GV WP] 🧪 TEST MODE — using stub data');
    prop = TEST_PROP;
  }
  // In test mode: pause and wait for the popup "Next Action" button to be clicked
  function waitForNext() {
    if (!testMode) return Promise.resolve();
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
  }
  // Broadcast step progress back to the popup window
  const TOTAL_STEPS = 17;
  let stepNum = 0;
  function wpStep(label) {
    stepNum++;
    const pct = Math.round((stepNum / TOTAL_STEPS) * 90); // leave 10% for publish
    chrome.runtime.sendMessage({ type: 'GV_PROGRESS', pct, label: `WP: ${label}` }).catch(() => {});
  }  // Make sure we're on the post editor page
  if (!location.pathname.includes('post-new.php')) {
    throw new Error('Not on post-new.php — wrong tab?');
  }

  // Wait for WP admin to finish loading
  await waitForEl('#title', 20_000);
  await sleep(800);

  // ── 1. Post Title ──────────────────────────────────────────────────────────
  wpStep('Post title');
  if (prop.title) {
    const titleEl = document.querySelector('#title');
    if (titleEl) setInputValue(titleEl, prop.title);
  }
  await waitForNext();

  // ── 2. Focus Keyphrase (Yoast) ─────────────────────────────────────────────
  wpStep('Focus keyphrase');
  const kpVal = prop.focus_keyphrase || prop.title || '';
  if (kpVal) {
    const keyphraseEl = document.querySelector('#focus-keyword-input-metabox');
    const keyphraseHidden = document.querySelector('#yoast_wpseo_focuskw');
    if (keyphraseEl) setInputValue(keyphraseEl, kpVal);
    if (keyphraseHidden) setInputValue(keyphraseHidden, kpVal);
    try { window.wp.data.dispatch('yoast-seo/editor').setFocusKeyword(kpVal); } catch(e) {}
  }
  await waitForNext();

  // ── 3. Type of View (sale/lease checkboxes) ────────────────────────────────
  wpStep('Sale / Lease type');
  // IDs from the recorder:
  //   #in-type_of_view-76-2  = For Lease
  //   #in-type_of_view-78-2  = For Lease|For Sale
  //   #in-type_of_view-75-2  = For Sale
  //   #in-type_of_view-77-2  = Investment
  const isForSale  = prop.saleOrLease === 'for-sale'  || prop.saleOrLease === 'for-auction';
  const isForLease = prop.saleOrLease === 'for-lease';

  const cbForLease     = document.querySelector('#in-type_of_view-76-2');
  const cbForSale      = document.querySelector('#in-type_of_view-75-2');
  const cbBoth         = document.querySelector('#in-type_of_view-78-2');
  const cbInvestment   = document.querySelector('#in-type_of_view-77-2');

  if (cbForSale)    checkCheckbox(cbForSale,    isForSale);
  if (cbForLease)   checkCheckbox(cbForLease,   isForLease);
  if (cbBoth)       checkCheckbox(cbBoth,        false); // unchecked by default
  if (cbInvestment) checkCheckbox(cbInvestment,  false);

  await sleep(300);
  await waitForNext();

  // ── 4. Yoast SEO Title ─────────────────────────────────────────────────────
  wpStep('Yoast SEO title');
  if (prop.seo_title) {
    // Write to hidden input (what WP reads on save)
    const titleHidden = document.querySelector('#yoast_wpseo_title');
    if (titleHidden) setInputValue(titleHidden, prop.seo_title);
    // Also dispatch into Yoast store (updates the DraftJS preview)
    try { window.wp.data.dispatch('yoast-seo/editor').updateData({ title: prop.seo_title }); } catch(e) {}
  }
  await waitForNext();

  // ── 4b. Yoast Meta Description ────────────────────────────────────────────
  wpStep('Yoast meta description');
  if (prop.meta_description) {
    // Write to hidden input first (what WP reads on save)
    const metaHidden = document.querySelector('#yoast_wpseo_metadesc');
    if (metaHidden) setInputValue(metaHidden, prop.meta_description);
    // Also dispatch into Yoast store (updates the DraftJS preview)
    try { window.wp.data.dispatch('yoast-seo/editor').updateData({ description: prop.meta_description }); } catch(e) {}
  }
  await waitForNext();

  // ── 5. Yoast SEO Slug ──────────────────────────────────────────────────────
  wpStep('Yoast SEO slug');
  if (prop.slug) {
    // Use explicit dispatch action from the store
    try { window.wp.data.dispatch('yoast-seo/editor').setEditorDataSlug(prop.slug); } catch(e) {}
    // Also write directly to the input as fallback
    const yoastSlugEl = document.querySelector('#yoast-google-preview-slug-metabox');
    if (yoastSlugEl) setInputValue(yoastSlugEl, prop.slug);
    await sleep(200);
  }
  await waitForNext();

  // ── 6. New Property Type (ACF select) ──────────────────────────────────────
  wpStep('Property type');
  const propTypeEl = document.querySelector('#acf-field_5d8958189ff21');
  if (propTypeEl && prop.record_type) {
    const wpType = RECORD_TYPE_MAP[prop.record_type] || '';
    if (wpType) setSelectValue(propTypeEl, wpType);
    await sleep(200);
  }
  await waitForNext();

  // ── 6b. New Subtype (ACF select) ──────────────────────────────────────────
  wpStep('Property subtype');
  const subtypeEl = document.querySelector('#acf-field_5d8958d39ff22');
  if (subtypeEl && prop.subtype) {
    const normalized = prop.subtype.toLowerCase().trim();
    const wpSubtype  = SUBTYPE_MAP[normalized] || prop.subtype;
    setSelectValue(subtypeEl, wpSubtype);
    await sleep(200);
  }
  await waitForNext();

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
  // For each agent in prop.listing_agents, click "Add Agent" and search by name
  const agents = prop.listing_agents || [];
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    if (!agent?.name) continue;
    await addAgentSelect2(agent.name, i);
    await sleep(400);
  }

  // ── 12. Locked PDF upload ─────────────────────────────────────────────────────
  wpStep('Locked PDF upload');
  // Add a document entry and upload via WP media library fetch
  if (prop.locked_pdf_url) {
    await uploadDocumentViaMediaLibrary(prop);
  }

  // ── 13. Images ────────────────────────────────────────────────────────────
  wpStep('Images upload');
  // Upload each finalized image via WP media library
  const images = prop.final_images || [];
  if (images.length > 0) {
    await uploadImagesToAcfGallery(images);
  }

  // ── 14. Private Access ────────────────────────────────────────────────────
  wpStep('Private Access');
  const privateAccessEl = document.querySelector('#acf-field_5f5a9ed0e21bc');
  if (privateAccessEl) clickEl(privateAccessEl);

  // ── 15. Scroll to top and Publish ────────────────────────────────────────────────────
  wpStep('Publishing…');
  window.scrollTo(0, 0);
  await sleep(500);
  await clickPublish();
}

// ── Select2 Agent helper ──────────────────────────────────────────────────────
async function addAgentSelect2(agentName, agentIndex) {
  // Click "Add Agent" button
  const addAgentBtn = document.querySelector('div.acf-field-55d38abe7fb9a div > a');
  if (!addAgentBtn) { console.warn('[GV WP] Add Agent button not found'); return; }
  clickEl(addAgentBtn);
  await sleep(600);

  // After clicking "Add Agent", a new row appears. Find the latest Select2 arrow in the list.
  const allArrows = document.querySelectorAll('div.acf-field-55d38abe7fb9a span.select2-selection__arrow');
  const arrow = allArrows[agentIndex];
  if (!arrow) { console.warn('[GV WP] Select2 arrow not found for agent index', agentIndex); return; }
  clickEl(arrow);
  await sleep(400);

  // Type into the Select2 search input which appears in the body
  const searchInput = document.querySelector('body > span input.select2-search__field, .select2-container--open input.select2-search__field');
  if (!searchInput) { console.warn('[GV WP] Select2 search input not found'); return; }
  setInputValue(searchInput, agentName);
  await sleep(800);

  // Click the first result
  const firstResult = document.querySelector('.select2-results__option--highlighted, .select2-results__option:first-child');
  if (firstResult) {
    clickEl(firstResult);
    await sleep(300);
  } else {
    console.warn('[GV WP] No Select2 result found for agent:', agentName);
    // Press Escape to close
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }
}

// ── WP Media Library upload helper ───────────────────────────────────────────
async function uploadToMediaLibrary(blobUrl, filename) {
  const resp = await fetch(blobUrl);
  const blob = await resp.blob();
  const file = new File([blob], filename, { type: blob.type });
  return file;
}

async function simulateFileInputUpload(fileInputEl, file) {
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInputEl.files = dt.files;
  fileInputEl.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(3000); // Wait for WP uploader to process
}

async function uploadDocumentViaMediaLibrary(prop) {
  // Click "Add Document"
  const addDocBtn = document.querySelector('div.acf-field-55d38b4e266e2 > div.acf-input > div > div > a');
  if (!addDocBtn) { console.warn('[GV WP] Add Document button not found'); return; }
  clickEl(addDocBtn);
  await sleep(500);

  // Fill document name
  const docNameEl = document.querySelector('[id*="field_55d38b79266e3"]');
  if (docNameEl) setInputValue(docNameEl, prop.title ? `${prop.title} OM` : 'Offering Memorandum');

  // Click "Add File"
  const addFileBtn = document.querySelector('div.acf-field-55d38b4e266e2 tr:nth-of-type(1) div.hide-if-value a');
  if (!addFileBtn) { console.warn('[GV WP] Add File button not found'); return; }
  clickEl(addFileBtn);
  await sleep(1000);

  // Switch to "Upload files" tab in media modal
  const uploadTab = await waitForEl('#menu-item-upload', 8000).catch(() => null);
  if (uploadTab) clickEl(uploadTab);
  await sleep(500);

  // Find the file input
  const fileInput = document.querySelector('#__wp-uploader-id-1, input[type="file"].moxie-shim-html5');
  if (!fileInput) { console.warn('[GV WP] PDF file input not found'); return; }

  const filename = prop.locked_pdf_url.split('/').pop()?.split('?')[0] || 'om.pdf';
  const file = await uploadToMediaLibrary(prop.locked_pdf_url, filename);
  await simulateFileInputUpload(fileInput, file);

  // Close modal after upload
  const closeBtn = document.querySelector('#wp-media-modal button.media-modal-close, span.media-modal-icon');
  if (closeBtn) {
    await sleep(1500);
    clickEl(closeBtn);
  }
  await sleep(500);
}

async function uploadImagesToAcfGallery(images) {
  // Click "Add Image or Video" to open the repeater
  const addImgVideoBtn = document.querySelector('div.acf-field-415e53663fa13 > div.acf-input > div > div > a');
  if (!addImgVideoBtn) { console.warn('[GV WP] Add Image or Video button not found'); return; }

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const imgUrl = img.watermarkedUrl || img.originalUrl;
    if (!imgUrl) continue;

    // Each iteration: click "Add Image" on the latest row
    const addImgBtns = document.querySelectorAll('div.acf-field-415e53663fa13 tr div.hide-if-value a');
    const addImgBtn  = addImgBtns[i] || addImgVideoBtn;
    if (!addImgBtn) continue;
    clickEl(addImgBtn);
    await sleep(1000);

    // Switch to Upload tab
    const uploadTab = await waitForEl('#menu-item-upload', 8000).catch(() => null);
    if (uploadTab) clickEl(uploadTab);
    await sleep(400);

    // Find the file input (WP increments uploader IDs)
    const fileInputSel = `#__wp-uploader-id-${i + 2}, #__wp-uploader-id-${i + 3}`;
    const fileInput = document.querySelector(fileInputSel) ||
                      document.querySelector('input[type="file"].moxie-shim-html5');
    if (!fileInput) { console.warn('[GV WP] Image file input not found at index', i); continue; }

    const filename = img.filename || imgUrl.split('/').pop()?.split('?')[0] || `image-${i}.jpg`;
    const file = await uploadToMediaLibrary(imgUrl, filename);
    await simulateFileInputUpload(fileInput, file);

    // Close modal
    const closeBtn = document.querySelector('#wp-media-modal button.media-modal-close, span.media-modal-icon');
    if (closeBtn) {
      await sleep(2000);
      clickEl(closeBtn);
      await sleep(600);
    }
  }
}

// ── Publish and capture permalink ─────────────────────────────────────────────
async function clickPublish() {
  // Standard WP publish button
  const publishBtn = document.querySelector('#publish, #save-action input[type="submit"], input[name="publish"]');
  if (!publishBtn) {
    console.warn('[GV WP] Publish button not found — pausing for manual publish');
    return;
  }
  clickEl(publishBtn);

  // Wait for page to reload / confirm publish
  await sleep(3000);
  await waitForEl('#message.updated, #message.notice', 15_000).catch(() => {});
  await sleep(500);

  // Try to grab the permalink from the "View post" link
  const viewLink = document.querySelector('#sample-permalink a, #view-post-btn a, .post-publish-panel a');
  const permalink = viewLink?.href || '';
  return permalink;
}

// ── Entry point: listen for background message ─────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'GV_WP_FILL') return;
  sendResponse({ ok: true });

  chrome.storage.local.get(['gvProperty', 'gvTestMode'], async ({ gvProperty, gvTestMode }) => {
    // In test mode a real property is not required
    if (!gvProperty && !gvTestMode) {
      chrome.runtime.sendMessage({ type: 'GV_WP_FILL_ERROR', message: 'No property data in storage' });
      return;
    }
    try {
      const permalink = await fillWordPress(gvProperty || {}, !!gvTestMode);
      chrome.runtime.sendMessage({
        type:      'GV_WP_FILL_DONE',
        permalink: permalink || '',
      });
    } catch (err) {
      console.error('[GV WP] Fill error:', err);
      chrome.runtime.sendMessage({
        type:    'GV_WP_FILL_ERROR',
        message: err.message,
      });
    }
  });

  return true;
});
