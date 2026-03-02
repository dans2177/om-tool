// ── Grandview Sender — wordpress/step-media.js ──────────────────────────────
// Steps 12–13: Property document (PDF URL) + Image upload (ACF gallery via REST).
'use strict';

window.WPSteps = window.WPSteps || {};

// ── Private helper: add property document via URL override ──────────────────
async function addPropertyDocument(prop) {
  const { clickEl, setInputValue, sleep } = window.WPHelpers;

  const addDocBtn = document.querySelector('div.acf-field-55d38b4e266e2 a.acf-repeater-add-row');
  if (!addDocBtn) { console.warn('[GV WP] Add Document button not found'); return; }
  clickEl(addDocBtn);
  await sleep(500);

  const realRows = document.querySelectorAll('div.acf-field-55d38b4e266e2 .acf-row:not(.acf-clone)');
  const newRow = realRows[realRows.length - 1];
  if (!newRow) { console.warn('[GV WP] No document row found after Add Document'); return; }

  const docName = prop.saleOrLease === 'for-lease' ? 'Leasing Brochure' : 'Offering Memorandum';
  const docNameInput = newRow.querySelector('input[name*="field_55d38b79266e3"]');
  if (docNameInput) setInputValue(docNameInput, docName);

  const docUrlInput = newRow.querySelector('input[name*="field_563107386508f"]');
  if (docUrlInput) setInputValue(docUrlInput, prop.locked_pdf_url);
  else console.warn('[GV WP] Document URL input not found — PDF URL not set');

  await sleep(300);
}

// ── Private helper: upload images via WP REST API ───────────────────────────
async function uploadImagesToAcfGallery(images) {
  const { clickEl, sleep } = window.WPHelpers;

  const nonce = window.wpApiSettings?.nonce;
  if (!nonce) {
    console.warn('[GV WP] wpApiSettings.nonce missing — cannot upload images via REST API');
    return;
  }

  const repeaterSel = 'div.acf-field-415e53663fa13';
  const addRowBtn   = document.querySelector(`${repeaterSel} a.acf-repeater-add-row`);
  if (!addRowBtn) { console.warn('[GV WP] Add Image/Video button not found'); return; }

  for (const img of images) {
    const imgUrl = img.watermarkedUrl || img.originalUrl;
    if (!imgUrl) continue;

    try {
      const imgResp = await fetch(imgUrl);
      if (!imgResp.ok) throw new Error(`Fetch failed: ${imgResp.status}`);
      const blob     = await imgResp.blob();
      const filename = img.filename || imgUrl.split('/').pop()?.split('?')[0] || 'image.jpg';

      const formData = new FormData();
      formData.append('file', blob, filename);
      const uploadResp = await fetch('/wp-json/wp/v2/media', {
        method:  'POST',
        headers: { 'X-WP-Nonce': nonce },
        body:    formData,
      });
      if (!uploadResp.ok) {
        const detail = await uploadResp.text().catch(() => '');
        console.warn(`[GV WP] REST upload failed (${uploadResp.status}):`, detail);
        continue;
      }
      const media        = await uploadResp.json();
      const attachmentId = media.id;
      if (!attachmentId) { console.warn('[GV WP] REST upload returned no id'); continue; }

      clickEl(addRowBtn);
      await sleep(400);

      const realRows = document.querySelectorAll(`${repeaterSel} .acf-row:not(.acf-clone)`);
      const newRow   = realRows[realRows.length - 1];
      if (!newRow) { console.warn('[GV WP] No image row found after Add'); continue; }

      const imageRadio = newRow.querySelector('input[type="radio"][value="image"]');
      if (imageRadio && !imageRadio.checked) imageRadio.click();

      const hiddenInput = newRow.querySelector('input[type="hidden"][name*="field_415e537c3fa14"]');
      if (hiddenInput) {
        hiddenInput.value = String(attachmentId);
        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
        try { window.jQuery && window.jQuery(hiddenInput).trigger('change'); } catch(e) {}
      } else {
        console.warn('[GV WP] Image attachment hidden input not found in new row');
      }

    } catch (err) {
      console.warn('[GV WP] Image upload error:', err.message);
    }
  }
}

window.WPSteps.media = async function media(prop) {
  const { wpStep } = window.WPHelpers;

  // ── 12. Document (URL override — skips media library) ──────────────────────
  wpStep('Property document');
  if (prop.locked_pdf_url) {
    await addPropertyDocument(prop);
  }

  // ── 13. Images ────────────────────────────────────────────────────────────
  wpStep('Images upload');
  const images = prop.final_images || [];
  if (images.length > 0) {
    await uploadImagesToAcfGallery(images);
  }
};
