// ── Grandview Sender — crexi/step-media.js ───────────────────────────────────
// Step 6: Upload property images to the Crexi listing (page 4).
// Fetches each image from its Vercel Blob URL and injects into the file input.
// Selectors verified against the live Crexi DOM.
'use strict';

window.CrexiSteps = window.CrexiSteps || {};

/**
 * Upload images from the finalized property data.
 * Downloads each FinalizedImage from its URL (watermarkedUrl preferred,
 * originalUrl fallback) and injects into the file input via DataTransfer.
 *
 * File input: input#image-uploader[type="file"][accept="image/..."][multiple]
 *
 * @param {Object} prop - Flattened property data from the API.
 */
window.CrexiSteps.media = async function media(prop) {
  const { sleep, waitForEl, clickEl, pageClick, log, warn } = window.CrexiHelpers;

  const images = prop.final_images || [];
  if (images.length === 0) {
    log('No images to upload — skipping');
    await clickContinue();
    return;
  }

  log(`Uploading ${images.length} images`);

  // ── Find the file input ────────────────────────────────────────────────────
  // Real selector: input#image-uploader[type="file"][multiple]
  let fileInput = document.querySelector('input#image-uploader[type="file"]');

  if (!fileInput) {
    // Fallback: any file input that accepts images
    fileInput = document.querySelector('input[type="file"][accept*="image"]');
  }

  if (!fileInput) {
    warn('File input #image-uploader not found — manual image upload needed');
    await clickContinue();
    return;
  }

  // ── Fetch all images and build a FileList via DataTransfer ─────────────────
  const dataTransfer = new DataTransfer();

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const url = img.watermarkedUrl || img.originalUrl;
    if (!url) continue;

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const filename = img.filename || url.split('/').pop()?.split('?')[0] || `image-${i}.jpg`;
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
      dataTransfer.items.add(file);
      log(`Fetched image ${i + 1}/${images.length}: ${filename}`);
    } catch (err) {
      warn(`Failed to fetch image ${i + 1}: ${err.message}`);
    }
  }

  if (dataTransfer.files.length === 0) {
    warn('No images fetched successfully — skipping upload');
    await clickContinue();
    return;
  }

  // ── Inject files into the input ────────────────────────────────────────────
  fileInput.files = dataTransfer.files;
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  fileInput.dispatchEvent(new Event('input',  { bubbles: true }));
  log(`Injected ${dataTransfer.files.length} files into #image-uploader`);

  // Wait for uploads to process — Crexi may show thumbnails / progress
  await sleep(5000);

  // If there's a visible upload spinner or progress bar, wait for it to clear
  try {
    await window.CrexiHelpers.waitForElGone('.upload-progress, .spinner, .loading', 60_000);
  } catch (_) {
    // Timeout is okay — uploads may already be done
  }

  await clickContinue();

  async function clickContinue() {
    await sleep(500);
    const nextBtn = window.CrexiHelpers.findButtonByText('continue')
      || window.CrexiHelpers.findButtonByText('next');
    if (nextBtn) {
      await pageClick(nextBtn);
      log('Clicked Continue after media upload');
    } else {
      warn('Continue button not found after media step');
    }
    await sleep(2000);
  }
};
