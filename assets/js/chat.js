(() => {
  'use strict';

  /* ============================================================
     NOVA DEV — Chat IA Intelligent avec Négociation
     Répond aux questions, négocie les prix, capture les prospects
     Ne répète jamais la même réponse deux fois
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
  const lead = { name:'', email:'', company:'', phone:'', service:'', message:'' };
  let leadSent = false;

  /* ── Mémoire de conversation (anti-répétition) ───────────── */
  const usedResponses = new Set();
  const conversationHistory = [];
  let negotiationStage = 0;
  let lastIntent = '';
  let lastBotReply = '';
  let priceDiscussedFor = '';

  function pickFresh(arr) {
    const available = arr.filter(r => !usedResponses.has(r));
    if (available.length === 0) {
      arr.forEach(r => usedResponses.delete(r));
      return arr[Math.floor(Math.random() * arr.length)];
    }
    const pick = available[Math.floor(Math.random() * available.length)];
    usedResponses.add(pick);
    return pick;
  }

  /* ── BASE DE CONNAISSANCES ───────────────────────────────── */
  const KB = {
    services: [
      { id:'web',      label:'Design & Développement Web',          desc:'Nous concevons et développons des sites web premium, performants et adaptés à vos objectifs business — des sites corporate aux applications web en passant par les pages d\'atterrissage. Chaque projet commence par une direction stratégique et aboutit à un résultat soigné, orienté conversion.' },
      { id:'mobile',   label:'Développement d\'Applications Mobiles', desc:'Nous développons des applications iOS et Android haute performance qui prolongent votre marque et engagent votre audience. Qu\'il s\'agisse d\'une app client, d\'un outil interne ou d\'une expérience mobile e-commerce, nous la concevons et développons de A à Z.' },
      { id:'ecom',     label:'E-commerce Orienté Conversion',        desc:'Nous créons des boutiques en ligne convaincantes qui présentent vos produits avec élégance, inspirent confiance et réduisent la friction tout au long du parcours d\'achat. Nous travaillons avec Shopify, WooCommerce et des solutions sur mesure.' },
      { id:'design',   label:'Design d\'Interface Premium (UI/UX)',   desc:'Notre processus de design est centré sur la clarté, la crédibilité et la conversion. Nous créons des interfaces épurées et sophistiquées qui renforcent votre image de marque et guident naturellement les visiteurs vers la bonne action.' },
      { id:'seo',      label:'Performance & Fondations SEO',         desc:'Nous améliorons la vitesse, la structure technique et les bases SEO pour que votre site charge rapidement, soit mieux référencé et offre une expérience fluide sur tous les appareils.' },
      { id:'rebrand',  label:'Refonte de Site Web',                  desc:'Nous pouvons élever votre site existant — direction visuelle plus forte, structure plus claire, crédibilité renforcée — sans perdre ce qui fonctionne déjà pour votre marque.' },
      { id:'strategy', label:'Direction Stratégique Digitale',       desc:'Nous commençons chaque projet en comprenant votre business, votre audience et vos objectifs. Nous définissons la structure, les priorités et le parcours des pages pour que le site serve vos objectifs commerciaux dès le départ.' },
    ],

    pricing: {
      general: "Nos tarifs sont conçus pour être accessibles à toutes les entreprises. Un site web professionnel démarre à partir de seulement 150 €, avec des options évolutives selon vos besoins. Les applications mobiles commencent à 200 €. Nous fournissons toujours un devis détaillé et transparent après avoir compris votre projet — sans surprises.",
      landing: "Une landing page démarre à partir de 150 €, selon la complexité du design et les intégrations nécessaires. C'est une façon intelligente et abordable de commencer à générer des leads.",
      website: "Un site business complet démarre à partir de 150 € et évolue selon le nombre de pages, les fonctionnalités et la complexité technique. Nous travaillons avec tous les budgets pour offrir le meilleur résultat possible.",
      mobile:  "Le développement d'applications mobiles démarre à partir de 200 € selon la plateforme (iOS, Android ou les deux), les fonctionnalités et les besoins back-end. Nous définirons le périmètre précis lors de votre consultation gratuite.",
      ecom:    "Les projets e-commerce démarrent à partir de 300 € selon la plateforme, le volume de produits et les intégrations nécessaires. Nous trouverons la meilleure solution dans votre budget.",
    },

    timeline: {
      general: "Les délais dépendent de la portée du projet. Une landing page peut être livrée en 1–2 semaines. Un site complet prend généralement 3–6 semaines. Une app mobile nécessite habituellement 8–16 semaines du brief au lancement. Nous vous donnerons un calendrier précis lors de votre consultation.",
      landing: "Les landing pages sont généralement livrées en 1–2 semaines.",
      website: "Les sites business complets prennent généralement 3–6 semaines du démarrage à la mise en ligne.",
      mobile:  "Le développement d'une app mobile prend habituellement 8–16 semaines selon la complexité.",
    },

    process: "Notre méthode se déroule en trois étapes claires :\n\n1️⃣ Clarifier l'objectif business — Nous commençons par comprendre votre entreprise, votre audience, votre position actuelle et le résultat attendu.\n\n2️⃣ Concevoir et développer avec précision — Nous travaillons l'interface, la structure du contenu et le développement avec une attention particulière à la qualité, à la vitesse et à la clarté.\n\n3️⃣ Lancer avec une vision long terme — Une fois en ligne, le site devient une plateforme plus forte pour votre marque, votre marketing et votre croissance future.",

    tech: "Nous travaillons avec une stack technique moderne et éprouvée : HTML/CSS/JavaScript, React, Next.js, Shopify, WordPress, Webflow, Node.js et React Native / Flutter pour le mobile. Nous choisissons les bons outils pour votre projet spécifique — pas les plus tendance.",

    contact: "La meilleure façon de commencer est de remplir le formulaire de contact sur cette page, ou de me parler de votre projet directement ici — je m'assurerai que la bonne personne vous recontacte. Vous pouvez aussi partager votre email et nous vous contacterons directement.",

    about: "Nova Dev est une agence premium de design et développement web et mobile. Nous travaillons avec des entreprises ambitieuses — cabinets de services professionnels, sociétés B2B, marques e-commerce et startups — qui veulent une présence digitale plus forte, une communication plus claire et une vraie croissance mesurable.",

    why: "Les clients choisissent Nova Dev parce que nous combinons un design visuel fort, une exécution technique solide et une réflexion commerciale. Nous ne créons pas seulement des sites beaux — nous construisons des expériences digitales qui renforcent la crédibilité, améliorent les conversions et soutiennent une vraie croissance business.",

    guarantee: "Nous garantissons la qualité de notre travail. Chaque projet passe par une révision et des tests approfondis avant le lancement. Si quelque chose n'est pas parfait, nous le corrigeons. Notre objectif est de dépasser vos attentes — c'est pourquoi la majorité de nos clients reviennent.",

    maintenance: "Oui, nous proposons des forfaits de support et de maintenance. Au fur et à mesure que votre entreprise grandit, nous faisons évoluer le site — nouvelles pages, mise à jour du contenu, améliorations de performance et support de campagnes.",

    seo: "Oui, le SEO fait partie de notre façon de construire. Nous structurons chaque site avec un code propre, un chargement rapide, une hiérarchie de titres correcte, du HTML sémantique et une conception mobile-first — les fondations techniques qui donnent à votre site les meilleures chances de bien se positionner.",

    mobile_friendly: "Absolument. Tous nos sites sont entièrement responsives et conçus mobile-first. Une expérience fluide et soignée sur mobile et tablette est non négociable pour nous.",

    hosting: "Nous pouvons conseiller et mettre en place l'hébergement dans le cadre de votre projet. Nous recommandons généralement Vercel, Netlify, Cloudflare Pages ou un hébergement géré selon vos besoins. Les coûts de domaine et d'hébergement sont séparés des frais de développement.",

    cms: "Oui, nous intégrons des systèmes de gestion de contenu pour que vous puissiez mettre à jour le contenu sans avoir besoin d'un développeur. Nous travaillons avec Sanity, WordPress, Webflow CMS et des solutions personnalisées.",

    revisions: "Absolument. Nos projets incluent des cycles de révision intégrés. Nous partageons les designs et prototypes pour vos retours avant le début du développement, et nous affinons jusqu'à votre satisfaction.",
  };

  /* ── RÉPONSES DE NÉGOCIATION (multi-étapes, jamais de répétition) ── */
  const NEGOTIATION = {
    firstObjection: {
      general: [
        "Je comprends tout à fait — le budget est important. La bonne nouvelle, c'est que nous sommes l'une des agences premium les plus abordables. Nos sites web démarrent à seulement 150 €, ce qui est bien en dessous de la moyenne du marché. Quel type de projet avez-vous en tête ? Je peux vous donner une idée plus précise.",
        "C'est une préoccupation légitime ! Beaucoup de clients sont agréablement surpris par nos tarifs. On démarre à 150 € pour les sites web et 200 € pour les applications mobiles — bien moins que la plupart des agences. Quel est votre budget idéal ? J'aimerais trouver une solution qui vous convient.",
        "J'apprécie votre franchise ! Laissez-moi préciser — nos prix sont en réalité très compétitifs. Les sites web professionnels démarrent à 150 € et les apps mobiles à 200 €. La plupart de nos clients sont agréablement surpris. Parlez-moi de votre projet et je vous donnerai une estimation adaptée.",
      ],
      web: [
        "Je vous entends ! Mais voilà le truc — nos sites web démarrent à seulement 150 €. C'est bien plus abordable que la plupart des agences qui facturent 2 000 €+. Nous gardons les coûts bas sans rogner sur la qualité. Quelles fonctionnalités sont les plus importantes pour votre projet ?",
        "Le budget compte, absolument. Notre développement web commence à 150 € — ça inclut le design professionnel, le développement responsive et les tests. Nous pouvons travailler dans votre budget. Que souhaitez-vous construire ?",
        "Je comprends la préoccupation ! Mais à 150 € comme prix de départ pour un site complet, nous sommes vraiment très accessibles. Beaucoup d'agences facturent 10 fois plus. Quel est votre budget idéal ? Voyons ce que nous pouvons créer pour vous.",
      ],
      mobile: [
        "Je comprends — les apps peuvent sembler coûteuses. Mais notre développement d'apps mobiles démarre à seulement 200 €, ce qui est incroyablement compétitif. La plupart des agences facturent 5 000 €+. Quel type d'application envisagez-vous ?",
        "Préoccupation tout à fait légitime ! Nos apps mobiles démarrent à 200 € — une fraction de ce que la plupart des studios facturent. Nous croyons que la qualité ne devrait pas être chère. Parlez-moi de votre idée d'app et je la cadrerai pour vous.",
        "Je comprends ! Mais notre développement d'apps démarre à 200 € — bien en dessous des tarifs du marché. Nous avons rendu le développement premium accessible. De quelles fonctionnalités votre app a-t-elle besoin ?",
      ],
    },

    secondObjection: [
      "Je veux vraiment que ça fonctionne pour vous. Que diriez-vous de ceci — parlez-moi exactement de ce dont vous avez besoin, et je préparerai un devis sur mesure qui correspond à votre budget. Nous sommes flexibles et nous voulons sincèrement aider votre business à grandir. Quel est votre budget confortable ?",
      "Trouvons un terrain d'entente. On peut toujours commencer par un MVP — une version allégée avec les fonctionnalités essentielles — et élargir ensuite. Comme ça, vous êtes en ligne plus vite, dépensez moins au départ, et faites évoluer le projet au fil du temps. Quelles sont vos fonctionnalités indispensables ?",
      "Je veux être transparent — nous sommes déjà parmi les agences les plus abordables avec une qualité premium. Mais je comprends que chaque euro compte. Si vous partagez votre budget, je peux concevoir un forfait qui maximise la valeur. Nous l'avons fait de nombreuses fois pour nos clients.",
      "Voici ce que font beaucoup de clients intelligents : commencer par une première phase ciblée — l'essentiel — puis ajouter des fonctionnalités quand le business génère des revenus. Ainsi le projet se rentabilise lui-même. Cette approche vous conviendrait-elle ?",
    ],

    finalOffer: [
      "D'accord, laissez-moi faire quelque chose de spécial. Si vous êtes prêt à démarrer, je peux vous connecter directement avec notre responsable de projets pour une consultation gratuite. Nous trouverons la meilleure solution absolue pour votre budget — nous n'avons jamais refusé un client sérieux. Partagez votre email et on s'en occupe aujourd'hui.",
      "Voici ce que je vais faire — je vais demander à notre équipe de préparer une proposition personnalisée sans engagement, spécifiquement pour votre budget et vos besoins. On trouve toujours une solution. Partagez votre email et nous vous l'envoyons sous 24h.",
      "Je respecte que vous connaissiez votre budget. Laissez-moi vous connecter directement avec notre équipe — ils peuvent proposer des plans de paiement flexibles et des livraisons par phases qui rendent tout ça très gérable. Quel est le meilleur email pour vous joindre ?",
    ],

    comparison: [
      "Comparé aux autres agences, nous sommes sincèrement l'une des plus abordables. La plupart facturent 2 000–10 000 €+ pour ce que nous livrons à partir de 150 €. Nous avons optimisé notre process pour faire profiter nos clients de ces économies sans sacrifier la qualité.",
      "Si vous avez reçu des devis d'autres agences, vous verrez qu'on est une fraction du coût. Notre tarif de départ à 150 € pour les sites web est possible parce que nous avons rationalisé notre workflow — pas parce que nous coupons les coins. Même qualité premium, prix bien plus bas.",
      "Pour mettre les choses en perspective : un freelancer pourrait facturer des prix similaires, mais sans la réflexion stratégique, les tests et le support que nous incluons. Et les autres agences facturent 5 à 20 fois plus. Nous sommes le juste milieu entre qualité et accessibilité.",
    ],

    value: [
      "Ce que vous obtenez à 150 € n'est pas qu'un site web — c'est un actif digital stratégique conçu pour attirer des clients et faire croître votre business. C'est un investissement qui peut générer des milliers en retour.",
      "Voyez les choses ainsi : un site bien construit se rentabilise plusieurs fois. À 150 €, vous investissez moins qu'une seule journée de chiffre d'affaires pour la plupart des entreprises, mais vous obtenez un outil qui travaille 24/7 pendant des mois et des années.",
      "Pour contexte, un seul clic Google Ads peut coûter 5–50 €. Votre site web à 150 € est un actif permanent qui continue d'attirer des clients sans dépenses publicitaires. C'est l'un des investissements les plus intelligents que vous puissiez faire.",
    ],

    discount: [
      "Nous proposons parfois des offres forfaitaires quand les clients combinent plusieurs services. Par exemple, un combo site web + landing page pourrait bénéficier d'une réduction. Voulez-vous que j'explore cette piste ?",
      "Pour les clients prêts à démarrer rapidement, nous offrons occasionnellement des tarifs d'engagement anticipé. Partagez les détails de votre projet et je verrai ce qu'on peut faire.",
      "Nous avons effectivement des forfaits flexibles. Si on connaît le périmètre complet de votre projet, on peut souvent trouver des moyens de maximiser la valeur dans votre budget. De quoi avez-vous exactement besoin ?",
    ],
  };

  /* ── DÉTECTION D'INTENTION (améliorée avec négociation) ──── */
  function detectIntent(text) {
    const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

    const is = (...kw) => kw.some(k => t.includes(k));

    // Négociation & objections prix (vérifier EN PREMIER)
    if (is('cher','trop cher','trop eleve','excessif','hors budget','depasse','pas les moyens',
           'baisser','reduction','remise','moins cher','reduire','pas abordable',
           'trop couteux','pas rentable','arnaque','serieusement','non merci',
           'je peux trouver','quelqu\'un d\'autre','autre agence','concurrent','freelance',
           'fiverr','upwork','negocier','offre','budget serre','budget limite',
           'petit budget','pas dans le budget','budget est','mon budget','n\'ai que',
           'seulement','peux me permettre','c\'est beaucoup','c\'est bcp',
           'expensive','too much','can\'t afford','cheaper','discount')) return 'negotiate';

    if (is('remise','reduction','promo','promotion','offre speciale','prix special','deal')) return 'discount';

    if (is('ca vaut','pourquoi payer','qu\'est-ce que j\'obtiens','inclus','justifier','rentable','retour sur investissement','roi')) return 'value';

    if (is('compare','autres agences','concurrents','prix moyen','tarif moyen','marche','benchmark','par rapport')) return 'comparison';

    if (is('prix','cout','coût','tarif','budget','combien','devis','facturer','investissement','forfait','payer','tarification')) return 'price';
    if (is('delai','délai','duree','durée','combien de temps','livrer','semaine','mois','quand','rapide','vite','long')) return 'timeline';
    if (is('application mobile','app mobile','android','ios','iphone','flutter','react native','developpement app','smartphone','tablette')) return 'mobile';
    if (is('e-commerce','boutique en ligne','shopify','woocommerce','vendre en ligne','produit','panier','commande')) return 'ecom';
    if (is('seo','referencement','référencement','google','moteur de recherche','rang','visibilite','visibilité','trafic organique','mot cle')) return 'seo';
    if (is('refonte','redesign','ameliorer','améliorer','moderniser','rafraichir','site existant','site actuel')) return 'redesign';
    if (is('design','ui','ux','interface','maquette','prototype','wireframe','look','esthetique','esthétique')) return 'design';
    if (is('landing page','page d\'atterrissage','page unique','page de vente','page campagne')) return 'landing';
    if (is('site corporate','site d\'entreprise','site professionnel','site business','site vitrine','b2b')) return 'corporate';
    if (is('performance','vitesse','rapide','core web','chargement','pagespeed','optimis')) return 'performance';
    if (is('processus','comment vous travaillez','methode','méthode','etape','étape','commencer','demarrer','démarrer','workflow','phase')) return 'process';
    if (is('technologie','stack','framework','react','next','wordpress','webflow','plateforme','construit avec')) return 'tech';
    if (is('hebergement','hébergement','domaine','serveur','deployer','déployer','cloud','cdn','infrastructure')) return 'hosting';
    if (is('maintenance','support','apres lancement','apres le lancement','mise a jour','suivi','retainer')) return 'maintenance';
    if (is('cms','gestion de contenu','modifier','editer le contenu','backend','back-office')) return 'cms';
    if (is('revision','modification','retour','iteration','changer','ajuster')) return 'revisions';
    if (is('qui etes','qui êtes','a propos','présentation','vous presentez','vous présentez','presentez-vous','que faites-vous','votre agence','votre equipe')) return 'about';
    if (is('pourquoi vous','pourquoi nova','différence','unique','meilleur','mieux que','versus','concurrent')) return 'why';
    if (is('garantie','qualite','qualité','assurance','confiance','remboursement','promesse')) return 'guarantee';
    if (is('mobile friendly','responsive','telephone','tablette','taille d\'ecran')) return 'mobile_friendly';
    if (is('site web','website','web app','creer un site','créer un site','nouveau site','besoin d\'un site','construire un site')) return 'web';
    if (is('contact','email','appeler','parler','consultation','devis','proposition','joindre','atteindre')) return 'contact';
    if (is('service','prestation','offrez','proposez','capable','que pouvez')) return 'services_list';
    if (is('bonjour','salut','bonsoir','hello','hey','coucou','bonne journee','bjr')) return 'greeting';
    if (is('merci','super','parfait','excellent','bravo','utile','genial','génial','formidable','top')) return 'thanks';
    if (is('au revoir','a bientot','a bientôt','ciao','bye','bonne journée','à plus')) return 'bye';

    return 'unknown';
  }

  /* ── GÉNÉRATION DE RÉPONSE (avec variété & négociation) ──── */
  let askedName = false, askedEmail = false, turnCount = 0;

  const RESPONSE_POOLS = {
    greeting_new: [
      "Bonjour ! 👋 Enchanté de discuter avec vous — comment puis-je vous aider aujourd'hui ? N'hésitez pas à me poser n'importe quelle question sur nos services, tarifs, délais ou notre façon de travailler.",
      "Salut ! 👋 Bienvenue chez Nova Dev. Je suis là pour tout — design web, développement d'apps, tarifs, délais... Qu'est-ce qui vous amène ?",
      "Bonjour ! 👋 Ravi de vous accueillir. Que vous exploriez vos options ou soyez prêt à lancer un projet, je suis là pour vous aider. Que souhaitez-vous savoir ?",
    ],
    greeting_known: [
      "Bonjour {name} ! Ravi de vous retrouver. En quoi puis-je vous aider ?",
      "Re-bonjour {name} ! 😊 Comment puis-je vous assister aujourd'hui ?",
      "Salut {name} ! Content de vous revoir. Qu'est-ce qui vous amène ?",
    ],
    thanks_new: [
      "Avec plaisir ! 😊 Y a-t-il autre chose que vous souhaiteriez savoir ?",
      "Content d'avoir pu aider ! 😊 N'hésitez pas si vous avez d'autres questions.",
      "Ravi d'avoir pu vous aider ! Autre chose en tête ?",
    ],
    thanks_known: [
      "Avec plaisir, {name} ! 😊 Puis-je vous aider avec autre chose ?",
      "C'est un plaisir, {name} ! 😊 N'hésitez pas à poser d'autres questions.",
      "De rien, {name} ! Que puis-je faire d'autre pour vous ?",
    ],
    bye_new: [
      "Merci pour votre visite ! Quand vous serez prêt à discuter de votre projet, n'hésitez pas à revenir. 👋",
      "C'était un plaisir d'échanger ! Revenez quand vous voulez. 👋",
      "Bonne continuation ! Nous sommes toujours là quand vous aurez besoin de nous. 👋",
    ],
    bye_known: [
      "À bientôt, {name} ! Si vous souhaitez lancer un projet, nous sommes là. 👋",
      "À très vite, {name} ! N'hésitez pas à revenir quand vous êtes prêt. 👋",
      "Au revoir {name} ! On serait ravis de travailler avec vous bientôt. 👋",
    ],
    unknown_short: [
      "Pourriez-vous préciser un peu ? Je veux m'assurer de vous donner la réponse la plus utile possible. 😊",
      "J'aimerais vous aider — pouvez-vous me donner un peu plus de détails sur ce que vous cherchez ?",
      "Pouvez-vous développer un peu ? Je veux vous donner la meilleure réponse possible.",
    ],
    unknown_long: [
      "Excellente question ! Pour vous donner la réponse la plus précise, pourriez-vous partager un peu plus de contexte sur votre projet ? Je suis là pour vous aider sur tout — services, tarifs, délais, technologie ou notre façon de travailler.",
      "Intéressant ! Je veux m'assurer de vous orienter au mieux. Pourriez-vous m'en dire plus sur ce que vous recherchez ? Je couvre tout, du développement web aux applications mobiles.",
      "J'aimerais vous aider avec ça. Pour la meilleure réponse, pourriez-vous me parler un peu plus de vos besoins ? Je m'occupe de tout, du développement web aux apps mobiles.",
    ],
    price_follow_up: [
      "Souhaitez-vous un devis précis pour votre projet ?",
      "Voulez-vous que je vous aide à estimer le coût pour vos besoins spécifiques ?",
      "Je peux vous aider à obtenir un devis précis — dites-moi juste ce dont vous avez besoin.",
      "Dois-je vous connecter avec notre équipe pour un devis détaillé sans engagement ?",
    ],
  };

  function personalize(text) {
    return lead.name ? text.replace(/\{name\}/g, lead.name) : text;
  }

  function pickFromPool(poolKey) {
    return personalize(pickFresh(RESPONSE_POOLS[poolKey]));
  }

  function extractData(text) {
    const emailMatch = text.match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/);
    if (emailMatch && !lead.email) lead.email = emailMatch[0];

    const phoneMatch = text.match(/(\+?\d[\d\s\-().]{7,}\d)/);
    if (phoneMatch && !lead.phone) lead.phone = phoneMatch[0].trim();

    const nameMatch = text.match(/(?:je m(?:'|')appelle|mon pr[eé]nom est|je suis|c(?:'|')est moi|appelez-moi)\s+([A-ZÀ-Ü][a-zà-ü]{1,20})/i);
    if (nameMatch && !lead.name) lead.name = nameMatch[1];

    if (!lead.name && askedName) {
      const single = text.trim().split(/\s+/);
      if (single.length <= 2 && /^[A-ZÀ-Ü][a-zà-ü]+/.test(single[0])) lead.name = single[0];
    }

    const compMatch = text.match(/(?:entreprise(?:\s+est)?|societe(?:\s+est)?|société(?:\s+est)?|travaille (?:pour|chez)|chez|pour)\s+([A-Za-z0-9 &.,'-]{2,30})/i);
    if (compMatch && !lead.company) lead.company = compMatch[1].trim();

    if (!lead.service) {
      const lower = text.toLowerCase();
      if (lower.includes('application mobile') || lower.includes('app mobile') || lower.includes('android') || lower.includes('ios')) lead.service = "Développement d'application mobile";
      else if (lower.includes('e-commerce') || lower.includes('boutique en ligne') || lower.includes('shopify')) lead.service = 'E-commerce';
      else if (lower.includes('refonte')) lead.service = 'Refonte de site';
      else if (lower.includes('landing')) lead.service = 'Landing page';
      else if (lower.includes('site web') || lower.includes('website')) lead.service = 'Site web';
      else if (lower.includes('design') || lower.includes('interface')) lead.service = 'Design UI/UX';
    }
  }

  function leadNudge() {
    if (!lead.name && !askedName && turnCount >= 2) {
      askedName = true;
      return pickFresh([
        "\n\nÀ propos, je ne connais pas encore votre prénom — comment vous appelez-vous ?",
        "\n\nJ'aimerais rendre cette conversation plus personnelle — quel est votre prénom ?",
        "\n\nAu fait, avec qui ai-je le plaisir de discuter ?",
      ]);
    }
    if (lead.name && !lead.email && !askedEmail && turnCount >= 3) {
      askedEmail = true;
      return pickFresh([
        `\n\nMerci, ${lead.name} ! Si vous souhaitez que nous vous recontactions, quelle est la meilleure adresse e-mail pour vous joindre ?`,
        `\n\n${lead.name}, si vous voulez un devis détaillé, partagez simplement votre email et nous vous l'envoyons.`,
        `\n\nAu fait ${lead.name}, voulez-vous qu'on vous envoie plus de détails par email ? Quelle est votre meilleure adresse ?`,
      ]);
    }
    return '';
  }

  function getNegotiationResponse() {
    negotiationStage++;
    const serviceKey = lead.service?.toLowerCase().includes('mobile') ? 'mobile' :
                       lead.service?.toLowerCase().includes('app') ? 'mobile' : 'general';

    if (negotiationStage === 1) {
      const pool = serviceKey === 'mobile' ?
        NEGOTIATION.firstObjection.mobile :
        (serviceKey === 'web' ? NEGOTIATION.firstObjection.web : NEGOTIATION.firstObjection.general);
      return pickFresh(pool);
    } else if (negotiationStage === 2) {
      return pickFresh(NEGOTIATION.secondObjection);
    } else {
      return pickFresh(NEGOTIATION.finalOffer);
    }
  }

  function generateReply(userText) {
    extractData(userText);
    turnCount++;
    const intent = detectIntent(userText);
    conversationHistory.push(intent);
    let reply = '';

    switch (intent) {
      case 'greeting':
        reply = lead.name ? pickFromPool('greeting_known') : pickFromPool('greeting_new');
        break;

      case 'thanks':
        reply = lead.name ? pickFromPool('thanks_known') : pickFromPool('thanks_new');
        break;

      case 'bye':
        reply = lead.name ? pickFromPool('bye_known') : pickFromPool('bye_new');
        break;

      case 'about':
        reply = KB.about;
        break;

      case 'why':
        reply = KB.why;
        break;

      case 'guarantee':
        reply = KB.guarantee;
        break;

      case 'services_list':
        reply = "Voici ce que nous proposons chez Nova Dev :\n\n"
          + KB.services.map((s, i) => `${i + 1}. **${s.label}**`).join('\n')
          + "\n\nLequel vous intéresse le plus ? Je peux vous donner plus de détails sur n'importe lequel.";
        break;

      case 'web':
        reply = KB.services.find(s => s.id === 'web').desc;
        if (!lead.service) lead.service = 'Site web';
        break;

      case 'mobile':
        reply = KB.services.find(s => s.id === 'mobile').desc + '\n\n' + KB.pricing.mobile;
        if (!lead.service) lead.service = "Développement d'application mobile";
        break;

      case 'ecom':
        reply = KB.services.find(s => s.id === 'ecom').desc + '\n\n' + KB.pricing.ecom;
        if (!lead.service) lead.service = 'E-commerce';
        break;

      case 'design':
        reply = KB.services.find(s => s.id === 'design').desc;
        break;

      case 'redesign':
        reply = KB.services.find(s => s.id === 'rebrand').desc
          + "\n\nLa plupart des refontes démarrent à partir de 150 € selon la portée et prennent 3–5 semaines.";
        if (!lead.service) lead.service = 'Refonte de site';
        break;

      case 'landing':
        reply = "Nous sommes spécialisés dans les landing pages à fort taux de conversion — rapides à construire, structurées stratégiquement et visuellement alignées avec votre marque.\n\n"
          + KB.pricing.landing + "\n\n" + KB.timeline.landing;
        if (!lead.service) lead.service = 'Landing page';
        break;

      case 'corporate':
        reply = KB.services.find(s => s.id === 'web').desc;
        break;

      case 'seo':
        reply = KB.seo;
        break;

      case 'performance':
        reply = KB.services.find(s => s.id === 'seo').desc;
        break;

      case 'price':
        if (lead.service?.includes('mobile')) reply = KB.pricing.mobile;
        else if (lead.service?.includes('commerce') || lead.service?.includes('e-commerce')) reply = KB.pricing.ecom;
        else if (lead.service?.includes('landing')) reply = KB.pricing.landing;
        else if (lead.service?.includes('site') || lead.service?.includes('refonte')) reply = KB.pricing.website;
        else reply = KB.pricing.general;
        reply += '\n\n' + pickFresh(RESPONSE_POOLS.price_follow_up);
        priceDiscussedFor = lead.service || 'general';
        break;

      case 'negotiate':
        reply = getNegotiationResponse();
        break;

      case 'discount':
        reply = pickFresh(NEGOTIATION.discount);
        break;

      case 'value':
        reply = pickFresh(NEGOTIATION.value);
        break;

      case 'comparison':
        reply = pickFresh(NEGOTIATION.comparison);
        break;

      case 'timeline':
        if (lead.service?.includes('mobile')) reply = KB.timeline.mobile;
        else if (lead.service?.includes('landing')) reply = KB.timeline.landing;
        else if (lead.service?.includes('site') || lead.service?.includes('refonte')) reply = KB.timeline.website;
        else reply = KB.timeline.general;
        break;

      case 'process':
        reply = KB.process;
        break;

      case 'tech':
        reply = KB.tech;
        break;

      case 'hosting':
        reply = KB.hosting;
        break;

      case 'maintenance':
        reply = KB.maintenance;
        break;

      case 'cms':
        reply = KB.cms;
        break;

      case 'revisions':
        reply = KB.revisions;
        break;

      case 'mobile_friendly':
        reply = KB.mobile_friendly;
        break;

      case 'contact':
        reply = KB.contact;
        askedEmail = true;
        break;

      default:
        if (lastIntent === 'negotiate' || lastIntent === 'price') {
          reply = getNegotiationResponse();
        } else if (userText.length < 15) {
          reply = pickFromPool('unknown_short');
        } else {
          reply = pickFromPool('unknown_long');
        }
    }

    if (reply === lastBotReply && intent !== 'greeting') {
      if (['price','negotiate','discount','value','comparison'].includes(intent)) {
        reply = getNegotiationResponse();
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
      fd.append('_subject',        `Prospect Nova Dev Chat (FR) — ${lead.name}`);
      fd.append('_captcha',        'false');
      fd.append('_template',       'table');
      fd.append('Prénom',          lead.name);
      fd.append('Email',           lead.email);
      fd.append('Entreprise',      lead.company || 'Non renseigné');
      fd.append('Téléphone',       lead.phone   || 'Non renseigné');
      fd.append('Service souhaité',lead.service || 'Non précisé');
      fd.append('Source',          'Widget Chat IA — Nova Dev FR');
      fetch(FORM_ENDPOINT, {
        method:'POST',
        headers:{ 'Accept':'application/json' },
        body: fd
      }).catch(()=>{});
      if (typeof fbq === 'function') { try { fbq('track','Lead'); } catch(_){} }
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
      .replace(/</g,'&lt;').replace(/>/g,'&gt;')
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
  function hideTyping() {
    if (typingEl) { typingEl.remove(); typingEl = null; }
  }

  /* ── FLUX D'ENVOI ────────────────────────────────────────── */
  function handleSend() {
    const val = inputEl?.value.trim();
    if (!val || isThinking) return;
    inputEl.value = '';
    isThinking = true;
    setInputEnabled(false);
    appendMsg(val, 'user');
    showTyping();
    const delay = 400 + Math.random() * 500;
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
        appendMsg("Bonjour ! 👋 Je suis l'assistant Nova Dev.\n\nJe peux répondre à toutes vos questions sur nos services de design web, développement et applications mobiles — tarifs, délais, technologie, processus et bien plus encore.\n\nComment puis-je vous aider aujourd'hui ?", 'bot');
      }, 900);
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
  bubble.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){e.preventDefault();openChat();} });
  closeBtn?.addEventListener('click', closeChat);
  sendBtn?.addEventListener('click', handleSend);
  inputEl?.addEventListener('keydown', e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();} });
  document.addEventListener('keydown', e => { if(e.key==='Escape'&&isOpen) closeChat(); });

  /* ── OUVERTURE AUTO ──────────────────────────────────────── */
  setTimeout(() => { if (!isOpen && !opened) openChat(); }, AUTO_OPEN_DELAY);

})();
