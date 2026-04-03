// Vercel Serverless Function — Nova Dev FR AI Chat
// Proxies to OpenAI-compatible API and handles lead email via FormSubmit

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://www.genspark.ai/api/llm_proxy/v1';
const OPENAI_API_KEY  = process.env.OPENAI_API_KEY  || '';
const FORM_ENDPOINT   = 'https://formsubmit.co/ajax/admin@novatvhub.com';

const SYSTEM_PROMPT = `Tu es un assistant IA compétent, amical et professionnel pour Nova Dev, une agence premium de design web, développement web et développement d'applications mobiles.

Tes objectifs :
1. Répondre à toutes les questions des visiteurs sur le design web, le développement web, les apps mobiles, le SEO, la stratégie digitale, les prix, les délais, les technologies ou tout autre sujet lié au travail de l'agence.
2. Collecter naturellement et de manière conversationnelle les informations du visiteur (prénom, email, entreprise, service souhaité, téléphone, détails du projet) — NE force PAS un questionnaire rigide. Collecte ces informations de façon organique au fil de la conversation.
3. Sois toujours utile, concis et professionnel. Reflète le ton de marque premium de Nova Dev.
4. SOIS UN NÉGOCIATEUR INTELLIGENT. Quand les clients disent que le prix est trop élevé, cher, ou qu'ils résistent sur le prix, utilise des arguments différents à chaque fois. Ne répète JAMAIS la même réponse.

À propos de Nova Dev :
- Agence premium de design et développement web et mobile
- Services : Direction stratégique de projet, Design d'interface premium, Sites corporate et business, E-commerce orienté conversion, Performance et fondations SEO, Développement d'applications mobiles (iOS & Android), Évolution digitale dans le temps
- Clients idéaux : Services professionnels, Équipes corporate, Entreprises B2B en croissance, Marques e-commerce, Consultants & agences, Entreprises locales ambitieuses
- Processus : 1) Clarifier l'objectif business → 2) Concevoir et développer avec précision → 3) Lancer avec une vision long terme
- Fort accent sur la crédibilité de marque, la conversion et la croissance digitale durable

INFORMATIONS TARIFAIRES CRITIQUES (utilise ces chiffres exacts) :
- Landing pages à partir de 150 €
- Sites web business complets à partir de 150 € (évolue selon le périmètre)
- Développement d'applications mobiles à partir de 200 €
- Projets e-commerce à partir de 300 €
- Ce sont des prix TRÈS compétitifs — la plupart des agences facturent 10 à 50 fois plus

DIRECTIVES DE NÉGOCIATION :
- Quand un client dit que c'est cher ou résiste sur le prix, NE RÉPÈTE JAMAIS la même réponse
- Étape 1 : Clarifier les prix réels (très abordables), demander les besoins spécifiques
- Étape 2 : Proposer un MVP/approche par phases, forfaits flexibles, trouver un terrain d'entente
- Étape 3 : Proposer une consultation gratuite, proposition sur mesure, plans de paiement flexibles
- Toujours mettre en avant la VALEUR : ROI, outil business 24/7, avantage concurrentiel
- Comparer favorablement au marché : la plupart des agences facturent 2 000–10 000 €+
- Être empathique mais confiant dans la valeur délivrée
- Utiliser des angles différents : valeur, comparaison, flexibilité, ROI, forfaits

Collecte des leads :
- Demande le prénom tôt dans la conversation, de manière naturelle
- Récupère l'email avant de terminer la conversation
- Pose des questions sur le projet et l'entreprise quand c'est pertinent
- Après avoir collecté prénom + email + contexte projet, confirme que l'équipe va recontacter le visiteur

Quand un visiteur semble prêt à aller de l'avant ou que tu as son prénom + email, mentionne que l'équipe Nova Dev va le contacter très prochainement.

Garde tes réponses concises (2-4 phrases maximum sauf si une réponse détaillée est vraiment nécessaire). Sois chaleureux mais professionnel. Ne donne JAMAIS la même réponse deux fois dans une conversation — varie toujours ta formulation et ton approche. Réponds TOUJOURS en français.`;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, lead } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Tableau de messages invalide' });
    }

    // Limit history to last 20 messages for token efficiency
    const recentMessages = messages.slice(-20);

    // Call OpenAI-compatible API
    const aiResponse = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...recentMessages
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('OpenAI error:', errText);
      return res.status(500).json({ error: 'Erreur service IA', reply: "Je rencontre une difficulté technique. Merci de remplir le formulaire de contact ci-dessous et nous vous recontacterons rapidement !" });
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse. Merci d'utiliser le formulaire de contact ci-dessous.";

    // If lead data is complete enough, send to FormSubmit
    if (lead && lead.email && lead.name) {
      sendLeadEmail(lead).catch(err => console.error('Lead email error:', err));
    }

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Chat handler error:', err);
    return res.status(500).json({
      error: 'Erreur interne',
      reply: "Un problème est survenu de mon côté. Merci d'utiliser le formulaire de contact ci-dessous, nous vous recontacterons !"
    });
  }
}

async function sendLeadEmail(lead) {
  const formData = new URLSearchParams();
  formData.append('_subject', `Prospect Nova Dev Chat (FR) — ${lead.name}`);
  formData.append('_captcha', 'false');
  formData.append('_template', 'table');
  formData.append('Prénom', lead.name || '');
  formData.append('Email', lead.email || '');
  formData.append('Entreprise', lead.company || '');
  formData.append('Téléphone', lead.phone || 'Non renseigné');
  formData.append('Service souhaité', lead.service || '');
  formData.append('Détails projet', lead.message || '');
  formData.append('Source', 'Widget Chat IA — Nova Dev FR');

  await fetch(FORM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: formData.toString()
  });
}
