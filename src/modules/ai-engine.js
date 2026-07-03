// ── MOTEUR DE CORRECTION ───────────────────────────────
let _correctEngine = 'lt'; // 'lt' | 'claude' | 'both'

const ENGINE_INFO = {
  lt:     '🛡 <strong>LanguageTool</strong> — Gratuit, sans clé API. Détecte les fautes d\'orthographe, de grammaire et de style en français.',
  claude: '✦ <strong>IA (fournisseur sélectionné)</strong> — Nécessite une clé API. Correction contextuelle avancée.',
  both:   '⚡ <strong>Les deux combinés</strong> — LanguageTool (gratuit) + IA (clé requise). Résultat le plus complet.',
};

function setCorrectEngine(engine) {
  _correctEngine = engine;
  ['lt','claude','both'].forEach(e => {
    document.getElementById('eng-' + e).classList.toggle('active', e === engine);
  });
  document.getElementById('wt-engine-info').innerHTML = ENGINE_INFO[engine];
}

// ═══════════════════════════════════════════════════════════════════
// ── POINT D'ENTRÉE IA UNIFIÉ ───────────────────────────────────────
// Une seule fonction gère tous les providers. Les prompts varient,
// la mécanique d'appel est centralisée ici.
// ═══════════════════════════════════════════════════════════════════
// ── AbortController — annulation des requêtes IA en cours ──
let _aiAbortController = null;

/** Annule toute requête IA en cours. Sans effet si rien ne tourne. */
function cancelCurrentAI() {
  if (_aiAbortController) {
    _aiAbortController.abort();
    _aiAbortController = null;
  }
}

async function callAI(systemPrompt, userMsg, maxTokens = 1024) {
  // Annuler tout appel précédent et créer un nouveau signal
  cancelCurrentAI();
  const _ctrl = new AbortController();
  _aiAbortController = _ctrl;
  const _signal = _ctrl.signal;

  // Toujours lire le provider et la clé depuis localStorage (source de vérité)
  // _wtProvider peut être périmé si loadApiKey() n'a pas encore tourné
  const _lsConfig = (function(){ try { return JSON.parse(localStorage.getItem('ia_config') || '{}'); } catch(e){ return {}; } })();
  const activeProv = (_lsConfig.provider && AI_PROVIDERS?.[_lsConfig.provider]) ? _lsConfig.provider : (_wtProvider || 'claude');
  const provCfg    = _getProviderConfig(activeProv);
  const activeKey  = (provCfg.key || _wtApiKey || '').trim();

  // ── Instruction de langue — injectée EN TÊTE du system prompt ──────────
  // Position en tête = priorité maximale pour tous les modèles.
  // buildLangInstruction() lit la préférence ia_langue en localStorage.
  try {
    const langInstr = buildLangInstruction();
    if (!systemPrompt.startsWith(langInstr)) {
      systemPrompt = langInstr + '\n\n' + systemPrompt;
    }
  } catch(e) {
    // buildLangInstruction pas encore disponible (premier appel très tôt) → fallback
    // Lire directement localStorage pour honorer la préférence ia_langue
    try {
      const _raw   = JSON.parse(localStorage.getItem('atelier_prefs') || '{}');
      const _code  = (_raw.ia_langue && LANGUE_LABELS[_raw.ia_langue]) ? _raw.ia_langue : 'fr';
      const _label = LANGUE_LABELS[_code];
      const _instr = _code === 'fr'
        ? 'INSTRUCTION ABSOLUE — LANGUE : Tu dois UNIQUEMENT rédiger ta réponse en français, sans exception.'
        : `ABSOLUTE INSTRUCTION — OUTPUT LANGUAGE: You MUST write your entire response exclusively in ${_label}. No exception.`;
      if (!systemPrompt.startsWith(_instr)) systemPrompt = _instr + '\n\n' + systemPrompt;
    } catch(_e) {
      if (!systemPrompt.includes('UNIQUEMENT')) {
        systemPrompt = 'INSTRUCTION ABSOLUE — LANGUE : Tu dois UNIQUEMENT rédiger ta réponse en français, sans exception.\n\n' + systemPrompt;
      }
    }
  }

  if (!activeKey) {
    const provNames = { claude: 'Anthropic', openai: 'OpenAI', gemini: 'Google Gemini', groq: 'Groq', openrouter: 'OpenRouter' };
    const pName = provNames[activeProv] || activeProv;
    return { error: `Aucune clé API pour ${pName}. Ouvrez ⚙ Paramètres → Config IA, entrez votre clé et cliquez 💾 Enregistrer.` };
  }

  // Résoudre le modèle actif (config sauvegardée en priorité)
  const model = provCfg.model || _wtModel || AI_PROVIDERS[activeProv]?.models[0]?.value;

  try {
    switch (activeProv) {
      // ── Claude (Anthropic) ────────────────────────────────────
      case 'claude': {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal: _signal,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': activeKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-client-side-api-key-allowed': 'true',
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMsg }],
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || 'Erreur API Claude ' + res.status);
        }
        const data = await res.json();
        return data.content?.[0]?.text || '';
      }

      // ── OpenAI ───────────────────────────────────────────────
      case 'openai':
        return await _callOpenAIcompat(
          'https://api.openai.com/v1/chat/completions',
          activeKey, systemPrompt, userMsg, model, maxTokens, 'OpenAI', _signal
        );

      // ── Gemini (Google) ──────────────────────────────────────
      case 'gemini': {
        // SECURITE : cle via en-tete x-goog-api-key (pas en parametre d'URL).
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const res = await fetch(endpoint, {
          method: 'POST',
          signal: _signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': activeKey },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userMsg }] }],
            generationConfig: { maxOutputTokens: maxTokens },
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || 'Erreur API Gemini ' + res.status);
        }
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      // ── Groq (LPU) ───────────────────────────────────────────
      case 'groq':
        return await _callOpenAIcompat(
          'https://api.groq.com/openai/v1/chat/completions',
          activeKey, systemPrompt, userMsg, model, maxTokens, 'Groq', _signal
        );

      // ── OpenRouter (200+ modèles) ─────────────────────────────
      case 'openrouter':
        return await _callOpenAIcompat(
          'https://openrouter.ai/api/v1/chat/completions',
          activeKey, systemPrompt, userMsg, model, maxTokens, 'OpenRouter', _signal
        );

      default:
        throw new Error(`Provider inconnu : ${activeProv}`);
    }
  } catch(e) {
    if (e.name === 'AbortError') return { error: 'Requête annulée.', aborted: true };
    let msg = e.message;
    if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('fetch')) {
      const providerNames = { claude: 'Anthropic', openai: 'OpenAI', gemini: 'Google Gemini', groq: 'Groq', openrouter: 'OpenRouter' };
      msg = `Impossible de contacter ${providerNames[activeProv] || activeProv} — vérifiez votre connexion ou votre clé API.`;
    }
    return { error: msg };
  } finally {
    // Libérer le controller si c'est encore le nôtre (pas annulé par un appel plus récent)
    if (_aiAbortController === _ctrl) _aiAbortController = null;
  }
}

// Alias rétrocompatibilité
const callClaude = callAI;

// ── Analyse locale (offline) ───────────────────────────
// ══════════════════════════════════════════════════════════
// CORRECTEUR LOCAL ENRICHI — offline, sans API
// ══════════════════════════════════════════════════════════


// ── Homophones à vérifier par contexte ──────────────────
// Format : [motFautif, motCorrect, regex_contexte_fautif, explication]
// ══════════════════════════════════════════════════════════
// CORRECTION — LanguageTool (principal) + règles locales littéraires
// ══════════════════════════════════════════════════════════

// ── Règles locales conservées (non couvertes par LT) ─────
// 1. Clichés littéraires — LT ne connaît pas les formules usées en fiction
// 2. Cohérence des noms de personnages — spécifique au roman de l'auteur
// 3. Répétitions proches — LT le fait mais peu précis sur le français littéraire

// ── Nettoyage du texte avant analyse ─────────────────────
function cleanForAnalysis(text) {
  // FIX 3: nettoyage étendu — supprimer aussi les titres de chapitres romans
  // pour éviter que les mots des titres polluent l'analyse des répétitions
  return text
    .replace(/\[IMAGE:[^\]]*\]/gi, ' ')   // [IMAGE:nom] → espace neutre
    .replace(/^#{1,6}\s.*$/mg, '')         // titres Markdown
    .replace(/^\*{3,}$/mg, '')             // séparateurs ***
    .replace(/^(Chapitre|Partie|Prologue|Épilogue|Epilogue|Acte|Scène|Interlude)\b.{0,80}$/gim, '')
    .replace(/^[IVXLC]+\.\s.{0,80}$/gm, ''); // numérotation romaine (I. II. etc.)
}

