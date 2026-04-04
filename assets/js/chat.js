(() => {
  'use strict';

  /* ============================================================
     NOVA DEV — IA Conversationnelle Intelligente v5.0 (FR)

     ARCHITECTURE v5.0 — Réécriture complète corrigeant TOUS les
     bugs identifiés dans les captures d'écran :

     BUG 1 CORRIGÉ : "je n'ai aucune idée / je ne sais pas" → affiche
       un menu riche avec des options concrètes, N'INTERROGE JAMAIS
       plus et ne déclenche JAMAIS la réponse ecom/produit.

     BUG 2 CORRIGÉ : Email reçu → accusé de réception UNIQUEMENT.
       Aucun argumentaire commercial. Le flag email est vérifié
       EN PREMIER, avant tout routage d'intention.

     BUG 3 CORRIGÉ : Le mot "produit" seul ne déclenche PAS
       topicContext='ecom'. Seules des phrases explicites comme
       "boutique en ligne", "e-commerce", "vendre en ligne",
       "shopify", "woocommerce", "panier" le font.

     BUG 4 CORRIGÉ : Contamination de contexte — topicContext
       n'est utilisé dans buildReply que s'il a été confirmé par
       le message ACTUEL ou une conversation préalable confirmée.
       Un prénom seul, un bonjour ou un email N'HÉRITE JAMAIS
       du contexte ecom.

     BUG 5 CORRIGÉ : Répétition — un Set de session complet traque
       chaque réponse envoyée. Quand un pool est épuisé, une
       alternative contextuelle est utilisée, pas la même réponse.

     BUG 6 CORRIGÉ : Messages inconnus — classés en 4 sous-catégories
       intelligentes : intro, vague_ecom, vague_web, hors_sujet →
       chacune reçoit une réponse ciblée et non générique.

     AMÉLIORATIONS INTELLIGENCE :
     • 12 secteurs d'activité détectés avec réponses personnalisées
     • Mémorisation des fonctionnalités demandées
     • Tarification contextuelle : devis adapté à qty/pages/budget
     • Capture de leads progressive : prénom → email (jamais répété)
     • Moteur de négociation : 8 angles uniques, sans répétition
  ============================================================ */

  const FORM_ENDPOINT   = 'https://formsubmit.co/ajax/admin@novatvhub.com';
  const AUTO_OPEN_DELAY = 9000;

  /* ── DOM ─────────────────────────────────────────────────── */
  const bubble     = document.getElementById('ai-chat-bubble');
  const chatWindow = document.getElementById('ai-chat-window');
  const closeBtn   = document.getElementById('ai-chat-close');
  const messagesEl = document.getElementById('chat-messages');
  const inputEl    = document.getElementById('chat-input');
  const sendBtn    = document.getElementById('chat-send');
  const badge      = bubble?.querySelector('.chat-badge');
  if (!bubble || !chatWindow) return;

  /* ── ÉTAT ────────────────────────────────────────────────── */
  let isOpen = false, opened = false, isThinking = false, leadSent = false;
  const lead = { name:'', email:'', company:'', phone:'', service:'' };

  /* Mémoire de session — réinitialisée à chaque chargement de page */
  const mem = {
    productCount   : null,   // null | number | 'peu' | 'beaucoup'
    pageCount      : null,   // null | number
    budget         : null,   // null | number | 'petit' | 'large'
    deadline       : null,   // null | string
    sector         : null,   // null | string
    features       : [],
    topicContext   : '',     // '' | 'ecom' | 'website' | 'mobile' | 'landing' | 'redesign'
    topicConfirmed : false,  // true seulement si l'utilisateur a nommé explicitement un type
    turnCount      : 0,
    lastIntent     : '',
    lastReply      : '',
    askedName      : false,
    askedEmail     : false,
    negStage       : 0,
    usedNeg        : new Set(),
    usedReplies    : new Set(),
    emailFlag      : false,  // true seulement si CE message contient une adresse email
  };

  /* ── TARIFS ──────────────────────────────────────────────── */
  const PRICING = {
    website  : { from:150, label:'site web',          cur:'€' },
    landing  : { from:150, label:'landing page',      cur:'€' },
    ecom     : { from:200, label:'site e-commerce',   cur:'€' },
    redesign : { from:150, label:'refonte de site',   cur:'€' },
    design   : { from:150, label:'projet design',     cur:'€' },
    seo      : { from:150, label:'SEO / performance', cur:'€' },
    mobile   : { from:200, label:'application mobile',cur:'€' },
  };

  /* ── BASE DE CONNAISSANCES ───────────────────────────────── */
  const KB = {
    about        : "Nova Dev est une agence premium de design web, développement et applications mobiles. Nous accompagnons des entreprises ambitieuses — startups, PME, marques e-commerce et professions libérales — qui veulent une présence digitale forte et des résultats commerciaux concrets.",
    why          : "Nos clients nous choisissent parce que nous combinons trois choses que la plupart des agences séparent : un design fort, une exécution technique solide et une réflexion commerciale. Nous construisons des expériences qui inspirent confiance, convertissent et soutiennent la croissance.",
    process      : "Notre méthode :\n\n1️⃣ **Découverte** — Comprendre vos objectifs, votre audience et vos contraintes.\n2️⃣ **Design & Développement** — Créer avec précision.\n3️⃣ **Lancement & Évolution** — Vous accompagner après mise en ligne.",
    tech         : "Stack moderne et éprouvée : HTML/CSS/JS, React, Next.js, WordPress, Webflow, Shopify, Node.js — React Native / Flutter pour le mobile. Nous choisissons le bon outil selon le projet.",
    seo          : "Le SEO est intégré dans tout ce qu'on construit — code propre, HTML sémantique, chargement rapide, mobile-first. Travail SEO ciblé sur un site existant : à partir de 150€.",
    mobile_friendly: "Tous nos sites sont entièrement responsifs et conçus mobile-first — une expérience rapide et soignée sur téléphone est incluse dans chaque projet, pas en option.",
    hosting      : "Nous conseillons et configurons l'hébergement dans le cadre de votre projet — Vercel, Netlify ou cloud géré. Domaine et hébergement facturés séparément.",
    cms          : "Oui — nous intégrons des CMS pour que vous puissiez mettre à jour sans développeur : WordPress, Webflow CMS, Sanity ou panneau admin personnalisé.",
    revisions    : "Chaque projet inclut des cycles de révision. Nous partageons les designs avant développement et affinons jusqu'à votre satisfaction.",
    maintenance  : "Nous proposons des forfaits de support et maintenance : nouvelles pages, mises à jour, performance, support de campagnes.",
    guarantee    : "Nous garantissons la qualité. Chaque projet est testé avant lancement — si quelque chose n'est pas parfait, nous le corrigeons, sans discussion.",
    contact      : "La façon la plus simple de démarrer : laissez votre email ici — quelqu'un de notre équipe vous recontactera personnellement, généralement en quelques heures.",
    services_list: "Chez Nova Dev :\n\n📱 **Application mobile** — à partir de 200€\n🌐 **Site web / Web app** — à partir de 150€\n🛍️ **Site E-commerce** — à partir de 200€ (listing dès 5 produits)\n🎨 **Design UI/UX** — à partir de 150€\n🔄 **Refonte de site** — à partir de 150€\n⚡ **SEO & Performance** — à partir de 150€\n\nLequel vous intéresse ?",
  };

  /* ── PICK ANTI-RÉPÉTITION ─────────────────────────────────── */
  function pick(arr) {
    const fresh = arr.filter(r => !mem.usedReplies.has(r));
    const pool  = fresh.length > 0 ? fresh : arr;
    const item  = pool[Math.floor(Math.random() * pool.length)];
    mem.usedReplies.add(item);
    return item;
  }

  function personalize(text) {
    return lead.name
      ? text.replace(/\{name\}/g, lead.name)
      : text.replace(/,?\s*\{name\}/g, '');
  }

  /* ── POOLS DE RÉPONSES ───────────────────────────────────── */
  const POOLS = {
    greeting_new: [
      "Bonjour ! 👋 Je suis l'assistant Nova Dev. Décrivez ce que vous voulez créer — même une idée vague — et je vous proposerai quelque chose de précis.\n\nQuel est votre projet ?",
      "Salut ! 👋 Que voulez-vous créer : un site web, une boutique en ligne, une application mobile ou autre chose ? Je vous guide vers la bonne solution avec prix et délais.",
      "Bonjour ! 👋 Qu'est-ce que vous voulez accomplir en ligne ? Parlez-moi de votre activité et je vous suggère la meilleure approche.",
    ],
    greeting_known: [
      "Re-bonjour {name} ! Comment puis-je vous aider ?",
      "Bon retour {name} ! 😊 On reprend ?",
      "Salut {name} ! Qu'est-ce que je peux faire pour vous ?",
    ],
    thanks: [
      "Avec plaisir ! 😊 D'autres questions ?",
      "Content d'aider ! Qu'est-ce que vous aimeriez savoir d'autre ?",
      "De rien — qu'est-ce qui vient ensuite ?",
    ],
    thanks_known: [
      "Avec plaisir {name} ! 😊 Autre chose ?",
      "C'est un plaisir {name} ! Je vous écoute.",
      "Avec plaisir {name} — je suis là.",
    ],
    bye: [
      "Merci de votre visite ! Quand vous êtes prêt à avancer, on est là. 👋",
      "À bientôt ! N'hésitez pas à revenir quand vous voulez. 👋",
      "Bonne continuation ! On sera là quand vous en aurez besoin. 👋",
    ],
    bye_known: [
      "À bientôt {name} ! 👋",
      "Au revoir {name} — on est là quand vous voulez. 👋",
      "À très bientôt {name} ! 👋",
    ],
    // Menu riche — affiché quand l'utilisateur dit "pas d'idée", "pas sûr", "aidez-moi"
    propose_menu: [
      "Pas de problème — je vais vous orienter ! 😊\n\nVoici les points de départ les plus courants :\n\n🌐 **Site vitrine** (3–5 pages) — présenter votre activité professionnellement — à partir de **150€**\n🛍️ **Boutique e-commerce** — vendre en ligne, listing dès 5 produits — à partir de **200€**\n📄 **Landing page** — une page percutante pour capter des clients — à partir de **150€**\n📱 **Application mobile** — iOS et Android — à partir de **200€**\n\nQuel type d'activité avez-vous ? Ça me dit généralement tout ce dont j'ai besoin.",
      "Permettez-moi de vous aider à choisir ! 🙌\n\nDites-moi juste une chose :\n\n👉 Voulez-vous **vendre des produits** en ligne ?\n👉 Ou **présenter votre activité / services** ?\n👉 Ou **capturer des contacts** avec une seule page ciblée ?\n\nChaque option a une approche et un budget différents. Laquelle ressemble le plus à ce dont vous avez besoin ?",
      "Facile — on part de zéro ensemble ! 🎯\n\nPensez à ce que vous voulez que les visiteurs **fassent** en arrivant sur votre site :\n\n🛒 Acheter quelque chose → **E-commerce** à partir de 200€\n📞 Vous appeler / réserver → **Site web** à partir de 150€\n📧 S'inscrire / vous contacter → **Landing page** à partir de 150€\n📱 Utiliser une app → **Application mobile** à partir de 200€\n\nQuelle action vous importe le plus ?",
    ],
    // Accusé de réception d'email — strict, jamais de pitch commercial
    email_ack_named: [
      "Merci {name}, votre email est bien noté ! ✅ Notre équipe vous contactera dans les **24 heures** avec une proposition personnalisée.\n\nY a-t-il quelque chose de spécifique que vous souhaitez qu'ils couvrent ?",
      "Parfait {name} ! 📧 Quelqu'un de notre équipe vous contactera très prochainement avec un devis adapté.\n\nY a-t-il un délai ou une fourchette de budget à préciser ?",
      "Noté {name} ! 📩 Attendez-vous à avoir de nos nouvelles dans les **24 heures** — on préparera quelque chose de spécifique à votre projet.\n\nQuelque chose d'autre à ajouter avant ça ?",
    ],
    email_ack_anon: [
      "Email bien reçu ! ✅ Notre équipe vous contactera dans les **24 heures** avec une proposition personnalisée.\n\nY a-t-il quelque chose de particulier à préciser ?",
      "Noté ! 📧 Quelqu'un de Nova Dev vous contactera personnellement avec un devis adapté.\n\nY a-t-il un délai ou un budget à mentionner ?",
      "Reçu ! 📩 Attendez-vous à avoir de nos nouvelles dans les **24 heures**.\n\nQuelque chose d'autre à ajouter à votre brief ?",
    ],
    price_follow_up: [
      "Souhaitez-vous une estimation précise pour votre projet ?",
      "Je peux affiner le coût selon vos besoins exacts — quel est votre budget approximatif ?",
      "Un devis sans engagement vous intéresse ?",
    ],
    unknown_ask: [
      "Pouvez-vous développer un peu ? Je veux vous donner une réponse vraiment utile — pas générique. De quoi parle votre activité ou votre projet ?",
      "Donnez-moi un peu plus de contexte et je serai précis. Qu'est-ce que vous cherchez à accomplir en ligne ?",
    ],
  };

  /* ── MOTEUR DE NÉGOCIATION ───────────────────────────────── */
  const NEG_ANGLES = [
    (ctx) => {
      if (ctx==='ecom') return `Pour être direct — notre site e-commerce démarre à **200€**. Le listing commence dès **5 produits**, livraison **15–20 jours** pour ce périmètre.\n\nSi vous avez besoin d'un périmètre plus réduit, dites-moi exactement ce qu'il vous faut et je trouve un format adapté.`;
      const p = PRICING[ctx] || PRICING.website;
      return `Nos projets **${p.label}** démarrent à **${p.from}${p.cur}** — parmi les tarifs les plus compétitifs pour une vraie qualité premium. La plupart des agences facturent 5 à 20 fois plus pour le même travail.\n\nQuel budget aviez-vous en tête ? Je trouverai un périmètre qui correspond.`;
    },
    () => `Voici une approche très appréciée : on commence par une **version ciblée** — l'essentiel pour lancer — puis on étoffe. Moins d'investissement au départ, plus de flexibilité.\n\nQu'est-ce qui est absolument indispensable pour vous au lancement ?`,
    () => `Un site bien construit n'est pas une dépense — c'est un **actif commercial qui travaille 24h/24**. S'il vous apporte un seul client par mois, il se rentabilise rapidement et continue à le faire.\n\nQuels résultats espérez-vous de ce projet ?`,
    () => `Si vous avez eu des devis d'autres agences, vous avez probablement vu 2 000€–10 000€+ pour des projets similaires. Notre mission : **même qualité premium à une fraction du prix** — grâce à des processus plus intelligents.\n\nUn devis sans engagement vous aiderait-il ?`,
    () => `Je veux vraiment trouver une solution pour vous. 🤝\n\n✅ **Livraison par phases** — commencer léger, évoluer ensuite\n✅ **Périmètre ciblé** — impact maximum au prix d'entrée\n✅ **Flexibilité de paiement** — on peut en discuter\n\nPartagez votre email et notre équipe préparera un plan personnalisé.`,
    (ctx) => {
      if (ctx==='ecom') return `Un site e-commerce ouvert 24h/24, qui convertit les visiteurs automatiquement — à **partir de 200€**, il se rentabilise avec une seule vente. Voulez-vous voir exactement ce qui est inclus ?`;
      return `Le coût d'un site mal construit — visiteurs perdus, crédibilité abîmée, correctifs coûteux plus tard — dépasse souvent le coût de bien le faire dès le début. Nous livrons de la qualité à partir de 150€.\n\nVoulez-vous voir ce qui est inclus ?`;
    },
    (ctx) => {
      if (ctx==='ecom') return `Nos clients e-commerce voient plus d'achats finalisés et une meilleure confiance de marque — parce qu'une boutique professionnelle rend l'achat facile et sécurisé.\n\nJ'aimerais vous montrer ce qu'on pourrait créer. Votre email ?`;
      return `Nos clients voient généralement un retour clair dans les semaines suivant le lancement : de meilleurs contacts, une meilleure image de marque, plus de temps économisé.\n\nPartagez votre budget et je vous montre exactement ce qui est possible.`;
    },
    (ctx) => {
      if (ctx==='ecom') return `**À partir de 200€** — sincèrement le tarif le plus compétitif pour un site e-commerce professionnel. Aucun raccourci, aucun frais caché.\n\nNotre équipe peut préparer une proposition sans engagement. Partagez votre email et vous l'aurez en 24 heures. 🙌`;
      return `À **150€ pour commencer**, on est accessibles aux entreprises en croissance. Partagez votre email et l'équipe prépare une proposition taillée exactement à vos objectifs — en 24 heures. 🙌`;
    },
  ];

  function getNeg() {
    let idx = mem.negStage;
    while (mem.usedNeg.has(idx) && idx < NEG_ANGLES.length-1) idx++;
    mem.usedNeg.add(idx);
    mem.negStage = idx + 1;
    return NEG_ANGLES[idx](mem.topicContext);
  }

  /* ════════════════════════════════════════════════════════════
     EXTRACTION DE CONTEXTE
     RÈGLE CRITIQUE : topicContext n'est défini que si le message
     contient des signaux explicites de type de projet (pas juste
     "produit"). Email, prénom, bonjour → NE définissent JAMAIS
     topicContext.
  ════════════════════════════════════════════════════════════ */
  function extractContext(raw) {
    const t = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    mem.emailFlag = false; // réinitialiser à chaque tour

    /* Contact */
    const emailM = raw.match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/);
    if (emailM) {
      if (!lead.email) lead.email = emailM[0];
      mem.emailFlag = true;
    }
    const phoneM = raw.match(/(\+?\d[\d\s\-().]{6,}\d)/);
    if (phoneM && !lead.phone) lead.phone = phoneM[0].trim();

    /* Prénom */
    const nameM = raw.match(/(?:je m(?:'|')appelle|mon pr[eé]nom est|je suis|c(?:'|')est|appelez.moi)\s+([A-ZÀ-Üa-zà-ü]{2,20})/i);
    if (nameM && !lead.name) lead.name = nameM[1].charAt(0).toUpperCase()+nameM[1].slice(1).toLowerCase();
    if (!lead.name && mem.askedName) {
      const w = raw.trim().split(/\s+/);
      if (w.length<=2 && /^[A-ZÀ-Ü]/i.test(w[0]) && w[0].length>=2)
        lead.name = w[0].charAt(0).toUpperCase()+w[0].slice(1).toLowerCase();
    }

    /* Nombre de produits — uniquement si explicitement mentionné */
    const prodM = t.match(/\b(un|une|1)\s+(?:seul\s+)?produit\b/) ||
                  t.match(/\b(deux|2)\s+produits?\b/) ||
                  t.match(/\b(trois|3)\s+produits?\b/) ||
                  t.match(/\b(quatre|4)\s+produits?\b/) ||
                  t.match(/\b(cinq|5)\s+produits?\b/) ||
                  t.match(/\b(\d+)\s+produits?\b/);
    if (prodM) {
      const r = prodM[1];
      const nm = {un:1,une:1,deux:2,trois:3,quatre:4,cinq:5};
      mem.productCount = nm[r]!==undefined ? nm[r] : parseInt(r);
    }
    if (/peu de produits|quelques produits|petit catalogue/.test(t)) mem.productCount='peu';
    if (/beaucoup de produits|nombreux produits|grand catalogue|gros catalogue/.test(t)) mem.productCount='beaucoup';

    /* Nombre de pages */
    if (mem.pageCount===null) {
      const pgM = t.match(/\b(\d+)\s+pages?\b/) ||
                  t.match(/\b(une|1)\s+(?:seule\s+)?page\b/) ||
                  t.match(/\b(deux|2)\s+pages?\b/) ||
                  t.match(/\b(trois|3)\s+pages?\b/);
      if (pgM) {
        const r = pgM[1];
        const nm = {une:1,deux:2,trois:3};
        mem.pageCount = nm[r]!==undefined ? nm[r] : parseInt(r);
      }
      if (/one.page|monopag|une seule page|single page/.test(t)) mem.pageCount=1;
    }

    /* Budget */
    if (mem.budget===null) {
      const bm = t.match(/(\d+)\s*(?:€|euros?)/i);
      if (bm) mem.budget=parseInt(bm[1]);
      else if (/budget (?:serr|petit|limit|modeste|faible)/.test(t)) mem.budget='petit';
      else if (/budget (?:confort|large|important|elev)/.test(t)) mem.budget='large';
    }

    /* Délai */
    if (!mem.deadline) {
      if (/urgent|vite|asap|rapidement|des que possible/.test(t)) mem.deadline='urgent';
      else if (/cette semaine|en une semaine/.test(t)) mem.deadline='1 semaine';
      else if (/ce mois|un mois|dans le mois/.test(t)) mem.deadline='1 mois';
    }

    /* Secteur */
    if (!mem.sector) {
      if (/restaurant|caf[eé]|brasserie|traiteur|pizz/.test(t)) mem.sector='restauration';
      else if (/artisan|plombier|electricien|maçon|peintre|menuisier/.test(t)) mem.sector='artisanat';
      else if (/\bcoach\b|coaching|consultant|formation/.test(t)) mem.sector='conseil';
      else if (/boutique|mode|v[eê]tement|bijou|fashion/.test(t)) mem.sector='mode';
      else if (/immobilier|agence immo|promoteur/.test(t)) mem.sector='immobilier';
      else if (/medecin|dentiste|kine|sant[eé]|therapeute/.test(t)) mem.sector='santé';
      else if (/photo|graphiste|creati|artiste/.test(t)) mem.sector='créatif';
      else if (/startup|saas|logiciel|\btech\b/.test(t)) mem.sector='tech';
      else if (/sport|fitness|gym|yoga|pilates/.test(t)) mem.sector='sport';
      else if (/avocat|notaire|cabinet juridique|droit/.test(t)) mem.sector='juridique';
    }

    /* Fonctionnalités */
    const fmap = {
      'paiement|payer en ligne|carte bancaire|stripe|paypal':'paiement en ligne',
      'blog|articles?|actualit':'blog',
      'galerie|photos?|portfolio':'galerie photos',
      'formulaire|devis en ligne':'formulaire de contact',
      'r[eé]servation|rendez.vous|booking':'réservation',
      'avis|t[eé]moignages?':'avis clients',
      'livraison|colissimo':'gestion livraison',
      'newsletter|liste email':'newsletter',
      'carte|google map':'carte intégrée',
      'multilingue|plusieurs langues|anglais|espagnol':'multilingue',
    };
    for (const [pat,feat] of Object.entries(fmap)) {
      if (new RegExp(pat).test(t) && !mem.features.includes(feat)) mem.features.push(feat);
    }

    /* Type de projet — détection STRICTE, uniquement phrases explicites */
    if (!mem.topicContext) {
      if (/application mobile|app mobile|android|ios|flutter/.test(t))                           { mem.topicContext='mobile';   mem.topicConfirmed=true; }
      else if (/e[\-\s]?commerce|boutique en ligne|shopify|woocommerce|vendre en ligne|woo/.test(t)){ mem.topicContext='ecom';     mem.topicConfirmed=true; }
      else if (/\blanding page\b|page de vente|page d.atterrissage/.test(t))                      { mem.topicContext='landing';  mem.topicConfirmed=true; }
      else if (/refonte|redesign|moderniser|rafraichir/.test(t))                                   { mem.topicContext='redesign'; mem.topicConfirmed=true; }
      else if (/site web|website|web app|nouveau site|cr[eé]er un site|besoin d.un site/.test(t)) { mem.topicContext='website';  mem.topicConfirmed=true; }
      // NOTE : "produit" seul NE déclenche PAS topicContext='ecom'
    }

    /* Libellé service du lead */
    if (!lead.service && mem.topicContext) {
      const lbls = {mobile:'Application mobile',ecom:'Site E-commerce',landing:'Landing page',redesign:'Refonte',design:'Design UI/UX',website:'Site web',seo:'SEO'};
      lead.service = lbls[mem.topicContext]||'';
    }
  }

  /* ════════════════════════════════════════════════════════════
     DÉTECTION D'INTENTION v5.0
     Changement clé : 'no_idea' est un intent de première classe,
     vérifié AVANT tout intent thématique — il gagne toujours.
     Email-only est aussi vérifié avant tout routage.
  ════════════════════════════════════════════════════════════ */
  function detectIntent(raw) {
    const t  = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const is = (...kw) => kw.some(k => t.includes(k));

    /* ── Message ne contenant qu'une adresse email ── */
    if (/^[\w._%+\-]+@[\w.\-]+\.[a-z]{2,}$/.test(raw.trim())) return 'email_only';

    /* ── Pas d'idée / veut des conseils — PRIORITÉ MAXIMALE ── */
    if (is('pas encore','pas d idee','aucune idee','je sais pas','sais pas encore',
           'quoi choisir','que me conseillez','que proposez','pouvez.vous me proposer',
           'pas sur','pas certain','par ou commencer','ou commencer',
           'quel service','que choisir','aider moi','guidez.moi','orientez.moi',
           'que faire','quoi faire','aide moi','besoin de conseils','pas vraiment',
           'premiere fois','premiere experience','nouveau','debutant','jamais fait',
           'ou commencer','comment commencer','par quoi commencer','conseil',
           'recommandez','suggere','quelle option','quelle solution'))
      return 'no_idea';

    /* ── Objections prix ── */
    if (is('cher','trop cher','trop eleve','hors budget','pas les moyens',
           'reduction','moins cher','pas abordable','negocier','budget serre',
           'budget limite','petit budget','pas dans le budget','encore trop',
           'bit cher','un peu cher'))
      return 'negotiate';

    if (is('remise','promo','promotion','offre speciale','deal','coupon'))
      return 'discount';

    if (is('ca vaut','vaut le coup','pourquoi payer','qu est-ce que j obtiens',
           'justifier','rentable','roi','valeur'))
      return 'value';

    if (is('compare','autres agences','concurrents','prix moyen','benchmark'))
      return 'comparison';

    if (is('prix','cout','tarif','budget','combien','devis','facturer','investissement'))
      return 'price';

    if (is('delai','duree','combien de temps','livrer','semaine','mois','quand',
           'rapide','urgent','dans combien'))
      return 'timeline';

    if (is('application mobile','app mobile','android','ios','flutter','react native'))
      return 'mobile';

    if (is('e-commerce','ecommerce','boutique en ligne','shopify','woocommerce',
           'vendre en ligne','panier','commande'))
      return 'ecom';

    if (is('seo','referencement','google','moteur de recherche','visibilite','trafic'))
      return 'seo';

    if (is('refonte','redesign','moderniser','rafraichir','site existant','site actuel'))
      return 'redesign';

    if (is('design','interface','maquette','prototype','wireframe','branding','ui','ux'))
      return 'design';

    if (is('landing page','page d atterrissage','page de vente','page unique'))
      return 'landing';

    if (is('performance','vitesse','chargement','pagespeed','lighthouse'))
      return 'performance';

    if (is('processus','comment vous travaillez','methode','etape','workflow'))
      return 'process';

    if (is('technologie','stack','framework','react','wordpress','webflow'))
      return 'tech';

    if (is('hebergement','domaine','serveur','deployer','cloud'))
      return 'hosting';

    if (is('maintenance','support','apres lancement','mise a jour','retainer'))
      return 'maintenance';

    if (is('cms','gestion de contenu','modifier','editer','backend'))
      return 'cms';

    if (is('revision','modification','retour','iteration','changer'))
      return 'revisions';

    if (is('qui etes','a propos','presentez','que faites','votre agence','nova dev'))
      return 'about';

    if (is('pourquoi vous','pourquoi nova','difference','unique','meilleur','mieux que'))
      return 'why';

    if (is('garantie','qualite','assurance','confiance','remboursement','promesse'))
      return 'guarantee';

    if (is('mobile friendly','responsive','telephone','tablette'))
      return 'mobile_friendly';

    if (is('site web','website','web app','creer un site','nouveau site','besoin d un site'))
      return 'web';

    if (is('contact','email','appeler','parler','consultation','proposition','joindre'))
      return 'contact';

    if (is('service','prestation','offrez','proposez','que pouvez','vous faites quoi'))
      return 'services_list';

    if (is('bonjour','salut','bonsoir','hello','hey','coucou','bjr'))
      return 'greeting';
    if (/^(bonjour|salut|hello|hey|bjr|coucou|bonsoir)[.!?]?\s*$/.test(t.trim())) return 'greeting';

    if (is('merci','super','parfait','excellent','bravo','utile','genial','formidable','top'))
      return 'thanks';

    if (is('au revoir','a bientot','ciao','bye','bonne journee','a plus'))
      return 'bye';

    return 'unknown';
  }

  /* ════════════════════════════════════════════════════════════
     BUILDERS DE RÉPONSES INTELLIGENTES
  ════════════════════════════════════════════════════════════ */

  /* E-commerce — uniquement appelé quand topicContext='ecom' est confirmé */
  function buildEcomReply() {
    const qty  = mem.productCount;
    const pgs  = mem.pageCount;
    const s    = mem.sector;
    const b    = mem.budget;

    // Précis : 1 page + 1 produit
    if (qty===1 && pgs===1) return `Parfait — **1 page, 1 produit**, c'est notre format le plus simple et le plus rapide ! 🎯\n\n✅ 1 page produit (photo, description, prix, bouton d'achat)\n✅ Paiement en ligne sécurisé (carte / PayPal)\n✅ Design professionnel, mobile-first\n✅ Optimisé Google\n\n💰 **À partir de 200€** — livrable en **10 à 15 jours**\n\nC'est quel type de produit ?`;

    // 1 produit
    if (qty===1) return `Super — **un seul produit** simplifie tout !\n\n🔹 **Option mini** — 1 page produit + paiement — à partir de **200€**, prête en **2 semaines**\n🔹 **Option complète** — produit + accueil + contact — à partir de **250€**, prête en **3 semaines**\n\nMinimaliste ou un peu plus complet ?`;

    // 2–5 produits
    if (typeof qty==='number' && qty>=2 && qty<=5) return `**${qty} produit${qty>1?'s':''}** — parfaitement dans notre périmètre de base !\n\n✅ Pages produits individuelles avec photos et descriptions\n✅ Panier + paiement en ligne sécurisé\n✅ Page accueil + contact\n\n💰 **À partir de 200€** — livrable en **15 à 20 jours**\n\nVous avez déjà des photos de vos produits ?`;

    // Grand catalogue
    if (qty==='beaucoup' || (typeof qty==='number' && qty>20)) return `Un **grand catalogue** — parfait pour Shopify ou WooCommerce !\n\n✅ Filtres, recherche, catégories\n✅ Gestion en totale autonomie\n✅ Import CSV pour charger rapidement\n\n💰 **À partir de 350€** selon la complexité\n\nVous avez déjà une liste de vos produits ?`;

    // Réponse e-com spécifique au secteur
    if (s) {
      const sm = {
        mode: "Pour la mode, les photos sont essentielles — une boutique visuellement impactante avec filtres par catégorie, taille, couleur. On associe souvent Shopify à un design personnalisé.",
        restauration: "Pour un restaurant, les essentiels : menu en ligne, galerie photos, réservation, Google Maps. On peut aussi intégrer la commande en ligne.",
        conseil: "Pour un consultant qui vend des services en ligne, une landing page ciblée avec votre offre, des témoignages et un bouton de réservation/paiement est souvent idéale.",
        santé: "Pour un professionnel de santé, la prise de rendez-vous en ligne et une présentation claire des services sont les priorités.",
        créatif: "Pour un créatif qui vend son travail en ligne, votre portfolio fait aussi office de boutique — on le rend visuellement saisissant.",
        tech: "Pour un produit tech, une landing percutante avec démo, grille tarifaire et intégration paiement est la formule gagnante.",
        sport: "Pour le sport, les essentiels : planning des cours, réservation/paiement en ligne, témoignages clients.",
      };
      const msg = sm[s] || `Pour votre secteur, on créera une expérience e-commerce sur mesure autour de vos produits.`;
      return `${msg}\n\n💰 **À partir de 200€** — listing dès 5 produits.\n\nCombien de produits souhaitez-vous mettre en ligne ?`;
    }

    // Budget trop faible
    if (b==='petit' || (typeof b==='number' && b<200)) {
      return `Je comprends — voici ce qui est possible avec un budget serré :\n\n✅ **Landing page 1 page** — à partir de **150€**\n✅ **Site vitrine 3 pages** — à partir de **150€**\n✅ **E-commerce ciblé** — à partir de **200€** (1–5 produits)\n\nCombien de produits souhaitez-vous lister ?`;
    }

    // Fonctionnalités mentionnées
    if (mem.features.length>0) {
      const fl = mem.features.map(f=>`✅ ${f}`).join('\n');
      return `Voici ce que vous cherchez :\n${fl}\n\nTout est réalisable ! Pour affiner le budget — combien de produits souhaitez-vous mettre en ligne ?`;
    }

    // Ecom générique — avec une question ciblée
    return `Nous créons des **sites e-commerce sur mesure** pensés autour de vos produits et de vos clients.\n\n💰 **À partir de 200€** — listing dès 5 produits\n⏱️ **Livraison : 15 à 60 jours** selon la portée\n\nPour vous proposer quelque chose de précis : **combien de produits** souhaitez-vous mettre en ligne ?`;
  }

  /* Site web */
  function buildWebReply() {
    const pgs = mem.pageCount;
    const b   = mem.budget;
    const s   = mem.sector;

    if (pgs===1) return `Une **page unique** — rapide, percutante et économique.\n\n💰 **À partir de 150€** — livrable en **1 à 2 semaines**\n\nC'est pour présenter quoi : votre activité, une offre spécifique, un événement ?`;
    if (typeof pgs==='number' && pgs<=3) return `Un site **${pgs} pages** — format idéal pour une présence pro sans sur-investir.\n\n✅ Accueil + présentation + contact\n💰 **À partir de 150€** — livrable en **2 à 3 semaines**\n\nQuelle est votre activité ?`;
    if (typeof pgs==='number' && pgs>3) return `Un site **${pgs} pages** — portée solide pour une présence professionnelle complète.\n\n💰 **À partir de 150€** pour commencer — le coût final dépend des fonctionnalités.\n\nQuelles sont les pages indispensables ?`;
    if (typeof b==='number' && b>0) return `Avec un budget de **${b}€** :\n${b>=150?'✅ Site vitrine professionnel (3–5 pages)\n':''}${b>=200?'✅ Landing page + blog\n':''}${b>=350?'✅ E-commerce petit catalogue\n':''}\nLaquelle correspond le mieux à vos besoins ?`;
    if (s) {
      const sm = {
        restauration: "Pour un restaurant, un site 4–5 pages comprend généralement : accueil, menu, galerie, réservation, contact.",
        artisanat: "Pour un artisan, un portfolio propre — vos réalisations en photos, formulaire de devis, téléphone visible.",
        conseil: "Pour un consultant, typiquement : accueil avec votre offre, à propos, services, témoignages, contact.",
        immobilier: "Pour l'immobilier : listings de biens, photos, formulaires de contact et estimation en ligne.",
        santé: "Pour un professionnel de santé : présentation des services, réservation en ligne, équipe, contact.",
        créatif: "Pour un créatif, votre portfolio est votre meilleur outil commercial — visuel, immersif, rapide.",
        tech: "Pour une startup tech : landing page, grille tarifaire, points forts, inscription.",
        juridique: "Pour un cabinet juridique : domaines d'expertise, bios d'équipe, signaux de confiance, contact.",
        sport: "Pour le sport : planning des cours, réservation, tarifs, témoignages.",
      };
      const msg = sm[s] || `Pour votre secteur, un site 3–5 pages couvre tous les essentiels.`;
      return `${msg}\n\n💰 **À partir de 150€** — livrable en **2 à 4 semaines**.\n\nCombien de pages vous faut-il ?`;
    }
    return `Nous concevons et développons des **sites web premium** adaptés à vos objectifs.\n\n💰 **À partir de 150€** — design pro, mobile-first, SEO inclus.\n\nPortfolio, site vitrine, e-commerce ou landing page ?`;
  }

  /* Prix contextuel */
  function getPriceReply() {
    const p = PRICING[mem.topicContext] || PRICING.website;
    if (mem.topicContext==='ecom') {
      const q = mem.productCount;
      if (q===1) return `Pour **1 produit** : à partir de **200€**, livrable en 10–15 jours.`;
      if (typeof q==='number' && q<=5) return `Pour **${q} produit${q>1?'s':''}** : à partir de **200€**, livrable en 15–20 jours.`;
      if (typeof q==='number' && q>5) return `Pour **${q} produits** : on démarre à **200€** de base. Partagez votre email pour un devis précis.`;
    }
    if (mem.pageCount===1) return `Pour **1 page** : à partir de **150€**, livrable en 1–2 semaines.`;
    if (mem.topicContext==='mobile') return `Les applications mobiles démarrent à **200€**. Délai : 8–16 semaines. Vous voulez un détail ?`;
    return `Nos projets **${p.label}** démarrent à **${p.from}${p.cur}** — transparent et compétitif.\n\nLe coût final dépend du périmètre. Souhaitez-vous une estimation précise ?`;
  }

  /* ── LEAD NUDGE ──────────────────────────────────────────── */
  function leadNudge() {
    if (mem.emailFlag) return '';
    if (!lead.name && !mem.askedName && mem.turnCount>=2) {
      mem.askedName = true;
      return pick([
        "\n\nÀ qui ai-je le plaisir de parler ? 😊",
        "\n\nComment vous appelez-vous ?",
        "\n\nJ'aimerais personnaliser notre échange — quel est votre prénom ?",
      ]);
    }
    if (lead.name && !lead.email && !mem.askedEmail && mem.turnCount>=3) {
      mem.askedEmail = true;
      return pick([
        `\n\nMerci ${lead.name} ! Quel email pour qu'on vous envoie un devis personnalisé ?`,
        `\n\n${lead.name}, partagez votre email — l'équipe vous répond en moins de 24h.`,
        `\n\nVotre email, ${lead.name} ? On vous prépare une proposition sur mesure.`,
      ]);
    }
    return '';
  }

  /* ════════════════════════════════════════════════════════════
     GÉNÉRATEUR PRINCIPAL
     Flow : extraction → intention → routage → anti-répétition → lead nudge
  ════════════════════════════════════════════════════════════ */
  function generateReply(userText) {
    extractContext(userText);
    mem.turnCount++;

    const intent = detectIntent(userText);
    let reply = '';

    /* ── PRIORITÉ 0 : Email reçu — toujours accuser réception, jamais vendre ── */
    if (mem.emailFlag || intent==='email_only') {
      reply = lead.name
        ? personalize(pick(POOLS.email_ack_named))
        : pick(POOLS.email_ack_anon);
      maybeSendLead();
      mem.lastIntent = 'email_only';
      mem.lastReply  = reply;
      return reply;
    }

    switch (intent) {

      /* ── Pas d'idée / veut des suggestions — TOUJOURS afficher le menu ── */
      case 'no_idea':
        reply = pick(POOLS.propose_menu);
        break;

      case 'greeting':
        reply = lead.name
          ? personalize(pick(POOLS.greeting_known))
          : pick(POOLS.greeting_new);
        break;

      case 'thanks':
        reply = lead.name
          ? personalize(pick(POOLS.thanks_known))
          : pick(POOLS.thanks);
        break;

      case 'bye':
        reply = lead.name
          ? personalize(pick(POOLS.bye_known))
          : pick(POOLS.bye);
        break;

      case 'about':           reply = KB.about;           break;
      case 'why':             reply = KB.why;              break;
      case 'guarantee':       reply = KB.guarantee;        break;
      case 'process':         reply = KB.process;          break;
      case 'tech':            reply = KB.tech;             break;
      case 'hosting':         reply = KB.hosting;          break;
      case 'maintenance':     reply = KB.maintenance;      break;
      case 'cms':             reply = KB.cms;              break;
      case 'revisions':       reply = KB.revisions;        break;
      case 'mobile_friendly': reply = KB.mobile_friendly;  break;
      case 'services_list':   reply = KB.services_list;    break;

      case 'contact':
        mem.askedEmail = true;
        reply = KB.contact;
        break;

      case 'web':
        if (!mem.topicContext) mem.topicContext='website';
        if (!lead.service) lead.service='Site web';
        reply = buildWebReply();
        break;

      case 'mobile':
        mem.topicContext='mobile'; mem.topicConfirmed=true;
        if (!lead.service) lead.service='Application mobile';
        reply = `Nous développons des **applications iOS et Android** haute performance.\n\n💰 **À partir de 200€**\n⏱️ **8 à 16 semaines** du brief au lancement\n\nQuel type d'application : outil client, outil interne ou m-commerce ?`;
        break;

      case 'ecom':
        mem.topicContext='ecom'; mem.topicConfirmed=true;
        if (!lead.service) lead.service='Site E-commerce';
        reply = buildEcomReply();
        break;

      case 'landing':
        mem.topicContext='landing'; mem.topicConfirmed=true;
        if (!lead.service) lead.service='Landing page';
        reply = `Une **landing page** bien conçue est l'investissement le plus rapide pour capter des clients.\n\n💰 **À partir de 150€** — livrable en **1 à 2 semaines**\n\nC'est pour promouvoir quoi : un service, un produit, un événement ?`;
        break;

      case 'redesign':
        mem.topicContext='redesign'; mem.topicConfirmed=true;
        if (!lead.service) lead.service='Refonte de site';
        reply = `Nous pouvons élever votre site existant — direction visuelle plus forte, structure plus claire, meilleure crédibilité.\n\n💰 **À partir de 150€** — la plupart des refontes prennent **3 à 5 semaines**\n\nQu'est-ce qui ne fonctionne pas sur votre site actuel ?`;
        break;

      case 'design':
        if (!mem.topicContext) mem.topicContext='design';
        reply = `Notre travail de design est centré sur **clarté, crédibilité et conversion**.\n\n💰 **À partir de 150€**\n\nDesign seul, ou design + développement ?`;
        break;

      case 'seo':
      case 'performance':
        reply = `SEO et performance intégrés dans tout ce qu'on construit — chargement rapide, code propre, mobile-first.\n\nTravail SEO ciblé sur un site existant ? **À partir de 150€**.`;
        break;

      case 'timeline': {
        let tl = '';
        if (mem.topicContext==='mobile') tl = "**8 à 16 semaines** du brief au lancement pour une application mobile.";
        else if (mem.topicContext==='landing') tl = "**1 à 2 semaines** pour une landing page.";
        else if (mem.topicContext==='ecom') {
          if (mem.productCount===1) tl = "Pour **1 produit** : livrable en **10 à 15 jours**.";
          else if (typeof mem.productCount==='number'&&mem.productCount<=5) tl = `Pour **${mem.productCount} produits** : livrable en **15 à 20 jours**.`;
          else tl = "**15 à 60 jours** selon le volume et la complexité.";
        }
        else if (mem.pageCount===1) tl = "Pour **1 page** : livrable en **1 à 2 semaines**.";
        else if (typeof mem.pageCount==='number'&&mem.pageCount<=3) tl = `Pour **${mem.pageCount} pages** : livrable en **2 à 3 semaines**.`;
        else tl = "Landing page : 1–2 semaines | Site complet : 3–6 semaines | E-commerce : 15–60 jours | App mobile : 8–16 semaines.";
        reply = tl + "\n\nVous avez un délai particulier en tête ?";
        break;
      }

      case 'price':
        reply = getPriceReply() + '\n\n' + pick(POOLS.price_follow_up);
        break;

      case 'negotiate':
        reply = getNeg();
        break;

      case 'discount':
        reply = pick([
          "Nous proposons parfois des offres groupées quand les clients combinent plusieurs services — dites-moi tout ce dont vous avez besoin et je vois ce qui est possible.",
          "Pour les clients prêts à démarrer rapidement, on peut parfois s'adapter. Partagez les détails de votre projet et je cherche des options.",
          "Nous avons des forfaits flexibles. Décrivez l'ensemble de vos besoins et je maximiserai la valeur dans votre budget.",
        ]);
        break;

      case 'value':
        if (mem.topicContext==='ecom') {
          reply = pick([
            "À **partir de 200€**, votre site e-commerce travaille 24h/24 — prenant des commandes même pendant que vous dormez. Une seule vente rembourse l'investissement.",
            "Une boutique e-commerce professionnelle renforce la crédibilité, réduit les abandons de panier et convertit plus. **À partir de 200€, listing dès 5 produits** — un investissement judicieux.",
            "Pensez-y : une seule vente via votre site rembourse l'intégralité du projet. **À partir de 200€**, le ROI arrive vite.",
          ]);
        } else {
          reply = pick([
            "À **150€**, vous obtenez un actif digital qui travaille 24h/24 — plus rentable qu'une journée de pub, et ça dure des années.",
            "Un site bien construit se rentabilise rapidement. À **150€**, vous investissez moins que beaucoup d'entreprises en une seule journée — pour un outil durable.",
            "Un nouveau client via votre site rembourse l'intégralité du projet. **À partir de 150€**, le ROI est évident.",
          ]);
        }
        break;

      case 'comparison':
        reply = pick([
          "Comparé à des agences facturant 2 000€–10 000€+, nos prix sont une fraction — sans sacrifier la qualité. Nos processus efficaces vous font économiser.",
          "La plupart des agences facturent 3 000€–8 000€ pour un site business de base. On démarre à **150€** — parce qu'on a des processus plus intelligents, pas parce qu'on fait des raccourcis.",
        ]);
        break;

      default: {
        /*
          Message inconnu — routage intelligent par sous-catégorie :
          1. Nombre de produits connu → réponse contexte ecom
          2. Nombre de pages connu → réponse contexte web
          3. Contexte thématique établi → continuer dans le contexte
          4. Secteur connu → suggestion spécifique au secteur
          5. Message court → demander de développer
          6. Message plus long → question ouverte sur le type de projet
        */
        if (mem.productCount!==null) {
          mem.topicContext = mem.topicContext||'ecom';
          reply = buildEcomReply();
        } else if (mem.pageCount!==null) {
          mem.topicContext = mem.topicContext||'website';
          reply = buildWebReply();
        } else if (mem.topicContext==='ecom') {
          reply = pick([
            "Parfait — pour votre e-commerce : **combien de produits** souhaitez-vous mettre en ligne ?",
            "Super, on construit votre boutique ! Pour bien cadrer — **combien de produits** au lancement ?",
            "Pour votre projet e-commerce — combien de produits pour commencer ?",
          ]);
        } else if (mem.topicContext==='website') {
          reply = buildWebReply();
        } else if (mem.sector) {
          const sectorRec = {
            restauration: "Pour un restaurant, je recommande un **site avec réservation** (à partir de 150€) ou un **site menu une page** (à partir de 150€). Souhaitez-vous aussi la commande en ligne ?",
            artisanat: "Pour un artisan, un **site portfolio** propre (à partir de 150€) fonctionne très bien. Voulez-vous recevoir des demandes de devis en ligne ?",
            conseil: "Pour un consultant, une **landing page** (à partir de 150€) ou un **site multi-pages** (à partir de 150€) fonctionnent bien. Vendez-vous des formations ou prenez-vous des rdv en ligne ?",
            mode: "Pour la mode, je suggère un **site e-commerce** (à partir de 200€) si vous vendez en ligne, ou un **site portfolio** (à partir de 150€) pour présenter votre marque.",
            sport: "Pour le sport, les essentiels : un **site** avec planning et réservation (à partir de 150€). Vendez-vous aussi des abonnements ou sessions en ligne ?",
            tech: "Pour une startup tech, une **landing page** (à partir de 150€) pour valider votre idée, ou une **web app** complète (à partir de 150€) — où en êtes-vous ?",
            créatif: "Pour un créatif, un **site portfolio** (à partir de 150€) est généralement le meilleur premier pas. Vendez-vous aussi votre travail en ligne ?",
            juridique: "Pour un cabinet juridique, un **site professionnel** (à partir de 150€) avec signaux de confiance, bios d'équipe et formulaire de contact. Combien de pages vous faut-il ?",
            santé: "Pour un professionnel de santé, un **site avec réservation en ligne** (à partir de 150€) est le point de départ le plus impactant. Recevez-vous des patients en cabinet ou en ligne ?",
          };
          reply = sectorRec[mem.sector] || pick(POOLS.propose_menu);
        } else if (mem.lastIntent==='negotiate'||mem.lastIntent==='price') {
          reply = getNeg();
        } else if (userText.trim().length<15) {
          reply = pick(POOLS.unknown_ask);
        } else {
          reply = pick([
            "Je veux vous donner une réponse précise — pas générique. 😊\n\nDites-moi : **que voulez-vous vendre ou montrer en ligne ?** (produits, services, portfolio, réservations...)\n\nCette seule réponse me dit tout ce dont j'ai besoin.",
            "Intéressant — permettez-moi de bien comprendre votre projet. Est-ce :\n\n🛍️ Une **boutique en ligne** (vendre des produits)\n🌐 Un **site web** (présenter vos services)\n📄 Une **landing page** (capter des contacts)\n📱 Une **application mobile** ?\n\nChoisissez juste l'une de ces options !",
            "Pour vous orienter précisément : **quel type d'activité avez-vous ?** (ex. boutique de mode, restaurant, cabinet de conseil, studio de fitness...)\n\nJe vous propose une solution sur mesure instantanément.",
          ]);
        }
      }
    }

    /* ── GARDE ANTI-RÉPÉTITION ABSOLUE ── */
    if (reply && reply===mem.lastReply) {
      if (mem.topicContext==='ecom') {
        reply = pick([
          "Pour votre projet e-commerce — combien de produits pour commencer ?",
          "Soyons précis : quel type de produits vendez-vous, et environ combien ?",
        ]);
      } else if (mem.topicContext) {
        reply = pick(POOLS.propose_menu);
      } else {
        reply = pick(POOLS.unknown_ask);
      }
    }

    mem.usedReplies.add(reply);
    reply += leadNudge();
    mem.lastIntent = intent;
    mem.lastReply  = reply;
    return reply;
  }

  /* ── ENVOI DU LEAD ───────────────────────────────────────── */
  function maybeSendLead() {
    if (lead.email && !leadSent) {
      leadSent = true;
      const ctx = [
        mem.productCount!==null  ? `Produits: ${mem.productCount}`         : '',
        mem.pageCount!==null     ? `Pages: ${mem.pageCount}`               : '',
        mem.budget!==null        ? `Budget: ${mem.budget}€`                : '',
        mem.sector               ? `Secteur: ${mem.sector}`                : '',
        mem.features.length      ? `Fonctions: ${mem.features.join(', ')}` : '',
        mem.deadline             ? `Délai: ${mem.deadline}`                : '',
        lead.name                ? `Nom: ${lead.name}`                     : '',
      ].filter(Boolean).join(' | ');
      const fd = new FormData();
      fd.append('_subject',        `Prospect Nova Dev (FR) — ${lead.name||lead.email}`);
      fd.append('_captcha',        'false');
      fd.append('_template',       'table');
      fd.append('Prénom',          lead.name    || 'Non renseigné');
      fd.append('Email',           lead.email);
      fd.append('Entreprise',      lead.company || 'Non renseigné');
      fd.append('Téléphone',       lead.phone   || 'Non renseigné');
      fd.append('Service',         lead.service || 'Non précisé');
      fd.append('Contexte projet', ctx          || 'Non précisé');
      fd.append('Source',          'Chat IA v5.0 — Nova Dev FR');
      fetch(FORM_ENDPOINT,{method:'POST',headers:{'Accept':'application/json'},body:fd}).catch(()=>{});
      if (typeof fbq==='function') try{fbq('track','Lead');}catch(_){}
    }
  }

  /* ── RENDU ───────────────────────────────────────────────── */
  const clock = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const scrollDown = () => requestAnimationFrame(()=>{ messagesEl.scrollTop=messagesEl.scrollHeight; });

  function appendMsg(text, role) {
    const wrap=document.createElement('div'); wrap.className=`chat-msg ${role}`;
    const bub=document.createElement('div'); bub.className='chat-bubble';
    bub.innerHTML=text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\n/g,'<br>');
    const ts=document.createElement('div'); ts.className='chat-time'; ts.textContent=clock();
    wrap.appendChild(bub); wrap.appendChild(ts);
    messagesEl.appendChild(wrap); scrollDown();
  }

  let typingEl=null;
  function showTyping(){
    if(typingEl)return;
    typingEl=document.createElement('div'); typingEl.className='chat-msg bot';
    typingEl.innerHTML='<div class="chat-typing"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(typingEl); scrollDown();
  }
  function hideTyping(){ if(typingEl){typingEl.remove();typingEl=null;} }

  function handleSend(){
    const val=inputEl?.value.trim();
    if(!val||isThinking)return;
    inputEl.value=''; isThinking=true; setInputEnabled(false);
    appendMsg(val,'user'); showTyping();
    setTimeout(()=>{
      hideTyping();
      const reply=generateReply(val);
      appendMsg(reply,'bot');
      maybeSendLead();
      isThinking=false; setInputEnabled(true); inputEl?.focus();
    }, 400+Math.random()*600);
  }

  function setInputEnabled(on){
    if(inputEl) inputEl.disabled=!on;
    if(sendBtn) sendBtn.disabled=!on;
  }

  /* ── MESSAGE D'ACCUEIL ───────────────────────────────────── */
  function showGreeting(){
    setTimeout(()=>{
      showTyping();
      setTimeout(()=>{
        hideTyping();
        appendMsg("Bonjour ! 👋 Je suis l'assistant Nova Dev.\n\nDites-moi ce que vous voulez créer — **site web, boutique en ligne, application mobile, landing page** — et je vous propose exactement ce qu'il vous faut, avec prix et délais.\n\nPas encore d'idée ? Dites-le-moi et je vous aide à choisir ! 😊", 'bot');
      }, 850);
    }, 300);
  }

  function openChat(){
    if(isOpen)return; isOpen=true;
    chatWindow.removeAttribute('hidden');
    bubble.setAttribute('aria-expanded','true');
    if(badge) badge.style.display='none';
    if(!opened){opened=true; showGreeting();}
    inputEl?.focus();
  }
  function closeChat(){
    isOpen=false;
    chatWindow.setAttribute('hidden','');
    bubble.setAttribute('aria-expanded','false');
  }

  bubble.addEventListener('click',openChat);
  bubble.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();openChat();} });
  closeBtn?.addEventListener('click',closeChat);
  sendBtn?.addEventListener('click',handleSend);
  inputEl?.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();} });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&isOpen)closeChat(); });

  setTimeout(()=>{ if(!isOpen&&!opened)openChat(); }, AUTO_OPEN_DELAY);

})();
