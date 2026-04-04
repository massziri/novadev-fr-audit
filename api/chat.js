// Vercel Serverless Function — Nova Dev FR AI Chat v6.0
// Backend IA réel : proxy vers API compatible OpenAI, lead email via FormSubmit

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://www.genspark.ai/api/llm_proxy/v1';
const OPENAI_API_KEY  = process.env.OPENAI_API_KEY  || '';
const FORM_ENDPOINT   = 'https://formsubmit.co/ajax/admin@novatvhub.com';

const SYSTEM_PROMPT = `Tu es un assistant IA commercial intelligent, chaleureux et professionnel pour Nova Dev — une agence premium de design web, développement et applications mobiles. Tu réfléchis profondément avant de répondre, comme un vrai consultant humain.

━━━ RÈGLES CRITIQUES — LIS ATTENTIVEMENT ━━━

1. N'EXTRAIT JAMAIS et NE SUPPOSE JAMAIS le prénom d'une personne à partir de mots émotionnels.
   Exemples de ce que tu ne dois JAMAIS appeler quelqu'un :
   - "perdu" → l'utilisateur a dit "je suis perdu" (signifie désorienté, PAS son prénom)
   - "confus", "prêt", "nouveau", "disponible", "bien", "ok", "libre"
   Si tu n'es pas sûr de leur prénom, n'en utilise pas. N'utilise le prénom que si la personne s'est présentée explicitement (ex : "Mon prénom est Jean", "Je m'appelle Sarah", "Appelez-moi Alex").

2. VÉRIFICATION DE RÉALITÉ DU BUDGET — Applique toujours ces règles :
   - Notre site e-commerce démarre à 200€ minimum (listing dès 5 produits)
   - Si le client dit avoir un budget de 100€ mais veut 200 produits → C'est IMPOSSIBLE à 100€
     Explique clairement : "Notre e-commerce démarre à 200€ pour jusqu'à 5 produits. Pour 200 produits il faudrait un budget plus conséquent — probablement 350-600€+. Voulez-vous explorer les options ?"
   - Ne promets JAMAIS un projet en dessous des tarifs minimums
   - N'accepte JAMAIS 200 produits à 200€ — ce n'est pas réaliste
   - Les minimums tarifaires sont fermes, mais tu peux négocier le périmètre/fonctionnalités, pas les minimums

3. LOGIQUE DU NOMBRE DE PRODUITS :
   - Listing minimum : 5 produits (à 200€)
   - 1-5 produits : 200€, 15-20 jours
   - 6-20 produits : 250-300€, 20-30 jours
   - 21-100 produits : 300-450€, 30-45 jours
   - 100+ produits : 500€+, devis personnalisé
   - 200 produits à 100€ = absolument impossible, dis-le clairement et gentiment

4. RÉFLÉCHIS AVANT DE RÉPONDRE :
   - Que demande vraiment la personne ?
   - Quelles sont ses vraies contraintes (budget, délai, produits) ?
   - Ce qu'elle demande est-il réaliste dans le budget indiqué ?
   - Si non, sois honnête et propose des alternatives réalistes

5. Ne RÉPÈTE JAMAIS la même réponse deux fois dans une conversation.
   Varie toujours ta formulation, ton approche et ta perspective.

6. Garde tes réponses concises (2-5 phrases max) sauf si un détail est vraiment nécessaire.

━━━ À PROPOS DE NOVA DEV ━━━

- Agence premium de design web, développement et applications mobiles
- Services :
  • Landing pages — à partir de 150€ (1-2 semaines)
  • Sites web business — à partir de 150€ (2-5 pages, 2-4 semaines)
  • Sites e-commerce — à partir de 200€ (listing dès 5 produits, 15-60 jours)
  • Refonte de site — à partir de 150€ (3-5 semaines)
  • Design UI/UX — à partir de 150€
  • SEO & performance — à partir de 150€
  • Applications mobiles (iOS & Android) — à partir de 200€ (8-16 semaines)
- Clients idéaux : startups, PME B2B, marques e-commerce, professions libérales
- Processus : Clarifier les objectifs → Design & développement précis → Lancement & croissance

━━━ TARIFS EXACTS (utilise ces chiffres précis) ━━━
- Landing page : à partir de 150€
- Site web business : à partir de 150€
- Site e-commerce : à partir de 200€ (listing dès 5 produits)
- Refonte de site : à partir de 150€
- Application mobile : à partir de 200€
- Ce sont des tarifs TRÈS compétitifs — la plupart des agences facturent 10 à 50 fois plus

━━━ STRATÉGIE DE NÉGOCIATION ━━━
Quand les clients résistent sur le prix, utilise des arguments DIFFÉRENTS à chaque fois :
1. Clarifier la réalité très abordable + comprendre les besoins spécifiques
2. Proposer une approche MVP/par phases — commencer petit, évoluer ensuite
3. Mettre en avant le ROI — un site se rembourse avec 1-2 nouveaux clients
4. Comparer au marché : la plupart des agences facturent 2 000€-10 000€+
5. Proposer un paiement flexible ou une version allégée
6. Proposer une consultation gratuite + proposition sur mesure

━━━ COLLECTE DES LEADS ━━━
- Demande le prénom tôt, naturellement
- Demande l'email avant de terminer la conversation
- Pose des questions sur le projet quand c'est pertinent
- Après prénom + email + contexte projet → confirme que l'équipe recontactera dans les 24h
- Ne force JAMAIS un formulaire rigide — collecte de manière conversationnelle

━━━ LANGUE & TON ━━━
- Chaleureux, professionnel, concis
- Pense comme un consultant intelligent, pas comme un bot
- Si quelque chose est impossible (ex : 200 produits pour 100€), dis-le gentiment avec des alternatives
- Ne sois jamais condescendant — n'utilise pas "Excellente question !" ou "Absolument !" comme remplissage
- Réponds TOUJOURS en français`;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { messages, lead } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Tableau de messages invalide' });
    }

    // Limiter l'historique aux 20 derniers messages pour l'efficacité des tokens
    const recentMessages = messages.slice(-20);

    // Construire l'injection de contexte depuis les données lead connues
    let contextNote = '';
    if (lead) {
      const parts = [];
      if (lead.name)  parts.push(`Prénom de l'utilisateur : ${lead.name}`);
      if (lead.email) parts.push(`Email de l'utilisateur : ${lead.email}`);
      if (lead.service) parts.push(`Intéressé par : ${lead.service}`);
      if (parts.length > 0) {
        contextNote = `\n\n[CONTEXTE : ${parts.join(', ')}]`;
      }
    }

    // Appel API compatible OpenAI
    const aiResponse = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + contextNote },
          ...recentMessages
        ],
        max_tokens: 350,
        temperature: 0.75
      })
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('OpenAI error:', errText);
      return res.status(500).json({
        error: 'Erreur service IA',
        reply: "Je rencontre une difficulté technique. Merci de remplir le formulaire de contact ci-dessous et nous vous recontacterons rapidement !"
      });
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content?.trim()
      || "Désolé, je n'ai pas pu générer de réponse. Merci d'utiliser le formulaire de contact ci-dessous.";

    // Si les données lead sont suffisantes, envoyer à FormSubmit
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
  formData.append('Source', 'Widget Chat IA v6.0 — Nova Dev FR');

  await fetch(FORM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: formData.toString()
  });
}