// ── Cohérence des noms de personnages ────────────────────
function checkCharacterNames(text) {
  const issues = [];
  const proper = {};

  // Dictionnaire étendu de mots communs français pouvant commencer une phrase avec majuscule
  // — couvre : conjonctions, prépositions, adverbes, adjectifs courants, noms communs fréquents,
  //   formes verbales conjuguées, déterminants, pronoms, mots grammaticaux
  const EXCLUS = new Set([
    // Déterminants / articles
    'Les','Des','Une','Ses','Ces','Mes','Tes','Nos','Vos',
    // Pronoms
    'Elle','Elles','Eux','Nous','Vous','Ils','Lui','Cela','Ceci','Celui',
    'Celle','Ceux','Celles','Lequel','Laquelle','Lesquels','Lesquelles',
    'Rien','Personne','Chacun','Chacune','Tout','Tous','Toute','Toutes',
    // Conjonctions
    'Mais','Donc','Car','Que','Qui','Quand','Lorsque','Parce','Puisque',
    'Tandis','Quoique','Alors','Puis','Ensuite','Pourtant','Cependant',
    'Néanmoins','Toutefois','Autrement','Cependant','Sauf',
    // Prépositions / locutions prépositives
    'Dans','Vers','Avec','Sans','Pour','Sous','Chez','Lors','Après',
    'Avant','Entre','Selon','Parmi','Contre','Malgré','Depuis','Pendant',
    'Devant','Derrière','Dessus','Dessous','Dehors','Dedans','Autour',
    'Auprès','Jusqu','Dès','Comme',
    // Adverbes courants
    'Très','Plus','Moins','Bien','Mal','Vite','Tôt','Tard','Ici','Là',
    'Même','Aussi','Encore','Déjà','Jamais','Toujours','Souvent','Parfois',
    'Soudain','Enfin','Voici','Voilà','Peut','Seulement','Notamment',
    'Simplement','Vraiment','Pourtant','Surtout','Plutôt','Assez','Trop',
    // Adjectifs communs fréquents
    'Grand','Grande','Petit','Petite','Vieux','Vieille','Jeune','Beau',
    'Belle','Nouveau','Nouvelle','Bon','Bonne','Mauvais','Mauvaise',
    'Long','Longue','Court','Courte','Haut','Haute','Bas','Basse',
    'Seul','Seule','Seuls','Seules','Vaste','Vide','Plein','Pleine',
    'Lent','Lente','Fort','Forte','Doux','Douce','Juste','Faux','Fausse',
    'Sombre','Claire','Profond','Profonde','Ancien','Ancienne','Libre',
    'Dernier','Dernière','Premier','Première','Autre','Autres','Certain',
    'Certaine','Certains','Certaines','Pareil','Pareille','Même',
    // Noms communs très fréquents pouvant être en majuscule
    'Pierre','Aube','Aubes','Terre','Ciel','Mer','Eau','Feu','Air',
    'Nuit','Jour','Soir','Matin','Heure','Temps','Vie','Mort','Monde',
    'Dieu','Homme','Femme','Enfant','Peuple','Roi','Reine','Seigneur',
    'Barbe','Gorge','Bouche','Voix','Corps','Tête','Regard','Visage',
    'Bras','Main','Mains','Pied','Pieds','Yeux','Sang','Larme','Ombre',
    'Lumière','Soleil','Lune','Étoile','Vent','Pluie','Neige','Forêt',
    // Verbes à l'infinitif fréquents (fin de phrase relative)
    'Faire','Avoir','Être','Dire','Voir','Aller','Venir','Prendre',
    'Mettre','Donner','Partir','Rester','Perdre','Trouver','Savoir',
    'Pouvoir','Vouloir','Devoir','Falloir','Sembler','Paraître',
    'Parler','Penser','Croire','Entendre','Sentir','Regarder','Ajuster',
    // Formes verbales conjuguées fréquentes
    'Parle','Parles','Parlons','Parlez','Parlent','Parlait','Parlaient',
    'Ajusta','Ajustait','Reste','Restes','Restait','Reste',
    'Irréel','Irréelle',
    // Structure du roman
    'Chapitre','Partie','Livre','Tome','Prologue','Épilogue','Introduction',
    'Conclusion','Annexe','Acte','Scène','Interlude','Commandant','Combattant',
    'Quelque','Quelques','Quelqu','Chaque',
    // Numéraux cardinaux et ordinaux (capitalisés en début de phrase)
    'Deux','Trois','Quatre','Cinq','Six','Sept','Huit','Neuf','Dix',
    'Onze','Douze','Treize','Vingt','Cent','Mille',
    'Premier','Deuxième','Troisième','Quatrième',
    // Négations et indéfinis négatifs
    'Aucun','Aucune','Nul','Nulle','Jamais','Rien','Personne',
    // Adjectifs qualificatifs courts souvent en majuscule en début de phrase
    'Lourd','Lourde','Froid','Froide','Chaud','Chaude','Plat','Plate',
    'Droit','Droite','Vrai','Vraie','Faux','Fausse','Raide','Calme',
    'Dense','Creux','Creuse','Flou','Floue','Vif','Vive','Pur','Pure',
    'Dur','Dure','Cru','Crue','Nu','Nue',
    // Verbes courants conjugués (3e personne) pouvant ouvrir une phrase (style inversé)
    'Crois','Croit','Crut','Prit','Vit','Dit','Fit','Fut','Put',
    'Tint','Vint','Sut','Dut','Voulut','Courut',
    // Noms communs courts fréquents absents ci-dessus
    'Tronc','Troncs','Tapis','Promis','Cours','Coeur','Honte',
    'Poids','Murs','Mur','Sort','Sors','Bruit','Bruits',
  ]);

  // Passe 1 : collecter tous les mots avec majuscule (hors EXCLUS et suffixes communs)
  for (const m of text.matchAll(/\b([A-ZÁÀÂÉÈÊËÎÏÔÙÛÜŒÇ][a-záàâéèêëîïôùûüœç]{2,})\b/g)) {
    const w = m[1];
    if (EXCLUS.has(w)) continue;
    // Exclure les mots à suffixes grammaticaux très communs
    if (/(?:ment|tion|tions|iste|isme|eur|euse|ant|ante|ains|aine|ien|ienne|iens|iennes|able|ible|itude|esse|ance|ence|ité|ifier|iser|aient|ait|ais|era|eras|erait|eraient|ons|ez|ent)$/.test(w)) continue;
    // Exclure les infinitifs (-er, -ir, -re de 4+ lettres)
    if (/(?:er|ir|re)$/.test(w) && w.length >= 5) continue;
    // Exclure passé simple 3e sg. en -a (Laissa, Regarda, Posa, Prit…) — 5+ lettres pour éviter "Eva"
    if (/[^aeiouéèêë]a$/.test(w.toLowerCase()) && w.length >= 5) continue;
    // Exclure participes passés et adjectifs accordés :
    // -ée/-ées (féminin sg/pl), -és (masc pl), -ue/-ues/-us (accords en -u), -ie/-ies/-is (accords en -i)
    if (/(?:ée|ées|ues|ies)$/.test(w.toLowerCase())) continue;
    // Adjectifs masculin/féminin courants : -ue (absolue), -ie (suivie)
    if (/(?:ue|ie)$/.test(w.toLowerCase()) && w.length >= 5) continue;
    proper[w] = (proper[w] || 0) + 1;
  }

  // Passe 2 : supprimer les mots qui apparaissent aussi EN MINUSCULES dans le texte
  // → si "pierre" existe en minuscule, alors "Pierre" en début de phrase est probablement
  //   juste le même nom commun capitalisé, pas un personnage
  for (const w of Object.keys(proper)) {
    const lower = w.toLowerCase();
    // Chercher le mot en minuscule en milieu de phrase via une approche sans lookbehind
    // à longueur variable (plus robuste et compatible tous moteurs JS).
    // On découpe le texte en tokens et on compte les occurrences en minuscule non-initiales.
    let midCount = 0;
    const tokenRe = new RegExp('[a-záàâéèêëîïôùûüœç]+', 'g');
    let tok;
    while ((tok = tokenRe.exec(text)) !== null) {
      if (tok[0] === lower) midCount++;
    }
    // Si le mot apparaît souvent en minuscule → c'est un nom commun, pas un personnage
    if (midCount >= 2) {
      delete proper[w];
    }
  }

  // Passe 2b : retirer les noms propres déclarés (personnages + lieux) — légitimes, jamais des typos
  const knownProperNouns = new Set();
  getPersos().forEach(p => {
    if (p.nom) p.nom.split(/[\s\-]+/).forEach(w => { if (w.length > 1) knownProperNouns.add(w); });
    if (p.variantes) p.variantes.split(/[,;]+/).map(v => v.trim()).filter(Boolean).forEach(v =>
      v.split(/[\s\-]+/).forEach(w => { if (w.length > 1) knownProperNouns.add(w); })
    );
  });
  getLieux().forEach(l => {
    if (l.nom) l.nom.split(/[\s\-]+/).forEach(w => { if (w.length > 1) knownProperNouns.add(w); });
    if (l.variantes) l.variantes.split(/[,;]+/).map(v => v.trim()).filter(Boolean).forEach(v =>
      v.split(/[\s\-]+/).forEach(w => { if (w.length > 1) knownProperNouns.add(w); })
    );
    if (l.peuples) l.peuples.split(/[,;]+/).map(v => v.trim()).filter(Boolean).forEach(v =>
      v.split(/[\s\-]+/).forEach(w => { if (w.length > 1) knownProperNouns.add(w); })
    );
  });
  for (const w of Object.keys(proper)) {
    if (knownProperNouns.has(w)) delete proper[w];
  }

  // FIX BUG 1 — algorithme Levenshtein + filtre de rareté
  // Logique: un personnage fréquent (>=3 occ) vs une variante RARE (<3 occ)
  // → La variante rare est probablement une typo, pas un second personnage
  // Avantage vs préfixe: capte "Selayne"/"Seelayne" (lettres transposées, ajoutées)

  // Distance de Levenshtein (insensible à la casse)
  function _lev(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    const m = a.length, n = b.length;
    const dp = Array.from({length: m+1}, (_, i) =>
      Array.from({length: n+1}, (_, j) => j === 0 ? i : 0));
    for (let j = 1; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
          : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
  }

  // BUG 5 FIX : comparer aussi les noms qui apparaissent chacun ≥ 2×
  // (et pas uniquement "main ≥3, autre <3")
  // Logique : si A et B ont tous deux ≥ 2 occ ET sont proches → deux graphies du même nom
  const mainChars  = Object.entries(proper).filter(([,c]) => c >= 3).map(([n]) => n);
  const rareChars  = Object.entries(proper).filter(([,c]) => c >= 2 && c < 3).map(([n]) => n);
  const allPropers = Object.keys(proper);
  const seenPairs  = new Set();

  // Comparer mainChars vs allPropers ET rareChars vs rareChars (BUG 5 FIX)
  const pairsToCheck = [
    ...mainChars.flatMap(m => allPropers.map(o => [m, o])),
    ...rareChars.flatMap(a => rareChars.map(b => [a, b])),
  ];

  // Ensemble des mots qui apparaissent aussi en minuscule dans le texte
  // → ce sont des mots du vocabulaire commun, pas des noms propres
  const commonWords = new Set();
  for (const m of text.matchAll(/(?<![A-ZÁÀÂÉÈÊËÎÏÔÙÛÜŒÇ])[a-záàâéèêëîïôùûüœç]{6,}/g))
    commonWords.add(m[0].charAt(0).toUpperCase() + m[0].slice(1));

  for (const [main, other] of pairsToCheck) {
    if (main === other) continue;
    if (main.length < 5 || other.length < 5) continue;
    // Rejeter tout mot qui existe aussi comme mot commun (minuscule) dans le texte
    // Ex: "Faites", "Pardon", "Demain", "Prends" sont des mots courants, pas des noms propres
    if (commonWords.has(main) || commonWords.has(other)) continue;

    // Deux noms tous deux fréquents (≥3×) : comparer quand même si dist=1 (probable typo)
    const bothFrequent = proper[other] >= 3 && proper[main] >= 3;
    if (bothFrequent) {
      const distPre = _lev(main, other);
      if (distPre !== 1) continue;
    }

    const pairKey = [main, other].sort().join('|');
    if (seenPairs.has(pairKey)) continue;

    const la = main.toLowerCase(), lb = other.toLowerCase();
    const normalize = s => s
      .replace(/(?:iennes?|iens?|aines?|ain|ées?|ée|es|ue|us|ie|is|e|s|a)$/, '')
      .replace(/aux$/, 'al');
    const stemA = normalize(la);
    const stemB = normalize(lb);
    if (stemA === stemB || stemA === lb || stemB === la) continue;
    if (la.startsWith(lb) || lb.startsWith(la)) continue;

    const dist = _lev(main, other);
    const minLen = Math.min(main.length, other.length);

    // Seuil de distance adaptatif selon la longueur :
    //   ≤ 8 lettres → dist 1 max  (mots courts : moindre tolérance)
    //   ≥ 9 lettres → dist 2 max  (mots longs : une lettre de plus tolérée)
    const maxDist = minLen >= 9 ? 2 : 1;
    if (dist < 1 || dist > maxDist) continue;

    // Filtre préfixe : les deux premiers caractères doivent être identiques
    // "Clang" / "Charg" → "cl" ≠ "ch" → rejeté
    // "Selyn" / "Selyne" → "se" = "se" → accepté
    if (la.slice(0, 2) !== lb.slice(0, 2)) continue;

    // Filtre suffixe pour mots ≤ 6 lettres : rejeter si les 2 derniers chars sont complètement différents
    // Ex : "Klarg"/"Klard" (g≠d en finale + avant-dernière aussi différente) → rejeté
    // "Alric"/"Alrik" → la[-2:] = "ic" vs "ik" → distance 1 → accepté
    if (minLen <= 6 && la.slice(-2) !== lb.slice(-2) && _lev(la.slice(-2), lb.slice(-2)) > 1) continue;

    seenPairs.add(pairKey);
    // Choisir le nom le plus fréquent comme "forme de référence"
    const [ref, variant] = proper[main] >= proper[other] ? [main, other] : [other, main];
    issues.push({
      type:    'warning',
      text:    'Variation de nom',
      msg:     `« ${ref} » (${proper[ref]}×) et « ${variant} » (${proper[variant]}×) ressemblent au même personnage — vérifiez l'orthographe.`,
      suggest: [ref],
      raw:     variant,
      ctx:     `${ref} / ${variant}`,
      source:  'local',
      offset:  -1,
    });
  }
  return issues.slice(0, 8);
}

// ── Répétitions proches ───────────────────────────────────
// CORRECTIONS :
// - Longueur min réduite à 4 pour les mots "valables" courts (porte, gens, voix…)
// - Noms propres détectés et exclus → pas de FP sur les héros principaux
// - Verbes de dialogue courts inclus séparément (dit, fit, vit…)
// - Cap relevé à 12 alertes
// - Fenêtre adaptée : 20 mots pour mots courts, 30 pour mots longs
function checkRepetitions(text) {
  const issues = [];
  const alreadyReported = new Set();

  // 1. Extraire les noms propres du texte pour les exclure des répétitions
  //    (un héros doit apparaître souvent — c'est normal)
  const PROPER_NAMES = new Set();
  for (const m of text.matchAll(/\b([A-ZÁÀÂÉÈÊËÎÏÔÙÛÜŒÇ][a-záàâéèêëîïôùûüœç]{3,})\b/g))
    PROPER_NAMES.add(m[1].toLowerCase());

  // 2. Mots fonctionnels à ignorer (liste exhaustive)
  const STOP = new Set([
    'comme','cette','celui','celle','leurs','autres','toute','après',
    'avant','aussi','encore','même','moins','plus','très','bien','tout','mais','donc',
    'avoir','être','faire','quand','pour','dans','avec','sans','vers','dont','quoi',
    'autre','entre','lors','depuis','dedans','dehors','devant','derrière',
    'parce','tandis','lorsque','chaque','jamais','toujours','souvent','parfois',
    'cependant','pourtant','néanmoins','toutefois','quelque','quelques',
    'certain','certains','certaine','certaines','aucune','aucun',
    'plusieurs','beaucoup','tellement','vraiment','plutôt','assez',
    // Formes verbales fréquentes et neutres
    'était','avait','allait','venait','semblait','regardait','disait','faisait',
    'prenait','tenait','voyait','savait','pouvait','voulait','fallait','devait',
    'pouvaient','voulaient','savaient','venaient','allaient','semblaient',
    // Pronoms, articles, prépositions (doublons 'leurs' supprimés)
    'notre','votre','elles','nous','vous','ils',
    // Formes du verbe "dire" courantes dans les dialogues
    'répondit','demanda','murmura','soupira','continua','reprit','ajouta',
    // Mots corporels/sensoriels très normaux dans la fiction — une scène peut
    // légitimement utiliser "visage", "épaules", "lèvres" plusieurs fois
    'visage','regard','yeux','mains','épaules','lèvres','souffle','silence',
    'instant','moment','soudain','semble','marbre','pierre','ombre','ombres',
    'lumière','panique','pensée','pensées','choses','chose','imagines','imagine',
    'entendu','dernière','dernier','première','premier','longtemps','bientôt','maintenant',
    // Note : 'encore','toujours','jamais','parfois','souvent' déjà présents plus haut
  ]);

  // 3a. Analyse des mots longs (≥ 6 lettres, hors noms propres)
  // BUG FIX : regex tenant compte des caractères accentués en début de mot
  // \b ne reconnaît pas é/è etc. → utiliser lookbehind pour éviter "taient" depuis "étaient"
  const words6raw = text.match(/(?<![a-zA-ZàâéèêëîïôùûüœçÀÂÉÈÊËÎÏÔÙÛÜŒÇ])[a-zàâéèêëîïôùûüœç]{6,}(?![a-zA-ZàâéèêëîïôùûüœçÀÂÉÈÊËÎÏÔÙÛÜŒÇ])/g) || [];
  const words6 = words6raw.map(w => w.toLowerCase());
  const seen6 = {};
  words6.forEach((w, i) => {
    if (STOP.has(w)) return;
    if (PROPER_NAMES.has(w)) return; // BUG 2 FIX : ne pas signaler les héros
    if (seen6[w] !== undefined && i - seen6[w] < 200) {  // fenêtre 200 mots — la fiction répète légitimement un mot dans la même scène
      if (!alreadyReported.has(w) && issues.length < 12) {
        alreadyReported.add(w);
        issues.push({
          type: 'style', text: 'Répétition proche',
          msg: `« ${w} » revient deux fois en peu de mots. Variez le vocabulaire.`,
          suggest: [], raw: w, ctx: w, source: 'local', offset: -1,
        });
      }
      delete seen6[w];
    } else { seen6[w] = i; }
  });

  // 3b. Mots courts significatifs (4-5L) — liste blanche curatée
  //     Uniquement les mots dont la répétition proche a vraiment du sens à signaler
  const SHORT_WORTH = new Set([
    'porte','yeux','main','mains','voix','peur','nuit','jour','ciel','murs',
    'soir','bras','corps','tête','lieu','sang','mort','feux','feu','cœur',
    'vent','pluie','eau','air','terre','sort','gens','lune','sol',
    'mots','vue','dos','cou','bout','seuil','bruit','poids',
  ]);
  // BUG 3 FIX : verbes de dialogue courts fréquemment répétés
  const DIALOGUE_VERBS = new Set(['dit']);
  // Même fix regex que words6 : éviter les troncatures sur mots accentués
  const words4raw = text.match(/(?<![a-zA-ZàâéèêëîïôùûüœçÀÂÉÈÊËÎÏÔÙÛÜŒÇ])[a-zàâéèêëîïôùûüœç]{3,5}(?![a-zA-ZàâéèêëîïôùûüœçÀÂÉÈÊËÎÏÔÙÛÜŒÇ])/g) || [];
  const words4 = words4raw.map(w => w.toLowerCase());
  const seen4 = {};
  words4.forEach((w, i) => {
    if (!SHORT_WORTH.has(w) && !DIALOGUE_VERBS.has(w)) return;
    if (alreadyReported.has(w)) return;
    if (seen4[w] !== undefined && i - seen4[w] < 25) {  // fenêtre 18→25 mots pour fiction
      if (issues.length < 12) {
        alreadyReported.add(w);
        const label = DIALOGUE_VERBS.has(w)
          ? `Le verbe de dialogue « ${w} » revient trop souvent. Alternez : souffla, murmura, lança…`
          : `« ${w} » revient deux fois en peu de mots. Variez le vocabulaire.`;
        issues.push({
          type: 'style', text: 'Répétition proche',
          msg: label,
          suggest: [], raw: w, ctx: w, source: 'local', offset: -1,
        });
      }
      delete seen4[w];
    } else { seen4[w] = i; }
  });

  return issues;
}

// Clichés littéraires — uniquement les formules vraiment usées et évitables.
// On retire les expressions normales en fiction : "malgré lui", "une sorte de",
// "sans s'en rendre compte" sont des tournures courantes, pas des clichés rédhibitoires.
const CLICHES_LOCAUX = [
  'silence de mort',
  'comme si le temps s\'était arrêté',
  'le cœur battant la chamade',
  'un frisson lui parcourut l\'échine',
  'le sang se glaça dans ses veines',
  'les larmes coulèrent sur ses joues',
  'son cœur se serra',
  'une boule dans la gorge',
  'le temps sembla s\'arrêter',
  'retenir son souffle',
  'le regard perdu dans le vide',
  'beau comme un dieu',
  'belle comme une déesse',
  'pâle comme un linge',
  'noir comme l\'ébène',
  'les larmes aux yeux',
  'un sourire qui illuminait son visage',
  'ses yeux brillaient de larmes',
  'le destin en avait décidé autrement',
  'c\'était écrit',
  'le sort en était jeté',
  'quelque chose d\'indéfinissable',
  'comme dans un rêve',
  'comme dans un cauchemar',
];

function checkCliches(text) {
  const issues = [];
  const lc = text.toLowerCase();
  for (const c of CLICHES_LOCAUX) {
    if (lc.includes(c) && issues.length < 12) // BUG 6 FIX : cap relevé 6→12
      issues.push({
        type: 'style',
        text: 'Cliché littéraire',
        msg:  `« ${c} » est une formule usée — recherchez une image plus originale.`,
        suggest: [],
        raw: c,
        ctx: c,
        source: 'local',
        offset: -1,
      });
  }
  return issues;
}

// ── LanguageTool : appel API ──────────────────────────────
// CORS ouvert sur api.languagetool.org — fonctionne depuis le navigateur sans clé
// ══════════════════════════════════════════════════════════
// ── RÈGLES LT DYNAMIQUES — générées depuis la Fiche Œuvre ─
// Chaque projet calcule SES règles au moment de l'appel.
// Aucune règle n'est hardcodée pour une œuvre future.
// ══════════════════════════════════════════════════════════
// ── Langue du manuscrit → code LanguageTool ──────────────
// Convention identique au moteur d'autocorrection : la langue de correction est
// pilotée par le sélecteur de langue du projet (ui_lang). Le finnois et le
// hongrois ne sont pas couverts par l'API publique LanguageTool → null
// (le correcteur LT est désactivé proprement ; l'autocorrection locale reste active).
const LT_LANG_CODES = { fr:'fr', en:'en-US', es:'es', de:'de-DE', it:'it', pt:'pt-PT', ru:'ru-RU', da:'da-DK', el:'el-GR', fi:null, hu:null };
// Règle du vérificateur orthographique LT par langue (IDs officiels).
const LT_SPELLER_RULES = {
  fr: ['MORFOLOGIK_RULE_FR'],
  en: ['MORFOLOGIK_RULE_EN_US','MORFOLOGIK_RULE_EN_GB'],
  es: ['MORFOLOGIK_RULE_ES'],
  de: ['GERMAN_SPELLER_RULE'],
  it: ['MORFOLOGIK_RULE_IT_IT'],
  pt: ['MORFOLOGIK_RULE_PT_PT','MORFOLOGIK_RULE_PT_BR'],
  ru: ['MORFOLOGIK_RULE_RU_RU'],
  da: ['MORFOLOGIK_RULE_DA_DK'],
  el: ['MORFOLOGIK_RULE_EL_GR'],
};
function _ltManuscriptLang() {
  const l = (typeof getPref === 'function') ? (getPref('ui_lang') || 'fr') : 'fr';
  return Object.prototype.hasOwnProperty.call(LT_LANG_CODES, l) ? l : 'fr';
}
function _ltApiCode() {
  const c = LT_LANG_CODES[_ltManuscriptLang()];
  return (c === undefined) ? 'fr' : c;
}

function buildLtParams() {
  const appLang = _ltManuscriptLang();
  const disabledRules      = new Set(['WHITESPACE_RULE','COMMA_PARENTHESIS_WHITESPACE']);
  if (appLang === 'fr') disabledRules.add('FRENCH_WHITESPACE');
  const disabledCategories = new Set();

  // Mots à ignorer : noms de personnages + lieux (centralisé)
  const wordsToIgnore = getKnownProperWords();

  // ── Règles conditionnelles selon la Fiche Œuvre ──────────
  const temps     = getDomVal('oeuvre-temps');
  const registre  = getDomVal('oeuvre-registre');
  const narration = getDomVal('oeuvre-narration');
  const genre     = getDomVal('oeuvre-genre');
  const epoque    = getDomVal('oeuvre-epoque');
  const type      = getDomVal('oeuvre-type');

  if (temps.includes('Passé simple') || temps.includes('Mélange')) {
    disabledRules.add('AGREEMENT_VERB_SUBJECT');
    if (appLang === 'fr') disabledRules.add('FR_AGREEMENT_VERB');
    disabledRules.add('VERB_TENSE_ERROR');
  }
  if (temps.includes('Présent')) {
    disabledRules.add('VERB_TENSE_ERROR');
  }
  if (registre.includes('Archaïsant') || epoque.includes('Moyen Âge') || epoque.includes('Antiquité') || epoque.includes('Renaissance')) {
    disabledRules.add('ARCHAIC_WORD');
    disabledRules.add('REGISTER_SHIFT');
    disabledCategories.add('STYLE');
    disabledCategories.add('REDUNDANCY');
  }
  if (registre.includes('Familier') || registre.includes('Argotique')) {
    disabledCategories.add('STYLE');
    disabledRules.add('REGISTER_SHIFT');
    if (appLang === 'fr') disabledRules.add('FR_INFORMAL_SPEECH');
  }
  if (narration.includes('non-fiable')) {
    disabledRules.add('VERB_TENSE_ERROR');
    disabledRules.add('INCONSISTENCY');
  }
  if (narration.includes('multiple')) {
    disabledRules.add('INCONSISTENCY');
  }
  const isCreativeFiction = ['Roman','Nouvelle','Novella','Recueil','Scénario'].some(t => type.includes(t));
  if (isCreativeFiction) {
    (LT_SPELLER_RULES[appLang] || []).forEach(r => disabledRules.add(r));
  }
  const isSpeculative = ['Fantasy','Science-Fiction','Space Opera','Cyberpunk','Steampunk',
    'Post-apocalyptique','Dystopie','Uchronie','Fantastique','Gothique','Horreur'].some(g => genre.includes(g));
  if (isSpeculative) {
    (LT_SPELLER_RULES[appLang] || []).forEach(r => disabledRules.add(r));
    disabledRules.add('SPELLING_RULE');
    disabledRules.add('HUNSPELL_RULE');
  }

  return {
    disabledRules:      [...disabledRules].join(','),
    disabledCategories: [...disabledCategories].join(','),
    wordsToIgnore:      [...wordsToIgnore].join(','),
  };
}

// ── Filtrage post-LT selon la Fiche Œuvre ────────────────
// Supprime les issues que LT retourne malgré les règles désactivées,
// en fonction du contexte de l'œuvre. Chaque filtre est conditionnel.
function ltPostFilter(issues) {
  const registre  = getDomVal('oeuvre-registre');
  const epoque    = getDomVal('oeuvre-epoque');
  const genre     = getDomVal('oeuvre-genre');
  const narration = getDomVal('oeuvre-narration');

  // Noms propres connus (personnages + lieux) — centralisé
  const persoNames = getKnownProperWords();

  return issues.filter(issue => {
    // Nettoyer la ponctuation autour du mot signalé pour la comparaison
    const raw     = (issue.raw || '').toLowerCase().replace(/[^\p{L}]/gu, '').trim();
    const ruleId  = (issue.ruleId || '');
    const issueType = (issue.type || '');

    // Exclure si le mot (ou l'un de ses sous-mots en cas de nom composé) est un nom connu
    if (persoNames.size > 0) {
      if (persoNames.has(raw)) return false;
      // Cas nom composé signalé en entier : "Roi Aldren" → chaque mot individuellement
      const subWords = (issue.raw || '').toLowerCase().split(/[\s\-]+/)
        .map(w => w.replace(/[^\p{L}]/gu, ''));
      if (subWords.length > 1 && subWords.every(w => !w || persoNames.has(w))) return false;
    }

    if ((registre.includes('Archaïsant') || epoque.includes('Moyen Âge') ||
         epoque.includes('Antiquité') || epoque.includes('Renaissance')) &&
        (issueType === 'style' || ruleId.includes('STYLE') || ruleId.includes('REGISTER'))) {
      return false;
    }

    if ((registre.includes('Familier') || registre.includes('Argotique')) &&
        (issueType === 'style' || ruleId.includes('REGISTER') || ruleId.includes('INFORMAL'))) {
      return false;
    }

    const isSpeculative = ['Fantasy','Science-Fiction','Space Opera','Cyberpunk','Steampunk',
      'Post-apocalyptique','Dystopie','Uchronie','Fantastique','Horreur'].some(g => genre.includes(g));
    if (isSpeculative && ruleId.includes('MORFOLOGIK') && raw.length <= 12) return false;

    return true;
  });
}

async function callLanguageTool(text) {
  // Découpage en segments <= LT_MAX (limite API publique) sur des frontières de
  // paragraphe/phrase, offsets agrégés. Au-delà de LT_CHUNKS_MAX segments
  // (courtoisie vis-à-vis de l'API gratuite), le reste est signalé « tronqué ».
  const LT_MAX = 20000;
  const LT_CHUNKS_MAX = 5;
  const chunks = [];
  let _pos = 0;
  while (_pos < text.length && chunks.length < LT_CHUNKS_MAX) {
    let end = Math.min(_pos + LT_MAX, text.length);
    if (end < text.length) {
      const win = text.slice(_pos, end);
      let cut = Math.max(win.lastIndexOf('\n\n'), win.lastIndexOf('\n'));
      if (cut < LT_MAX * 0.5) cut = Math.max(win.lastIndexOf('. '), win.lastIndexOf('! '), win.lastIndexOf('? '));
      if (cut >= LT_MAX * 0.5) end = _pos + cut + 1;
    }
    chunks.push({ start: _pos, text: text.slice(_pos, end) });
    _pos = end;
  }
  const truncated = _pos < text.length;

  // Langue du manuscrit (pilotée par le sélecteur de langue du projet).
  const ltCode = _ltApiCode();
  if (!ltCode) {
    const _m = (typeof _t === 'function') ? _t('lt_lang_unsupported') : null;
    return { error: (_m && _m !== 'lt_lang_unsupported') ? _m : "cette langue n'est pas encore prise en charge par LanguageTool — l'autocorrection locale reste disponible.", unsupported: true };
  }

  const ltParams = buildLtParams();
  const allMatches = [];
  try {
    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 600)); // rythme : API publique
      const params = {
        text:          chunks[i].text,
        language:      ltCode,
        enabledOnly:   'false',
        disabledRules: ltParams.disabledRules,
      };
      if (ltParams.disabledCategories) params.disabledCategories = ltParams.disabledCategories;
      // Liste blanche des noms propres connus (niveau API, avant filtrage local)
      if (ltParams.wordsToIgnore) params.words = ltParams.wordsToIgnore;

      const res = await fetch('https://api.languagetool.org/v2/check', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams(params).toString(),
      });
      if (!res.ok) {
        // 1er segment en échec -> erreur franche ; sinon on garde l'acquis.
        if (i === 0) throw new Error('HTTP ' + res.status);
        console.warn('LanguageTool : segment ' + (i + 1) + ' ignoré (HTTP ' + res.status + ')');
        break;
      }
      const data = await res.json();
      (data.matches || []).forEach(m => {
        m.offset += chunks[i].start;   // offset GLOBAL dans le texte complet
        m._globalOffset = m.offset;
        allMatches.push(m);
      });
    }
    return { matches: allMatches, truncated };
  } catch(e) {
    console.warn('LanguageTool error:', e.message);
    return { error: 'LanguageTool inaccessible : ' + e.message };
  }
}

