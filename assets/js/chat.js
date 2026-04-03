(() => {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  const FORM_ENDPOINT = 'https://formsubmit.co/ajax/admin@novatvhub.com';

  // ── Lead state ────────────────────────────────────────────────────────────
  const lead = { name: '', email: '', company: '', phone: '', service: '', message: '' };

  // ── Conversation flow (French) ────────────────────────────────────────────
  const STEPS = [
    {
      key: 'name',
      question: "Bonjour ! 👋 Je suis l'assistant Nova Dev.\n\nJ'aimerais en savoir un peu plus sur votre projet pour que la bonne personne puisse vous recontacter.\n\nComment vous appelez-vous ?",
      validate: v => v.trim().length >= 2,
      errorMsg: "Merci d'entrer votre prénom (au moins 2 caractères)."
    },
    {
      key: 'service',
      question: name => `Ravi de vous rencontrer, ${name} ! 😊\n\nQuel type de projet souhaitez-vous réaliser ?`,
      validate: v => v.trim().length >= 2,
      quickReplies: [
        "Site web premium",
        "Refonte de site",
        "Application mobile",
        "E-commerce",
        "Landing page",
        "Pas encore décidé"
      ]
    },
    {
      key: 'company',
      question: "Excellent choix ! Quel est le nom de votre entreprise ou marque ?",
      validate: v => v.trim().length >= 2,
      errorMsg: "Merci d'entrer le nom de votre entreprise ou marque."
    },
    {
      key: 'email',
      question: "Quelle est la meilleure adresse e-mail pour vous joindre ?",
      validate: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
      errorMsg: "Merci d'entrer une adresse e-mail valide."
    },
    {
      key: 'phone',
      question: "Et votre numéro de téléphone ? (optionnel — tapez 'passer' pour continuer)",
      validate: () => true // optional
    },
    {
      key: 'message',
      question: "Dernière question ! Décrivez brièvement votre projet ou ce que vous souhaitez accomplir — même quelques mots suffisent.",
      validate: v => v.trim().length >= 3,
      errorMsg: "Merci de partager quelques mots sur votre projet."
    }
  ];

  // ── DOM elements ──────────────────────────────────────────────────────────
  const bubble = document.getElementById('ai-chat-bubble');
  const chatWindow = document.getElementById('ai-chat-window');
  const closeBtn = document.getElementById('ai-chat-close');
  const messagesEl = document.getElementById('chat-messages');
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const badge = bubble?.querySelector('.chat-badge');

  if (!bubble || !chatWindow) return;

  // ── State ─────────────────────────────────────────────────────────────────
  let isOpen = false;
  let stepIndex = 0;
  let waitingForInput = false;
  let submitted = false;
  let opened = false;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const now = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  const scrollToBottom = () => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  const createMsg = (text, type) => {
    const wrapper = document.createElement('div');
    wrapper.className = `chat-msg ${type}`;

    const bub = document.createElement('div');
    bub.className = 'chat-bubble';
    bub.textContent = text;

    const time = document.createElement('div');
    time.className = 'chat-time';
    time.textContent = now();

    wrapper.appendChild(bub);
    wrapper.appendChild(time);
    return wrapper;
  };

  const addMsg = (text, type, delay = 0) => {
    return new Promise(resolve => {
      setTimeout(() => {
        const msg = createMsg(text, type);
        messagesEl.appendChild(msg);
        scrollToBottom();
        resolve();
      }, delay);
    });
  };

  const showTyping = () => {
    const el = document.createElement('div');
    el.className = 'chat-msg bot';
    el.id = 'chat-typing-indicator';
    el.innerHTML = `<div class="chat-typing"><span></span><span></span><span></span></div>`;
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  };

  const botSay = (text, delay = 600) => {
    return new Promise(resolve => {
      const typing = showTyping();
      setTimeout(async () => {
        typing.remove();
        await addMsg(text, 'bot');
        resolve();
      }, delay);
    });
  };

  const addQuickReplies = (replies) => {
    const existing = messagesEl.querySelector('.chat-quick-btns');
    if (existing) existing.remove();

    const row = document.createElement('div');
    row.className = 'chat-quick-btns';
    replies.forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'chat-quick-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        row.remove();
        handleUserInput(label);
      });
      row.appendChild(btn);
    });
    messagesEl.appendChild(row);
    scrollToBottom();
  };

  // ── Form submission ───────────────────────────────────────────────────────
  const submitLead = async () => {
    const formData = new FormData();
    formData.append('_subject', 'Prospect Nova Dev Chat (FR)');
    formData.append('_captcha', 'false');
    formData.append('_template', 'table');
    formData.append('prenom', lead.name);
    formData.append('entreprise', lead.company);
    formData.append('email', lead.email);
    formData.append('telephone', lead.phone || 'Non renseigné');
    formData.append('service', lead.service);
    formData.append('message', lead.message);
    formData.append('source', 'Widget Chat IA');

    try {
      await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData
      });
    } catch (_) { /* silent */ }

    if (typeof fbq === 'function') {
      try { fbq('track', 'Lead'); } catch (_) {}
    }
  };

  // ── Conversation engine ───────────────────────────────────────────────────
  const askStep = async (index) => {
    if (index >= STEPS.length) {
      await botSay("Parfait, merci ! 🎉 J'envoie vos informations à notre équipe…", 700);
      await submitLead();
      submitted = true;
      setInputEnabled(false);
      await botSay(`Nous avons bien reçu vos informations, ${lead.name}. 📬\n\nUn membre de l'équipe Nova Dev vous contactera très prochainement à l'adresse ${lead.email}.\n\nEn attendant, n'hésitez pas à parcourir notre site — il y a beaucoup à découvrir !`, 900);
      return;
    }

    const step = STEPS[index];
    const questionText = typeof step.question === 'function'
      ? step.question(lead.name || 'vous')
      : step.question;

    await botSay(questionText, index === 0 ? 400 : 700);

    if (step.quickReplies) {
      addQuickReplies(step.quickReplies);
    }

    waitingForInput = true;
    inputEl?.focus();
  };

  const handleUserInput = async (rawValue) => {
    if (!waitingForInput || submitted) return;
    const value = rawValue.trim();
    if (!value) return;

    const qr = messagesEl.querySelector('.chat-quick-btns');
    if (qr) qr.remove();

    await addMsg(value, 'user');
    inputEl.value = '';
    waitingForInput = false;

    const step = STEPS[stepIndex];
    const isSkip = ['passer', 'skip', 'non', 'no'].includes(value.toLowerCase());

    if (!isSkip && step.validate && !step.validate(value)) {
      const errMsg = step.errorMsg || "Ce n'est pas tout à fait correct. Pourriez-vous réessayer ?";
      await botSay(errMsg, 500);
      waitingForInput = true;
      if (step.quickReplies) addQuickReplies(step.quickReplies);
      return;
    }

    lead[step.key] = isSkip ? '' : value;
    stepIndex++;
    await askStep(stepIndex);
  };

  // ── UI controls ───────────────────────────────────────────────────────────
  const setInputEnabled = (enabled) => {
    if (inputEl) inputEl.disabled = !enabled;
    if (sendBtn) sendBtn.disabled = !enabled;
  };

  const openChat = async () => {
    if (isOpen) return;
    isOpen = true;
    chatWindow.removeAttribute('hidden');
    bubble.setAttribute('aria-expanded', 'true');
    if (badge) badge.style.display = 'none';

    if (!opened) {
      opened = true;
      await askStep(0);
    }
    inputEl?.focus();
  };

  const closeChat = () => {
    isOpen = false;
    chatWindow.setAttribute('hidden', '');
    bubble.setAttribute('aria-expanded', 'false');
  };

  // ── Event listeners ───────────────────────────────────────────────────────
  bubble.addEventListener('click', openChat);
  bubble.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openChat(); } });
  closeBtn?.addEventListener('click', closeChat);

  sendBtn?.addEventListener('click', () => {
    if (inputEl?.value.trim()) handleUserInput(inputEl.value);
  });

  inputEl?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputEl.value.trim()) handleUserInput(inputEl.value);
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen) closeChat();
  });

  // ── Auto-open après 8 secondes ────────────────────────────────────────────
  setTimeout(() => {
    if (!isOpen && !opened) openChat();
  }, 8000);

})();
