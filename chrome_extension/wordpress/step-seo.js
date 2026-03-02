// ── Grandview Sender — wordpress/step-seo.js ────────────────────────────────
// Steps 2, 4, 4b, 5: Focus keyphrase, Yoast SEO title (manual pause),
// Yoast meta description (manual pause), Yoast slug.
'use strict';

window.WPSteps = window.WPSteps || {};

window.WPSteps.seo = async function seo(prop) {
  const { wpStep, waitForNext, waitForManualStep, setInputValue, copyToClipboard, sleep } = window.WPHelpers;

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

  // ── 4. Yoast SEO Title ─────────────────────────────────────────────────────
  wpStep('Yoast SEO title');
  if (prop.seo_title) {
    const titleHidden = document.querySelector('#yoast_wpseo_title');
    if (titleHidden) setInputValue(titleHidden, prop.seo_title);
    try { window.wp.data.dispatch('yoast-seo/editor').updateData({ title: prop.seo_title }); } catch(e) {}
    try { await copyToClipboard(prop.seo_title); } catch(e) {}
  }
  await waitForManualStep(
    prop.seo_title
      ? `SEO Title copied to clipboard:\n${prop.seo_title}\n\nPaste it in the Yoast SEO title field, then click Continue.`
      : 'Set the Yoast SEO title manually, then click Continue.'
  );

  // ── 4b. Yoast Meta Description ────────────────────────────────────────────
  wpStep('Yoast meta description');
  if (prop.meta_description) {
    const metaHidden = document.querySelector('#yoast_wpseo_metadesc');
    if (metaHidden) setInputValue(metaHidden, prop.meta_description);
    try { window.wp.data.dispatch('yoast-seo/editor').updateData({ description: prop.meta_description }); } catch(e) {}
    try { await copyToClipboard(prop.meta_description); } catch(e) {}
  }
  await waitForManualStep(
    prop.meta_description
      ? `Meta description copied to clipboard:\n${prop.meta_description}\n\nPaste it in the Yoast meta description field, then click Continue.`
      : 'Set the Yoast meta description manually, then click Continue.'
  );

  // ── 5. Yoast SEO Slug ──────────────────────────────────────────────────────
  wpStep('Yoast SEO slug');
  if (prop.slug) {
    try { window.wp.data.dispatch('yoast-seo/editor').setEditorDataSlug(prop.slug); } catch(e) {}
    const yoastSlugEl = document.querySelector('#yoast-google-preview-slug-metabox');
    if (yoastSlugEl) setInputValue(yoastSlugEl, prop.slug);
    await sleep(300);
  }
};
