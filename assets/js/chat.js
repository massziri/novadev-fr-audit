(() => {
  'use strict';

  // ─── Config ────────────────────────────────────────────────────────────────
  const API_ENDPOINT    = '/api/chat';
  const FORM_ENDPOINT   = 'https://formsubmit.co/ajax/admin@novatvhub.com';
  const AUTO_OPEN_DELAY = 9000; // ms

  // ─── DOM ───────────────────────────────────────────────────────────────────
  const bubble     = document.getElementById('ai-chat-bubble');
  const chatWindow = document.getElementById('ai-chat-window');
  const closeBtn   = document.getElementById('ai-chat-close');
  const messagesEl = document.getElementById('chat-messages');
  const inputEl    = document.getElementById('chat-input');
  const sendBtn    = document.getElementById('chat-send');
  const badge      = bubble?.querySelector('.chat-badge');

  if (!bubble || !chatWindow || !messagesEl) return;

  // ─── State ─────────────────────────────────────────────────────────────────
  let isOpen      = false;
  let isTyping    = false;
  let opened      = false;

  // Historique de conversation envoyé à l'IA
  const history   = [];

  // Informations du prospect extraites progressivement
  const lead      = { name: '', email: '', company: '', phone: '', service: '', message: '' };

  // ─── Extraction des données prospect ───────────────────────────────────────
  const emailRx   = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/;
  const phoneRx   = /(\+?\d[\d\s\-().]{7,15}\d)/;

  function extractLeadData(text) {
    const emailMatch = text.match(emailRx);
    if (emailMatch && !lead.email) lead.email = emailMatch[0];

    const phoneMatch = text.match(phoneRx);
    if (phoneMatch && !lead.phone) lead.phone = phoneMatch[0];

    if (!lead.service) {
      const lower = text.toLowerCase();
      if (lower.includes('application mobile') || lower.includes('app mobile') || lower.includes('ios') || lower.includes('android')) lead.service = "Développement d'application mobile";
      else if (lower.includes('e-commerce') || lower.includes('boutique en ligne')) lead.service = 'E-commerce';
      else if (lower.includes('refonte')) lead.service = 'Refonte de site';
      else if (lower.includes('landing')) lead.service = 'Landing page';
      else if (lower.includes('site web') || lower.includes('website')) lead.service = 'Site web';
    }
  }

  function extractNameFromContext(botText, userText) {
    if (!lead.name) {
      const nameFromBot = botText.match(/(?:ravi de vous rencontrer|enchanté|bonjour|salut),?\s+([A-ZÀ-Ü][a-zà-ü]{1,20})/i);
      if (nameFromBot) lead.name = nameFromBot[1];
      const nameFromUser = userText.match(/(?:je m(?:'|')appelle|mon prénom est|c(?:'|')est|je suis)\s+([A-ZÀ-Ü][a-zà-ü]{1,20})/i);
      if (nameFromUser) lead.name = nameFromUser[1];
      const single = userText.trim();
      if (!lead.name && /^[A-ZÀ-Ü][a-zà-ü]{1,19}$/.test(single)) lead.name = single;
    }
  }

  function maybeSendLead() {
    if (lead.email && lead.name && !lead._sent) {
      lead._sent = true;
      sendLeadToFormSubmit().catch(() => {});
    }
  }

  async function sendLeadToFormSubmit() {
    const fd = new FormData();
    fd.append('_subject', `Prospect Nova Dev Chat (FR) — ${lead.name || 'Inconnu'}`);
    fd.append('_captcha', 'false');
    fd.append('_template', 'table');
    fd.append('Prénom',          lead.name    || '');
    fd.append('Email',           lead.email   || '');
    fd.append('Entreprise',      lead.company || '');
    fd.append('Téléphone',       lead.phone   || 'Non renseigné');
    fd.append('Service souhaité',lead.service || '');
    fd.append('Détails projet',  lead.message || '');
    fd.append('Source',          'Widget Chat IA — Nova Dev FR');
    await fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: fd
    });
    if (typeof fbq === 'function') { try { fbq('track', 'Lead'); } catch(_){} }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const clock = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const scrollDown = () => { messagesEl.scrollTop = messagesEl.scrollHeight; };

  function appendMsg(text, role) {
    const wrap = document.createElement('div');
    wrap.className = `chat-msg ${role}`;

    const bub = document.createElement('div');
    bub.className = 'chat-bubble';
    bub.innerHTML = text.replace(/\n/g, '<br>');

    const ts = document.createElement('div');
    ts.className = 'chat-time';
    ts.textContent = clock();

    wrap.appendChild(bub);
    wrap.appendChild(ts);
    messagesEl.appendChild(wrap);
    scrollDown();
    return wrap;
  }

  let typingEl = null;
  function showTypingIndicator() {
    if (typingEl) return;
    typingEl = document.createElement('div');
    typingEl.className = 'chat-msg bot';
    typingEl.id = 'chat-typing-indicator';
    typingEl.innerHTML = '<div class="chat-typing"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(typingEl);
    scrollDown();
  }
  function hideTypingIndicator() {
    if (typingEl) { typingEl.remove(); typingEl = null; }
  }

  // ─── Appel IA ──────────────────────────────────────────────────────────────
  async function askAI(userMessage) {
    if (isTyping) return;
    isTyping = true;
    setInputEnabled(false);

    appendMsg(userMessage, 'user');
    history.push({ role: 'user', content: userMessage });
    extractLeadData(userMessage);

    showTypingIndicator();

    try {
      const resp = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, lead })
      });

      let reply;
      if (resp.ok) {
        const data = await resp.json();
        reply = data.reply || "Je rencontre une difficulté. Merci d'utiliser le formulaire de contact ci-dessous !";
      } else {
        reply = "Je rencontre un petit problème technique. Merci d'utiliser le formulaire de contact ci-dessous, nous vous répondrons rapidement !";
      }

      hideTypingIndicator();
      appendMsg(reply, 'bot');
      history.push({ role: 'assistant', content: reply });

      extractNameFromContext(reply, userMessage);
      extractLeadData(reply);
      maybeSendLead();

    } catch (err) {
      hideTypingIndicator();
      const fallback = "Problème de connexion de mon côté. Vous pouvez nous contacter directement via le formulaire ci-dessous — nous répondons vite !";
      appendMsg(fallback, 'bot');
      history.push({ role: 'assistant', content: fallback });
    } finally {
      isTyping = false;
      setInputEnabled(true);
      inputEl?.focus();
    }
  }

  // ─── Message de bienvenue (sans appel API) ─────────────────────────────────
  function showGreeting() {
    setTimeout(() => {
      showTypingIndicator();
      setTimeout(() => {
        hideTypingIndicator();
        const msg = "Bonjour ! 👋 Je suis l'assistant Nova Dev.\n\nJe peux répondre à toutes vos questions sur nos services de design web, développement et applications mobiles — ou vous aider à lancer votre projet.\n\nComment puis-je vous aider aujourd'hui ?";
        appendMsg(msg, 'bot');
        history.push({ role: 'assistant', content: msg });
      }, 900);
    }, 300);
  }

  // ─── Contrôles UI ─────────────────────────────────────────────────────────
  function setInputEnabled(on) {
    if (inputEl) inputEl.disabled = !on;
    if (sendBtn) sendBtn.disabled = !on;
  }

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

  function handleSend() {
    const val = inputEl?.value.trim();
    if (!val || isTyping) return;
    inputEl.value = '';
    askAI(val);
  }

  // ─── Événements ────────────────────────────────────────────────────────────
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

  // ─── Ouverture automatique ─────────────────────────────────────────────────
  setTimeout(() => {
    if (!isOpen && !opened) openChat();
  }, AUTO_OPEN_DELAY);

})();
