// Vercel Serverless Function — Nova Dev FR AI Chat v7.0
// LLM: Pollinations.ai (100% GRATUIT, sans clé API, compatible OpenAI)
// Lead capture: FormSubmit → admin@novatvhub.com
// Brevo: définir BREVO_API_KEY dans les variables d'env Vercel pour activer

const POLLINATIONS_URL = 'https://text.pollinations.ai/openai';
const FORM_ENDPOINT    = 'https://formsubmit.co/ajax/admin@novatvhub.com';
const BREVO_API_KEY    = process.env.BREVO_API_KEY || '';
const BREVO_LIST_ID    = parseInt(process.env.BREVO_LIST_ID || '3', 10);

const SYSTEM_PROMPT = `Tu es un assistant IA commercial intelligent, chaleureux et professionnel pour Nova Dev — une agence premium de design web, développement et applications mobiles basée en France. Tu réfléchis profondément avant de répondre, comme un vrai consultant humain.

━━━ RÈGLES CRITIQUES — LIS ATTENTIVEMENT ━━━

1. N'EXTRAIT JAMAIS et NE SUPPOSE JAMAIS le prénom d'une personne à partir de mots émotionnels.
   Exemples de ce que tu ne dois JAMAIS appeler quelqu'un :
   - "perdu" → l'utilisateur a dit "je suis perdu" (signifie désorienté, PAS son prénom)
   - "confus", "prêt", "nouveau", "disponible", "bien", "ok", "libre"
   N'utilise leur prénom que s'ils se sont clairement présentés.

2. RÉALITÉ DES BUDGETS — Applique toujours ces règles :
   - Landing pages à partir de 150€ / Sites web à partir de 150€ / E-commerce à partir de 200€ / Apps mobiles à partir de 200€ / Refonte à partir de 150€
   - Sois honnête sur les contraintes budgétaires mais propose toujours des alternatives
   - NE PROMETS JAMAIS en dessous du prix minimum

3. RÉFLÉCHIS AVANT DE RÉPONDRE :
   - Que demande vraiment cette personne ?
   - Quelles sont leurs contraintes réelles (budget, délai, type de projet) ?
   - Ce qu'on demande est-il réaliste ? Sinon, dis-le gentiment avec des alternatives.

4. Garde les réponses concises (2-4 phrases max) sauf si le détail est vraiment nécessaire.
5. Ne répète JAMAIS la même réponse deux fois dans une conversation.

━━━ À PROPOS DE NOVA DEV ━━━

- Agence premium de design web, développement et applications mobiles en France et en Europe
- Services :
  • Landing pages — à partir de 150€ (1-2 semaines)
  • Sites web professionnels/corporate — à partir de 150€ (2-5 pages, 2-4 semaines)
  • Sites e-commerce — à partir de 200€ (15-60 jours)
  • Refonte de site — à partir de 150€ (3-5 semaines)
  • Design UI/UX — à partir de 500€
  • SEO & performance — à partir de 300€
  • Applications mobiles (iOS & Android) — à partir de 200€ (8-16 semaines)
- Clients idéaux : startups, entreprises B2B, e-commerce, services professionnels, PME françaises
- Processus : Clarifier les objectifs → Concevoir & développer avec précision → Lancer & croître
- Conforme RGPD, mobile-first, axé France & Europe

━━━ TARIFS EXACTS (utilise ces chiffres précis) ━━━
- Landing page : à partir de 150€
- Site professionnel : à partir de 150€
- Site e-commerce : à partir de 200€
- Refonte de site : à partir de 150€
- Application mobile : à partir de 200€
- Très compétitifs — la plupart des agences françaises facturent 3-10× plus

━━━ COLLECTE DE LEADS ━━━
- Demande le prénom tôt, naturellement
- Demande l'email avant de terminer la conversation
- Demande le type de projet et le délai souhaité
- Après avoir collecté prénom + email → confirme que l'équipe recontactera dans les 24h
- Ne force JAMAIS un formulaire rigide — collecte de façon conversationnelle et chaleureuse

━━━ LANGUE & TON ━━━
- Chaleureux, professionnel, concis
- Pense comme un consultant intelligent, pas comme un bot
- Si quelque chose est impossible avec leur budget, dis-le gentiment avec des alternatives
- N'utilise pas de formules de politesse creuses comme "Super question !" ou "Absolument !"`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, lead } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages array' });
    }

    const recentMessages = messages.slice(-20);

    let contextNote = '';
    if (lead) {
      const parts = [];
      if (lead.name)    parts.push(`Prénom de l'utilisateur : ${lead.name}`);
      if (lead.email)   parts.push(`Email : ${lead.email}`);
      if (lead.service) parts.push(`Intéressé par : ${lead.service}`);
      if (lead.phone)   parts.push(`Téléphone : ${lead.phone}`);
      if (parts.length > 0) contextNote = `\n\n[CONTEXTE : ${parts.join(', ')}]`;
    }

    // ── Appel Pollinations.ai (GRATUIT, sans clé API) ──
    const aiResponse = await fetch(POLLINATIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + contextNote },
          ...recentMessages
        ],
        max_tokens: 350,
        temperature: 0.75,
        seed: 42,
        private: true
      })
    });

    if (!aiResponse.ok) {
      console.error('LLM error:', await aiResponse.text());
      return res.status(200).json({
        reply: "J'ai un problème technique momentané. Remplissez le formulaire de contact ci-dessous et notre équipe vous recontactera sous 24h !"
      });
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content?.trim()
      || "Je n'ai pas pu générer une réponse pour l'instant. Utilisez le formulaire de contact ci-dessous, nous vous répondrons rapidement !";

    if (lead && lead.email) {
      Promise.all([
        sendLeadFormSubmit(lead),
        sendLeadToBrevo(lead)
      ]).catch(err => console.error('Lead capture error:', err));
    }

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Chat handler error:', err);
    return res.status(200).json({
      reply: "Un problème est survenu. Utilisez le formulaire de contact ci-dessous et nous vous répondrons très vite !"
    });
  }
}

