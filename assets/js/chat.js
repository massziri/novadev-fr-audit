(() => {
  'use strict';

  /* ============================================================
     NOVA DEV — Moteur de Chat IA Élite (FR)
     • Négociation intelligente à plusieurs étapes
     • Ne répète jamais la même phrase
     • Réponses contextuelles basées sur le fil de conversation
     • Tarifs : site web à partir de 150€, mobile à partir de 200€
     • Site e-commerce : à partir de 200€, listing dès 5 produits, livraison 15–60 jours
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

  /* ── État ────────────────────────────────────────────────── */
  let isOpen = false, opened = false, isThinking = false;
  const lead = { name:'', email:'', company:'', phone:'', service:'' };
  let leadSent = false;

  // Mémoire anti-répétition
  const usedTexts = new Set();
  // Intelligence conversationnelle
  let negotiationStage  = 0;
  let lastIntent        = '';
  let lastBotReply      = '';
  let topicContext      = '';   // service dont on parle
  let turnCount         = 0;
  let askedName         = false;
  let askedEmail        = false;
  const usedNegAngles   = new Set();

  /* ── TARIFS ──────────────────────────────────────────────── */
  const PRICING = {
    website:  { from:150, label:'site web',              currency:'€' },
    landing:  { from:150, label:'landing page',          currency:'€' },
    ecom:     { from:200, label:'site e-commerce',          currency:'€' },
    redesign: { from:150, label:'refonte de site',       currency:'€' },
    design:   { from:150, label:'projet design',         currency:'€' },
    seo:      { from:150, label:'SEO / performance',     currency:'€' },
    mobile:   { from:200, label:'application mobile',    currency:'€' },
  };

  /* ── BASE DE CONNAISSANCES ───────────────────────────────── */
  const KB = {
    about:    "Nova Dev est une agence premium de design web, développement et applications mobiles. Nous accompagnons des entreprises ambitieuses — startups, sociétés B2B, marques e-commerce et prestataires de services — qui veulent une présence digitale plus forte et des résultats commerciaux concrets.",

    why:      "Nos clients nous choisissent parce que nous combinons trois choses que la plupart des agences séparent : un design visuel fort, une exécution technique solide et une réflexion commerciale. Nous ne créons pas de beaux sites — nous construisons des expériences qui inspirent confiance, convertissent et soutiennent une vraie croissance.",

    process:  "Notre méthode est simple et efficace :\n\n1️⃣ **Découverte** — Nous comprenons vos objectifs, votre audience et votre situation actuelle.\n\n2️⃣ **Design & Développement** — Nous créons l'interface et développons avec précision et qualité.\n\n3️⃣ **Lancement & Évolution** — Nous vous mettons en ligne et vous accompagnons dans votre croissance.",

    tech:     "Nous utilisons une stack technique moderne et éprouvée : HTML/CSS/JavaScript, React, Next.js, WordPress, Webflow, Shopify, Node.js — et React Native / Flutter pour les apps mobiles. Nous choisissons le bon outil pour chaque projet, pas le plus tendance.",

    seo:      "Le SEO fait partie intégrante de notre façon de construire — code propre, HTML sémantique, chargement rapide, mobile-first, structure correcte. Ce sont les fondations techniques que Google récompense. Nous intervenons aussi sur l'optimisation SEO de sites existants.",

    mobile_friendly: "Tous nos sites sont entièrement responsifs et conçus mobile-first. Une expérience rapide et soignée sur smartphone n'est pas une option — c'est la norme sur chaque projet.",

    hosting:  "Nous conseillons et configurons l'hébergement dans le cadre de votre projet. Nous recommandons généralement Vercel, Netlify ou un hébergement cloud géré. Les frais de domaine et d'hébergement sont séparés du développement.",

    cms:      "Oui — nous intégrons des solutions CMS pour que vous puissiez mettre à jour le contenu sans développeur. Nous travaillons avec WordPress, Webflow CMS, Sanity et des panneaux d'administration personnalisés.",

    revisions: "Chaque projet inclut des cycles de révision. Nous partageons les designs avant le développement, recueillons vos retours et affinons jusqu'à votre satisfaction totale.",

    maintenance: "Nous proposons des forfaits de support et maintenance. Au fil de votre croissance, nous faisons évoluer votre site — nouvelles pages, mises à jour, améliorations de performance et support de campagnes.",

    guarantee: "Nous garantissons la qualité de chaque livraison. Chaque projet est testé en profondeur avant le lancement, et si quelque chose n'est pas parfait, nous le corrigeons. La majorité de nos clients reviennent — c'est la meilleure preuve de notre engagement.",

    contact:  "La façon la plus simple de commencer est de laisser votre email ici — quelqu'un de notre équipe vous recontactera rapidement et personnellement. Ou utilisez le formulaire de contact ci-dessous si vous préférez.",

    services_list: "Voici ce que nous proposons chez Nova Dev :\n\n📱 **Développement d'applications mobiles** — à partir de 200€\n🌐 **Site web / Application web** — à partir de 150€\n🛍️ **Site E-commerce** — à partir de 200€ (listing dès 5 produits)\n🎨 **Design UI/UX** — à partir de 150€\n🔄 **Refonte de site** — à partir de 150€\n⚡ **SEO & Performance** — à partir de 150€\n\nLes prix dépendent de la portée du projet. Lequel vous intéresse le plus ?",
  };

  /* ── PICK FRESH (anti-répétition) ────────────────────────── */
  function pickFresh(arr) {
    const available = arr.filter(r => !usedTexts.has(r));
    const pool = available.length > 0 ? available : arr;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    usedTexts.add(pick);
    return pick;
  }

  function personalize(text) {
    return lead.name ? text.replace(/\{name\}/g, lead.name) : text.replace(/,?\s*\{name\}/g, '');
  }

  /* ── POOLS DE RÉPONSES ───────────────────────────────────── */
  const POOLS = {
    greeting_new: [
      "Bonjour ! 👋 Bienvenue chez Nova Dev. Je peux répondre à toutes vos questions — services, tarifs, délais, technologie. De quoi souhaitez-vous parler ?",
      "Salut ! 👋 Ravi de vous accueillir. Que vous exploriez vos options ou soyez prêt à démarrer, je suis là. Qu'est-ce qui vous amène ?",
      "Bonjour ! 👋 Je suis l'assistant Nova Dev. Posez-moi n'importe quelle question sur le design web, le développement d'apps, les tarifs ou notre façon de travailler.",
    ],
    greeting_known: [
      "Bonjour {name} ! Content de vous revoir. En quoi puis-je vous aider ?",
      "Re-bonjour {name} ! 😊 Comment puis-je vous assister aujourd'hui ?",
      "Salut {name} ! Qu'est-ce que je peux faire pour vous ?",
    ],
    thanks_new: [
      "Avec plaisir ! 😊 Autre chose que je peux faire pour vous ?",
      "Content d'avoir pu aider ! N'hésitez pas si vous avez d'autres questions.",
      "Ravi d'avoir pu vous aider — quoi d'autre souhaiteriez-vous savoir ?",
    ],
    thanks_known: [
      "Avec plaisir, {name} ! 😊 Autre chose en tête ?",
      "C'est un plaisir, {name} ! Posez-moi toutes vos autres questions.",
      "De rien, {name} ! Que puis-je faire d'autre pour vous ?",
    ],
    bye_new: [
      "Merci pour votre visite ! Quand vous serez prêt à discuter d'un projet, nous serons là. 👋",
      "À bientôt ! Nous sommes disponibles quand vous voulez avancer. 👋",
      "C'était un plaisir ! Revenez quand vous le souhaitez. 👋",
    ],
    bye_known: [
      "À bientôt, {name} ! Nous adorerions travailler avec vous. 👋",
      "Au revoir, {name} ! Contactez-nous quand vous êtes prêt. 👋",
      "À très vite, {name} ! On est là quand vous voulez démarrer. 👋",
    ],
    unknown_short: [
      "Pourriez-vous préciser un peu ? Je veux vous donner la réponse la plus utile possible. 😊",
      "J'aimerais vous aider — pouvez-vous m'en dire un peu plus sur ce que vous cherchez ?",
      "Pouvez-vous développer ? Je veux m'assurer de vous donner la meilleure réponse.",
    ],
    unknown_long: [
      "Excellente question ! Pour vous donner la réponse la plus précise, pourriez-vous partager un peu plus de contexte sur votre projet ? Je suis là pour tout — services, tarifs, délais, technologie.",
      "Bonne question — pourriez-vous me donner un peu plus de contexte ? Je veux m'assurer de vous orienter au mieux.",
      "Je veux vous donner une réponse précise. Pouvez-vous m'en dire un peu plus sur votre situation ? Budget, délais, services — je m'occupe de tout.",
    ],
    price_follow_up: [
      "Souhaitez-vous une estimation plus précise pour votre projet ?",
      "Voulez-vous que je vous aide à cadrer le coût selon vos besoins exacts ?",
      "Je peux vous mettre en contact avec l'équipe pour un devis détaillé sans engagement — vous voulez ?",
    ],
  };

  /* ── MOTEUR DE NÉGOCIATION ───────────────────────────────── */
  // 8 angles de négociation distincts — sans répétition
  const NEG_ANGLES = [
    // Angle 0 — Clarification du prix (toujours en premier)
    (ctx) => {
      if (ctx === 'ecom') return `Pour être clair — notre site e-commerce démarre à **200€**. Le listing commence dès **5 produits** et est livré en **15–20 jours**. Besoin de plus de produits ? On peut étendre le catalogue.\n\nQuel type de boutique souhaitez-vous créer ?`;
      const p = PRICING[ctx] || PRICING.website;
      return `Pour être précis — nos projets de **${p.label}** démarrent à seulement **${p.from}${p.currency}**. C'est déjà l'un des tarifs les plus compétitifs du marché pour une vraie qualité premium. La plupart des agences facturent 5 à 20 fois plus.\n\nQuel est le budget que vous avez en tête ? Je ferai de mon mieux pour trouver une portée qui vous convient.`;
    },
    // Angle 1 — Approche MVP / par phases
    () => `Voici une approche que beaucoup de nos clients adorent : on commence par une **version lean et ciblée** — les pages et fonctionnalités essentielles pour l'instant. Une fois le site en ligne et les résultats au rendez-vous, on l'enrichit. Investissement réduit au départ, projet qui grandit avec votre business.\n\nQuel sont les éléments absolument indispensables pour vous au lancement ?`,
    // Angle 2 — Retour sur investissement
    () => `Permettez-moi de changer d'angle. Un site bien construit n'est pas une dépense — c'est un **actif commercial** qui travaille 24h/24, 365 jours par an. S'il vous apporte un seul nouveau client par mois, il se rentabilise rapidement et continue à performer. Comparez ça à un mois de publicité sans rien de durable.\n\nQuels résultats espérez-vous que ce projet génère pour votre business ?`,
    // Angle 3 — Comparaison marché
    () => `Si vous avez demandé des devis ailleurs, vous avez probablement vu des chiffres entre 2 000€ et 10 000€+ pour des projets similaires. Notre mission, c'est d'offrir **la même qualité premium à une fraction du prix** — sans rogner sur la qualité, parce que nous avons construit des processus efficaces qui font profiter nos clients de ces économies.\n\nUn devis personnalisé sans engagement vous aiderait-il ? Je peux l'organiser.`,
    // Angle 4 — Offre de flexibilité
    () => `Je veux vraiment trouver une solution qui vous convient. 🤝 Voici ce qu'on peut envisager :\n\n✅ **Livraison par phases** — commencer léger, évoluer ensuite\n✅ **Périmètre ciblé** — projet impactant au prix d'entrée\n✅ **Flexibilité de paiement** — on peut discuter d'un échelonnement\n\nSi vous partagez votre email, l'équipe vous préparera un plan sur mesure dans votre budget — sans pression.`,
    // Angle 5 — Valeur de la qualité professionnelle
    (ctx) => {
      if (ctx === 'ecom') return `Pensez à ce qu'un bon site e-commerce fait pour vous : il est ouvert 24h/24, convertit les visiteurs en acheteurs et inspire confiance automatiquement. À **partir de 200€** — il se rentabilise avec une seule vente.\n\nVoulez-vous voir exactement ce qui est inclus dans le pack de base ?`;
      return `Je comprends la sensibilité au budget — mais je vous rappelle doucement : **le coût d'un site mal construit est souvent supérieur** à celui d'un site fait correctement. Un site mal fait fait fuir les visiteurs, nuit à la crédibilité et nécessite souvent des corrections coûteuses plus tard.\n\nNous livrons de la qualité qui tient dans le temps — et à 150€ pour commencer, c'est une vraie valeur. Voulez-vous savoir ce qui est inclus à ce tarif ?`;
    },
    // Angle 6 — Succès clients
    (ctx) => {
      if (ctx === 'ecom') return `Nos clients e-commerce constatent généralement plus d'achats finalisés, une image de marque plus forte et une meilleure confiance client — parce qu'un site professionnel rend l'achat simple et rassurant.\n\nJ'aimerais vous montrer ce qu'on pourrait créer pour votre boutique. Voulez-vous partager votre email afin que notre équipe vous envoie les détails ?`;
      return `Nos clients — des entreprises comme la vôtre — voient généralement un **retour clair dans les semaines suivant le lancement** : meilleure qualité des demandes entrantes, image de marque renforcée, plus de temps économisé grâce à un site qui répond vraiment aux questions.\n\nJ'aimerais vous montrer ce qu'on pourrait construire pour votre budget spécifique. Voulez-vous partager avec quoi vous travaillez ?`;
    },
    // Angle 7 — Clôture douce finale
    (ctx) => {
      if (ctx === 'ecom') return `Je respecte votre position, et je veux être direct : **à partir de 200€** est sincèrement le tarif le plus compétitif que vous trouverez pour un site e-commerce professionnel — sans raccourcis, sans frais cachés.\n\nNotre équipe peut préparer une proposition sans engagement montrant exactement ce que votre boutique obtiendrait. Partagez votre email et vous l'aurez dans les 24h. 🙌`;
      return `Je respecte votre position, et je veux être honnête : à **150€ pour commencer**, on est déjà positionnés pour être accessibles aux entreprises en croissance. Je ne peux pas aller plus bas en bonne conscience tout en livrant la qualité que vous méritez.\n\nCe que je *peux* faire, c'est demander à l'équipe de préparer une proposition sans engagement, taillée exactement à vos objectifs et budget. Partagez votre email et vous l'aurez dans 24h. 🙌`;
    },
  ];

  function getNegotiationResponse() {
    let idx = negotiationStage;
    while (usedNegAngles.has(idx) && idx < NEG_ANGLES.length - 1) idx++;
    usedNegAngles.add(idx);
    negotiationStage = idx + 1;
    return NEG_ANGLES[idx](topicContext);
  }

  /* ── DÉTECTION D'INTENTION ───────────────────────────────── */
  function detectIntent(text) {
    const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const is = (...kw) => kw.some(k => t.includes(k));

    // Objections prix (vérifier EN PREMIER)
    if (is('cher','trop cher','trop eleve','excessif','hors budget','depasse budget',
           'pas les moyens','baisser','reduction','remise','moins cher','reduire',
           'pas abordable','trop couteux','pas rentable','arnaque','serieusement',
           'non merci','je peux trouver','quelqu autre','autre agence','concurrent',
           'freelance','fiverr','upwork','negocier','budget serre','budget limite',
           'petit budget','pas dans le budget','budget est','mon budget','n ai que',
           'seulement','peux me permettre','c est beaucoup','c est bcp',
           'encore trop','quand meme beaucoup','c est eleve','un peu cher',
           'expensive','too much','can t afford','cheaper','discount'))
      return 'negotiate';

    if (is('remise','reduction de prix','promo','promotion','offre speciale','prix special','deal'))
      return 'discount';

    if (is('ca vaut','vaut le coup','pourquoi payer','qu est-ce que j obtiens','inclus',
            'justifier','rentable','retour sur investissement','roi','valeur'))
      return 'value';

    if (is('compare','autres agences','concurrents','prix moyen','tarif moyen',
            'marche','benchmark','par rapport aux autres'))
      return 'comparison';

    if (is('prix','cout','cout','tarif','budget','combien','devis','facturer',
            'investissement','forfait','payer','tarification'))
      return 'price';
    if (is('delai','duree','combien de temps','livrer','semaine','mois','quand','rapide',
            'vite','long','dans combien'))
      return 'timeline';
    if (is('application mobile','app mobile','android','ios','iphone','flutter',
            'react native','developpement app','smartphone','tablette'))
      return 'mobile';
    if (is('e-commerce','boutique en ligne','shopify','woocommerce','vendre en ligne',
            'produit','panier','commande','boutique','chatbot','chat bot','agent ia',
            'agent virtuel','assistant virtuel','bot pour ma boutique','automatise'))
      return 'ecom';
    if (is('seo','referencement','google','moteur de recherche','rang','visibilite',
            'trafic organique','mot cle'))
      return 'seo';
    if (is('refonte','redesign','ameliorer','moderniser','rafraichir','site existant',
            'site actuel','rebrand'))
      return 'redesign';
    if (is('design','ui','ux','interface','maquette','prototype','wireframe',
            'look','esthetique','branding'))
      return 'design';
    if (is('landing page','page d atterrissage','page unique','page de vente','page campagne'))
      return 'landing';
    if (is('performance','vitesse','chargement rapide','core web','pagespeed','lighthouse','optimis'))
      return 'performance';
    if (is('processus','comment vous travaillez','methode','etape','workflow',
            'comment ca marche','votre approche'))
      return 'process';
    if (is('technologie','stack','framework','react','next','wordpress','webflow',
            'plateforme','construit avec'))
      return 'tech';
    if (is('hebergement','domaine','serveur','deployer','cloud','cdn','infrastructure'))
      return 'hosting';
    if (is('maintenance','support','apres lancement','mise a jour','suivi','retainer'))
      return 'maintenance';
    if (is('cms','gestion de contenu','modifier','editer le contenu','backend'))
      return 'cms';
    if (is('revision','modification','retour','iteration','changer','ajuster'))
      return 'revisions';
    if (is('qui etes','a propos','presentez','que faites-vous','votre agence',
            'votre equipe','nova dev'))
      return 'about';
    if (is('pourquoi vous','pourquoi nova','difference','unique','meilleur',
            'mieux que','versus','concurrent'))
      return 'why';
    if (is('garantie','qualite','assurance','confiance','remboursement','promesse'))
      return 'guarantee';
    if (is('mobile friendly','responsive','telephone','tablette','taille ecran','sur mobile'))
      return 'mobile_friendly';
    if (is('site web','website','web app','creer un site','creer un site','nouveau site',
            'besoin d un site','construire un site','developpement web'))
      return 'web';
    if (is('contact','email','appeler','parler','consultation','devis','proposition','joindre'))
      return 'contact';
    if (is('service','prestation','offrez','proposez','que pouvez'))
      return 'services_list';
    if (is('bonjour','salut','bonsoir','hello','hey','coucou','bjr'))
      return 'greeting';
    if (is('merci','super','parfait','excellent','bravo','utile','genial','formidable','top'))
      return 'thanks';
    if (is('au revoir','a bientot','ciao','bye','bonne journee','a plus'))
      return 'bye';

    return 'unknown';
  }

  /* ── RÉPONSE PRIX CONTEXTUELLE ───────────────────────────── */
  function getPriceReply() {
    const p = PRICING[topicContext] || PRICING.website;
    return `Nos projets de **${p.label}** démarrent à seulement **${p.from}${p.currency}** — transparent, compétitif et conçu pour vous offrir une vraie qualité sans le tarif gonflé des grandes agences.\n\nLe coût final dépend du périmètre, des fonctionnalités et du délai. Souhaitez-vous une estimation plus précise ?`;
  }

  /* ── EXTRACTION DE DONNÉES ───────────────────────────────── */
  function extractData(text) {
    const emailM = text.match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/);
    if (emailM && !lead.email) lead.email = emailM[0];

    const phoneM = text.match(/(\+?\d[\d\s\-().]{6,}\d)/);
    if (phoneM && !lead.phone) lead.phone = phoneM[0].trim();

    const nameM = text.match(/(?:je m(?:'|')appelle|mon pr[eé]nom est|je suis|c(?:'|')est moi|appelez-moi)\s+([A-ZÀ-Ü][a-zà-ü]{1,20})/i);
    if (nameM && !lead.name) lead.name = nameM[1];
    if (!lead.name && askedName) {
      const words = text.trim().split(/\s+/);
      if (words.length <= 2 && /^[A-ZÀ-Ü][a-zà-ü]+$/.test(words[0])) lead.name = words[0];
    }

    const compM = text.match(/(?:entreprise(?:\s+est)?|societe(?:\s+est)?|société(?:\s+est)?|travaille (?:pour|chez)|chez|pour)\s+([A-Za-z0-9 &.,'-]{2,30})/i);
    if (compM && !lead.company) lead.company = compM[1].trim();

    if (!topicContext) {
      const low = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      if (low.includes('mobile') || low.includes('android') || low.includes('ios') || low.includes(' app ')) topicContext = 'mobile';
      else if (low.includes('ecommerce') || low.includes('e-commerce') || low.includes('boutique') || low.includes('shopify')) topicContext = 'ecom';
      else if (low.includes('landing')) topicContext = 'landing';
      else if (low.includes('refonte') || low.includes('redesign') || low.includes('moderniser')) topicContext = 'redesign';
      else if (low.includes('design') || low.includes('ui') || low.includes('ux')) topicContext = 'design';
      else if (low.includes('site web') || low.includes('website') || low.includes('web')) topicContext = 'website';
    }
    if (!lead.service && topicContext) {
      const labels = { mobile:"Application mobile", ecom:"Site E-commerce", landing:"Landing page", redesign:"Refonte de site", design:"Design UI/UX", website:"Site web", seo:"SEO & Performance" };
      lead.service = labels[topicContext] || '';
    }
  }

  /* ── RELANCE PROSPECT ────────────────────────────────────── */
  function leadNudge() {
    if (!lead.name && !askedName && turnCount >= 2) {
      askedName = true;
      return pickFresh([
        "\n\nÀ propos — à qui ai-je le plaisir de parler ? 😊",
        "\n\nJ'aimerais rendre cette conversation plus personnelle — quel est votre prénom ?",
        "\n\nEt si je puis me permettre, comment vous appelez-vous ?",
      ]);
    }
    if (lead.name && !lead.email && !askedEmail && turnCount >= 3) {
      askedEmail = true;
      return pickFresh([
        `\n\nMerci ${lead.name} ! Quelle est la meilleure adresse email pour vous joindre ? Notre équipe vous recontactera personnellement.`,
        `\n\n${lead.name}, si vous souhaitez qu'on vous envoie des infos ou un devis, partagez simplement votre email.`,
        `\n\nSi vous voulez qu'on reste en contact, ${lead.name}, quel est votre email ?`,
      ]);
    }
    return '';
  }

  /* ── GÉNÉRATION DE RÉPONSE ───────────────────────────────── */
  function generateReply(userText) {
    extractData(userText);
    turnCount++;
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
        askedEmail = true;
        reply = KB.contact;
        break;

      case 'services_list':
        reply = KB.services_list;
        break;

      case 'web':
        topicContext = topicContext || 'website';
        if (!lead.service) lead.service = 'Site web';
        reply = `Nous concevons et développons des **sites web premium** adaptés à vos objectifs — sites corporate, applications web, portfolios, pages de services et plus encore.\n\n💰 **À partir de seulement 150€** — une vraie qualité à un prix accessible.\n\nQuel type de site avez-vous besoin ?`;
        break;

      case 'mobile':
        topicContext = 'mobile';
        if (!lead.service) lead.service = 'Application mobile';
        reply = `Nous développons des **applications iOS et Android** haute performance qui prolongent votre marque et engagent votre audience — apps clients, outils internes, expériences e-commerce mobiles et plus.\n\n💰 **À partir de 200€** — l'un des tarifs les plus compétitifs pour un développement mobile de qualité.\n\nQuel type d'application avez-vous en tête ?`;
        break;

      case 'ecom':
        topicContext = 'ecom';
        if (!lead.service) lead.service = 'Site E-commerce';
        reply = `Nous créons un **site e-commerce sur mesure** pour votre business — conçu autour de vos produits, votre marque et vos clients, pour vendre en ligne professionnellement dès le premier jour.\n\n💰 **À partir de 200€**\n📦 **Listing dès 5 produits**\n⏱️ **Livraison : 15 à 60 jours** selon la complexité\n\nLe site inclut les pages produits, le panier, le paiement et tout ce dont vos clients ont besoin. Voulez-vous savoir ce qui est inclus ?`;
        break;

      case 'landing':
        topicContext = 'landing';
        if (!lead.service) lead.service = 'Landing page';
        reply = `Une **landing page** bien conçue est l'un des investissements les plus intelligents pour toute campagne — rapide à livrer et conçue pour convertir.\n\n💰 **À partir de 150€** — structurée stratégiquement, visuellement percutante, livrée en 1–2 semaines.\n\nQuel est l'objectif de votre landing page ?`;
        break;

      case 'redesign':
        topicContext = 'redesign';
        if (!lead.service) lead.service = 'Refonte de site';
        reply = `Nous pouvons élever votre site existant — direction visuelle plus forte, structure plus claire, crédibilité renforcée — tout en conservant ce qui fonctionne déjà.\n\n💰 **À partir de 150€**, la plupart des refontes prennent 3–5 semaines.\n\nQu'est-ce qui ne fonctionne pas sur votre site actuel ?`;
        break;

      case 'design':
        topicContext = topicContext || 'design';
        reply = `Notre travail de design est centré sur la **clarté, la crédibilité et la conversion** — des interfaces épurées et sophistiquées qui rendent votre marque premium et guident les visiteurs vers l'action.\n\n💰 **À partir de 150€**.\n\nAvez-vous besoin du design seul, ou design + développement ?`;
        break;

      case 'seo':
      case 'performance':
        reply = `Le SEO et la performance sont intégrés dans notre façon de construire — chargement rapide, code sémantique propre, mobile-first, structure correcte. Ce ne sont pas des options, c'est notre standard.\n\nBesoin d'un travail SEO ciblé sur un site existant ? Nous intervenons aussi — **à partir de 150€**.`;
        break;

      case 'timeline':
        if (topicContext === 'mobile') reply = "Les applications mobiles prennent généralement **8–16 semaines** du brief au lancement, selon la complexité.";
        else if (topicContext === 'landing') reply = "Les landing pages sont généralement prêtes en **1–2 semaines** — rapide, ciblé, efficace.";
        else if (topicContext === 'ecom') reply = "Notre site e-commerce est livré en **15 à 60 jours** — le listing démarre à 5 produits, généralement prêt en 15–20 jours. Les catalogues plus larges ou les fonctionnalités personnalisées peuvent aller jusqu'à 60 jours. Nous vous donnerons une estimation précise après examen de votre brief.";
        else reply = "Les délais varient selon le projet :\n\n📄 **Landing page** — 1–2 semaines\n🌐 **Site complet** — 3–6 semaines\n🛍️ **Site e-commerce** — 15–60 jours\n📱 **Application mobile** — 8–16 semaines\n\nNous vous donnerons un calendrier précis lors de votre consultation.";
        break;

      case 'price':
        reply = getPriceReply() + '\n\n' + pickFresh(POOLS.price_follow_up);
        break;

      case 'negotiate':
        reply = getNegotiationResponse();
        break;

      case 'discount':
        reply = pickFresh([
          "Nous proposons parfois des offres groupées quand les clients combinent plusieurs services — comme un site web + landing page. Voulez-vous que j'explore ce qui est possible pour votre projet ?",
          "Pour les clients prêts à démarrer rapidement, nous offrons occasionnellement des tarifs d'engagement anticipé. Partagez les détails de votre projet et je verrai ce qu'on peut mettre ensemble.",
          "Nous avons des forfaits flexibles. Dites-moi exactement ce dont vous avez besoin en totalité et je verrai comment maximiser la valeur dans votre budget.",
        ]);
        break;

      case 'value':
        if (topicContext === 'ecom') {
          reply = pickFresh([
            "À **partir de 200€**, votre site e-commerce travaille 24h/24 — présentant vos produits, traitant les commandes, inspirant confiance. C'est un **actif permanent** pour votre business.",
            "Pensez-y : une seule vente via votre site rembourse tout le projet. À **partir de 200€**, le retour est rapide.",
            "Un site e-commerce professionnel renforce la crédibilité, augmente les conversions et donne confiance aux acheteurs. **À partir de 200€, listing dès 5 produits** — c'est l'un des investissements les plus intelligents pour tout vendeur.",
          ]);
        } else {
          reply = pickFresh([
            "À 150€, vous n'obtenez pas juste un site web — vous obtenez un **actif digital stratégique** conçu pour attirer des clients et faire croître votre business. C'est un investissement qui se rentabilise généralement plusieurs fois.",
            "Voyez les choses ainsi : un site bien construit se rentabilise rapidement. À 150€, vous investissez moins que ce que beaucoup d'entreprises dépensent en une journée — mais vous obtenez un outil qui travaille 24h/24 pendant des années.",
            "Un seul nouveau client venant de votre site rembourse tout le projet — et il continue à travailler. C'est la puissance d'une présence digitale bien construite. À 150€ pour commencer, le potentiel ROI est énorme.",
          ]);
        }
        break;

      case 'comparison':
        reply = pickFresh([
          "Comparé aux autres agences, nous sommes sincèrement parmi les plus compétitifs. La plupart facturent 2 000€–10 000€+ pour ce que nous livrons à partir de 150€. Nous avons construit des processus efficaces qui permettent de faire profiter nos clients de ces économies.",
          "Si vous avez reçu des devis d'autres agences, vous verrez qu'on est une fraction du coût. Notre tarif de départ à 150€ est possible parce que nous avons optimisé notre workflow — pas parce qu'on coupe les coins. Même qualité premium, prix bien plus bas.",
          "Voici la comparaison honnête : la plupart des agences facturent 3 000€–8 000€ pour un site business de base. Nous démarrons à 150€. Ce n'est pas parce que nous sommes une agence low-cost — c'est parce que nous avons construit des processus plus intelligents et plus efficaces.",
        ]);
        break;

      default:
        if (lastIntent === 'negotiate' || lastIntent === 'price') {
          reply = getNegotiationResponse();
        } else if (userText.trim().length < 12) {
          reply = pickFresh(POOLS.unknown_short);
        } else {
          reply = pickFresh(POOLS.unknown_long);
        }
    }

    // Protection absolue : jamais deux réponses identiques d'affilée
    if (reply === lastBotReply) {
      if (['price','negotiate','discount','value','comparison'].includes(intent)) {
        reply = getNegotiationResponse();
      } else {
        reply = pickFresh(POOLS.unknown_long);
      }
    }

    reply += leadNudge();
    lastIntent = intent;
    lastBotReply = reply;
    return reply;
  }

  /* ── ENVOI DU PROSPECT ───────────────────────────────────── */
  function maybeSendLead() {
    if (lead.email && lead.name && !leadSent) {
      leadSent = true;
      const fd = new FormData();
      fd.append('_subject',         `Prospect Nova Dev Chat (FR) — ${lead.name}`);
      fd.append('_captcha',         'false');
      fd.append('_template',        'table');
      fd.append('Prénom',           lead.name);
      fd.append('Email',            lead.email);
      fd.append('Entreprise',       lead.company  || 'Non renseigné');
      fd.append('Téléphone',        lead.phone    || 'Non renseigné');
      fd.append('Service souhaité', lead.service  || 'Non précisé');
      fd.append('Source',           'Widget Chat IA — Nova Dev FR');
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
    const delay = 450 + Math.random() * 650;
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
        appendMsg("Bonjour ! 👋 Je suis l'assistant Nova Dev.\n\nJe peux répondre à toutes vos questions sur nos services — **sites web à partir de 150€**, **applications mobiles à partir de 200€**, **sites e-commerce à partir de 200€ (listing dès 5 produits)**, délais, technologie, processus et bien plus.\n\nQue souhaitez-vous construire ?", 'bot');
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
