// ── Grandview Sender — crexi/step-description.js ─────────────────────────────
// Step 5: Fill the Subheader (after disabling auto-fill) and Investment
// Highlights (ProseMirror rich-text editor).  These are on page 3 —
// clicks Continue afterward.
// Selectors verified against the live Crexi DOM.
'use strict';

window.CrexiSteps = window.CrexiSteps || {};

/**
 * 1. Uncheck the "auto-fill" checkbox so the Subheader input becomes editable.
 * 2. Clear and fill the Subheader (max 100 chars).
 * 3. Fill the Investment Highlights ProseMirror editor.
 * 4. Click Continue — this is the last section on page 3.
 *
 * Selectors:
 *   Auto-fill checkbox:    cui-checkbox[formcontrolname="autofillDescription"] mat-checkbox
 *   Subheader:             input[name="description"][formcontrolname="description"]
 *   Investment Highlights: crx-html-editor[formcontrolname="investmentHighlights"]
 *                          → .NgxEditor__Content .ProseMirror (contenteditable div)
 *
 * @param {Object} prop - Flattened property data from the API.
 */
window.CrexiSteps.description = async function description(prop) {
  const { sleep, setInputValue, clickEl, pageClick, log, warn } = window.CrexiHelpers;

  log('Filling subheader and investment highlights (page 3)');

  // ── Uncheck "auto-fill" so the subheader input is editable ───────────────
  const autofillCheckbox = document.querySelector(
    'cui-checkbox[formcontrolname="autofillDescription"] mat-checkbox'
  );
  if (autofillCheckbox) {
    const isChecked = autofillCheckbox.classList.contains('mat-mdc-checkbox-checked');
    if (isChecked) {
      await pageClick(autofillCheckbox);
      log('Unchecked auto-fill on subheader');
      await sleep(600); // wait for input to become enabled
    }
  } else {
    // Fallback: try the raw checkbox input
    const fallbackCb = document.querySelector(
      'cui-checkbox[formcontrolname="autofillDescription"] input[type="checkbox"]'
    );
    if (fallbackCb && fallbackCb.checked) {
      fallbackCb.click();
      log('Unchecked auto-fill on subheader (fallback)');
      await sleep(600);
    } else {
      warn('Auto-fill checkbox not found — subheader may already be editable');
    }
  }

  // ── Subheader (max 100 chars) ────────────────────────────────────────────
  const subheaderEl = document.querySelector('input[name="description"]');
  if (subheaderEl) {
    // Build subheader text from blob — use seo_title, title, or meta_description
    const rawSubheader = prop.seo_title || prop.title || prop.meta_description || '';
    const subheader = rawSubheader.substring(0, 100);

    if (subheader) {
      // Clear the existing value first
      setInputValue(subheaderEl, '');
      await sleep(200);
      setInputValue(subheaderEl, subheader);
      log(`Set subheader: "${subheader}" (${subheader.length} chars)`);
    }
  } else {
    warn('Subheader input not found');
  }

  await sleep(400);

  // ── Investment Highlights (ProseMirror rich-text editor) ─────────────────
  // The editor is inside crx-html-editor → .NgxEditor__Content → .ProseMirror
  const proseMirror = document.querySelector(
    'crx-html-editor[formcontrolname="investmentHighlights"] .NgxEditor__Content .ProseMirror'
  );

  if (proseMirror && prop.description_html) {
    proseMirror.focus();

    // Clear existing content
    proseMirror.innerHTML = '';
    await sleep(200);

    // Insert the HTML content from the blob
    proseMirror.innerHTML = prop.description_html;

    // Fire input event so ngx-editor picks up the change
    proseMirror.dispatchEvent(new Event('input', { bubbles: true }));
    proseMirror.dispatchEvent(new Event('change', { bubbles: true }));

    // Also dispatch a more specific event that ProseMirror/ngx-editor may listen for
    proseMirror.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertFromPaste',
    }));

    log('Set investment highlights (HTML)');
  } else if (proseMirror && !prop.description_html) {
    // Try plain text fallback
    const plainDesc = prop.meta_description || '';
    if (plainDesc) {
      proseMirror.focus();
      proseMirror.innerHTML = '';
      await sleep(200);
      proseMirror.textContent = plainDesc;
      proseMirror.dispatchEvent(new Event('input', { bubbles: true }));
      log('Set investment highlights (plain text fallback)');
    }
  } else {
    warn('Investment Highlights ProseMirror editor not found');
  }

  await sleep(500);

  // ── Click Continue ─────────────────────────────────────────────────────────
  // This is the last section on page 2.
  const nextBtn = window.CrexiHelpers.findButtonByText('continue')
    || window.CrexiHelpers.findButtonByText('next');
  if (nextBtn) {
    await pageClick(nextBtn);
    log('Clicked Continue — advancing past page 3');
  } else {
    warn('Continue button not found after description step');
  }

  await sleep(2000);
};