// ── LanguageTool : convertir les matches en issues ────────
function ltMatchesToIssues(matches, originalText) {
  // Catégorisation précise par issueType et ruleId
  const TYPE_MAP = {
    misspelling:         'error',
    grammar:             'error',
    typographical:       'typo',
    style:               'style',
    locale_violation:    'warning',
    register:            'style',
    duplication:         'style',
    inconsistency:       'warning',
    uncategorized:       'warning',
  };

  // AUDIT FIX : trier par priorité (erreurs > typos > style > warnings) avant de tronquer
  const PRIORITY = { misspelling: 0, grammar: 0, typographical: 1, style: 2, register: 2, duplication: 2, locale_violation: 3, inconsistency: 3, uncategorized: 3 };
  const sorted = [...matches].sort((a, b) => {
    const pa = PRIORITY[a.rule?.issueType] ?? 3;
    const pb = PRIORITY[b.rule?.issueType] ?? 3;
    return pa - pb;
  });
  return sorted.slice(0, 50).map(m => {
    const issueType = m.rule?.issueType || 'uncategorized';
    const type = TYPE_MAP[issueType] || 'warning';

    // Contexte : extraire le mot fautif depuis le texte original via la position globale
    const globalOff = m._globalOffset ?? m.offset;
    const raw = originalText.slice(globalOff, globalOff + m.length) || m.context?.text?.slice(m.context.offset, m.context.offset + m.context.length) || '';

    // Contexte élargi autour de l'erreur
    const ctxStart = Math.max(0, globalOff - 20);
    const ctxEnd   = Math.min(originalText.length, globalOff + m.length + 20);
    const ctx      = originalText.slice(ctxStart, ctxEnd).trim();

    return {
      type,
      text:    m.rule?.description || m.shortMessage || 'Erreur',
      msg:     m.message || '',
      ctx,
      raw,
      suggest: (m.replacements || []).slice(0, 4).map(r => r.value),
      source:  'LanguageTool',
      offset:  globalOff,
      length:  m.length,
      ruleId:  m.rule?.id || '',
    };
  });
}

// ── Règles locales combinées ──────────────────────────────
function localLiteraryChecks(text) {
  // FIX 8: nettoyage complet avant analyse
  // Supprimer balises image, sauts de scène ET titres de chapitre (lignes isolées courtes)
  const clean = cleanForAnalysis(text)
    .split('\n')
    .filter(line => {
      const t = line.trim();
      // Exclure les lignes de titre isolées (<=60 chars, sans ponctuation de fin, sans espace interne → un seul mot ou sigle)
      // AUDIT FIX : on exige l'absence d'espace pour ne pas filtrer les courtes répliques
      if (t.length <= 60 && !t.includes(' ') && /^[A-ZÁÀÂÉÈÊËÎÏÔÙÛÜŒÇ—\-–—\d\.IVX«]{1}/.test(t) && !/[.!?:,]$/.test(t)) return false;
      return true;
    })
    .join('\n');

  return [
    ...checkCliches(clean),
    ...checkRepetitions(clean),
    ...checkCharacterNames(clean),
  ];
}

