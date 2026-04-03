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

À propos de Nova Dev :
- Agence premium de design et développement web et mobile
- Services : Direction stratégique de projet, Design d'interface premium, Sites corporate et business, E-commerce orienté conversion, Performance et fondations SEO, Développement d'applications mobiles (iOS & Android), Évolution digitale dans le temps
- Clients idéaux : Services professionnels, Équipes corporate, Entreprises B2B en croissance, Marques e-commerce, Consultants & agences, Entreprises locales ambitieuses
- Processus : 1) Clarifier l'objectif business → 2) Concevoir et développer avec précision → 3) Lancer avec une vision long terme
- Fort accent sur la crédibilité de marque, la conversion et la croissance digitale durable

Collecte des leads :
- Demande le prénom tôt dans la conversation, de manière naturelle
- Récupère l'email avant de terminer la conversation
- Pose des questions sur le projet et l'entreprise quand c'est pertinent
- Après avoir collecté prénom + email + contexte projet, confirme que l'équipe va recontacter le visiteur

Quand un visiteur semble prêt à aller de l'avant ou que tu as son prénom + email, mentionne que l'équipe Nova Dev va le contacter très prochainement.

Garde tes réponses concises (2-4 phrases maximum sauf si une réponse détaillée est vraiment nécessaire). Sois chaleureux mais professionnel. Réponds TOUJOURS en français.`;

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
