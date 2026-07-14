// bugReport.js — Module « Signaler un bug » de l'atelier (multilingue).
// Autonome : injecte son style + sa modale, traduit selon la préférence ui_lang
// (partagée avec le site), envoie le report à /api/bugs/report (cookie sv_session).
// Le ticket alimente le forum Discord de l'équipe et le tableau de bord utilisateur.

(function () {
  'use strict';

  // ── Traductions (11 langues, repli langue → en → fr → clé) ──
  var TR = {
  "br_support": {
    "fr": "Support",
    "en": "Support",
    "es": "Soporte",
    "de": "Support",
    "it": "Supporto",
    "pt": "Suporte",
    "ru": "Поддержка",
    "da": "Support",
    "el": "Υποστήριξη",
    "fi": "Tuki",
    "hu": "Támogatás"
  },
  "br_title": {
    "fr": "Signaler un bug",
    "en": "Report a bug",
    "es": "Informar de un error",
    "de": "Fehler melden",
    "it": "Segnala un bug",
    "pt": "Relatar um bug",
    "ru": "Сообщить об ошибке",
    "da": "Rapportér en fejl",
    "el": "Αναφορά σφάλματος",
    "fi": "Ilmoita virheestä",
    "hu": "Hiba jelentése"
  },
  "br_subtitle": {
    "fr": "Votre report est transmis directement à l'équipe. Suivez son statut depuis votre tableau de bord.",
    "en": "Your report goes straight to the team. Track its status from your dashboard.",
    "es": "Tu informe se envía directamente al equipo. Sigue su estado desde tu panel.",
    "de": "Deine Meldung geht direkt an das Team. Verfolge ihren Status in deinem Dashboard.",
    "it": "La tua segnalazione arriva direttamente al team. Segui il suo stato dalla tua dashboard.",
    "pt": "O teu relato vai diretamente para a equipa. Acompanha o seu estado no teu painel.",
    "ru": "Ваше сообщение отправляется напрямую команде. Следите за его статусом на панели.",
    "da": "Din rapport går direkte til teamet. Følg dens status fra dit dashboard.",
    "el": "Η αναφορά σας πηγαίνει απευθείας στην ομάδα. Παρακολουθήστε την κατάστασή της από τον πίνακά σας.",
    "fi": "Raporttisi menee suoraan tiimille. Seuraa sen tilaa hallintapaneelistasi.",
    "hu": "A jelentésed közvetlenül a csapathoz kerül. Kövesd az állapotát a vezérlőpultodon."
  },
  "br_ph_title": {
    "fr": "Titre court du problème",
    "en": "Short title of the problem",
    "es": "Título breve del problema",
    "de": "Kurzer Titel des Problems",
    "it": "Titolo breve del problema",
    "pt": "Título curto do problema",
    "ru": "Краткое название проблемы",
    "da": "Kort titel på problemet",
    "el": "Σύντομος τίτλος του προβλήματος",
    "fi": "Ongelman lyhyt otsikko",
    "hu": "A probléma rövid címe"
  },
  "br_cat_editeur": {
    "fr": "Éditeur",
    "en": "Editor",
    "es": "Editor",
    "de": "Editor",
    "it": "Editor",
    "pt": "Editor",
    "ru": "Редактор",
    "da": "Editor",
    "el": "Επεξεργαστής",
    "fi": "Editori",
    "hu": "Szerkesztő"
  },
  "br_cat_export": {
    "fr": "Export",
    "en": "Export",
    "es": "Exportación",
    "de": "Export",
    "it": "Esportazione",
    "pt": "Exportação",
    "ru": "Экспорт",
    "da": "Eksport",
    "el": "Εξαγωγή",
    "fi": "Vienti",
    "hu": "Exportálás"
  },
  "br_cat_projets": {
    "fr": "Projets / sauvegarde",
    "en": "Projects / saving",
    "es": "Proyectos / guardado",
    "de": "Projekte / Speichern",
    "it": "Progetti / salvataggio",
    "pt": "Projetos / gravação",
    "ru": "Проекты / сохранение",
    "da": "Projekter / lagring",
    "el": "Έργα / αποθήκευση",
    "fi": "Projektit / tallennus",
    "hu": "Projektek / mentés"
  },
  "br_cat_compte": {
    "fr": "Compte",
    "en": "Account",
    "es": "Cuenta",
    "de": "Konto",
    "it": "Account",
    "pt": "Conta",
    "ru": "Аккаунт",
    "da": "Konto",
    "el": "Λογαριασμός",
    "fi": "Tili",
    "hu": "Fiók"
  },
  "br_cat_perf": {
    "fr": "Performance",
    "en": "Performance",
    "es": "Rendimiento",
    "de": "Leistung",
    "it": "Prestazioni",
    "pt": "Desempenho",
    "ru": "Производительность",
    "da": "Ydeevne",
    "el": "Απόδοση",
    "fi": "Suorituskyky",
    "hu": "Teljesítmény"
  },
  "br_cat_autre": {
    "fr": "Autre",
    "en": "Other",
    "es": "Otro",
    "de": "Sonstiges",
    "it": "Altro",
    "pt": "Outro",
    "ru": "Другое",
    "da": "Andet",
    "el": "Άλλο",
    "fi": "Muu",
    "hu": "Egyéb"
  },
  "br_sev_mineur": {
    "fr": "Gênant (mineur)",
    "en": "Annoying (minor)",
    "es": "Molesto (menor)",
    "de": "Störend (gering)",
    "it": "Fastidioso (minore)",
    "pt": "Incómodo (menor)",
    "ru": "Неудобство (незначительное)",
    "da": "Generende (mindre)",
    "el": "Ενοχλητικό (ήσσον)",
    "fi": "Häiritsevä (vähäinen)",
    "hu": "Zavaró (kisebb)"
  },
  "br_sev_majeur": {
    "fr": "Sérieux (majeur)",
    "en": "Serious (major)",
    "es": "Grave (mayor)",
    "de": "Ernst (schwerwiegend)",
    "it": "Grave (maggiore)",
    "pt": "Sério (maior)",
    "ru": "Серьёзное (существенное)",
    "da": "Alvorlig (større)",
    "el": "Σοβαρό (μείζον)",
    "fi": "Vakava (suuri)",
    "hu": "Súlyos (nagyobb)"
  },
  "br_sev_bloquant": {
    "fr": "Bloquant",
    "en": "Blocking",
    "es": "Bloqueante",
    "de": "Blockierend",
    "it": "Bloccante",
    "pt": "Bloqueante",
    "ru": "Блокирующее",
    "da": "Blokerende",
    "el": "Αποκλειστικό",
    "fi": "Estävä",
    "hu": "Blokkoló"
  },
  "br_ph_desc": {
    "fr": "Décrivez le problème : ce que vous faisiez, ce qui s'est passé, ce que vous attendiez… (10 caractères min.)",
    "en": "Describe the problem: what you were doing, what happened, what you expected… (10 characters min.)",
    "es": "Describe el problema: qué hacías, qué ocurrió, qué esperabas… (10 caracteres mín.)",
    "de": "Beschreibe das Problem: was du getan hast, was passiert ist, was du erwartet hast… (mind. 10 Zeichen)",
    "it": "Descrivi il problema: cosa stavi facendo, cosa è successo, cosa ti aspettavi… (min. 10 caratteri)",
    "pt": "Descreve o problema: o que fazias, o que aconteceu, o que esperavas… (mín. 10 caracteres)",
    "ru": "Опишите проблему: что вы делали, что произошло, чего вы ожидали… (минимум 10 символов)",
    "da": "Beskriv problemet: hvad du lavede, hvad der skete, hvad du forventede… (mindst 10 tegn)",
    "el": "Περιγράψτε το πρόβλημα: τι κάνατε, τι συνέβη, τι περιμένατε… (10 χαρακτήρες τουλάχιστον)",
    "fi": "Kuvaile ongelma: mitä teit, mitä tapahtui, mitä odotit… (vähintään 10 merkkiä)",
    "hu": "Írd le a problémát: mit csináltál, mi történt, mire számítottál… (min. 10 karakter)"
  },
  "br_send_site": {
    "fr": "Envoyer le report",
    "en": "Send report",
    "es": "Enviar informe",
    "de": "Meldung senden",
    "it": "Invia segnalazione",
    "pt": "Enviar relato",
    "ru": "Отправить сообщение",
    "da": "Send rapport",
    "el": "Αποστολή αναφοράς",
    "fi": "Lähetä raportti",
    "hu": "Jelentés küldése"
  },
  "br_send": {
    "fr": "Envoyer",
    "en": "Send",
    "es": "Enviar",
    "de": "Senden",
    "it": "Invia",
    "pt": "Enviar",
    "ru": "Отправить",
    "da": "Send",
    "el": "Αποστολή",
    "fi": "Lähetä",
    "hu": "Küldés"
  },
  "br_sending": {
    "fr": "Envoi…",
    "en": "Sending…",
    "es": "Enviando…",
    "de": "Wird gesendet…",
    "it": "Invio…",
    "pt": "A enviar…",
    "ru": "Отправка…",
    "da": "Sender…",
    "el": "Αποστολή…",
    "fi": "Lähetetään…",
    "hu": "Küldés…"
  },
  "br_ok": {
    "fr": "Merci ! Votre report a bien été transmis à l’équipe.",
    "en": "Thank you! Your report has been sent to the team.",
    "es": "¡Gracias! Tu informe se ha enviado al equipo.",
    "de": "Danke! Deine Meldung wurde an das Team gesendet.",
    "it": "Grazie! La tua segnalazione è stata inviata al team.",
    "pt": "Obrigado! O teu relato foi enviado à equipa.",
    "ru": "Спасибо! Ваше сообщение отправлено команде.",
    "da": "Tak! Din rapport er sendt til teamet.",
    "el": "Ευχαριστούμε! Η αναφορά σας στάλθηκε στην ομάδα.",
    "fi": "Kiitos! Raporttisi on lähetetty tiimille.",
    "hu": "Köszönjük! A jelentésed elküldtük a csapatnak."
  },
  "br_err_fields": {
    "fr": "Titre (3 car. min.) et description (10 car. min.) requis.",
    "en": "Title (3 char. min.) and description (10 char. min.) required.",
    "es": "Se requiere título (mín. 3 car.) y descripción (mín. 10 car.).",
    "de": "Titel (mind. 3 Zeichen) und Beschreibung (mind. 10 Zeichen) erforderlich.",
    "it": "Titolo (min. 3 car.) e descrizione (min. 10 car.) obbligatori.",
    "pt": "Título (mín. 3 car.) e descrição (mín. 10 car.) obrigatórios.",
    "ru": "Требуются заголовок (мин. 3 симв.) и описание (мин. 10 симв.).",
    "da": "Titel (min. 3 tegn) og beskrivelse (min. 10 tegn) påkrævet.",
    "el": "Απαιτούνται τίτλος (3 χαρ. min.) και περιγραφή (10 χαρ. min.).",
    "fi": "Otsikko (väh. 3 merkkiä) ja kuvaus (väh. 10 merkkiä) vaaditaan.",
    "hu": "Cím (min. 3 karakter) és leírás (min. 10 karakter) szükséges."
  },
  "br_err_429": {
    "fr": "Limite de reports atteinte pour l’heure. Réessayez plus tard.",
    "en": "Report limit reached for this hour. Try again later.",
    "es": "Límite de informes alcanzado por esta hora. Inténtalo más tarde.",
    "de": "Meldungslimit für diese Stunde erreicht. Versuche es später erneut.",
    "it": "Limite di segnalazioni raggiunto per quest'ora. Riprova più tardi.",
    "pt": "Limite de relatos atingido nesta hora. Tenta novamente mais tarde.",
    "ru": "Достигнут лимит сообщений на этот час. Повторите позже.",
    "da": "Rapportgrænse nået for denne time. Prøv igen senere.",
    "el": "Συμπληρώθηκε το όριο αναφορών για αυτήν την ώρα. Δοκιμάστε ξανά αργότερα.",
    "fi": "Raporttiraja saavutettu tältä tunnilta. Yritä myöhemmin uudelleen.",
    "hu": "Elérted az órás jelentéskorlátot. Próbáld újra később."
  },
  "br_err_fail": {
    "fr": "Échec de l’envoi. Réessayez dans un instant.",
    "en": "Sending failed. Try again in a moment.",
    "es": "Error al enviar. Inténtalo de nuevo en un momento.",
    "de": "Senden fehlgeschlagen. Versuche es gleich noch einmal.",
    "it": "Invio non riuscito. Riprova tra un istante.",
    "pt": "Falha ao enviar. Tenta novamente daqui a instantes.",
    "ru": "Не удалось отправить. Повторите через мгновение.",
    "da": "Afsendelse mislykkedes. Prøv igen om et øjeblik.",
    "el": "Η αποστολή απέτυχε. Δοκιμάστε ξανά σε λίγο.",
    "fi": "Lähetys epäonnistui. Yritä hetken kuluttua uudelleen.",
    "hu": "A küldés nem sikerült. Próbáld újra egy pillanat múlva."
  },
  "br_err_net": {
    "fr": "Erreur réseau. Vérifiez votre connexion et réessayez.",
    "en": "Network error. Check your connection and try again.",
    "es": "Error de red. Comprueba tu conexión e inténtalo de nuevo.",
    "de": "Netzwerkfehler. Prüfe deine Verbindung und versuche es erneut.",
    "it": "Errore di rete. Controlla la connessione e riprova.",
    "pt": "Erro de rede. Verifica a tua ligação e tenta novamente.",
    "ru": "Ошибка сети. Проверьте подключение и повторите.",
    "da": "Netværksfejl. Tjek din forbindelse og prøv igen.",
    "el": "Σφάλμα δικτύου. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.",
    "fi": "Verkkovirhe. Tarkista yhteytesi ja yritä uudelleen.",
    "hu": "Hálózati hiba. Ellenőrizd a kapcsolatot, és próbáld újra."
  },
  "br_err_401": {
    "fr": "Session expirée — rouvrez l’atelier depuis votre tableau de bord.",
    "en": "Session expired — reopen the studio from your dashboard.",
    "es": "Sesión caducada — vuelve a abrir el taller desde tu panel.",
    "de": "Sitzung abgelaufen — öffne das Atelier erneut über dein Dashboard.",
    "it": "Sessione scaduta — riapri lo studio dalla tua dashboard.",
    "pt": "Sessão expirada — reabre o ateliê a partir do teu painel.",
    "ru": "Сессия истекла — откройте мастерскую заново с панели.",
    "da": "Sessionen er udløbet — genåbn værkstedet fra dit dashboard.",
    "el": "Η συνεδρία έληξε — ανοίξτε ξανά το εργαστήριο από τον πίνακά σας.",
    "fi": "Istunto vanheni — avaa työpaja uudelleen hallintapaneelista.",
    "hu": "A munkamenet lejárt — nyisd meg újra a műhelyt a vezérlőpultról."
  },
  "st_nouveau": {
    "fr": "Nouveau",
    "en": "New",
    "es": "Nuevo",
    "de": "Neu",
    "it": "Nuovo",
    "pt": "Novo",
    "ru": "Новый",
    "da": "Ny",
    "el": "Νέο",
    "fi": "Uusi",
    "hu": "Új"
  },
  "st_confirme": {
    "fr": "Bug confirmé",
    "en": "Bug confirmed",
    "es": "Error confirmado",
    "de": "Fehler bestätigt",
    "it": "Bug confermato",
    "pt": "Bug confirmado",
    "ru": "Ошибка подтверждена",
    "da": "Fejl bekræftet",
    "el": "Επιβεβαιωμένο σφάλμα",
    "fi": "Virhe vahvistettu",
    "hu": "Hiba megerősítve"
  },
  "st_en_cours": {
    "fr": "En cours",
    "en": "In progress",
    "es": "En curso",
    "de": "In Bearbeitung",
    "it": "In corso",
    "pt": "Em curso",
    "ru": "В работе",
    "da": "I gang",
    "el": "Σε εξέλιξη",
    "fi": "Käynnissä",
    "hu": "Folyamatban"
  },
  "st_resolu": {
    "fr": "Résolu",
    "en": "Resolved",
    "es": "Resuelto",
    "de": "Gelöst",
    "it": "Risolto",
    "pt": "Resolvido",
    "ru": "Решено",
    "da": "Løst",
    "el": "Επιλύθηκε",
    "fi": "Ratkaistu",
    "hu": "Megoldva"
  },
  "st_rejete": {
    "fr": "Rejeté",
    "en": "Rejected",
    "es": "Rechazado",
    "de": "Abgelehnt",
    "it": "Rifiutato",
    "pt": "Rejeitado",
    "ru": "Отклонено",
    "da": "Afvist",
    "el": "Απορρίφθηκε",
    "fi": "Hylätty",
    "hu": "Elutasítva"
  },
  "br_answer": {
    "fr": "Réponse : ",
    "en": "Reply: ",
    "es": "Respuesta: ",
    "de": "Antwort: ",
    "it": "Risposta: ",
    "pt": "Resposta: ",
    "ru": "Ответ: ",
    "da": "Svar: ",
    "el": "Απάντηση: ",
    "fi": "Vastaus: ",
    "hu": "Válasz: "
  }
};
  function curLang() {
    try { return JSON.parse(localStorage.getItem('atelier_prefs') || '{}').ui_lang || 'fr'; }
    catch (e) { return 'fr'; }
  }
  function t(key) {
    var e = TR[key] || {};
    var l = curLang();
    return e[l] || e.en || e.fr || key;
  }

  var CSS = `
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

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function boxHTML() {
    return '' +
    '<div class="bugr-box" role="dialog" aria-modal="true" aria-label="' + esc(t('br_title')) + '">' +
      '<div class="bugr-head">' +
        '<div class="bugr-title">🐛 ' + esc(t('br_title')) + '</div>' +
        '<button type="button" class="bugr-close" title="' + esc(t('br_close') || '') + '" aria-label="Fermer">✕</button>' +
      '</div>' +
      '<div class="bugr-sub">' + esc(t('br_subtitle')) + '</div>' +
      '<form class="bugr-form">' +
        '<input type="text" name="title" maxlength="120" placeholder="' + esc(t('br_ph_title')) + '" required />' +
        '<div class="bugr-row">' +
          '<select name="category">' +
            '<option value="editeur">' + esc(t('br_cat_editeur')) + '</option>' +
            '<option value="export">' + esc(t('br_cat_export')) + '</option>' +
            '<option value="projets">' + esc(t('br_cat_projets')) + '</option>' +
            '<option value="compte">' + esc(t('br_cat_compte')) + '</option>' +
            '<option value="performance">' + esc(t('br_cat_perf')) + '</option>' +
            '<option value="autre" selected>' + esc(t('br_cat_autre')) + '</option>' +
          '</select>' +
          '<select name="severity">' +
            '<option value="mineur" selected>' + esc(t('br_sev_mineur')) + '</option>' +
            '<option value="majeur">' + esc(t('br_sev_majeur')) + '</option>' +
            '<option value="bloquant">' + esc(t('br_sev_bloquant')) + '</option>' +
          '</select>' +
        '</div>' +
        '<textarea name="description" maxlength="4000" required placeholder="' + esc(t('br_ph_desc')) + '"></textarea>' +
        '<div class="bugr-actions">' +
          '<button type="submit" class="bugr-send">' + esc(t('br_send')) + '</button>' +
          '<span class="bugr-msg"></span>' +
        '</div>' +
      '</form>' +
    '</div>';
  }

  var overlay = null;

  function ensureStyle() {
    if (document.getElementById('bugr-style')) return;
    var style = document.createElement('style');
    style.id = 'bugr-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function render() {
    ensureStyle();
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'bugr-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay.classList.contains('open')) close();
      });
    }
    overlay.innerHTML = boxHTML();  // (re)construit avec la langue courante
    var form = overlay.querySelector('.bugr-form');
    var msg = overlay.querySelector('.bugr-msg');
    var send = overlay.querySelector('.bugr-send');
    overlay.querySelector('.bugr-close').addEventListener('click', close);

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      msg.className = 'bugr-msg';
      var fd = new FormData(form);
      var payload = {
        title: (fd.get('title') || '').toString().trim(),
        description: (fd.get('description') || '').toString().trim(),
        category: fd.get('category'),
        severity: fd.get('severity'),
        source: 'app',
        lang: curLang(),
        context: 'UA: ' + navigator.userAgent,
      };
      if (payload.title.length < 3 || payload.description.length < 10) {
        msg.textContent = t('br_err_fields'); msg.classList.add('err'); return;
      }
      send.disabled = true; send.textContent = t('br_sending');
      try {
        var res = await fetch('/api/bugs/report', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          msg.textContent = t('br_ok'); msg.classList.add('ok');
          form.reset(); setTimeout(close, 2200);
        } else if (res.status === 401) {
          msg.textContent = t('br_err_401'); msg.classList.add('err');
        } else if (res.status === 429) {
          msg.textContent = t('br_err_429'); msg.classList.add('err');
        } else {
          msg.textContent = t('br_err_fail'); msg.classList.add('err');
        }
      } catch (err) {
        msg.textContent = t('br_err_net'); msg.classList.add('err');
      }
      send.disabled = false; send.textContent = t('br_send');
    });
  }

  function open() {
    render();  // toujours re-rendre pour refléter la langue courante
    overlay.classList.add('open');
    var ti = overlay.querySelector('input[name="title"]');
    if (ti) setTimeout(function () { ti.focus(); }, 50);
  }
  function close() {
    if (overlay) overlay.classList.remove('open');
  }

  // Libellés du bouton de la barre d'outils selon la langue
  function setBtnLabels() {
    var btn = document.getElementById('btn-bugreport');
    if (btn) { btn.title = t('br_title'); btn.setAttribute('aria-label', t('br_title')); }
  }

  window.openBugReportModal = open;

  function wire() {
    var btn = document.getElementById('btn-bugreport');
    if (btn) btn.addEventListener('click', open);
    setBtnLabels();
    // Mettre à jour le libellé du bouton quand l'utilisateur change de langue
    var sel = document.getElementById('pref-ui-langue');
    if (sel) sel.addEventListener('change', function () { setTimeout(setBtnLabels, 0); });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else { wire(); }
})();
