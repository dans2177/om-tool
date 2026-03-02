// ── Grandview Sender — crexi/step-om.js ──────────────────────────────────────
// Step 7: Upload the password-protected Offering Memorandum PDF and select
// "Private OM (CA required)" access type.  Clicks Continue afterward.
// Selectors verified against the live Crexi DOM.
'use strict';

window.CrexiSteps = window.CrexiSteps || {};

/**
 * Upload the locked/password-protected PDF as the Offering Memorandum,
 * then select "Private OM (CA required)" radio button.
 *
 * File input:  crx-uploader[formcontrolname="omDocument"] input[type="file"][accept="application/pdf"]
 * Radio group: mat-radio-group[formcontrolname="omAccessType"]
 *   - "Public"                      → value="Public"
 *   - "Private OM (CA required)"    → value="CA Required"
 *   - "Private OM (CA and approval required)" → value="Access Request Required"
 *
 * @param {Object} prop - Flattened property data from the API.
 */
window.CrexiSteps.om = async function om(prop) {
  const { sleep, clickEl, pageClick, log, warn } = window.CrexiHelpers;

  log('Uploading Offering Memorandum (page 5)');

  const pdfUrl = prop.locked_pdf_url;
  if (!pdfUrl) {
    warn('No locked PDF URL in property data — skipping OM upload');
    await clickContinue();
    return;
  }

  // ── Find the PDF file input ──────────────────────────────────────────────
  const fileInput = document.querySelector(
    'crx-uploader[formcontrolname="omDocument"] input[type="file"][accept="application/pdf"]'
  );

  if (!fileInput) {
    warn('OM file input not found — manual upload needed');
    await clickContinue();
    return;
  }

  // ── Fetch the PDF and inject via DataTransfer ────────────────────────────
  try {
    log(`Fetching PDF: ${pdfUrl.substring(0, 80)}…`);
    const resp = await fetch(pdfUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();

    const filename = pdfUrl.split('/').pop()?.split('?')[0] || 'offering-memorandum.pdf';
    const file = new File([blob], filename, { type: 'application/pdf' });

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input',  { bubbles: true }));
    log(`Injected PDF: ${filename} (${(blob.size / 1024 / 1024).toFixed(1)} MB)`);
  } catch (err) {
    warn(`Failed to fetch/upload PDF: ${err.message}`);
    await clickContinue();
    return;
  }

  // Wait for upload to process
  await sleep(3000);

  // OM access type defaults to "Public OM" — leave it as-is.
  log('Leaving OM access type as Public OM (default)');

  await clickContinue();

  async function clickContinue() {
    await sleep(500);
    const nextBtn = window.CrexiHelpers.findButtonByText('continue')
      || window.CrexiHelpers.findButtonByText('next');
    if (nextBtn) {
      await pageClick(nextBtn);
      log('Clicked Continue after OM upload');
    } else {
      warn('Continue button not found after OM step');
    }
    await sleep(2000);
  }
};
