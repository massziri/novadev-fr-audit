(() => {
  'use strict';

  /* ============================================================
     NOVA DEV — Cerveau IA Conversationnel v3.0 (FR)
     • Compréhension contextuelle profonde : mémorise TOUT ce que
       l'utilisateur dit et adapte chaque réponse en conséquence
     • Détecte les détails précis : quantités, budgets, délais,
       type de projet, secteur d'activité
     • Répond à CE que le prospect dit, pas à un script générique
     • Négociation intelligente à 8 angles sans répétition
     • Capture de prospects → admin@novatvhub.com via FormSubmit
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

  /* ── État global ─────────────────────────────────────────── */
  let isOpen = false, opened = false, isThinking = false;
  let leadSent = false;
  const lead = { name:'', email:'', company:'', phone:'', service:'' };

  // Mémoire conversationnelle complète
  const memory = {
    // Ce que le prospect veut exactement
    productCount:   null,   // ex: 1, 5, 20, "beaucoup"
    pageCount:      null,   // ex: 1, 3, "plusieurs"
    budget:         null,   // ex: 100, 200, 500
    deadline:       null,   // ex: "urgent", "1 semaine", "2 mois"
    sector:         null,   // ex: "restaurant", "artisan", "coach"
    projectType:    null,   // site, ecom, mobile, landing, redesign
    features:       [],     // ex: ["paiement", "blog", "galerie"]
    painPoints:     [],     // ex: ["pas de site", "site trop vieux", "pas de ventes"]
    // Contexte conversationnel
    turnCount:      0,
    lastIntent:     '',
    lastBotReply:   '',
    topicContext:   '',
    askedName:      false,
    askedEmail:     false,
    negotiationStage: 0,
    clarifyPending: false,  // on attend une précision du prospect
    clarifyTopic:   '',     // sur quoi on attend la précision
  };

  const usedTexts    = new Set();
  const usedNegAngles = new Set();

  /* ── TARIFS ──────────────────────────────────────────────── */
  const PRICING = {
    website:  { from:150, label:'site web',        currency:'€' },
    landing:  { from:150, label:'landing page',    currency:'€' },
    ecom:     { from:200, label:'site e-commerce', currency:'€' },
    redesign: { from:150, label:'refonte de site', currency:'€' },
    design:   { from:150, label:'projet design',   currency:'€' },
    seo:      { from:150, label:'SEO / performance', currency:'€' },
    mobile:   { from:200, label:'application mobile', currency:'€' },
  };

  /* ── BASE DE CONNAISSANCES ───────────────────────────────── */
  const KB = {
    about:    "Nova Dev est une agence premium de design web, développement et applications mobiles. Nous accompagnons des entreprises ambitieuses — startups, B2B, e-commerce et prestataires de services — qui veulent une présence digitale plus forte et des résultats concrets.",
    why:      "Nos clients nous choisissent parce que nous combinons design fort, exécution technique solide et réflexion commerciale. Pas juste de beaux sites — des expériences qui convertissent et soutiennent votre croissance.",
    process:  "Notre méthode :\n\n1️⃣ **Découverte** — Comprendre vos objectifs et votre situation.\n2️⃣ **Design & Développement** — Créer avec précision et qualité.\n3️⃣ **Lancement & Évolution** — Vous mettre en ligne et vous accompagner.",
    tech:     "Stack technique moderne : HTML/CSS/JS, React, Next.js, WordPress, Webflow, Shopify, Node.js — et React Native / Flutter pour le mobile. On choisit le bon outil, pas le plus tendance.",
    seo:      "Le SEO fait partie intégrante de notre façon de construire — code propre, HTML sémantique, chargement rapide, mobile-first.",
    mobile_friendly: "Tous nos sites sont entièrement responsifs et conçus mobile-first. Une expérience rapide sur smartphone est standard sur chaque projet.",
    hosting:  "Nous conseillons et configurons l'hébergement dans le cadre de votre projet. Généralement Vercel, Netlify ou cloud géré. Domaine et hébergement facturés séparément.",
    cms:      "Nous intégrons des CMS pour que vous puissiez mettre à jour votre contenu sans développeur — WordPress, Webflow CMS, Sanity ou panneau admin personnalisé.",
    revisions: "Chaque projet inclut des cycles de révision. Nous partageons les designs avant le développement et affinons jusqu'à votre satisfaction totale.",
    maintenance: "Nous proposons des forfaits de support et maintenance : nouvelles pages, mises à jour, performances, support de campagnes.",
    guarantee: "Nous garantissons la qualité de chaque livraison. Chaque projet est testé avant lancement — si quelque chose n'est pas parfait, nous le corrigeons.",
    contact:  "La façon la plus simple de commencer : laissez votre email ici — quelqu'un de notre équipe vous recontactera rapidement et personnellement.",
    services_list: "Chez Nova Dev :\n\n📱 **Applications mobiles** — à partir de 200€\n🌐 **Site web / Web app** — à partir de 150€\n🛍️ **Site E-commerce** — à partir de 200€ (listing dès 5 produits)\n🎨 **Design UI/UX** — à partir de 150€\n🔄 **Refonte de site** — à partir de 150€\n⚡ **SEO & Performance** — à partir de 150€\n\nLequel vous intéresse ?",
  };

  /* ── UTILITAIRES ─────────────────────────────────────────── */
  function pickFresh(arr) {
    const available = arr.filter(r => !usedTexts.has(r));
    const pool = available.length > 0 ? available : arr;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    usedTexts.add(pick);
    return pick;
  }

  function personalize(text) {
    return lead.name
      ? text.replace(/\{name\}/g, lead.name)
      : text.replace(/,?\s*\{name\}/g, '');
  }

  /* ── POOLS DE RÉPONSES ───────────────────────────────────── */
  const POOLS = {
    greeting_new: [
      "Bonjour ! 👋 Je suis l'assistant Nova Dev. Dites-moi ce que vous souhaitez créer — site, e-commerce, app — et je vous guide précisément.",
      "Salut ! 👋 Qu'est-ce que vous cherchez à construire ? Décrivez-moi votre projet, même brièvement, je m'adapte à vous.",
      "Bonjour ! 👋 Parlez-moi de votre projet — secteur, taille, objectif — et je vous propose la solution la plus adaptée.",
    ],
    greeting_known: [
      "Re-bonjour {name} ! Comment puis-je vous aider ?",
      "Bon retour {name} ! 😊 On reprend où on en était ?",
      "Salut {name} ! Qu'est-ce que je peux faire pour vous ?",
    ],
    thanks_new: [
      "Avec plaisir ! 😊 Autre chose ?",
      "Content d'aider ! D'autres questions ?",
      "Ravi — quoi d'autre ?",
    ],
    thanks_known: [
      "Avec plaisir, {name} ! Autre chose ?",
      "C'est un plaisir, {name} ! Je vous écoute.",
      "De rien, {name} !",
    ],
    bye_new: [
      "Merci ! Quand vous êtes prêt à avancer, on est là. 👋",
      "À bientôt ! N'hésitez pas à revenir. 👋",
      "Bonne continuation ! On vous attend. 👋",
    ],
    bye_known: [
      "À bientôt {name} ! 👋",
      "Au revoir {name} — on est là quand vous voulez. 👋",
      "À très vite {name} ! 👋",
    ],
    price_follow_up: [
      "Souhaitez-vous une estimation précise pour votre projet ?",
      "Je peux vous aider à cadrer le budget selon vos besoins exacts.",
      "Un devis sans engagement vous intéresse ?",
    ],
    unknown_short: [
      "Pouvez-vous préciser ? Je veux vous donner la réponse la plus utile. 😊",
      "Dites-m'en un peu plus, je m'adapte à votre situation.",
    ],
    unknown_long: [
      "Intéressant ! Pour vous orienter précisément, pouvez-vous me dire quel est votre projet et vos objectifs principaux ?",
      "Bonne question — donnez-moi un peu plus de contexte et je vous guide au mieux.",
    ],
  };

  /* ── MOTEUR DE NÉGOCIATION ───────────────────────────────── */
  const NEG_ANGLES = [
    (ctx) => {
      if (ctx === 'ecom') return `Pour être clair — notre site e-commerce démarre à **200€**. Le listing commence dès **5 produits**, livraison **15–20 jours** pour ce volume.\n\nBesoin de moins de produits ou d'un périmètre plus réduit ? Dites-moi exactement ce dont vous avez besoin et je trouve le format qui correspond à votre budget.`;
      const p = PRICING[ctx] || PRICING.website;
      return `Nos projets **${p.label}** démarrent à **${p.from}${p.currency}** — parmi les tarifs les plus compétitifs pour une vraie qualité premium. La plupart des agences facturent 5 à 20 fois plus.\n\nQuel budget avez-vous en tête ? Je ferai de mon mieux pour trouver une portée qui vous convient.`;
    },
    () => `Voici une approche que beaucoup apprécient : on commence par une **version ciblée** — l'essentiel pour lancer — puis on étoffe au fil de votre croissance. Moins d'investissement au départ, plus de flexibilité.\n\nQu'est-ce qui est absolument indispensable pour vous au lancement ?`,
    () => `Un site bien construit n'est pas une dépense — c'est un **actif commercial** qui travaille 24h/24. S'il vous apporte un seul client par mois, il se rentabilise et continue à performer.\n\nQuels résultats espérez-vous que ce projet génère pour votre business ?`,
    () => `Si vous avez demandé des devis ailleurs, vous avez probablement vu des chiffres entre 2 000€ et 10 000€+. Notre mission : **même qualité premium à une fraction du prix**, grâce à des processus efficaces.\n\nUn devis personnalisé sans engagement vous aiderait-il ?`,
    () => `Je veux vraiment trouver une solution pour vous. 🤝\n\n✅ **Livraison par phases** — commencer léger, évoluer ensuite\n✅ **Périmètre ciblé** — projet impactant au prix d'entrée\n✅ **Flexibilité de paiement** — on peut en discuter\n\nPartagez votre email et l'équipe prépare un plan sur mesure dans votre budget.`,
    (ctx) => {
      if (ctx === 'ecom') return `Un site e-commerce ouvert 24h/24, qui convertit les visiteurs en acheteurs et inspire confiance — à **partir de 200€**, il se rentabilise avec une seule vente.\n\nVoulez-vous voir exactement ce qui est inclus ?`;
      return `Le coût d'un site mal construit est souvent supérieur à celui d'un site fait correctement : perte de visiteurs, crédibilité abîmée, corrections coûteuses. Nous livrons de la qualité qui tient dans le temps — à 150€ pour commencer.\n\nVoulez-vous voir ce qui est inclus à ce tarif ?`;
    },
    (ctx) => {
      if (ctx === 'ecom') return `Nos clients e-commerce constatent plus d'achats finalisés, une meilleure image de marque et plus de confiance client — parce qu'un site professionnel rend l'achat simple et rassurant.\n\nJe peux vous montrer ce qu'on pourrait créer. Votre email ?`;
      return `Nos clients voient généralement un retour clair dans les semaines suivant le lancement : plus de demandes, meilleure crédibilité, plus de temps économisé.\n\nVoulez-vous partager votre budget et on voit exactement ce qu'on peut faire ?`;
    },
    (ctx) => {
      if (ctx === 'ecom') return `**À partir de 200€** — c'est sincèrement le tarif le plus compétitif pour un site e-commerce professionnel. Sans raccourcis, sans frais cachés.\n\nNotre équipe peut préparer une proposition sans engagement. Partagez votre email, vous l'aurez dans 24h. 🙌`;
      return `À **150€ pour commencer**, on est déjà positionnés pour être accessibles. Ce que je *peux* faire : demander à l'équipe une proposition taillée à vos objectifs et budget. Partagez votre email, vous l'aurez dans 24h. 🙌`;
    },
  ];

  function getNegotiationResponse() {
    let idx = memory.negotiationStage;
    while (usedNegAngles.has(idx) && idx < NEG_ANGLES.length - 1) idx++;
    usedNegAngles.add(idx);
    memory.negotiationStage = idx + 1;
    return NEG_ANGLES[idx](memory.topicContext);
  }

  /* ════════════════════════════════════════════════════════════
     EXTRACTION DE DONNÉES AVANCÉE
     Détecte : quantités, budgets, délais, secteur, fonctions
  ════════════════════════════════════════════════════════════ */
  function extractDeepContext(text) {
    const t    = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const tOrig = text.toLowerCase();

    /* ── Contact ── */
    const emailM = text.match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/);
    if (emailM && !lead.email) lead.email = emailM[0];
    const phoneM = text.match(/(\+?\d[\d\s\-().]{6,}\d)/);
    if (phoneM && !lead.phone) lead.phone = phoneM[0].trim();
    const nameM = text.match(/(?:je m(?:'|')appelle|mon pr[eé]nom est|je suis|c(?:'|')est|appelez-moi)\s+([A-ZÀ-Ü][a-zà-ü]{1,20})/i);
    if (nameM && !lead.name) lead.name = nameM[1];
    if (!lead.name && memory.askedName) {
      const words = text.trim().split(/\s+/);
      if (words.length <= 2 && /^[A-ZÀ-Ü][a-zà-ü]+$/.test(words[0])) lead.name = words[0];
    }

    /* ── Nombre de produits ── */
    if (memory.productCount === null) {
      // "un seul produit", "1 produit", "un produit"
      if (/\b(?:un seul|1 seul|un|1)\s+produit\b/.test(t)) memory.productCount = 1;
      else if (/\b(?:deux|2)\s+produits?\b/.test(t))        memory.productCount = 2;
      else if (/\b(?:trois|3)\s+produits?\b/.test(t))       memory.productCount = 3;
      else if (/\b(?:cinq|5)\s+produits?\b/.test(t))        memory.productCount = 5;
      else if (/\b(\d+)\s+produits?\b/.test(t)) {
        const m = t.match(/\b(\d+)\s+produits?\b/);
        memory.productCount = parseInt(m[1]);
      }
      else if (/peu de produits|quelques produits/.test(t)) memory.productCount = 'peu';
      else if (/beaucoup de produits|nombreux produits|grand catalogue/.test(t)) memory.productCount = 'beaucoup';
    }

    /* ── Nombre de pages ── */
    if (memory.pageCount === null) {
      if (/\b(?:une seule|1 seule|une|1)\s+page\b/.test(t))  memory.pageCount = 1;
      else if (/\b(?:deux|2)\s+pages?\b/.test(t))             memory.pageCount = 2;
      else if (/\b(?:trois|3)\s+pages?\b/.test(t))            memory.pageCount = 3;
      else if (/\b(\d+)\s+pages?\b/.test(t)) {
        const m = t.match(/\b(\d+)\s+pages?\b/);
        memory.pageCount = parseInt(m[1]);
      }
      else if (/site\s+(?:one.page|monop|une.page|single.page)/.test(t)) memory.pageCount = 1;
    }

    /* ── Budget explicite ── */
    if (memory.budget === null) {
      const budgetM = tOrig.match(/(\d+)\s*(?:€|euros?|eur)/i);
      if (budgetM) memory.budget = parseInt(budgetM[1]);
      else if (/pas (?:grand|beaucoup de) budget|budget (?:serr[ée]|limit[ée]|petit|modeste)/.test(t)) memory.budget = 'petit';
      else if (/budget (?:confort|large|important|[eé]lev[eé])/.test(t)) memory.budget = 'large';
    }

    /* ── Délai ── */
    if (memory.deadline === null) {
      if (/urgent|rapidement|vite|asap|des que possible|tout de suite/.test(t)) memory.deadline = 'urgent';
      else if (/cette semaine|en une semaine|dans la semaine/.test(t)) memory.deadline = '1 semaine';
      else if (/ce mois|dans le mois|un mois/.test(t)) memory.deadline = '1 mois';
      else if (/deux|2\s*mois/.test(t)) memory.deadline = '2 mois';
    }

    /* ── Secteur / activité ── */
    if (!memory.sector) {
      if (/restaurant|caf[eé]|brasserie|traiteur|pizz|sushi/.test(t)) memory.sector = 'restauration';
      else if (/artisan|plombier|electricien|maçon|carreleur|peintre|menuisier/.test(t)) memory.sector = 'artisanat';
      else if (/coach|coaching|formation|consultant|conseil/.test(t)) memory.sector = 'conseil';
      else if (/boutique|mode|v[eê]tement|bijou|accessoire/.test(t)) memory.sector = 'mode';
      else if (/immobilier|agence immo|promoteur/.test(t)) memory.sector = 'immobilier';
      else if (/m[eé]decin|dentiste|kine|infirmier|sant[eé]|th[eé]rapeute/.test(t)) memory.sector = 'santé';
      else if (/photo|photographe|vid[eé]o|graphiste|creati/.test(t)) memory.sector = 'créatif';
      else if (/startup|saas|logiciel|appli|tech/.test(t)) memory.sector = 'tech';
      else if (/sport|fitness|gym|yoga|pilates/.test(t)) memory.sector = 'sport';
    }

    /* ── Fonctionnalités souhaitées ── */
    const featureMap = {
      'paiement|payer en ligne|carte bancaire|stripe|paypal':     'paiement en ligne',
      'blog|articles?|actualit[eé]s?':                            'blog',
      'galerie|photos?|portfolio':                                 'galerie photos',
      'formulaire|contact|devis en ligne':                        'formulaire de contact',
      'reservation|rendez.vous|booking|agenda':                   'réservation',
      'avis|t[eé]moignages?|reviews?':                            'avis clients',
      'livraison|colissimo|chronopost':                           'gestion livraison',
      'stock|inventaire|gestion des produits':                    'gestion stock',
      'multilingue|anglais|espagnol|en plusieurs langues':        'multilingue',
      'carte|map|google map|adresse':                             'carte intégrée',
      'newsletter|liste email|abonnes?':                          'newsletter',
      'chat|whatsapp|messagerie':                                  'chat/messagerie',
    };
    for (const [pattern, feature] of Object.entries(featureMap)) {
      if (new RegExp(pattern).test(t) && !memory.features.includes(feature)) {
        memory.features.push(feature);
      }
    }

    /* ── Points de douleur ── */
    if (/pas de site|sans site|aucun site/.test(t) && !memory.painPoints.includes('sans site'))
      memory.painPoints.push('sans site');
    if (/site (?:vieux|vieilli|obsol|ancien|depass)/.test(t) && !memory.painPoints.includes('site obsolète'))
      memory.painPoints.push('site obsolète');
    if (/pas de ventes?|ne vend pas|ventes? en berne/.test(t) && !memory.painPoints.includes('pas de ventes'))
      memory.painPoints.push('pas de ventes');
    if (/pas visible|invisible|introuvable|pas sur google/.test(t) && !memory.painPoints.includes('pas visible'))
      memory.painPoints.push('pas visible');

    /* ── Type de projet ── */
    if (!memory.topicContext) {
      if (/application mobile|app mobile|android|ios|flutter/.test(t)) memory.topicContext = 'mobile';
      else if (/e.commerce|boutique|shopify|woocommerce|vendre|produits?|panier/.test(t)) memory.topicContext = 'ecom';
      else if (/landing page|page de vente|page d.atterrissage/.test(t)) memory.topicContext = 'landing';
      else if (/refonte|redesign|moderniser|rafraichir/.test(t)) memory.topicContext = 'redesign';
      else if (/site web|website|web app|nouveau site/.test(t)) memory.topicContext = 'website';
    }

    /* ── Service lead ── */
    if (!lead.service && memory.topicContext) {
      const labels = {
        mobile:'Application mobile', ecom:'Site E-commerce', landing:'Landing page',
        redesign:'Refonte de site', design:'Design UI/UX', website:'Site web', seo:'SEO'
      };
      lead.service = labels[memory.topicContext] || '';
    }
  }

  /* ════════════════════════════════════════════════════════════
     GÉNÉRATEUR DE RÉPONSES CONTEXTUELLES
     C'est ici que la magie opère — chaque réponse est unique
     et directement liée à ce que le prospect a dit
  ════════════════════════════════════════════════════════════ */
  function buildSmartEcomReply(userText) {
    const t = userText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const qty   = memory.productCount;
    const pages = memory.pageCount;
    const feats = memory.features;
    const sector = memory.sector;
    const budget = memory.budget;

    // ── Cas : 1 page + 1 produit (exactement comme le screenshot) ──
    if ((qty === 1 || qty === 'peu') && pages === 1) {
      return `Parfait — **1 page, 1 produit**, c'est en fait notre format le plus simple et le plus rapide à livrer ! 🎯\n\nCe qu'on crée pour vous :\n✅ **1 page produit** (photo, description, prix, bouton d'achat)\n✅ Paiement en ligne sécurisé (carte bancaire)\n✅ Design professionnel adapté à votre marque\n✅ Mobile-first et optimisé Google\n\n💰 **À partir de 200€** — livrable en **10 à 15 jours**\n\nC'est quel type de produit vous vendez ?`;
    }

    // ── Cas : 1 seul produit mais pas de précision sur les pages ──
    if (qty === 1) {
      return `Super — **un seul produit**, ça simplifie tout ! Pas besoin d'un catalogue complet.\n\nOn peut faire :\n🔹 **Option mini** — 1 page produit épurée + paiement en ligne → à partir de **200€**, livrable en **2 semaines**\n🔹 **Option complète** — page produit + page accueil + contact → à partir de **250€**, livrable en **3 semaines**\n\nVous préférez la version minimaliste ou un peu plus complète ?`;
    }

    // ── Cas : 1 seule page (landing / one-page) ──
    if (pages === 1 && !memory.topicContext.includes('ecom')) {
      return `Une **page unique** — excellent choix pour aller vite et à l'essentiel ! 🎯\n\nUne landing page bien construite peut :\n✅ Présenter votre offre clairement\n✅ Capturer des contacts / réservations\n✅ Convertir les visiteurs en clients\n\n💰 **À partir de 150€** — livrable en **1 à 2 semaines**\n\nC'est pour quel type d'activité ?`;
    }

    // ── Cas : budget explicitement petit ──
    if (budget === 'petit' || (typeof budget === 'number' && budget < 200)) {
      const budgetStr = typeof budget === 'number' ? `${budget}€` : 'un budget serré';
      return `Je comprends — ${budgetStr}, c'est réaliste et on peut travailler avec ça.\n\nPour ${budgetStr}, voici ce qui est possible :\n✅ **Landing page 1 page** — à partir de **150€** (notre entrée de gamme)\n✅ **Site vitrine 3 pages** — à partir de **150€**\n\nPour un site e-commerce, on démarre à **200€** avec un périmètre ciblé. Combien de produits vous souhaitez mettre en ligne ?`;
    }

    // ── Cas : peu de produits ──
    if (qty !== null && typeof qty === 'number' && qty <= 3) {
      return `**${qty} produit${qty > 1 ? 's' : ''}** seulement — c'est très gérable et ça reste dans notre périmètre de base !\n\nPour ${qty} produit${qty > 1 ? 's' : ''} :\n✅ Pages produits individuelles avec photos et descriptions\n✅ Panier + paiement en ligne sécurisé\n✅ Page accueil + contact\n💰 **À partir de 200€** — livrable en **15 à 20 jours**\n\nVous avez déjà des photos de vos produits ?`;
    }

    // ── Cas : beaucoup de produits / grand catalogue ──
    if (qty === 'beaucoup' || (typeof qty === 'number' && qty > 20)) {
      return `Un **grand catalogue** — parfait pour Shopify ou WooCommerce !\n\nAvec ${typeof qty === 'number' ? qty + ' produits' : 'un large catalogue'}, on recommande :\n✅ Shopify ou WooCommerce (gestion facile en autonomie)\n✅ Filtres, recherche, catégories\n✅ Import CSV pour charger tous les produits rapidement\n💰 **À partir de 350€** selon la complexité\n\nVous avez déjà une liste de vos produits ?`;
    }

    // ── Cas : fonctionnalités spécifiques mentionnées ──
    if (feats.length > 0) {
      const featList = feats.map(f => `✅ ${f}`).join('\n');
      return `Voici ce que vous voulez :\n${featList}\n\nTout ça est faisable ! Maintenant, pour affiner le budget, pouvez-vous me dire combien de produits vous avez et si vous avez un délai en tête ?`;
    }

    // ── Cas : secteur détecté, personnaliser ──
    if (sector) {
      const sectorMsg = {
        restauration: `Pour un restaurant, les essentiels sont : menu en ligne, galerie photos, réservation et accès Google Maps. On peut aussi intégrer un système de commande en ligne si besoin.`,
        artisanat: `Pour un artisan, un site vitrine efficace suffit souvent : présentation de vos réalisations, devis en ligne, et numéro de téléphone bien visible. Simple et efficace.`,
        conseil: `Pour un coach ou consultant, une landing page bien construite avec votre offre, vos témoignages et un bouton de réservation peut suffire pour commencer.`,
        mode: `Pour la mode, les photos sont essentielles — on construira un site e-commerce visuellement impactant avec un filtrage par catégorie, taille, couleur.`,
        immobilier: `Pour l'immobilier, on peut créer un site avec listings de biens, photos, formulaires de contact et estimation en ligne.`,
        santé: `Pour un professionnel de santé, la prise de rendez-vous en ligne et la présentation claire de vos services sont les priorités.`,
        créatif: `Pour un créatif, votre portfolio est votre meilleur outil commercial — on crée une expérience visuelle qui met en valeur votre travail.`,
        tech: `Pour une startup tech, on recommande une landing page percutante avec votre proposition de valeur, une démo ou capture d'email, et un design moderne.`,
        sport: `Pour un coach sportif ou une salle de sport, les essentiels sont : planning des cours, réservation en ligne et témoignages clients.`,
      };
      return `${sectorMsg[sector]}\n\n💰 **À partir de 150€** selon la portée.\n\nCombien de pages avez-vous besoin et quel est votre budget approximatif ?`;
    }

    // ── Réponse ecom générique enrichie (si aucun contexte précis) ──
    return `Nous créons des **sites e-commerce sur mesure** — conçus autour de vos produits et de vos clients.\n\n💰 **À partir de 200€**\n📦 **Listing dès 5 produits**\n⏱️ **Livraison : 15 à 60 jours** selon la complexité\n\nPour vous proposer quelque chose de précis : combien de produits souhaitez-vous mettre en ligne ?`;
  }

  function buildSmartWebReply() {
    const pages  = memory.pageCount;
    const sector = memory.sector;
    const feats  = memory.features;
    const budget = memory.budget;

    if (pages === 1) {
      return `Une **page unique** — rapide, percutante et économique.\n\n💰 **À partir de 150€** — livrable en **1 à 2 semaines**\n\nC'est pour présenter quoi : votre activité, une offre spécifique, un événement ?`;
    }
    if (pages !== null && typeof pages === 'number' && pages <= 3) {
      return `Un site **${pages} pages** — c'est le format idéal pour une présence professionnelle sans sur-investir.\n\n✅ Page accueil + présentation + contact\n💰 **À partir de 150€** — livrable en **2 à 3 semaines**\n\nQuelle est votre activité ?`;
    }
    if (sector) {
      return buildSmartEcomReply(''); // réutilise le secteur
    }
    if (budget !== null && typeof budget === 'number') {
      return `Avec **${budget}€** de budget, voici ce que je peux vous proposer :\n${budget >= 150 ? '✅ Site vitrine professionnel (3–5 pages)\n' : ''}${budget >= 200 ? '✅ Landing page + blog\n' : ''}${budget >= 350 ? '✅ Site e-commerce petit catalogue\n' : ''}\nLaquelle correspond le mieux à vos besoins ?`;
    }
    return `Nous créons des **sites web premium** adaptés à vos objectifs.\n\n💰 **À partir de 150€** — design pro, mobile-first, SEO inclus.\n\nQuel type de site cherchez-vous ? (vitrine, portfolio, e-commerce, landing page ?)`;
  }

  /* ── DÉTECTION D'INTENTION ───────────────────────────────── */
  function detectIntent(text) {
    const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const is = (...kw) => kw.some(k => t.includes(k));

    // Objections prix
    if (is('cher','trop cher','trop eleve','excessif','hors budget','pas les moyens',
           'baisser','reduction','moins cher','pas abordable','trop couteux','arnaque',
           'negocier','budget serre','budget limite','petit budget','pas dans le budget',
           'encore trop','quand meme','un peu cher','expensive','too much','cheaper'))
      return 'negotiate';

    if (is('remise','promo','promotion','offre speciale','prix special','deal','coupon'))
      return 'discount';

    if (is('ca vaut','vaut le coup','pourquoi payer','qu est-ce que j obtiens','inclus',
            'justifier','rentable','roi','valeur'))
      return 'value';

    if (is('compare','autres agences','concurrents','prix moyen','tarif moyen','benchmark'))
      return 'comparison';

    if (is('prix','cout','tarif','budget','combien','devis','facturer','investissement','payer'))
      return 'price';

    if (is('delai','duree','combien de temps','livrer','semaine','mois','quand','rapide','urgent'))
      return 'timeline';

    if (is('application mobile','app mobile','android','ios','iphone','flutter','react native'))
      return 'mobile';

    if (is('e-commerce','ecommerce','boutique en ligne','shopify','woocommerce','vendre en ligne',
            'produit','panier','commande','boutique','acheter'))
      return 'ecom';

    if (is('seo','referencement','google','moteur de recherche','rang','visibilite','trafic'))
      return 'seo';

    if (is('refonte','redesign','ameliorer','moderniser','rafraichir','site existant','site actuel'))
      return 'redesign';

    if (is('design','ui','ux','interface','maquette','prototype','wireframe','look'))
      return 'design';

    if (is('landing page','page d atterrissage','page unique','page de vente'))
      return 'landing';

    if (is('performance','vitesse','chargement','core web','pagespeed','lighthouse'))
      return 'performance';

    if (is('processus','comment vous travaillez','methode','etape','workflow'))
      return 'process';

    if (is('technologie','stack','framework','react','next','wordpress','webflow'))
      return 'tech';

    if (is('hebergement','domaine','serveur','deployer','cloud'))
      return 'hosting';

    if (is('maintenance','support','apres lancement','mise a jour','suivi','retainer'))
      return 'maintenance';

    if (is('cms','gestion de contenu','modifier','editer','backend'))
      return 'cms';

    if (is('revision','modification','retour','iteration','changer','ajuster'))
      return 'revisions';

    if (is('qui etes','a propos','presentez','que faites-vous','votre agence','nova dev'))
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

    if (is('merci','super','parfait','excellent','bravo','utile','genial','formidable','top','cool'))
      return 'thanks';

    if (is('au revoir','a bientot','ciao','bye','bonne journee','a plus'))
      return 'bye';

    return 'unknown';
  }

  /* ── RÉPONSE PRIX CONTEXTUELLE ───────────────────────────── */
  function getPriceReply() {
    const p = PRICING[memory.topicContext] || PRICING.website;
    if (memory.productCount !== null && memory.topicContext === 'ecom') {
      const qty = memory.productCount;
      if (qty === 1) return `Pour **1 seul produit**, notre tarif e-commerce démarre à **200€** — c'est notre format le plus simple et le plus rapide (livrable en 10–15 jours).`;
      if (typeof qty === 'number' && qty <= 5) return `Pour **${qty} produit${qty>1?'s':''}**, comptez à partir de **200€** — livrable en 15–20 jours.`;
      if (typeof qty === 'number' && qty > 5) return `Pour **${qty} produits**, le budget dépend du niveau de personnalisation. On démarre à **200€** pour la base et on adapte selon vos besoins. Partagez votre email pour un devis précis.`;
    }
    if (memory.pageCount === 1) return `Pour **1 seule page**, on démarre à **150€** — livrable en 1–2 semaines.`;
    return `Nos projets **${p.label}** démarrent à **${p.from}${p.currency}** — transparent et compétitif.\n\nLe coût final dépend du périmètre et des fonctionnalités. Souhaitez-vous une estimation précise ?`;
  }

  /* ── NUDGE PROSPECT ──────────────────────────────────────── */
  function leadNudge() {
    if (!lead.name && !memory.askedName && memory.turnCount >= 2) {
      memory.askedName = true;
      return pickFresh([
        "\n\nÀ qui ai-je le plaisir de parler ? 😊",
        "\n\nEt si je puis me permettre, comment vous appelez-vous ?",
        "\n\nJ'aimerais personnaliser notre échange — quel est votre prénom ?",
      ]);
    }
    if (lead.name && !lead.email && !memory.askedEmail && memory.turnCount >= 3) {
      memory.askedEmail = true;
      return pickFresh([
        `\n\nMerci ${lead.name} ! Quel email pour que notre équipe vous envoie un devis personnalisé ?`,
        `\n\n${lead.name}, si vous souhaitez un devis ou plus d'infos, partagez votre email.`,
        `\n\nVotre email, ${lead.name} ? L'équipe vous répond en moins de 24h.`,
      ]);
    }
    return '';
  }

  /* ── GÉNÉRATION DE RÉPONSE PRINCIPALE ───────────────────── */
  function generateReply(userText) {
    extractDeepContext(userText);
    memory.turnCount++;

    // Si on attendait une précision, on traite la réponse en contexte
    if (memory.clarifyPending) {
      memory.clarifyPending = false;
      const clarifyIntent = detectIntent(userText);
      if (clarifyIntent === 'unknown' || memory.turnCount <= 3) {
        // Répondre intelligemment selon ce que l'utilisateur vient de préciser
        if (memory.topicContext === 'ecom' || memory.productCount !== null) {
          return buildSmartEcomReply(userText) + leadNudge();
        }
        if (memory.topicContext === 'website' || memory.pageCount !== null) {
          return buildSmartWebReply() + leadNudge();
        }
      }
    }

    const intent = detectIntent(userText);
    let reply = '';

    switch (intent) {

      case 'greeting':
        reply = lead.name
          ? personalize(pickFresh(POOLS.greeting_known))
          : pickFresh(POOLS.greeting_new);
        break;

      case 'thanks':
        reply = lead.name
          ? personalize(pickFresh(POOLS.thanks_known))
          : pickFresh(POOLS.thanks_new);
        break;

      case 'bye':
        reply = lead.name
          ? personalize(pickFresh(POOLS.bye_known))
          : pickFresh(POOLS.bye_new);
        break;

      case 'about':       reply = KB.about;       break;
      case 'why':         reply = KB.why;          break;
      case 'guarantee':   reply = KB.guarantee;    break;
      case 'process':     reply = KB.process;      break;
      case 'tech':        reply = KB.tech;         break;
      case 'hosting':     reply = KB.hosting;      break;
      case 'maintenance': reply = KB.maintenance;  break;
      case 'cms':         reply = KB.cms;          break;
      case 'revisions':   reply = KB.revisions;    break;
      case 'mobile_friendly': reply = KB.mobile_friendly; break;

      case 'contact':
        memory.askedEmail = true;
        reply = KB.contact;
        break;

      case 'services_list':
        reply = KB.services_list;
        break;

      case 'web':
        memory.topicContext = memory.topicContext || 'website';
        if (!lead.service) lead.service = 'Site web';
        reply = buildSmartWebReply();
        break;

      case 'mobile':
        memory.topicContext = 'mobile';
        if (!lead.service) lead.service = 'Application mobile';
        reply = `Nous développons des **applications iOS et Android** haute performance.\n\n💰 **À partir de 200€** — parmi les tarifs les plus compétitifs pour du développement mobile de qualité.\n\nQuel type d'application avez-vous en tête ? (outil interne, app client, e-commerce mobile ?)`;
        break;

      case 'ecom':
        memory.topicContext = 'ecom';
        if (!lead.service) lead.service = 'Site E-commerce';
        reply = buildSmartEcomReply(userText);
        break;

      case 'landing':
        memory.topicContext = 'landing';
        if (!lead.service) lead.service = 'Landing page';
        reply = `Une **landing page** bien conçue est l'investissement le plus rapide pour capter des clients.\n\n💰 **À partir de 150€** — livrée en **1 à 2 semaines**.\n\nC'est pour promouvoir quoi : un service, un produit, un événement ?`;
        break;

      case 'redesign':
        memory.topicContext = 'redesign';
        if (!lead.service) lead.service = 'Refonte de site';
        reply = `Nous pouvons élever votre site existant — direction visuelle plus forte, structure plus claire.\n\n💰 **À partir de 150€**, livraison en **3 à 5 semaines**.\n\nQu'est-ce qui ne fonctionne pas sur votre site actuel ?`;
        break;

      case 'design':
        memory.topicContext = memory.topicContext || 'design';
        reply = `Notre travail de design est centré sur **clarté, crédibilité et conversion**.\n\n💰 **À partir de 150€**.\n\nDesign seul ou design + développement ?`;
        break;

      case 'seo':
      case 'performance':
        reply = `SEO et performance sont intégrés dans tout ce qu'on construit — chargement rapide, code propre, mobile-first.\n\nBesoin d'un travail SEO sur un site existant ? **À partir de 150€**.`;
        break;

      case 'timeline': {
        // Réponse adaptée au contexte mémorisé
        let tl = '';
        if (memory.topicContext === 'mobile') tl = "**8 à 16 semaines** du brief au lancement pour une app mobile.";
        else if (memory.topicContext === 'landing') tl = "**1 à 2 semaines** pour une landing page.";
        else if (memory.topicContext === 'ecom') {
          if (memory.productCount === 1) tl = "Pour **1 produit** : livrable en **10 à 15 jours**.";
          else if (typeof memory.productCount === 'number' && memory.productCount <= 5)
            tl = `Pour **${memory.productCount} produits** : livrable en **15 à 20 jours**.`;
          else tl = "**15 à 60 jours** selon le volume et la complexité.";
        }
        else if (memory.pageCount === 1) tl = "Pour **1 page** : livrable en **1 à 2 semaines**.";
        else if (typeof memory.pageCount === 'number' && memory.pageCount <= 3)
          tl = `Pour **${memory.pageCount} pages** : livrable en **2 à 3 semaines**.`;
        else tl = "Landing page : 1–2 semaines | Site complet : 3–6 semaines | E-commerce : 15–60 jours | App mobile : 8–16 semaines.";
        reply = tl + "\n\nVous avez un délai particulier en tête ?";
        break;
      }

      case 'price':
        reply = getPriceReply() + '\n\n' + pickFresh(POOLS.price_follow_up);
        break;

      case 'negotiate':
        reply = getNegotiationResponse();
        break;

      case 'discount':
        reply = pickFresh([
          "Nous proposons parfois des offres groupées quand les clients combinent plusieurs services. Dites-moi l'ensemble de vos besoins et je vois ce qu'on peut optimiser.",
          "Pour les clients prêts à démarrer rapidement, on peut parfois ajuster. Partagez les détails de votre projet.",
          "Nous avons des forfaits flexibles. Décrivez tout ce dont vous avez besoin et je vois comment maximiser la valeur dans votre budget.",
        ]);
        break;

      case 'value':
        if (memory.topicContext === 'ecom') {
          reply = pickFresh([
            "À **partir de 200€**, votre site e-commerce travaille 24h/24 — vitrine ouverte en permanence, commandes qui tombent même quand vous dormez. Un seul achat rembourse l'investissement.",
            "Un site e-commerce professionnel renforce la crédibilité, augmente les conversions et donne confiance aux acheteurs. **À partir de 200€, listing dès 5 produits** — l'un des meilleurs investissements pour tout vendeur.",
            "Pensez-y : une vente via votre site rembourse tout le projet. À **partir de 200€**, le retour sur investissement est rapide.",
          ]);
        } else {
          reply = pickFresh([
            "À **150€**, vous obtenez un actif digital qui travaille 24h/24, renforce votre crédibilité et convertit les visiteurs en clients — bien plus qu'une journée de pub.",
            "Un site bien construit se rentabilise rapidement. À **150€**, vous investissez moins que ce que beaucoup dépensent en une journée — pour un outil qui dure des années.",
            "Un seul nouveau client depuis votre site rembourse le projet — et il continue à travailler. À **150€** pour commencer, le ROI est évident.",
          ]);
        }
        break;

      case 'comparison':
        reply = pickFresh([
          "Comparé à d'autres agences qui facturent 2 000€ à 10 000€+, nos prix sont une fraction du coût — sans sacrifier la qualité. Nos processus efficaces vous font profiter des économies.",
          "La plupart des agences facturent 3 000€–8 000€ pour un site business. On démarre à **150€** — parce qu'on a construit des processus plus intelligents, pas parce qu'on coupe les coins.",
        ]);
        break;

      default:
        // Vérifier si c'est une réponse à une question qu'on avait posée
        if (memory.clarifyTopic === 'productCount' && /\d+/.test(userText)) {
          memory.topicContext = memory.topicContext || 'ecom';
          reply = buildSmartEcomReply(userText);
          memory.clarifyTopic = '';
        }
        else if (memory.lastIntent === 'negotiate' || memory.lastIntent === 'price') {
          reply = getNegotiationResponse();
        }
        // Répondre en contexte si on a des infos mémorisées
        else if (memory.topicContext === 'ecom' || memory.productCount !== null) {
          reply = buildSmartEcomReply(userText);
        }
        else if (memory.topicContext === 'website' || memory.pageCount !== null) {
          reply = buildSmartWebReply();
        }
        else if (userText.trim().length < 12) {
          reply = pickFresh(POOLS.unknown_short);
        }
        else {
          // Essayer de détecter si le message décrit un besoin
          reply = pickFresh([
            "Intéressant ! Pour vous proposer quelque chose de vraiment adapté — c'est pour quel type de projet : site vitrine, e-commerce, application mobile, ou autre ?",
            "Je veux vous donner une réponse précise. Décrivez-moi votre projet en quelques mots : que voulez-vous vendre ou présenter, et à qui ?",
            "Dites-m'en plus sur votre projet — secteur d'activité, ce que vous voulez proposer en ligne, et votre idée de budget ?",
          ]);
          memory.clarifyPending = true;
        }
    }

    // Protection anti-répétition
    if (reply === memory.lastBotReply) {
      if (['price','negotiate','discount','value','comparison'].includes(intent)) {
        reply = getNegotiationResponse();
      } else {
        reply = pickFresh(POOLS.unknown_long);
      }
    }

    reply += leadNudge();
    memory.lastIntent   = intent;
    memory.lastBotReply = reply;
    return reply;
  }

  /* ── ENVOI DU PROSPECT ───────────────────────────────────── */
  function maybeSendLead() {
    if (lead.email && lead.name && !leadSent) {
      leadSent = true;
      const fd = new FormData();
      const context = [
        memory.productCount !== null ? `Produits: ${memory.productCount}` : '',
        memory.pageCount !== null    ? `Pages: ${memory.pageCount}` : '',
        memory.budget !== null       ? `Budget: ${memory.budget}€` : '',
        memory.sector               ? `Secteur: ${memory.sector}` : '',
        memory.features.length      ? `Fonctions: ${memory.features.join(', ')}` : '',
        memory.deadline             ? `Délai: ${memory.deadline}` : '',
      ].filter(Boolean).join(' | ');
      fd.append('_subject',         `Prospect Nova Dev Chat (FR) — ${lead.name}`);
      fd.append('_captcha',         'false');
      fd.append('_template',        'table');
      fd.append('Prénom',           lead.name);
      fd.append('Email',            lead.email);
      fd.append('Entreprise',       lead.company  || 'Non renseigné');
      fd.append('Téléphone',        lead.phone    || 'Non renseigné');
      fd.append('Service souhaité', lead.service  || 'Non précisé');
      fd.append('Contexte projet',  context       || 'Non précisé');
      fd.append('Source',           'Widget Chat IA v3 — Nova Dev FR');
      fetch(FORM_ENDPOINT, { method:'POST', headers:{'Accept':'application/json'}, body:fd }).catch(()=>{});
      if (typeof fbq === 'function') try { fbq('track','Lead'); } catch(_){}
    }
  }

  /* ── RENDU ───────────────────────────────────────────────── */
  const clock = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const scrollDown = () => requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });

  function appendMsg(text, role) {
    const wrap = document.createElement('div');
    wrap.className = `chat-msg ${role}`;
    const bub = document.createElement('div');
    bub.className = 'chat-bubble';
    bub.innerHTML = text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\n/g,'<br>');
    const ts = document.createElement('div');
    ts.className = 'chat-time';
    ts.textContent = clock();
    wrap.appendChild(bub);
    wrap.appendChild(ts);
    messagesEl.appendChild(wrap);
    scrollDown();
  }

  let typingEl = null;
  function showTyping() {
    if (typingEl) return;
    typingEl = document.createElement('div');
    typingEl.className = 'chat-msg bot';
    typingEl.innerHTML = '<div class="chat-typing"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(typingEl);
    scrollDown();
  }
  function hideTyping() { if (typingEl) { typingEl.remove(); typingEl = null; } }

  /* ── FLUX D'ENVOI ────────────────────────────────────────── */
  function handleSend() {
    const val = inputEl?.value.trim();
    if (!val || isThinking) return;
    inputEl.value = '';
    isThinking = true;
    setInputEnabled(false);
    appendMsg(val, 'user');
    showTyping();
    const delay = 400 + Math.random() * 600;
    setTimeout(() => {
      hideTyping();
      const reply = generateReply(val);
      appendMsg(reply, 'bot');
      maybeSendLead();
      isThinking = false;
      setInputEnabled(true);
      inputEl?.focus();
    }, delay);
  }

  function setInputEnabled(on) {
    if (inputEl) inputEl.disabled = !on;
    if (sendBtn) sendBtn.disabled = !on;
  }

  /* ── MESSAGE D'ACCUEIL ───────────────────────────────────── */
  function showGreeting() {
    setTimeout(() => {
      showTyping();
      setTimeout(() => {
        hideTyping();
        appendMsg("Bonjour ! 👋 Je suis l'assistant Nova Dev.\n\nDites-moi ce que vous voulez créer — **site vitrine, e-commerce, app mobile, landing page** — et je vous propose exactement ce qu'il vous faut, avec un prix et un délai précis.\n\nQuel est votre projet ?", 'bot');
      }, 850);
    }, 300);
  }

  /* ── OUVRIR / FERMER ─────────────────────────────────────── */
  function openChat() {
    if (isOpen) return;
    isOpen = true;
    chatWindow.removeAttribute('hidden');
    bubble.setAttribute('aria-expanded','true');
    if (badge) badge.style.display = 'none';
    if (!opened) { opened = true; showGreeting(); }
    inputEl?.focus();
  }
  function closeChat() {
    isOpen = false;
    chatWindow.setAttribute('hidden','');
    bubble.setAttribute('aria-expanded','false');
  }

  /* ── ÉVÉNEMENTS ──────────────────────────────────────────── */
  bubble.addEventListener('click', openChat);
  bubble.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' '){e.preventDefault();openChat();} });
  closeBtn?.addEventListener('click', closeChat);
  sendBtn?.addEventListener('click', handleSend);
  inputEl?.addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();} });
  document.addEventListener('keydown', e => { if (e.key==='Escape'&&isOpen) closeChat(); });

  /* ── OUVERTURE AUTO ──────────────────────────────────────── */
  setTimeout(() => { if (!isOpen && !opened) openChat(); }, AUTO_OPEN_DELAY);

})();