// ── Auto-correction avec prévisualisation ─────────────────
// FIX 6: afficher ce qui sera modifié avant d'appliquer
function runAutoFix() {
  const ta   = document.getElementById('raw-input');
  const text = ta.value;

  // Calculer chaque correction et son nombre d'occurrences
  const RULES = [
    {
      label: '"..." → "…" (points de suspension)',
      apply: t => t.replace(/\.\.\.(?!\.)/g, '…'),
      count: t => (t.match(/\.\.\.(?!\.)/g)||[]).length,
    },
    {
      label: '"x" → « x » (guillemets français)',
      apply: t => t.replace(/"([^"\n]{1,200})"/g, (_, i) => `\u00ab\u00a0${i}\u00a0\u00bb`),
      count: t => (t.match(/"[^"\n]{1,200}"/g)||[]).length,
    },
    {
      label: '"-" → "—" (tiret de dialogue)',
      apply: t => t.replace(/^-(?!-)\s*([A-ZÁÀÂÉÈÊËÎÏÔÙÛÜŒÇ«])/mg, (_, f) => `— ${f}`),
      count: t => (t.match(/^-(?!-)\s*[A-ZÁÀÂÉÈÊËÎÏÔÙÛÜŒÇ«]/mg)||[]).length,
    },
    {
      label: 'Doubles espaces supprimés',
      apply: t => t.replace(/  +/g, ' '),
      count: t => (t.match(/  +/g)||[]).reduce((s,m) => s+m.length-1, 0),
    },
    {
      label: 'Espace insécable avant : ; ! ?',
      apply: t => t.replace(/(?<=\S) ([:;!?])/g, (_, p) => ` ${p}`),
      count: t => (t.match(/(?<=\S) [:;!?]/g)||[]).length,
    },
  ];

  const applicable = RULES.map(r => ({ ...r, n: r.count(text) })).filter(r => r.n > 0);
  const total = applicable.reduce((s, r) => s + r.n, 0);

  if (!applicable.length) {
    showToast(_t('toast_typo_ok'), 3000, 'ok');
    return;
  }

  const listHTML = applicable.map(r =>
    `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--cream);font-size:12px;gap:10px;">
      <span style="color:var(--ink);">${r.label}</span>
      <span style="color:var(--gold);font-weight:600;flex-shrink:0;">${r.n}×</span>
    </div>`
  ).join('');

  showConfirm(
    `⚡ Auto-correction — ${total} modification${total>1?'s':''}`,
    `<div style="margin:8px 0;">${listHTML}</div>
     <div style="font-size:11px;color:var(--ink-muted);margin-top:8px;font-style:italic;">
       Ces corrections sont appliquées à l'ensemble du texte. Cette action peut être annulée par Ctrl+Z.
     </div>`,
    () => {
      let t = text;
      applicable.forEach(r => { t = r.apply(t); });
      taWrite(ta, t);
      onRawInput();
      markUnsaved();
      showToast(_t('toast_typo_done').replace('{n}', total).replace(/\{s\}/g, total>1?'s':''), 3000, 'ok');
    }
  );
}

// ══════════════════════════════════════════════════════════
// ONGLET STATS AVANCÉES — 100% offline
// ══════════════════════════════════════════════════════════

// Lexique émotionnel français (~200 mots)
// ── Lexique émotionnel — 4 niveaux de détection ──────────
// 1. Noms d'émotions abstraites (haut niveau)
const LEXIQUE_EMOTIONS_NOMS = new Set([
  'terreur','effroi','angoisse','panique','peur','crainte','frayeur','horreur','épouvante','appréhension',
  'joie','bonheur','extase','euphorie','allégresse','jubilation','enchantement','ravissement','félicité','béatitude',
  'tristesse','chagrin','mélancolie','désespoir','douleur','peine','affliction','abattement','accablement','détresse',
  'colère','fureur','rage','courroux','indignation','irritation','exaspération','véhémence','furie','emportement',
  'amour','tendresse','passion','désir','adoration','affection','dévotion','nostalgie','solitude','abandon',
  'honte','culpabilité','remords','humiliation','embarras','confusion','gêne','pudeur',
  'orgueil','fierté','arrogance','mépris','dédain','suffisance',
  'surprise','stupeur','saisissement','ébahissement','incrédulité','stupéfaction',
  'dégoût','répugnance','écœurement','nausée',
  'jalousie','envie','convoitise','rancœur','amertume','ressentiment',
  'espoir','attente','confiance','foi','enthousiasme','ardeur','ferveur',
  'souffrance','tourment','supplice','agonie','martyre','blessure','plaie',
  'lassitude','épuisement','découragement','résignation','capitulation',
  'soulagement','apaisement','réconfort','gratitude','reconnaissance',
  'curiosité','fascination','émerveillement','admiration','vénération',
  'méfiance','suspicion','doute','incertitude','hésitation','ambivalence',
  'ennui','indifférence','apathie','torpeur','vide','néant',
  'excitation','frénésie','impatience','nervosité','agitation','fébrilité',
  // Ajouts v41 — états narratifs fréquents
  'silence','immensité','écho','souffle','murmure','vertige','ivresse','fièvre',
  'effondrements','révérence','présence','absence','attente','brisure','fissure',
]);

// 2. Verbes d'état intérieur et de perception émotionnelle (formes de base)
// La détection se fait par correspondance de racine (startsWith)
const LEXIQUE_EMOTIONS_VERBES_RACINES = [
  // Ressentir / percevoir
  'ressent','éprouv','ressen','percev','vivait','vivant',
  // Souffrir / peiner
  'souffr','gémiss','sanglot','pleur','lament',
  // Craindre / trembler
  'crain','trembl','frémiss','frisson','frissonn','redout','appréhend',
  // Aimer / désirer
  'aim','désir','brûl','languis','aspir','chéri','adorait','adorant',
  // Détester / haïr
  'détèst','haïss','abhorr','abomit','exècr',
  // Espérer / désespérer
  'espèr','espérait','désespèr','désespérait','suppli',
  // Colère / s'emporter
  'emport','explos','fulmin','ragit','bouillait','bouillant',
  // Sourire / rire / pleurer
  'sourit','sourir','souriait','riait','pleurait','pleurant',
  // Soupirer / gémir
  'soupir','gémir','gémit','gémissait',
  // Hésiter / douter
  'hésit','doutait','doutant','tergiversait',
  // Rougir / pâlir (manifestations)
  'rougit','rougissait','pâlit','pâlissait','blêmit','blêmissait',
  // Verbes de rupture / effondrement intérieur — v41
  'effondra','écroula','chancela','vacilla','fléchit','cédèrent','céda',
  'figea','pétrifia','paralysa','immobilisa','raidit','crispa','contracta',
  'recula','agrippa','étreignit','serra','étreindr','serrait',
  'haletait','haletant','suffoquait','suffoquant','ravala','déglutit',
  'tressaillit','tressaillait','frémissait','frémissant',
  'sanglotait','sanglotant','larmoiait','renifla',
  'contemplait','contempla','observait','scrutait','dévisageait',
  'demeura','demeurait','demeuraient','restait','resta','resta',
  'attendit','attendait','compta','recompta',
  'releva','baissa','détourna','ferma','ouvrit','rouvrit',
  'retint','réprima','étouffa','dissimula','masqua',
  'mord','mordit','mordait','griffa','griffait','pinça','pinçait',
  'chancela','tanguait','oscillait','titubait',
];

// 3. Marqueurs corporels d'émotion (noms + verbes de réaction physique)
// IMPORTANT v41 : on stocke ici les RACINES de mots (sans apostrophe) car le tokeniseur
// découpe sur \b et ignore les apostrophes. "s'effondra" → token "effondra".
const LEXIQUE_EMOTIONS_CORPS = new Set([
  // Manifestations physiques — noms
  'larme','larmes','pleurs','sanglot','sanglots','soupir','soupirs',
  'frisson','frissons','frémissement','frémissements','tremblement','tremblements',
  'rire','sourire','grimace','grimaces','rictus','crispation','contraction',
  'sueur','sueurs','gorge','serrement','étreinte','poids',
  'battement','battements','palpitation','palpitations','vertiges','vertige',
  'nausée','chaleur','froid','souffle','souffles',
  // Corps — zones physiques évocatrices
  'cœur','poitrine','ventre','entrailles','nuque','mâchoire','tempes','épaules',
  'mains','jambes','genoux','doigts','lèvres','yeux','regard',
  // Verbes corporels — formes sans apostrophe (tokeniseur coupe sur ')
  'effondra','écroula','figea','raidit','contracta','crispa',
  'chancela','vacilla','recula','agrippa','étreignit','serra',
  'haletait','haletant','suffoquait','suffoquant','ravala','déglutit',
  'tressaillit','tressaillait','frémissait','frémissant',
  'tremblait','tremblant','frissonnait','frissonnant',
  'rougit','pâlit','blêmit','blêmissait','ruisselait',
  'mordait','pinçait','griffait','crispait',
  'chancela','tituba','tanguait','oscillait',
  'cédèrent','fléchit','ploya','ployait','ployèrent',
  'noua','nouait','tordait','tordait','serrait',
  'hoqueta','hoquetait','bégaya','bégayait','balbutia','balbutiait',
  // Adjectifs corporels d'état — v41
  'pétrifiée','pétrifié','paralysée','paralysé','figée','figé',
  'rivés','rivées','rivé','rivée','clouée','cloué','enchaînée','enchaîné',
  'tremblantes','tremblants','tremblante','tremblant',
  'crispées','crispés','crispée','crispé',
  'glacée','glacé','glacées','glacés',
  'brisées','brisés','brisée','brisé',
  'noués','nouées','nouée','noué',
]);

// 4. Adjectifs et participes de ressenti intérieur
const LEXIQUE_EMOTIONS_ADJ = new Set([
  // États émotionnels adjectivaux
  'épuisé','épuisée','brisé','brisée','anéanti','anéantie','meurtri','meurtrie',
  'apeuré','apeurée','terrifié','terrifiée','affolé','affolée','paniqué','paniquée',
  'soulagé','soulagée','apaisé','apaisée','serein','sereine','tranquille',
  'troublé','troublée','bouleversé','bouleversée','ébranlé','ébranlée',
  'furieux','furieuse','enragé','enragée','exaspéré','exaspérée','excédé','excédée',
  'abattu','abattue','accablé','accablée','désespéré','désespérée','prostré','prostrée',
  'ému','émue','touché','touchée','attendri','attendrie',
  'honteux','honteuse','coupable','humilié','humiliée','mortifié','mortifiée',
  'fier','fière','souverain','souveraine','triomphant','triomphante',
  'anxieux','anxieuse','inquiet','inquiète','fébrile','tendu','tendue','crispé','crispée',
  'nostalgique','mélancolique','morose','sombre','lugubre','sinistre',
  'émerveillé','émerveillée','fasciné','fascinée','captivé','captivée',
  'dégoûté','dégoûtée','écœuré','écœurée','révulsé','révulsée',
  'jaloux','jalouse','envieux','envieuse','possessif','possessive',
  'résigné','résignée','las','lasse','découragé','découragée','vaincu','vaincue',
  'impatient','impatiente','excité','excitée','électrisé','électrisée',
  'libéré','libérée','délesté','délestée',
  'seul','isolé','isolée','abandonné','abandonnée','rejeté','rejetée',
  'amer','amère','rancunier','rancunière','aigri','aigrie',
  // Ajouts v41 — états descriptifs courants en fiction littéraire
  'pétrifiée','pétrifié','paralysée','paralysé','figée','figé','immobile',
  'rivés','rivées','rivé','rivée','clouée','cloué','enchaînée','enchaîné',
  'tremblantes','tremblants','tremblante','tremblant',
  'glacée','glacé','glacées','glacés','glacial','glaciale',
  'brisées','brisés','noués','nouées','contractées','contractés',
  'hagard','hagarde','hébété','hébétée','sonné','sonnée','abasourdi','abasourdie',
  'muet','muette','sans voix','interdit','interdite','stupéfait','stupéfaite',
  'livide','blême','blafard','blafarde','cadavérique',
  'crispé','crispée','noué','nouée','serré','serrée',
  'effondré','effondrée','prostré','prostrée','accablé','accablée',
  'douloureux','douloureuse','lancinant','lancinante','poignant','poignante',
  'silencieux','silencieuse','immobile','immobiles','figé','figée',
  'seule','solitaire','perdu','perdue','égaré','égarée','naufragé','naufragée',
  'lourd','lourde','pesant','pesante','écrasant','écrasante',
  'vide','vides','creux','creuse','vain','vaine',
  'absolu','absolue','total','totale','entier','entière',
]);

// 5. Expressions descriptives d'état — v41 (phrases-patterns détectés dans le texte brut)
// Ces patterns capturent les tournures littéraires que les lexiques de mots isolés ratent.
// On les teste sur le texte AVANT tokenisation.
const PATTERNS_ETAT_DESCRIPTIF = [
  // Immobilité / pétrification
  /demeura\s+\w+(?:ée?|és?)/gi,          // "demeura pétrifiée", "demeura immobile"
  /resta\s+\w+(?:ée?|és?)/gi,             // "resta figée"
  /se\s+(?:figea|pétrifia|paralysa|raidit|contracta|crispa)/gi,
  /ne\s+(?:pouvait|put|parvenait|parvint)\s+(?:plus\s+)?(?:bouger|parler|respirer|crier|fuir|avancer)/gi,
  // Effondrement physique / chute
  /(?:jambes?|genoux|corps)\s+(?:cédèrent?|fléchit|ploya|tremblaient?|faillirent?)/gi,
  /s['']\s*effondra/gi,
  /s['']\s*écroula/gi,
  /tomba\s+(?:à\s+genoux|par\s+terre|à\s+terre)/gi,
  /(?:genoux?|mains?)\s+(?:à\s+terre|tremblantes?|tremblants?)/gi,
  // Regard / yeux comme marqueurs d'état
  /yeux\s+(?:rivés?|rivées?|cloués?|perdus?|vides?|écarquillés?|baignés?\s+de|brillants?\s+de|noyés?\s+de)/gi,
  /regard\s+(?:vide|perdu|égaré|sombre|brillant|noyé|chargé)/gi,
  /les\s+yeux\s+(?:fermés?|clos|baissés?|levés?|détournés?)/gi,
  // Silence / absence comme état émotionnel
  /le\s+silence\s+(?:demeurait?|régnait?|pesait?|s['']\s*abattit|tombait?|était\s+(?:absolu|total|lourd|pesant))/gi,
  /plus\s+(?:un\s+son|un\s+mot|un\s+bruit|une\s+voix|de\s+pas)/gi,
  /n['']\s*(?:était|fut)\s+plus\s+là/gi,
  /était\s+seule?\s+(?:dans|au|en)/gi,
  // Comptage / attente comme angoisse
  /compta\s+jusqu['']\s*à/gi,
  /attendit\s+(?:sans|que|longtemps)/gi,
  // Mains / corps tremblants
  /mains\s+tremblantes?/gi,
  /voix\s+(?:tremblante?|brisée?|étranglée?|blanche|blanche)/gi,
  /souffle\s+(?:court|coupé|retenu|bloqué|haletant)/gi,
  // Retenir / réprimer une émotion
  /retint\s+(?:un\s+)?(?:cri|larme|sanglot|souffle|soupir)/gi,
  /(?:réprima|étouffa|ravala|dissimula)\s+(?:un\s+)?(?:cri|sanglot|larme|soupir|frisson)/gi,
  // Déchirement intérieur
  /quelque\s+chose\s+(?:se\s+brisa|se\s+déchira|se\s+noua|se\s+serra)\s+(?:en\s+(?:elle|lui|eux)|dans\s+(?:sa|son))/gi,
  /(?:son|sa|le|la)\s+(?:cœur|poitrine|gorge|ventre)\s+(?:se\s+serra|se\s+noua|se\s+contracta|se\s+déchira|battit|cogna|s['']\s*emballa|se\s+souleva)/gi,
];

