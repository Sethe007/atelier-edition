import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// Garantit que les clés i18n ajoutées pour la barre d'outils + les modales
// existent dans les 6 langues, et que les data-i18n correspondants sont posés.
const bundle = fs.readFileSync(new URL('../public/legacy-bundle.js', import.meta.url), 'utf8');
const html   = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const KEYS = [
  'tb_open','tb_open_t','tb_file','tb_file_warn','tb_backups','tb_backups_t','tb_export','tb_cardview','tb_isolated',
  'help_sec','help_h_file','help_h_disp','help_isolated','help_dark','help_h_search','help_gsearch','help_help','help_closewin',
  'gs_footer',
  'iap_title','iap_generating','iap_generate','iap_hint','iap_close','iap_replace','iap_confirmq','iap_cancel','iap_confirmbtn',
  'exp_pdf',
  'exp_word',
  'exp_epub',
  'exp_md',
  'tb_ai_label',
  'tb_ai_t',
  'cfg_ai',
  'tb_logout_t',
  'ed_bold_t',
  'ed_italic_t',
  'ed_underline_t',
  'ed_strike_t',
  'ed_typewriter_t',
  'ed_note_t',
  'ed_rep_t',
  'ed_aicontinue_t',
  'view_split_t',
  'view_edit_t',
  'view_preview_t',
  'nav_prev_t',
  'nav_next_t',
  'nav_replace_t',
  'nav_close_t',
  'ch_add_isolated_t',
  'ch_add_t',
  'iso_enable_t',
  'iso_disable_t',
  'ch_none_detected',
  'cork_delete_t',
  'cork_summary_t',
  'cork_unlock_t',
  'cork_lock_t',
];

describe('i18n — complétude des clés barre d’outils + modales (6 langues)', () => {
  for (const k of KEYS) {
    it(`"${k}" défini dans les 6 langues`, () => {
      const count = (bundle.match(new RegExp('\\b' + k + ':', 'g')) || []).length;
      expect(count, `${k} trouvé ${count} fois (attendu >=6)`).toBeGreaterThanOrEqual(6);
    });
  }
  it('les data-i18n clés sont posés dans index.html', () => {
    for (const id of ['tb_open','tb_backups','tb_export','gs_footer','iap_title']) {
      expect(html.includes(`data-i18n="${id}"`) || html.includes(`data-i18n-placeholder="${id}"`) || html.includes(`data-i18n-title="${id}"`), `data-i18n ${id}`).toBe(true);
    }
  });
});
