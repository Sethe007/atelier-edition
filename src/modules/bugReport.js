// bugReport.js — Module « Signaler un bug » de l'atelier.
// Autonome : injecte son style + sa modale, envoie le report à /api/bugs/report
// (authentifié par le cookie sv_session, envoyé automatiquement en same-origin).
// Le ticket alimente le forum Discord de l'équipe et le dashboard utilisateur.

(function () {
  'use strict';

  const CSS = `
  .bugr-overlay {
    position: fixed; inset: 0; z-index: 10000; display: none;
    align-items: center; justify-content: center;
    background: rgba(0,0,0,0.55); backdrop-filter: blur(3px);
  }
  .bugr-overlay.open { display: flex; }
  .bugr-box {
    width: min(480px, calc(100vw - 32px)); max-height: calc(100vh - 64px);
    overflow: auto; border-radius: 12px; padding: 22px 24px;
    background: #1e1f24; border: 1px solid rgba(255,255,255,0.09);
    color: rgba(255,255,255,0.88); font-size: 13.5px;
    box-shadow: 0 18px 50px rgba(0,0,0,0.5);
  }
  .bugr-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .bugr-title { font-size: 15.5px; font-weight: 600; }
  .bugr-close {
    background: none; border: none; color: rgba(255,255,255,0.45);
    font-size: 16px; cursor: pointer; padding: 4px 8px; border-radius: 6px;
  }
  .bugr-close:hover { color: #fff; background: rgba(255,255,255,0.08); }
  .bugr-sub { color: rgba(255,255,255,0.45); font-size: 12px; margin-bottom: 14px; }
  .bugr-form { display: grid; gap: 10px; }
  .bugr-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .bugr-form input, .bugr-form select, .bugr-form textarea {
    width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 8px;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.9); font-size: 13px; font-family: inherit;
  }
  .bugr-form textarea { min-height: 96px; resize: vertical; }
  .bugr-form input:focus, .bugr-form select:focus, .bugr-form textarea:focus {
    outline: none; border-color: rgba(255,255,255,0.35);
  }
  .bugr-form option { background: #1e1f24; }
  .bugr-actions { display: flex; align-items: center; gap: 12px; margin-top: 2px; }
  .bugr-send {
    padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer;
    background: #4f6ef7; color: #fff; font-size: 13px; font-weight: 500;
  }
  .bugr-send:hover { background: #6079f8; }
  .bugr-send:disabled { opacity: 0.55; cursor: default; }
  .bugr-msg { font-size: 12.5px; display: none; }
  .bugr-msg.ok { display: block; color: #4ade80; }
  .bugr-msg.err { display: block; color: #f87171; }
  `;

  const HTML = `
  <div class="bugr-box" role="dialog" aria-modal="true" aria-label="Signaler un bug">
    <div class="bugr-head">
      <div class="bugr-title">🐛 Signaler un bug</div>
      <button type="button" class="bugr-close" title="Fermer" aria-label="Fermer">✕</button>
    </div>
    <div class="bugr-sub">Votre report est transmis directement à l'équipe. Suivez son statut depuis votre tableau de bord.</div>
    <form class="bugr-form">
      <input type="text" name="title" maxlength="120" placeholder="Titre court du problème" required />
      <div class="bugr-row">
        <select name="category">
          <option value="editeur">Éditeur</option>
          <option value="export">Export</option>
          <option value="projets">Projets / sauvegarde</option>
          <option value="compte">Compte</option>
          <option value="performance">Performance</option>
          <option value="autre" selected>Autre</option>
        </select>
        <select name="severity">
          <option value="mineur" selected>Gênant (mineur)</option>
          <option value="majeur">Sérieux (majeur)</option>
          <option value="bloquant">Bloquant</option>
        </select>
      </div>
      <textarea name="description" maxlength="4000" required
        placeholder="Décrivez le problème : ce que vous faisiez, ce qui s'est passé, ce que vous attendiez… (10 caractères min.)"></textarea>
      <div class="bugr-actions">
        <button type="submit" class="bugr-send">Envoyer</button>
        <span class="bugr-msg"></span>
      </div>
    </form>
  </div>`;

  let overlay = null;

  function build() {
    if (overlay) return overlay;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    overlay = document.createElement('div');
    overlay.className = 'bugr-overlay';
    overlay.innerHTML = HTML;
    document.body.appendChild(overlay);

    const form = overlay.querySelector('.bugr-form');
    const msg = overlay.querySelector('.bugr-msg');
    const send = overlay.querySelector('.bugr-send');

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('.bugr-close').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.className = 'bugr-msg';
      const fd = new FormData(form);
      const payload = {
        title: (fd.get('title') || '').toString().trim(),
        description: (fd.get('description') || '').toString().trim(),
        category: fd.get('category'),
        severity: fd.get('severity'),
        source: 'app',
        context: 'UA: ' + navigator.userAgent,
      };
      if (payload.title.length < 3 || payload.description.length < 10) {
        msg.textContent = 'Titre (3 car. min.) et description (10 car. min.) requis.';
        msg.classList.add('err');
        return;
      }
      send.disabled = true;
      send.textContent = 'Envoi…';
      try {
        const res = await fetch('/api/bugs/report', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          msg.textContent = 'Merci ! Votre report a bien été transmis à l’équipe.';
          msg.classList.add('ok');
          form.reset();
          setTimeout(close, 2200);
        } else if (res.status === 401) {
          msg.textContent = 'Session expirée — rouvrez l’atelier depuis votre tableau de bord.';
          msg.classList.add('err');
        } else if (res.status === 429) {
          msg.textContent = 'Limite de reports atteinte pour l’heure. Réessayez plus tard.';
          msg.classList.add('err');
        } else {
          msg.textContent = 'Échec de l’envoi. Réessayez dans un instant.';
          msg.classList.add('err');
        }
      } catch {
        msg.textContent = 'Erreur réseau. Vérifiez votre connexion et réessayez.';
        msg.classList.add('err');
      }
      send.disabled = false;
      send.textContent = 'Envoyer';
    });

    return overlay;
  }

  function open() {
    build().classList.add('open');
    const t = overlay.querySelector('input[name="title"]');
    if (t) setTimeout(() => t.focus(), 50);
  }

  function close() {
    if (overlay) {
      overlay.classList.remove('open');
      const msg = overlay.querySelector('.bugr-msg');
      if (msg) msg.className = 'bugr-msg';
    }
  }

  // Exposition globale + branchement du bouton de la barre d'outils
  window.openBugReportModal = open;
  function wire() {
    const btn = document.getElementById('btn-bugreport');
    if (btn) btn.addEventListener('click', open);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