// Compte les patterns d'état descriptif dans le texte brut (avant tokenisation)
function countDescriptifPatterns(text) {
  let count = 0;
  for (const pat of PATTERNS_ETAT_DESCRIPTIF) {
    const matches = text.match(pat);
    if (matches) count += matches.length;
    // Reset lastIndex pour les regex globales
    pat.lastIndex = 0;
  }
  return count;
}

// Correspondance — détecter les verbes par leur racine
function matchesVerbRacine(word) {
  const lw = word.toLowerCase();
  for (const racine of LEXIQUE_EMOTIONS_VERBES_RACINES) {
    if (lw.startsWith(racine) || lw === racine) return true;
  }
  return false;
}

function runStatsAnalysis() {
  const res    = document.getElementById('wt-stats-results');
  const btn    = document.getElementById('wt-btn-stats');
  const rawText = getDomVal('raw-input').trim();
  if (!rawText) { showToast(_t('toast_no_text')); return; }

  // Réinitialiser le tableau des locators (paragraphes longs, lignes POV)
  window._statsLocators = [];

  btn.disabled = true;

  try {
    const cleanText = rawText.replace(/\[IMAGE:[^\]]*\]/gi, '').replace(/\[NOTE:[^\]]*\]/gi, '').replace(/\[HL:\w+\s([^\|]*?)(?:\|[^\]]*)?\]/gi, '$1').replace(/\[TAG:\w+\s([^\]]*)\]/gi, '$1');
    const lines     = cleanText.split('\n');
    // Découpe robuste pour roman :
    // – On NE split PAS sur '…' en milieu de dialogue (trop fragmentant)
    // – On split sur [.!?] suivi d'un espace + majuscule OU début de réplique —
    // – On ignore les lignes de dialogue courtes (< 4 mots) pour le calcul de longueur moyenne
    // – v50 FIX : les séparateurs (* * *, lignes vides, entêtes sans ponctuation)
    //   sont normalisés en ". " pour éviter qu'ils fusionnent des phrases distinctes.
    const _normText = cleanText
      .replace(/^\s*[\*\·\-]{1,}\s*([\*\·\-]\s*){1,}$/mg, '.')  // * * * → .
      .replace(/\n{2,}/g, '.\n');                                  // double saut de ligne → .
    const sentenceRaw = _normText
      .split(/(?<=[.!?])\s+(?=[A-ZÁÀÂÉÈÊËÎÏÔÙÛÜŒÇ—«])|(?<=[.!?])\s*\n+\s*(?=[A-ZÁÀÂÉÈÊËÎÏÔÙÛÜŒÇ—«"\-])/)
      .map(s => s.trim())
      .filter(s => s.length > 8);
    // Exclure les répliques ultra-courtes (< 4 mots) du calcul de moyenne
    const sentences = sentenceRaw;
    const sentencesForAvg = sentenceRaw.filter(s => s.split(/\s+/).length >= 5);  // exclure les répliques courtes du calcul
    const words     = cleanText.match(/\b[a-zA-ZàâéèêëîïôùûüœçÀÂÉÈÊËÎÏÔÙÛÜŒÇ]{2,}\b/g) || [];
    const paras     = cleanText.split(/\n{2,}/).filter(p => p.trim().length > 0);

    // ── Richesse lexicale (MATTR) ───────────────────────
    // AUDIT FIX : TTR brut invalide sur textes longs (décroît par loi de Zipf).
    // On utilise le Moving-Average TTR (fenêtres de 500 mots) qui est stable
    // quelle que soit la longueur du texte.
    const totalWords  = words.length;
    const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
    const MATTR_WIN = 500;
    let mattr;
    if (totalWords < MATTR_WIN) {
      // Texte court : TTR brut acceptable
      mattr = totalWords > 0 ? (uniqueWords / totalWords * 100) : 0;
    } else {
      // Texte long : moyenne des TTR par fenêtre glissante
      const lw = words.map(w => w.toLowerCase());
      let sumTTR = 0; let winCount = 0;
      for (let wi = 0; wi <= lw.length - MATTR_WIN; wi += Math.floor(MATTR_WIN / 2)) {
        const win = lw.slice(wi, wi + MATTR_WIN);
        sumTTR += new Set(win).size / MATTR_WIN;
        winCount++;
      }
      mattr = winCount > 0 ? (sumTTR / winCount * 100) : (uniqueWords / totalWords * 100);
    }
    const ttr = mattr.toFixed(1);
    const _textTooShort = totalWords < 200;

    // ── Lisibilité Flesch adapté FR ──────────────────────
    // Formule Kandel-Moles (version française de Flesch)
    // F = 207 - (1.015 × mots/phrases) - (73.6 × syllabes/mots)
    function countSyllables(word) {
      const w = word.toLowerCase().replace(/[^a-zàâéèêëîïôùûüœç]/g,'');
      // AUDIT FIX : diphtongues réelles françaises (1 syllabe) vs hiatus (2 syllabes)
      // Diphtongues : ou, au, eu, ei, oi, ai → une seule syllabe phonétique
      // Hiatus : ia, io, ié, ue, ua → deux syllabes séparées
      const DIPHT = new Set(['ou','au','eu','ei','oi','ai','ay','oy','uy','œu']);
      let count = 0;
      let i = 0;
      while (i < w.length) {
        if ('aeéèêëàâîïôùûüœiu'.includes(w[i])) {
          // Vérifier si c'est une vraie diphtongue avec le caractère suivant
          const pair = i+1 < w.length ? w[i] + w[i+1] : '';
          if (DIPHT.has(pair)) {
            count++; i += 2; // diphtongue = 1 syllabe, avancer de 2
          } else if (i+1 < w.length && 'aeéèêëàâîïôùûüœiu'.includes(w[i+1])) {
            count++; i++; // hiatus : compter la voyelle actuelle, la suivante sera comptée séparément
          } else {
            count++; i++;
          }
        } else {
          i++;
        }
      }
      return Math.max(1, count);
    }
    const totalSylls = words.reduce((s,w) => s + countSyllables(w), 0);
    const avgSylls   = totalWords > 0 ? totalSylls / totalWords : 0;
    const avgWPS     = sentencesForAvg.length > 0 ? totalWords / sentencesForAvg.length : 0;
    const flesch     = Math.round(207 - (1.015 * avgWPS) - (73.6 * avgSylls));
    const fleschClamped = Math.max(0, Math.min(100, flesch));

    function fleschLabel(f) {
      if (f >= 80) return { label:'Très facile', color:'#10b981', detail:'Roman grand public, presse quotidienne' };
      if (f >= 70) return { label:'Facile', color:'#34d399', detail:'Roman populaire' };
      if (f >= 60) return { label:'Standard', color:'#f59e0b', detail:'Roman contemporain moyen' };
      if (f >= 50) return { label:'Assez difficile', color:'#f97316', detail:'Littérature exigeante' };
      if (f >= 30) return { label:'Difficile', color:'#ef4444', detail:'Essai, littérature classique' };
      return { label:'Très difficile', color:'#dc2626', detail:'Texte académique ou poétique dense' };
    }
    const fi = fleschLabel(fleschClamped);

    // ── Temps narratifs ──────────────────────────────────
    // Regexes temps verbaux — contraintes pour réduire les faux positifs
    // Passé simple : on exclut les terminaisons -it/-ut/-int sur des mots courants
    //   → on exige une longueur minimale (≥4 lettres avant la terminaison)
    //   → on exclut les mots finissant par -ruit, -duit, -nuit, -suit, -cuit, -tuit
    // AUDIT FIX : complétion de PS_EXCLUD avec les noms courants en -it/-ut/-int manquants
    const PS_EXCLUD = /\b(?:nuit|bruit|fruit|gratuit|produit|conduit|circuit|déduit|séduit|traduit|construit|instruit|détruit|réduit|induit|reconduit|reconstruit|saint|point|joint|poing|loin|moins|besoin|soin|coin|foin|grain|train|plein|fin|certain|terrain|humain|prochain|lendemain|demain|main|bain|pain|vain|chemin|jardin|festin|matin|latin|raisin|cousin|voisin|esprit|écrit|décrit|inscrit|prescrit|souscrit|transcrit|instinct|distinct|extinct|succinct|circuit|récit|appétit|crédit|débit|audit|profit|conflit|transit|permis|promis|appris|compris|repris|surpris|épris|mépris|pris|mis|admis|soumis|compromis|transmis|remis|démis|omis|assis|acquis|requis|inédit|inédit|prédit|interdit|maudit|préfit|afit|défit|contrefit|refit|comfit|suffit)\b/gi;
    const pSimpleRaw = (cleanText.match(/\b[a-záàâéèêëîïôùûüœç]{3,}(?:ai|as|a(?!it\b)|âmes|âtes|èrent|it|irent|ut|urent|ût|ussent|int(?!érieur)|inrent|vint|vinrent)\b/g)||[]);
    const pSimple  = pSimpleRaw.filter(w => !PS_EXCLUD.test(w)).length;

    // Imparfait : -ais/-ait/-ions/-iez/-aient
    // AUDIT FIX : ajout IMPARFAIT_EXCLUD pour les noms/adj courants capturés par erreur
    const IMPARFAIT_EXCLUD = /(?:biais|délais|essais|jamais|mais|rabais|relais|remblais|balais|marais|palais|frais|attrait|portrait|trait|extrait|distrait|retrait|intrait|subtrait|contraint|plaît|plaîts|nations|actions|passions|mentions|tensions|missions|versions|liaisons|raisons|saisons|maisons|occasions|leçons|façons|garçons|tronçons|bâtons|ballons|salons|talons|coulons|roulons|allions|venions|disions|faisions|prenions|tenions|voyions|savions|pouvions|voulions|devions|étions|avions|allions)/gi;
    const pImparfaitRaw = (cleanText.match(/[a-záàâéèêëîïôùûüœç]{3,}(?:ais|ait|ions|iez|aient)/g)||[]);
    const pImparfait = pImparfaitRaw.filter(w => !IMPARFAIT_EXCLUD.test(w)).length;

    // Présent : on exclut les mots connus non-verbaux via une liste de suffixes
    //   → on NE compte PAS les mots en -ment, -ence, -ance, -esse, -ture, -bre, -ple, -cle, -ble
    //   → on exige ≥ 5 lettres totales pour éviter 'que', 'le', 'une', etc.
    const PRESENT_EXCLUD_SUFFIX = /(?:ment|ence|ance|esse|ture|bre|ple|cle|ble|ise|ite|ine|ice|ile|ire|ière|oire|aire|aise|oise|euse|ouse|ause|anse|erse|orce|arce|arbe|orbe|arme|erme|orme|arne|erne|orne|arne|ille|aille|eille|ouille|euille|ueille|nne|onne|asse|igne|erre|ierre|otte|ette|osse|usse|isse|ysse|anne|inne|enne)$/i;
    // AUDIT FIX : on compte uniquement les formes verbales précédées d'un pronom sujet
    // Réduit massivement les faux positifs (noms pluriels, adjectifs…)
    const PRON_SUJET = /(?:je|tu|il|elle|on|nous|vous|ils|elles|qui|y|se|me|te|le|la|les|lui|leur)\s+$/i;
    const presentRaw = (cleanText.match(/[a-záàâéèêëîïôùûüœç]{4,}(?:e|es|ons|ez|ent)/g)||[]);
    // Approche hybride : filtrer par suffix ET compter les occurrences après pronom
    const presentFiltered = presentRaw.filter(w => !PRESENT_EXCLUD_SUFFIX.test(w));
    // Comptage via regex avec contexte pronom (plus précis)
    const presentWithPron = (cleanText.match(/(?:je|tu|il|elle|on|nous|vous|ils|elles|qui)\s+[a-záàâéèêëîïôùûüœç]{4,}(?:e|es|ons|ez|ent)/gi)||[]).length;
    // Moyenne pondérée : 60% méthode suffix, 40% méthode pronom (complémentaires)
    const present = Math.round(presentFiltered.length * 0.6 + presentWithPron * 1.5);

    const totalVerbes = pSimple + pImparfait + present || 1;
    const psRatio  = Math.round(pSimple / totalVerbes * 100);
    const impRatio = Math.round(pImparfait / totalVerbes * 100);
    const presRatio = Math.round(present / totalVerbes * 100);

    // ── Densité émotionnelle — 5 catégories (v41) ───────
    // Catégorie 1-4 : lexique mot à mot
    // Catégorie 5 : patterns descriptifs d'état (expressions multi-mots)
    // CORRECTIF v41 : le tokeniseur \b coupe sur les apostrophes
    // "s'effondra" devient ["s", "effondra"] — on retokenise avec apostrophes incluses
    const wordsExt = cleanText.match(/[a-zA-ZàâéèêëîïôùûüœçÀÂÉÈÊËÎÏÔÙÛÜŒÇ][a-zA-ZàâéèêëîïôùûüœçÀÂÉÈÊËÎÏÔÙÛÜŒÇ\u2019\-]*/g) || [];

    let emotionCount = 0;
    const emotionWords = [];
    const emotionBreakdown = { noms: 0, verbes: 0, corps: 0, adj: 0, descriptif: 0 };

    // Passe sur les tokens normaux (mots isolés)
    words.forEach(w => {
      const lw = w.toLowerCase();
      let matched = false;
      if (LEXIQUE_EMOTIONS_NOMS.has(lw))   { emotionBreakdown.noms++;   matched = true; }
      if (LEXIQUE_EMOTIONS_CORPS.has(lw))  { emotionBreakdown.corps++;  matched = true; }
      if (LEXIQUE_EMOTIONS_ADJ.has(lw))    { emotionBreakdown.adj++;    matched = true; }
      if (!matched && matchesVerbRacine(lw)) { emotionBreakdown.verbes++; matched = true; }
      if (matched) { emotionCount++; emotionWords.push(lw); }
    });

    // Passe complémentaire sur les tokens étendus (avec apostrophes)
    // pour attraper "s'effondra" -> "effondra", "s'agrippa" -> "agrippa", etc.
    wordsExt.forEach(w => {
      if (!/[\u2019]/.test(w) && !/['']/.test(w)) return;
      const parts = w.split(/[\u2019'']/);
      parts.forEach(part => {
        const lp = part.toLowerCase();
        if (lp.length < 3) return;
        if (emotionWords.includes(lp)) return; // eviter doublons
        let matched = false;
        if (LEXIQUE_EMOTIONS_CORPS.has(lp))  { emotionBreakdown.corps++;  matched = true; }
        if (!matched && matchesVerbRacine(lp)) { emotionBreakdown.verbes++; matched = true; }
        if (matched) { emotionCount++; emotionWords.push(lp); }
      });
    });

    // Categorie 5 : patterns descriptifs d'etat (expressions litteraires multi-mots)
    const descriptifCount = countDescriptifPatterns(cleanText);
    emotionBreakdown.descriptif = descriptifCount;
    emotionCount += descriptifCount;

    const emotionDensity = totalWords > 0 ? (emotionCount / totalWords * 100).toFixed(1) : 0;

    // Seuils réalistes pour la fiction narrative (POV inclus)
    // Fiction littéraire dense : 4-10%, roman genre : 2-6%, texte descriptif : 1-3%
    function emotionColor(d) {
      if (d >= 4)  return '#10b981'; // bon
      if (d >= 2)  return '#f59e0b'; // correct
      return '#ef4444';              // faible
    }
    function emotionNote(d) {
      if (d >= 6)  return 'Texture émotionnelle très riche.';
      if (d >= 4)  return 'Bonne présence émotionnelle.';
      if (d >= 2)  return 'Présence émotionnelle modérée — des passages pourraient être approfondis.';
      return 'Faible charge émotionnelle détectée — vérifiez que le texte contient bien des scènes de POV.';
    }

    // ── Dialogue vs narration ────────────────────────────
    const dialogLines = lines.filter(l => /^[—«"\u201c]/.test(l.trim()));
    const narrationLines = lines.filter(l => l.trim().length > 10 && !/^[—«"\u201c]/.test(l.trim()));
    const totalActive = dialogLines.length + narrationLines.length || 1;
    const dialogPct   = Math.round(dialogLines.length / totalActive * 100);

    // ── Point de vue narratif ────────────────────────────
    const je1  = (cleanText.match(/\bje\b/gi)||[]).length;
    const nous1= (cleanText.match(/\bnous\b/gi)||[]).length;
    const il3  = (cleanText.match(/\b(?:il|elle)\b/gi)||[]).length;
    const ils3 = (cleanText.match(/\b(?:ils|elles)\b/gi)||[]).length;
    let pov = 'Indéterminé';
    if (je1 > il3 * 2)  pov = '1ʳᵉ personne (je)';
    else if (je1 > 30 && il3 > 30) pov = 'POV mixte 1ʳᵉ/3ᵉ (à vérifier)';
    else if (il3 + ils3 > je1 * 2) pov = '3ᵉ personne (il/elle)';

    // Ruptures POV — AUDIT FIX : les seuils précédents (il3 > je1*0.5) déclenchaient
    // quasi-systématiquement en fiction non-monologue. On supprime la fausse détection
    // et on laisse simplement le POV détecté + les compteurs bruts en info.
    const povRuptures = 0; // détection supprimée (trop de faux positifs)
    const povDetail = `je:${je1} · il/elle:${il3} · ils/elles:${ils3}`; // debug info

    // ── Paragraphes ─────────────────────────────────────
    const avgParaWords = paras.length > 0 ? Math.round(totalWords / paras.length) : 0;
    // ── Paragraphes longs — v4 ───────────────────────────
    // Cible : un vrai mur de narration dense et uniforme.
    // Un bloc est exclu (= scène normale) si l'un de ces critères est vrai :
    //   1. ≥ 20 lignes non-vides          → scène structurée
    //   2. ≥ 20 % de lignes dialogue      → scène mixte
    //   3. contient une ligne vide interne → déjà aéré
    //   4. ≥ 25 % de lignes courtes (≤8 mots) → rythme varié (action, fragments)
    //      Un vrai pavé a des phrases longues et uniformes ; une scène vivante
    //      est parsemée de lignes courtes (réactions, fragments, actions brèves).
    // Seuil mots : 300 (narration pure et continue).
    // AUDIT FIX : seuil adaptatif — 15% du texte ou 300 mots (min 150)
    const _seuilParaLong = Math.max(150, Math.min(300, Math.round(totalWords * 0.15)));
    const longParas = paras.filter(p => {
      const wc = p.split(/\s+/).length;
      if (wc <= _seuilParaLong) return false;
      const pLines = p.split('\n').filter(l => l.trim().length > 0);
      if (pLines.length >= 20) return false;
      const dialogCount = pLines.filter(l => /^[—«"\u201c\u201d]/.test(l.trim())).length;
      if (pLines.length > 0 && dialogCount / pLines.length >= 0.20) return false;
      if (/\n[ \t]*\n/.test(p)) return false;
      // Critère 4 : rythme — proportion de lignes courtes (≤8 mots)
      const shortLines = pLines.filter(l => l.trim().split(/\s+/).length <= 8).length;
      if (pLines.length > 0 && shortLines / pLines.length >= 0.25) return false;
      return true;
    });

    // ── Ponctuation ──────────────────────────────────────
    const excl  = (cleanText.match(/!/g)||[]).length;
    const inter = (cleanText.match(/\?/g)||[]).length;
    const points_susp = (cleanText.match(/…|\.{3}/g)||[]).length;
    const virgules = (cleanText.match(/,/g)||[]).length;

    // ── Top émotions présentes ───────────────────────────
    const emotionFreq = {};
    emotionWords.forEach(w => { emotionFreq[w] = (emotionFreq[w]||0)+1; });
    const topEmotions = Object.entries(emotionFreq).sort((a,b)=>b[1]-a[1]).slice(0,8);

    // ── Rendu ────────────────────────────────────────────
    function bar(pct, color) {
      return `<div style="height:6px;border-radius:3px;background:var(--cream);margin-top:3px;overflow:hidden;"><div style="height:100%;width:${Math.min(100,pct)}%;background:${color};border-radius:3px;transition:width .4s;"></div></div>`;
    }
    function statCard(label, value, unit='', color='var(--ink-soft)', detail='') {
      return `<div style="background:var(--paper);border:1px solid var(--cream);border-radius:7px;padding:9px 11px;">
        <div style="font-size:10px;color:var(--ink-muted);font-weight:500;text-transform:uppercase;letter-spacing:.06em;">${label}</div>
        <div style="font-size:18px;font-weight:600;color:${color};margin:2px 0;">${value}<span style="font-size:11px;font-weight:400;color:var(--ink-muted);margin-left:3px;">${unit}</span></div>
        ${detail ? `<div style="font-size:10.5px;color:var(--ink-muted);">${detail}</div>` : ''}
      </div>`;
    }

    let html = '';
    if (_textTooShort) {
      html += `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:7px;padding:9px 12px;margin-bottom:10px;font-size:11px;color:#92400e;">
        ⚠ <strong>Texte court (${totalWords} mots)</strong> — certaines métriques (MATTR, temps narratifs, densité émotionnelle) sont peu fiables en dessous de 200 mots.
      </div>`;
    }
    html += `
    <!-- Grille principale -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:12px;">
      ${statCard('Mots total', totalWords.toLocaleString('fr'))}
      ${statCard('Mots uniques', uniqueWords.toLocaleString('fr'))}
      ${statCard('Richesse (MATTR)', ttr+'%', '', parseFloat(ttr)>=55?'#10b981':parseFloat(ttr)>=42?'#f59e0b':'#ef4444', parseFloat(ttr)>=55?'Vocabulaire varié':parseFloat(ttr)>=42?'Correct':'Vocabulaire répétitif')}
      ${statCard('Phrases', sentences.length.toLocaleString('fr'))}
      ${statCard('Mots/phrase', avgWPS.toFixed(1), '', avgWPS>30?'#ef4444':avgWPS>20?'#f59e0b':'#10b981')}
      ${statCard('Paragraphes', paras.length, '', 'var(--ink-soft)', avgParaWords+' mots/§ en moy.')}
    </div>

    <!-- Lisibilité Flesch-FR -->
    <div style="background:var(--paper);border:1px solid var(--cream);border-radius:7px;padding:10px 12px;margin-bottom:10px;">
      <div style="font-size:10px;color:var(--ink-muted);font-weight:500;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Lisibilité (Kandel-Moles)</div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="font-size:24px;font-weight:700;color:${fi.color};min-width:44px;">${fleschClamped}</div>
        <div>
          <div style="font-size:12px;font-weight:600;color:${fi.color};">${fi.label}</div>
          <div style="font-size:10.5px;color:var(--ink-muted);">${fi.detail}</div>
        </div>
      </div>
      ${bar(fleschClamped, fi.color)}
    </div>

    <!-- Temps narratifs -->
    <div style="background:var(--paper);border:1px solid var(--cream);border-radius:7px;padding:10px 12px;margin-bottom:10px;">
      <div style="font-size:10px;color:var(--ink-muted);font-weight:500;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Temps narratifs (estimation)</div>
      <div style="display:flex;flex-direction:column;gap:5px;">
        <div>
          <div style="display:flex;justify-content:space-between;font-size:11px;"><span>Passé simple</span><span style="color:${psRatio>30?'#10b981':'var(--ink-muted)'};font-weight:600;">${psRatio}%</span></div>
          ${bar(psRatio,'#10b981')}
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:11px;"><span>Imparfait</span><span style="font-weight:600;color:var(--ink-soft);">${impRatio}%</span></div>
          ${bar(impRatio,'#3b82f6')}
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:11px;"><span>Présent</span><span style="color:${presRatio>60?'#f59e0b':'var(--ink-muted)'};font-weight:600;">${presRatio}%</span></div>
          ${bar(presRatio,'#f59e0b')}
        </div>
      </div>
      ${psRatio<10 && impRatio<10 ? '<div style="font-size:10.5px;color:#f59e0b;margin-top:5px;">⚠ Peu de passé simple/imparfait — texte au présent ou narration non conventionnelle.</div>' : ''}
    </div>

    <!-- Dialogue vs Narration -->
    <div style="background:var(--paper);border:1px solid var(--cream);border-radius:7px;padding:10px 12px;margin-bottom:10px;">
      <div style="font-size:10px;color:var(--ink-muted);font-weight:500;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Dialogue vs narration</div>
      <div style="display:flex;gap:16px;">
        <div style="text-align:center;flex:1;">
          <div style="font-size:20px;font-weight:700;color:#3b82f6;">${dialogPct}%</div>
          <div style="font-size:10px;color:var(--ink-muted);">Dialogue</div>
        </div>
        <div style="text-align:center;flex:1;">
          <div style="font-size:20px;font-weight:700;color:#10b981;">${100-dialogPct}%</div>
          <div style="font-size:10px;color:var(--ink-muted);">Narration</div>
        </div>
      </div>
      ${bar(dialogPct,'#3b82f6')}
      ${dialogPct<5 ? '<div style="font-size:10.5px;color:#f59e0b;margin-top:5px;">💡 Peu de dialogue — le texte peut sembler monolithique.</div>' : ''}
      ${dialogPct>80 ? '<div style="font-size:10.5px;color:#f59e0b;margin-top:5px;">💡 Beaucoup de dialogue — ajoutez plus de narration/description.</div>' : ''}
    </div>

    <!-- Point de vue -->
    <div style="background:var(--paper);border:1px solid var(--cream);border-radius:7px;padding:10px 12px;margin-bottom:10px;">
      <div style="font-size:10px;color:var(--ink-muted);font-weight:500;text-transform:uppercase;letter-spacing:.06em;">Point de vue narratif</div>
      <div style="font-size:14px;font-weight:600;color:var(--ink);margin:4px 0;">${pov}</div>
      ${povRuptures ? '<div style="font-size:10.5px;color:#f59e0b;">⚠ Possibles ruptures de POV détectées — vérifiez la cohérence du narrateur.</div>' : '<div style="font-size:10.5px;color:#10b981;">✓ POV cohérent</div>'}
    </div>

    <!-- Densité émotionnelle -->
    <div style="background:var(--paper);border:1px solid var(--cream);border-radius:7px;padding:10px 12px;margin-bottom:10px;">
      <div style="font-size:10px;color:var(--ink-muted);font-weight:500;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Densité émotionnelle</div>
      <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:3px;">
        <div style="font-size:20px;font-weight:700;color:${emotionColor(parseFloat(emotionDensity))};">${emotionDensity}%</div>
        <div style="font-size:10.5px;color:var(--ink-muted);">${emotionCount} marqueurs / ${totalWords} mots</div>
      </div>
      ${bar(Math.min(100, parseFloat(emotionDensity) * 10), '#ec4899')}
      <div style="font-size:10.5px;color:var(--ink-muted);margin-top:5px;font-style:italic;">${emotionNote(parseFloat(emotionDensity))}</div>
      <!-- Breakdown par catégorie — v41 : 5 catégories -->
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin-top:8px;text-align:center;">
        <div style="background:rgba(236,72,153,.07);border-radius:5px;padding:4px 2px;">
          <div style="font-size:13px;font-weight:600;color:#ec4899;">${emotionBreakdown.noms}</div>
          <div style="font-size:9px;color:var(--ink-muted);">États</div>
        </div>
        <div style="background:rgba(139,92,246,.07);border-radius:5px;padding:4px 2px;">
          <div style="font-size:13px;font-weight:600;color:#7c3aed;">${emotionBreakdown.verbes}</div>
          <div style="font-size:9px;color:var(--ink-muted);">Ressentis</div>
        </div>
        <div style="background:rgba(59,130,246,.07);border-radius:5px;padding:4px 2px;">
          <div style="font-size:13px;font-weight:600;color:#2563eb;">${emotionBreakdown.corps}</div>
          <div style="font-size:9px;color:var(--ink-muted);">Corps</div>
        </div>
        <div style="background:rgba(245,158,11,.07);border-radius:5px;padding:4px 2px;">
          <div style="font-size:13px;font-weight:600;color:#d97706;">${emotionBreakdown.adj}</div>
          <div style="font-size:9px;color:var(--ink-muted);">Qualif.</div>
        </div>
        <div style="background:rgba(16,185,129,.07);border-radius:5px;padding:4px 2px;" title="Expressions descriptives d'état : pétrifiée, jambes qui cèdent, silence absolu…">
          <div style="font-size:13px;font-weight:600;color:#10b981;">${emotionBreakdown.descriptif}</div>
          <div style="font-size:9px;color:var(--ink-muted);">Descrip.</div>
        </div>
      </div>
      ${topEmotions.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">${topEmotions.map(([w,c])=>`<span class="wt-syn-chip" style="font-size:10px;cursor:pointer;" title="${_t('wt_locate')}" onclick="wtHighlightAll('${escHtml(w)}')">${escHtml(w)} <span style="opacity:.6;">${c}×</span></span>`).join('')}</div>` : ''}
    </div>

    <!-- Ponctuation -->
    <div style="background:var(--paper);border:1px solid var(--cream);border-radius:7px;padding:10px 12px;margin-bottom:10px;">
      <div style="font-size:10px;color:var(--ink-muted);font-weight:500;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Ponctuation</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:center;">
        <div><div style="font-size:16px;font-weight:700;">!</div><div style="font-size:10px;color:var(--ink-muted);">${excl}</div></div>
        <div><div style="font-size:16px;font-weight:700;">?</div><div style="font-size:10px;color:var(--ink-muted);">${inter}</div></div>
        <div><div style="font-size:16px;font-weight:700;">…</div><div style="font-size:10px;color:var(--ink-muted);">${points_susp}</div></div>
        <div><div style="font-size:16px;font-weight:700;">,</div><div style="font-size:10px;color:var(--ink-muted);">${virgules}</div></div>
      </div>
      ${excl > sentences.length * 0.3 ? '<div style="font-size:10.5px;color:#f59e0b;margin-top:4px;">⚠ Beaucoup de points d\'exclamation — à modérer.</div>' : ''}
    </div>

    ${longParas.length ? `
    <div style="background:var(--paper);border:1px solid var(--cream);border-radius:7px;padding:10px 12px;margin-bottom:10px;">
      <div style="font-size:10px;color:var(--ink-muted);font-weight:500;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">📄 Paragraphes très longs (${longParas.length})</div>
      <div style="font-size:10.5px;color:var(--ink-muted);margin-bottom:8px;">Bloc de narration dense dépassant 300 mots, sans dialogue, sans aération et sans variation de rythme — cliquer pour localiser.</div>
      ${longParas.map(p => {
        const wc       = p.split(/\s+/).length;
        const rawText  = p.trim().slice(0, 120);
        const alertId  = _alertId('longpara', rawText);
        if (_loadIgnored().has(alertId)) return '';
        const _loc = buildLocator(p.trim());
        const _si  = (window._statsLocators = window._statsLocators || []).length;
        window._statsLocators.push(_loc);
        return `<div class="wt-issue warning" data-type="longpara" data-raw-text="${escHtml(rawText)}"
          style="cursor:pointer;margin-bottom:5px;position:relative;"
          onclick="locateAndGoTo(window._statsLocators && window._statsLocators[${_si}])">
          <button class="wt-dismiss-btn" title="${_t('wt_dismiss')}"
            onclick="(function(e){
              e.stopPropagation();
              var el=this.closest('.wt-issue');
              if(!el)return;
              window._addIgnored(window._alertId('longpara', el.dataset.rawText||''));
              el.classList.add('dismissed');
              setTimeout(function(){el.style.display='none';},350);
            }).bind(this)(event)">✕</button>
          <div style="display:flex;align-items:baseline;gap:6px;">
            <span style="font-size:9px;font-weight:600;background:#fef3c7;color:#d97706;padding:1px 6px;border-radius:8px;flex-shrink:0;">⚠ ${wc} mots</span>
            <span style="font-size:10.5px;font-style:italic;color:var(--ink-muted);">"${escHtml(p.trim().slice(0,75))}…"</span>
          </div>
        </div>`;
      }).join('')}
    </div>` : ''}

    ${povRuptures ? (() => {
      const povLines = lines.filter(l => {
        const t = l.trim();
        if (t.length < 25) return false;

        // Exclure les dialogues purs : guillemet ou tiret cadratin en debut de ligne
        const fc = t.charCodeAt(0);
        if (fc === 34 || fc === 171 || fc === 187 || fc === 8220 || fc === 8221 || fc === 8212 || fc === 8211) return false;

        // Retirer les repliques embarquees entre guillemets avant de tester les pronoms
        // Ainsi "Il reflechit. <C est lui qu elle veut que je tue.> Il hocha." => pas de 'je'
        var tNoDialog = t
          .replace(/\u00ab[\s\S]*?\u00bb/g, " ")
          .replace(/\u201c[\s\S]*?\u201d/g, " ")
          .replace(/"[^"\n]{1,300}"/g, " ")
          .replace(/\u2014[^\u2014\n]{1,200}\u2014/g, " ");

        // Tester les pronoms sur la narration nettoyee uniquement
        var hasJe = /\bje\b|\bj[\u2019']|\bmon\b|\bmoi\b|\bm[\u2019']/.test(tNoDialog);
        var hasIl = /\b(il|elle|ils|elles|son|sa|ses|leur|leurs)\b/i.test(tNoDialog);
        if (!hasJe || !hasIl) return false;

        var jeCount = (tNoDialog.match(/\bje\b|\bj[\u2019']|\bmon\b|\bmoi\b|\bm[\u2019']/g) || []).length;
        var ilCount = (tNoDialog.match(/\b(il|elle|ils|elles|son|sa|ses|leur|leurs)\b/gi) || []).length;
        // Exiger au moins 2 pronoms de chaque type pour eviter les faux positifs
        return jeCount >= 2 && ilCount >= 2;
      }).slice(0, 6);
      const visiblePovLines = povLines.filter(l => !_loadIgnored().has(_alertId('pov', l.trim().slice(0,120))));
      if (!visiblePovLines.length) return '';
      return `
      <div style="background:var(--paper);border:1px solid #fef3c7;border-radius:7px;padding:10px 12px;margin-bottom:10px;">
        <div style="font-size:10px;color:var(--ink-muted);font-weight:500;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">👁 POV mixte — lignes suspectes</div>
        <div style="font-size:10.5px;color:var(--ink-muted);margin-bottom:8px;">Ces lignes de narration (hors dialogue) mélangent pronoms 1ʳᵉ et 3ᵉ personne — vérifiez la cohérence du narrateur.</div>
        ${visiblePovLines.map(l => {
          const rawText = l.trim().slice(0, 120);
          const _loc = buildLocator(l.trim());
          const _si  = (window._statsLocators = window._statsLocators || []).length;
          window._statsLocators.push(_loc);
          return `<div class="wt-issue warning" data-type="pov" data-raw-text="${escHtml(rawText)}"
            style="cursor:pointer;margin-bottom:5px;position:relative;"
            onclick="locateAndGoTo(window._statsLocators && window._statsLocators[${_si}])">
            <button class="wt-dismiss-btn" title="${_t('wt_dismiss')}"
              onclick="(function(e){
                e.stopPropagation();
                var el=this.closest('.wt-issue');
                if(!el)return;
                window._addIgnored(window._alertId('pov', el.dataset.rawText||''));
                el.classList.add('dismissed');
                setTimeout(function(){el.style.display='none';},350);
              }).bind(this)(event)">✕</button>
            <span style="font-size:10.5px;font-style:italic;color:var(--ink-muted);">"${escHtml(l.trim().slice(0, 90))}${l.trim().length > 90 ? '…' : ''}"</span>
          </div>`;
        }).join('')}
      </div>`;
    })() : ''}
    `;

    document.getElementById('wt-stats-results').innerHTML = html;
  } finally {
    btn.disabled = false;
  }
}

// ── Correcteur principal (multi-moteur) ────────────────
async function runCorrector() {
  const ta   = getTA();
  const text = ta.value.trim();
  if (!text) { showToast(_t('toast_no_text')); return; }

  const btn = document.getElementById('wt-btn-correct');
  const res = document.getElementById('wt-correct-results');
  btn.disabled = true;
  try {

  // ── Texte nettoyé envoyé à LanguageTool ──────────────
  const cleanText = cleanForAnalysis(text);

  // ── Chapitre actif uniquement ? ───────────────────────
  const chapterOnly = document.getElementById('wt-chapter-only')?.checked;
  let analysisText = cleanText;
  if (chapterOnly && _currentChapterText) {
    const idx = cleanText.toLowerCase().indexOf(_currentChapterText.toLowerCase().slice(0, 40));
    if (idx >= 0) analysisText = cleanText.slice(idx, idx + _currentChapterText.length);
  }

  const useLT     = _correctEngine === 'lt'     || _correctEngine === 'both';
  const useClaude = _correctEngine === 'claude' || _correctEngine === 'both';

  let ltIssues    = [];
  let aiIssues    = [];
  let errors      = [];
  let sources     = [];

  // ── LanguageTool ──────────────────────────────────────
  if (useLT) {
    res.innerHTML = spinnerHtml('LanguageTool analyse votre texte…');
    const ltResult = await callLanguageTool(analysisText);
    if (ltResult.error) {
      errors.push('LanguageTool : ' + ltResult.error);
    } else {
      ltIssues = ltPostFilter(ltMatchesToIssues(ltResult.matches, analysisText));
      sources.push('LanguageTool');
      if (ltResult.truncated) {
        errors.push('LanguageTool : seuls les 100 000 premiers caractères (5 segments) ont été analysés — utilisez « Chapitre actif seulement » pour cibler la suite.');
      }
    }
  }

  // ── Claude / IA ───────────────────────────────────────
  if (useClaude) {
    const key = _wtApiKey || getDomVal('wt-api-key').trim();
    if (!key) {
      errors.push('IA : clé API manquante.');
    } else {
      res.innerHTML = spinnerHtml('Analyse IA en cours…');

      // ── Découpage avec chevauchement pour ne pas couper les phrases ──
      const AI_CHUNK = 5500;
      const AI_OVERLAP = 300; // chevauchement : évite les faux positifs de césure
      const aiChunks = [];
      for (let i = 0; i < analysisText.length; i += AI_CHUNK) {
        const start = Math.max(0, i - AI_OVERLAP);
        aiChunks.push(analysisText.slice(start, i + AI_CHUNK));
      }

      // ── Prompt optimisé pour Groq (Llama) — anti-faux-positifs littéraires ──
      const oeuvreCtx = buildOeuvreContext();
      const sysPr = resolvePrompt('correcteur');

      // ── Filtre post-parsing : rejette les faux positifs résiduels ──
      const PASSÉ_SIMPLE = /\b(dit|répondit|reprit|ajouta|murmura|chuchota|cria|s'écria|soupira|demanda|interrogea|songea|pensa|réfléchit|comprit|sentit|vit|fit|fut|eut|alla|vint|prit|put|dut|voulut|sut|tint|courut|mourut|naquit|apparut|disparut|s'assit|se leva|se retourna|regarda|entendit|ouvrit|ferma|sortit|entra|arriva|repartit|tomba|resta|devint|sembla|parut)\b/i;
      // Filtre dialogues élargi :
      // 1. Lignes commençant par «, —, ", " (guillemets droits ou typographiques)
      // 2. Fragments courts (< 12 mots) contenant un verbe de dialogue à la suite d'un point
      // 3. Répliques embarquées : fragment encadré de guillemets ou de tirets dans le raw
      const NOMS_DIALOGUES = /^[«—""\u201c\u201d]/;
      const DIALOGUE_EMBEDDED = /[«"][^»"]{2,60}[»"]|—[^—]{2,60}—/;
      const VERBE_DIALOGUE = /\b(dit|répondit|reprit|ajouta|murmura|chuchota|cria|demanda|pensa|songea|s'écria|soupira)\b/i;

      const allAiIssues = [];
      for (let ci = 0; ci < aiChunks.length; ci++) {
        const label = aiChunks.length > 1 ? ` (tranche ${ci+1}/${aiChunks.length})` : '';
        res.innerHTML = spinnerHtml(`Analyse IA en cours${label}…`);
        const result = await callAI(sysPr, aiChunks[ci], 2000);
        if (result && !result.error) {
          try {
            const parsed = JSON.parse(result.replace(/```json[\s\S]*?```|```/g,'').trim());
            (parsed.issues || [])
              .filter(issue => {
                const raw = issue.raw || '';
                // Rejeter si le fragment contient un verbe de passé simple courant
                if (PASSÉ_SIMPLE.test(raw)) return false;
                // Rejeter si le fragment est un dialogue (début ou embarqué)
                if (NOMS_DIALOGUES.test(raw.trimStart())) return false;
                // Rejeter les répliques embarquées entre guillemets/tirets
                if (DIALOGUE_EMBEDDED.test(raw)) return false;
                // Rejeter les fragments courts (< 12 mots) terminés par un verbe de dialogue
                if (raw.trim().split(/\s+/).length <= 12 && VERBE_DIALOGUE.test(raw)) return false;
                // Rejeter si le titre de l'issue mentionne un "temps verbal" ou "style"
                const txt = (issue.text || '').toLowerCase();
                if (/temps verbal|passé simple|subjonctif|imparfait|style/.test(txt)) return false;
                // Rejeter les issues sans fragment "raw" (trop vagues)
                if (!raw || raw.length < 2) return false;
                return true;
              })
              .forEach(i => allAiIssues.push({ ...i, source:'IA', offset:-1 }));
          } catch(e) { /* tranche ignorée si JSON invalide */ }
        } else if (result?.error) {
          errors.push('IA : ' + result.error);
          break;
        }
      }

      if (allAiIssues.length > 0) {
        aiIssues = allAiIssues;
        sources.push('IA');
      }
    }
  }

  // ── Règles locales littéraires (toujours actives) ─────
  const localIssues = localLiteraryChecks(text);
  if (localIssues.length) sources.push('local');

  // ── Fusion et dédoublonnage — FIX 4 ─────────────────
  // Clé = source + raw + type pour éviter de fusionner 2 erreurs différentes sur le même mot
  const seenKeys = new Set();
  const allIssues = [...ltIssues, ...aiIssues, ...localIssues].filter(i => {
    const raw  = (i.raw  || '').toLowerCase().slice(0, 40);
    const txt  = (i.text || '').toLowerCase().slice(0, 30);
    const rule = (i.ruleId || '').slice(0, 20);
    // Clé composite : type + raw + première partie du titre
    // Permet deux erreurs différentes sur le même mot (ortho + style)
    // mais dédoublonne les doublons stricts LT/IA sur la même faute
    const k = `${i.type}|${raw}|${txt.slice(0,10)}`;
    if (!raw || seenKeys.has(k)) return false;
    seenKeys.add(k);
    return true;
  });

  if (errors.length) showToast(errors.join(' — '), 6000, 'error');
  renderCorrectorResults(allIssues, sources.join(' + '), text);
  } finally {
    btn.disabled = false;
  }
}

