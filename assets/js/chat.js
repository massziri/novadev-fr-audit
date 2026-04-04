(() => {
  'use strict';

  /* ============================================================
     NOVA DEV — Widget Chat IA v6.0 (FR)
     
     ARCHITECTURE v6.0 — Intégration complète backend IA :
     - Toutes les réponses viennent d'un vrai LLM via /api/chat
     - Plus de correspondance par mots-clés ni de pools de réponses
     - Le contexte (prénom, email, budget, produits) est extrait
       côté client et envoyé avec chaque requête
     - Le lead est capturé côté client, envoyé à FormSubmit quand email connu
     - Indicateur de saisie pendant l'attente de la réponse IA
     - Historique complet de la conversation gardé en mémoire par session
  ============================================================ */

  const FORM_ENDPOINT   = 'https://formsubmit.co/ajax/admin@novatvhub.com';
  const AUTO_OPEN_DELAY = 9000;
  const API_ENDPOINT    = '/api/chat';

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

  // Données lead — extraites progressivement de la conversation
  const lead = { name: '', email: '', company: '', phone: '', service: '' };

  // Historique de conversation envoyé à l'IA
  const history = [];

  /* ── EXTRACTION DU LEAD (côté client, pour la capture) ─────── */
  function extractLead(text) {
    // Email
    const emailM = text.match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/);
    if (emailM && !lead.email) lead.email = emailM[0];

    // Téléphone
    const phoneM = text.match(/(\+?\d[\d\s\-().]{6,}\d)/);
    if (phoneM && !lead.phone) lead.phone = phoneM[0].trim();

    // Prénom — uniquement depuis des formules d'introduction explicites
    // IMPORTANT : "je suis perdu" NE doit PAS extraire "perdu" comme prénom
    const nameM = text.match(/(?:je m(?:'|')appelle|mon pr[eé]nom est|c(?:'|')est|appelez.moi)\s+([A-ZÀ-Üa-zà-ü]{2,20})(?:\s|$|,|\.)/i);
    if (nameM && !lead.name) {
      // Exclure les mots courants qui ne sont pas des prénoms
      const notNames = ['perdu','confus','pret','ici','bien','ok','nouveau','pas','juste','encore','deja','disponible','libre'];
      const candidate = nameM[1].toLowerCase();
      if (!notNames.includes(candidate)) {
        lead.name = nameM[1].charAt(0).toUpperCase() + nameM[1].slice(1).toLowerCase();
      }
    }
  }

  /* ── APPEL IA ────────────────────────────────────────────── */
  async function askAI(userMessage) {
    history.push({ role: 'user', content: userMessage });

    const payload = {
      messages: history.slice(-20),
      lead: {
        name:    lead.name    || '',
        email:   lead.email   || '',
        company: lead.company || '',
        phone:   lead.phone   || '',
        service: lead.service || ''
      }
    };

    try {
      const res = await fetch(API_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
      });

      const data = await res.json();
      const reply = data.reply || "Désolé, une erreur est survenue. Merci d'utiliser le formulaire de contact ci-dessous.";
      history.push({ role: 'assistant', content: reply });
      return reply;

    } catch (err) {
      const fallback = "J'ai un problème de connexion. Merci de remplir le formulaire de contact ci-dessous et nous vous recontacterons !";
      history.push({ role: 'assistant', content: fallback });
      return fallback;
    }
  }

  /* ── ENVOI DU LEAD ───────────────────────────────────────── */
  function maybeSendLead() {
    if (lead.email && !leadSent) {
      leadSent = true;
      const fd = new FormData();
      fd.append('_subject',   `Prospect Nova Dev (FR) — ${lead.name || lead.email}`);
      fd.append('_captcha',   'false');
      fd.append('_template',  'table');
      fd.append('Prénom',     lead.name    || 'Non renseigné');
      fd.append('Email',      lead.email);
      fd.append('Entreprise', lead.company || 'Non renseigné');
      fd.append('Téléphone',  lead.phone   || 'Non renseigné');
      fd.append('Service',    lead.service || 'Non précisé');
      fd.append('Source',     'Widget Chat IA v6.0 — Nova Dev FR');
      fetch(FORM_ENDPOINT, { method: 'POST', headers: { 'Accept': 'application/json' }, body: fd })
        .catch(() => {});
      if (typeof fbq === 'function') try { fbq('track', 'Lead'); } catch (_) {}
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
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
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

  /* ── GESTIONNAIRE D'ENVOI ────────────────────────────────── */
  async function handleSend() {
    const val = inputEl?.value.trim();
    if (!val || isThinking) return;
    inputEl.value = '';
    isThinking = true;
    setInputEnabled(false);

    // Extraire les données lead du message utilisateur
    extractLead(val);

    // Afficher le message utilisateur
    appendMsg(val, 'user');
    showTyping();

    // Appeler l'IA
    const reply = await askAI(val);
    hideTyping();
    appendMsg(reply, 'bot');

    // Essayer aussi d'extraire le lead depuis la réponse IA
    extractLead(reply);
    maybeSendLead();

    isThinking = false;
    setInputEnabled(true);
    inputEl?.focus();
  }

  function setInputEnabled(on) {
    if (inputEl) inputEl.disabled = !on;
    if (sendBtn) sendBtn.disabled = !on;
  }

  /* ── MESSAGE D'ACCUEIL ───────────────────────────────────── */
  async function showGreeting() {
    setTimeout(() => {
      showTyping();
      setTimeout(async () => {
        hideTyping();
        // Ajouter le message d'accueil à l'historique pour que l'IA ait le contexte
        const greeting = "Bonjour ! 👋 Je suis l'assistant Nova Dev.\n\nDites-moi ce que vous voulez créer — **site web, boutique en ligne, application mobile, landing page** — et je vous propose exactement ce qu'il vous faut, avec prix et délais.\n\nPas encore d'idée ? Dites-le-moi et je vous aide à choisir ! 😊";
        history.push({ role: 'assistant', content: greeting });
        appendMsg(greeting, 'bot');
      }, 850);
    }, 300);
  }

  /* ── OUVERTURE / FERMETURE ───────────────────────────────── */
  function openChat() {
    if (isOpen) return;
    isOpen = true;
    chatWindow.removeAttribute('hidden');
    bubble.setAttribute('aria-expanded', 'true');
    if (badge) badge.style.display = 'none';
    if (!opened) { opened = true; showGreeting(); }
    inputEl?.focus();
  }

  function closeChat() {
    isOpen = false;
    chatWindow.setAttribute('hidden', '');
    bubble.setAttribute('aria-expanded', 'false');
  }

  /* ── ÉCOUTEURS D'ÉVÉNEMENTS ──────────────────────────────── */
  bubble.addEventListener('click', openChat);
  bubble.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openChat(); }
  });
  closeBtn?.addEventListener('click', closeChat);
  sendBtn?.addEventListener('click', handleSend);
  inputEl?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen) closeChat();
  });

  setTimeout(() => { if (!isOpen && !opened) openChat(); }, AUTO_OPEN_DELAY);

})();