async function sendLeadFormSubmit(lead) {
  const formData = new URLSearchParams();
  formData.append('_subject', `Nova Dev Lead Chat (FR) — ${lead.name || lead.email}`);
  formData.append('_captcha', 'false');
  formData.append('_template', 'table');
  formData.append('Prénom',    lead.name    || 'Non fourni');
  formData.append('Email',     lead.email);
  formData.append('Entreprise',lead.company || 'Non fournie');
  formData.append('Téléphone', lead.phone   || 'Non fourni');
  formData.append('Service',   lead.service || 'Non précisé');
  formData.append('Source',    'Chat IA v7.0 — Pollinations.ai — Nova Dev FR');

  await fetch(FORM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: formData.toString()
  });
}

async function sendLeadToBrevo(lead) {
  if (!BREVO_API_KEY) return;

  await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      email: lead.email,
      attributes: {
        FIRSTNAME: lead.name    || '',
        LASTNAME:  lead.company || '',
        SMS:       lead.phone   || '',
        COMPANY:   lead.company || '',
        SOURCE:    'Chat IA - Nova Dev FR'
      },
      listIds: [BREVO_LIST_ID],
      updateEnabled: true
    })
  });

  if (lead.name && lead.email) {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'Nova Dev', email: 'admin@novatvhub.com' },
        to: [{ email: lead.email, name: lead.name || 'là' }],
        replyTo: { email: 'admin@novatvhub.com' },
        subject: 'Merci d\'avoir discuté avec Nova Dev 🚀',
        htmlContent: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;color:#1e1b4b;">
            <div style="background:linear-gradient(135deg,#1e1b4b,#4338ca);padding:32px;text-align:center;border-radius:12px 12px 0 0;">
              <h1 style="color:#fff;margin:0;font-size:1.6rem;">&lt;/&gt; Nova<em>Dev</em></h1>
              <p style="color:#c7d2fe;margin:8px 0 0;font-size:.9rem;">Agence Web & Mobile Premium</p>
            </div>
            <div style="padding:32px;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
              <h2 style="color:#1e1b4b;">Bonjour ${lead.name || ''} 👋</h2>
              <p style="color:#475569;line-height:1.7;">Merci de nous avoir contactés chez <strong>Nova Dev</strong> ! Nous avons bien reçu votre demande et notre équipe va étudier les détails de votre projet très prochainement.</p>
              <p style="color:#475569;line-height:1.7;">Nous vous répondons généralement <strong>sous 24 heures</strong> avec une proposition personnalisée pour votre projet.</p>
              ${lead.service ? `<p style="background:#f0f9ff;border-left:4px solid #6366f1;padding:12px 16px;border-radius:4px;color:#1e1b4b;"><strong>Votre projet :</strong> ${lead.service}</p>` : ''}
              <div style="text-align:center;margin:28px 0;">
                <a href="https://novadev-fr-audit.vercel.app/#contact" style="background:#6366f1;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">Voir notre portfolio →</a>
              </div>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
              <p style="font-size:.82rem;color:#94a3b8;text-align:center;">Nova Dev · admin@novatvhub.com · WhatsApp : <a href="https://wa.me/212665103031" style="color:#6366f1;">+212 665 103 031</a></p>
            </div>
          </div>
        `
      })
    });
  }
}