function renderCorrectorResults(issues, source, originalText) {
  const res = document.getElementById('wt-correct-results');

  if (!issues.length) {
    res.innerHTML = `
      <div style="font-size:10px;color:var(--ink-muted);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        <span>Moteur : <strong>${escHtml(source)}</strong></span>
        <span style="margin-left:auto;background:var(--cream);padding:1px 7px;border-radius:8px;">0 point(s)</span>
      </div>
      <div class="wt-empty">✅ Aucune erreur détectée.</div>`;
    updateErrorBadge(0);
    return;
  }
  updateErrorBadge(issues.length);

  // ── Compter par type pour la barre de filtres ─────────
  const typeCounts = { error: 0, warning: 0, typo: 0, style: 0 };
  issues.forEach(i => {
    const t = i.type === 'typo' ? 'typo' : (i.type || 'warning');
    if (t in typeCounts) typeCounts[t]++;
  });

  // ── Barre de filtres ──────────────────────────────────
  const TYPE_META = {
    error:   { icon: '⛔', label: 'Erreurs',   color: '#dc2626' },
    warning: { icon: '⚠️',  label: 'Attention', color: '#d97706' },
    typo:    { icon: '🔤', label: 'Typo',      color: '#7c3aed' },
    style:   { icon: '✏️',  label: 'Style',     color: '#2563eb' },
  };

  let filterHtml = `<div id="wt-filter-bar" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;">
    <button style="font-size:10px;padding:2px 8px;border-radius:10px;border:1px solid var(--ink);background:var(--ink);color:var(--parchment);cursor:pointer;font-family:'DM Sans',sans-serif;"
      data-filter="all" onclick="wtSetFilter('all')">Tout <span style="opacity:.7;">${issues.length}</span></button>`;
  ['error','warning','typo','style'].forEach(t => {
    if (!typeCounts[t]) return;
    const m = TYPE_META[t];
    filterHtml += `<button style="font-size:10px;padding:2px 8px;border-radius:10px;border:1px solid var(--cream);background:var(--paper);color:var(--ink-soft);cursor:pointer;font-family:'DM Sans',sans-serif;"
      data-filter="${t}" onclick="wtSetFilter('${t}')">${m.icon} ${m.label} <span style="opacity:.6;">${typeCounts[t]}</span></button>`;
  });
  filterHtml += `</div>`;

  // ── En-tête + compteur ────────────────────────────────
  let html = `
    <div style="font-size:10px;color:var(--ink-muted);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
      <span>Moteur : <strong>${escHtml(source)}</strong></span>
      <span id="wt-issue-count" style="margin-left:auto;background:var(--cream);padding:1px 7px;border-radius:8px;">${issues.length} point(s)</span>
    </div>
    ${filterHtml}`;

  // ── Grouper par source ────────────────────────────────
  const bySource = {};
  issues.forEach(i => {
    const s = i.source || 'local';
    if (!bySource[s]) bySource[s] = [];
    bySource[s].push(i);
  });

  const multiSrc = Object.keys(bySource).length > 1;
  const SRC_ICONS = { LanguageTool: '🛡', IA: '✦', local: '⚙' };

  let globalIdx = 0;
  Object.entries(bySource).forEach(([src, list]) => {
    if (multiSrc) {
      const icon = SRC_ICONS[src] || '•';
      // FIX 5: data-sep sur le séparateur pour que wtSetFilter puisse le masquer
      html += `<div data-sep="${escHtml(src)}" style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;
        color:var(--ink-muted);margin:10px 0 5px;display:flex;align-items:center;gap:6px;">
        ${icon} ${escHtml(src)}
        <span style="flex:1;height:1px;background:var(--cream);display:block;"></span>
      </div>`;
    }
    html += list.map(issue => {
      const idx     = globalIdx++;
      const rawEsc  = (issue.raw || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const itype   = issue.type === 'typo' ? 'typo' : (issue.type || 'warning');
      const meta    = TYPE_META[itype] || TYPE_META.warning;

      // Badge catégorie coloré
      const badgeBg = {
        error:   '#fee2e2', warning: '#fef3c7',
        typo:    '#ede9fe', style:   '#dbeafe',
      }[itype] || '#f3f4f6';

      // Bouton IA pour les clichés littéraires
      const isCliche = issue.text === 'Cliché littéraire';
      const clicheBtn = isCliche
        ? `<button
            data-style-ai="cliche"
            data-ia-payload="${(issue.raw||issue.ctx||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}"
            onclick="event.stopPropagation();iaPropOpen(this,'cliche')"
            style="margin-top:7px;display:inline-block;font-size:11px;font-family:'DM Sans',sans-serif;padding:4px 13px;
              border-radius:10px;border:1px solid var(--accent-light);background:transparent;
              color:var(--accent);cursor:pointer;"
            onmouseover="this.style.background='var(--accent)';this.style.color='#fff'"
            onmouseout="this.style.background='transparent';this.style.color='var(--accent)'"
          >✦ ${(typeof _i18n !== 'undefined' && typeof getPref === 'function') ? (_i18n[getPref('ui_lang') || 'fr']?.ai_sub_btn || 'Proposition de substitution') : 'Proposition de substitution'}</button>`
        : '';

      const _isRepeat = (issue.text||'').includes('R\u00e9p\u00e9tition') || (issue.text||'').includes('repetition');
      const _onclickFn = _isRepeat ? ('wtHighlightAll(\'' + rawEsc + '\')') : ('wtScrollToText(\'' + rawEsc + '\')');
      // Construire data-raw-text pour l'ID stable de faux-positif
      const _rawForId = escHtml((issue.raw || issue.ctx || issue.text || '').slice(0, 120));
      return `
        <div class="wt-issue ${itype}" id="wt-issue-${idx}" data-type="${itype}" data-style-card="1"
             data-raw-text="${_rawForId}"
             onclick="${_onclickFn}">
          <button class="wt-dismiss-btn" onclick="wtDismissIssue(${idx},event)" title="${_t('wt_dismiss')}">✕</button>
          <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:3px;">
            <span style="font-size:9px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
              background:${badgeBg};color:${meta.color};padding:1px 6px;border-radius:8px;flex-shrink:0;">
              ${meta.icon} ${meta.label}</span>
            <div class="wt-issue-text" style="flex:1;">${escHtml(issue.text || '')}</div>
          </div>
          <div class="wt-issue-msg">${escHtml(issue.msg || '')}</div>
          ${issue.ctx ? `<div style="font-size:10.5px;color:var(--ink-muted);margin-top:4px;
            padding:4px 8px;background:var(--paper);border-radius:3px;
            font-style:italic;border-left:2px solid var(--cream);">
            ${escHtml(issue.ctx.slice(0,80))}${issue.ctx.length > 80 ? '…' : ''}</div>` : ''}
          ${issue.suggest && issue.suggest.length ? `
            <div class="wt-issue-suggest">
              ${issue.suggest.slice(0,3).map(s =>
                `<button class="wt-suggest-chip"
                  onclick="wtApplySuggestion('${rawEsc}','${escHtml(s)}',event)"
                >${escHtml(s)}</button>`
              ).join('')}
            </div>` : ''}
          ${clicheBtn}
        </div>`;
    }).join('');
  });

  html += `<div class="wt-dismissed-count" id="wt-dismissed-bar" onclick="wtRestoreAll()"></div>`;
  res.innerHTML = html;

  res._totalIssues    = issues.length;
  res._dismissedCount = 0;

  // Auto-dismisser les alertes déjà ignorées (faux positifs persistants)
  setTimeout(() => {
    const ignored = _loadIgnored();
    if (!ignored.size) return;
    document.querySelectorAll('#wt-correct-results .wt-issue').forEach(el => {
      const t = el.dataset.type || 'warning';
      const r = el.dataset.rawText || '';
      if (r && ignored.has(_alertId(t, r))) {
        el.classList.add('dismissed');
        res._dismissedCount++;
      }
    });
    if (res._dismissedCount > 0) {
      const badge = document.getElementById('wt-issue-count');
      if (badge) badge.textContent = (res._totalIssues - res._dismissedCount) + ' point(s)';
      const bar = document.getElementById('wt-dismissed-bar');
      if (bar) {
        bar.textContent = `${res._dismissedCount} alerte${res._dismissedCount > 1 ? 's' : ''} ignorée${res._dismissedCount > 1 ? 's' : ''} — Cliquer pour tout restaurer`;
        bar.classList.add('visible');
      }
    }
  }, 0);
}

// ── Filtrer les alertes par type ──────────────────────────
function wtSetFilter(type) {
  // Mise à jour visuelle des boutons
  document.querySelectorAll('#wt-filter-bar button').forEach(btn => {
    const active = btn.dataset.filter === type;
    btn.style.background    = active ? 'var(--ink)'       : 'var(--paper)';
    btn.style.color         = active ? 'var(--parchment)' : 'var(--ink-soft)';
    btn.style.borderColor   = active ? 'var(--ink)'       : 'var(--cream)';
  });

  // Afficher / masquer les issues
  document.querySelectorAll('#wt-correct-results .wt-issue').forEach(el => {
    if (el.classList.contains('dismissed')) return;
    el.style.display = (type === 'all' || el.dataset.type === type) ? '' : 'none';
  });

  // Masquer les séparateurs de section si leur contenu est vide
  document.querySelectorAll('#wt-correct-results [data-sep]').forEach(sep => {
    let sib = sep.nextElementSibling;
    let visible = false;
    while (sib && !sib.dataset?.sep) {
      if (sib.classList?.contains('wt-issue') && sib.style.display !== 'none') { visible = true; break; }
      sib = sib.nextElementSibling;
    }
    sep.style.display = visible ? '' : 'none';
  });
}

// ══════════════════════════════════════════════════════════
// ── SYSTÈME FAUX POSITIFS — alertes ignorées persistantes ─
// ══════════════════════════════════════════════════════════

const LS_IGNORED_KEY = 'atelier_ignored_alerts';

// Génère un ID robuste pour une alerte :
// type | 3 premiers mots normalisés | 3 derniers mots normalisés | longueur approx
function _alertId(type, rawText) {
  const norm = (s) => (s || '').toLowerCase()
    .replace(/[^\wàâéèêëîïôùûüœç\s]/g, '')
    .replace(/\s+/g, ' ').trim();
  const words = norm(rawText).split(' ').filter(Boolean);
  const first = words.slice(0, 3).join('_');
  const last  = words.slice(-3).join('_');
  const len   = Math.round(words.length / 5) * 5; // arrondi à 5 mots
  return `${type}|${first}|${last}|${len}`;
}

function _loadIgnored() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_IGNORED_KEY) || '[]'));
  } catch(e) { return new Set(); }
}

