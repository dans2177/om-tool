// ── Grandview Sender — wordpress/step-title.js ──────────────────────────────
// Steps 1–1b: Post title + Property description (ACF TinyMCE WYSIWYG).
'use strict';

window.WPSteps = window.WPSteps || {};

window.WPSteps.title = async function title(prop) {
  const { wpStep, waitForNext, setInputValue, sleep, log, warn } = window.WPHelpers;

  // ── 1. Post Title ──────────────────────────────────────────────────────────
  wpStep('Post title');
  if (prop.title) {
    const titleEl = document.querySelector('#title');
    if (titleEl) setInputValue(titleEl, prop.title);
  }
  await waitForNext();

  // ── 1b. Property Description (ACF TinyMCE WYSIWYG) ────────────────────────
  wpStep('Property description');
  if (prop.description_html) {
    const descTextarea = document.querySelector('textarea[name*="field_55d389b51113c"]');

    // Try to find the TinyMCE editor instance
    let tinyEditor = null;
    if (descTextarea?.id) {
      tinyEditor = window.tinymce?.get(descTextarea.id);
    }
    // Fallback: search all registered TinyMCE editors for one linked to this field
    if (!tinyEditor && window.tinymce?.editors?.length) {
      tinyEditor = window.tinymce.editors.find((ed) => {
        try {
          const el = ed.getElement();
          return el === descTextarea || el?.name?.includes('field_55d389b51113c');
        } catch (_) { return false; }
      });
    }

    if (tinyEditor) {
      // Visual mode: inject HTML directly — preserves all bold/bullet formatting
      tinyEditor.setContent(prop.description_html);
      tinyEditor.save();
      try { window.jQuery && window.jQuery(descTextarea).trigger('change'); } catch(e) {}
    } else if (descTextarea) {
      // Fallback: switch to Text (HTML) tab, set textarea directly, switch back to Visual
      const editorId = descTextarea.id || '';
      if (editorId) {
        const htmlTabBtn = document.querySelector(`#${editorId}-html`);
        if (htmlTabBtn) { htmlTabBtn.click(); await sleep(300); }
      }
      setInputValue(descTextarea, prop.description_html);
      if (editorId) {
        const visualTabBtn = document.querySelector(`#${editorId}-tmce`);
        if (visualTabBtn) { await sleep(200); visualTabBtn.click(); }
      }
    } else {
      warn('Description textarea (field_55d389b51113c) not found');
    }
  }
  await waitForNext();
};