function _saveIgnored(set) {
  try {
    localStorage.setItem(LS_IGNORED_KEY, JSON.stringify([...set]));
  } catch(e) {}
}

function _addIgnored(id) {
  const set = _loadIgnored();
  set.add(id);
  _saveIgnored(set);
}

// Exposer sur window pour les handlers inline des cartes de style
window._addIgnored = _addIgnored;
window._alertId    = _alertId;

function _removeAllIgnored() {
  try { localStorage.removeItem(LS_IGNORED_KEY); } catch(e) {}
}

function isAlertIgnored(type, rawText) {
  return _loadIgnored().has(_alertId(type, rawText));
}

// ── Ignorer une alerte ─────────────────────────────────
function wtDismissIssue(idx, event) {
  event.stopPropagation();
  const el  = document.getElementById('wt-issue-' + idx);
  const res = document.getElementById('wt-correct-results');
  if (!el) return;

  // Persister l'ID de l'alerte ignorée
  const type    = el.dataset.type    || 'warning';
  const rawText = el.dataset.rawText || '';
  if (rawText) _addIgnored(_alertId(type, rawText));

  el.classList.add('dismissed');
  res._dismissedCount = (res._dismissedCount || 0) + 1;

  // Mettre à jour le badge de compte
  const remaining = res._totalIssues - res._dismissedCount;
  const badge = document.getElementById('wt-issue-count');
  if (badge) badge.textContent = remaining + ' point(s)';

  // Afficher la barre "X ignorées — Restaurer"
  const bar = document.getElementById('wt-dismissed-bar');
  if (bar) {
    bar.textContent = `${res._dismissedCount} alerte${res._dismissedCount > 1 ? 's' : ''} ignorée${res._dismissedCount > 1 ? 's' : ''} — Cliquer pour tout restaurer`;
    bar.classList.add('visible');
  }

  // Recalculer le score de style si l'onglet style est actif
  _wtRecalcStyleScoreAfterDismiss();
}

// ── Restaurer toutes les alertes ignorées ──────────────
function wtRestoreAll() {
  _removeAllIgnored();
  const res = document.getElementById('wt-correct-results');
  document.querySelectorAll('.wt-issue.dismissed').forEach(el => el.classList.remove('dismissed'));
  res._dismissedCount = 0;
  const badge = document.getElementById('wt-issue-count');
  if (badge) badge.textContent = res._totalIssues + ' point(s)';
  const bar = document.getElementById('wt-dismissed-bar');
  if (bar) bar.classList.remove('visible');
  // Recalculer le score sans les filtres d'ignorés
  _wtRecalcStyleScoreAfterDismiss();
}

// ── Recalcul du score de style après dismiss ───────────
// Relit les cartes encore visibles pour ajuster pénalités et score global
function _wtRecalcStyleScoreAfterDismiss() {
  const scoreEl = document.querySelector('#wt-style-results .wt-score-circle span');
  const labelEl = document.querySelector('#wt-style-results .wt-score-label');
  if (!scoreEl || !window._wtLastStyleData) return;

  const d = window._wtLastStyleData;
  const ignored = _loadIgnored();

  // Filtrer les données pénalisantes selon les IDs ignorés
  const longSentsActive   = d.longSentsCtx.filter(s => !ignored.has(_alertId('long',    s.text || s)));
  const repetsActive      = d.closeRepetitions.filter(r => !ignored.has(_alertId('repetition', r.word)));
  const debutsActive      = d.debutsRepetitifs.filter(([w]) => !ignored.has(_alertId('debut', w)));
  const weakActive        = Object.entries(d.weakFound).filter(([mot]) => !ignored.has(_alertId('weak', mot)));
  const verbeCreuxActive  = Object.entries(d.verbeCreuxFound).filter(([v]) => !ignored.has(_alertId('verbe', v)));

  // Recalculer le ratio d'adverbes en excluant ceux ignorés individuellement
  let activeAdverbCount = d.totalAdverbCount || 0;
  if (d.adverbFreq && d.totalWords > 0) {
    activeAdverbCount = Object.entries(d.adverbFreq)
      .filter(([adv]) => !ignored.has(_alertId('adverbe', adv)))
      .reduce((sum, [, cnt]) => sum + cnt, 0);
  }
  const ratioAdvActive = d.totalWords > 0 ? (activeAdverbCount / d.totalWords * 1000) : d.ratioAdverbes;

  let penalty = 0;

  // Phrases longues
  if (longSentsActive.length > 0) penalty += Math.min(20, longSentsActive.length * 4);

  // Adverbes (recalculé après exclusion des adverbes ignorés)
  const ratioAdv = ratioAdvActive;
  if (ratioAdv > d.seuilAdverbesBad)        penalty += Math.min(15, Math.round((ratioAdv - d.seuilAdverbesBad) * 1.2) + 8);
  else if (ratioAdv > d.seuilAdverbesWarn)  penalty += Math.min(7,  Math.round((ratioAdv - d.seuilAdverbesWarn) * 0.8));

  // Mots faibles
  const ratioWeak = d.totalWords > 0 ? (weakActive.length / d.totalWords * 1000) : 0;
  if (ratioWeak > 1.5)            penalty += Math.min(12, Math.round(ratioWeak * 3));
  else if (weakActive.length > 0) penalty += Math.min(6, weakActive.length);

  // Répétitions
  const ratioRep = d.totalWords > 0 ? (repetsActive.length / d.totalWords * 1000) : 0;
  if (ratioRep > 2)                  penalty += Math.min(8, Math.round(ratioRep * 1.5));
  else if (repetsActive.length > 0)  penalty += Math.min(4, repetsActive.length);

  // Rythme monotone
  if (d.hasMonotoneRhythm && d.totalSentences >= 30) penalty += 6;

  // Débuts répétitifs
  if (debutsActive.length > 0) penalty += Math.min(8, debutsActive.length * 3);

  // Voix passive
  if (d.passiveCount > d.seuilPassive) penalty += Math.min(5, Math.round((d.passiveCount - d.seuilPassive) * 0.5));

  // Longueur moyenne
  if (d.avgWPS > d.seuilMoyPhrase) penalty += Math.min(8, Math.round((d.avgWPS - d.seuilMoyPhrase) * 0.8));

  const score = Math.max(0, 100 - penalty);
  const color = styleScoreColor(score);

  // Mise à jour visuelle du cercle de score
  const circle = scoreEl.closest('div');
  if (circle) circle.style.borderColor = color;
  scoreEl.textContent = score;
  scoreEl.style.color = color;
  if (labelEl) { labelEl.textContent = styleScoreLabel(score); labelEl.style.color = color; }

  // Mise à jour compteur phrases longues dans les stats
  const longStatEl = document.querySelector('#wt-style-results .wt-stat-val[data-stat="long"]');
  if (longStatEl) longStatEl.textContent = longSentsActive.length;
}

// Exposer sur window pour les handlers inline
window._wtRecalcStyleScoreAfterDismiss = _wtRecalcStyleScoreAfterDismiss;

// ── SCROLL TEXTAREA VERS UNE POSITION ─────────────────
// Principe : on mesure la position du mot via un mirror dans document.body,
// puis on force le scrollTop via requestAnimationFrame (après que le navigateur
// a potentiellement bougé le scroll via setSelectionRange/focus).
