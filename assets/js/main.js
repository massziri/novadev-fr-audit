(() => {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('[data-menu-toggle]');
  const form = document.getElementById('auditForm');
  const success = document.getElementById('formSuccess');
  const error = document.getElementById('formError');
  const submit = form?.querySelector('button[type="submit"]');

  toggle?.addEventListener('click', () => {
    const isOpen = header.classList.toggle('menu-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      header?.classList.remove('menu-open');
      toggle?.setAttribute('aria-expanded', 'false');
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const showAlert = (element, message) => {
    if (!element) return;
    element.textContent = message;
    element.style.display = 'block';
  };

  const hideAlerts = () => {
    if (success) success.style.display = 'none';
    if (error) error.style.display = 'none';
  };

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    hideAlerts();

    const data = new FormData(form);
    const website = (data.get('website') || '').toString().trim();
    const email = (data.get('email') || '').toString().trim();

    if (!website || !email) {
      showAlert(error, 'Veuillez remplir les champs obligatoires avant d’envoyer votre demande.');
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.dataset.original = submit.textContent;
      submit.textContent = 'Envoi en cours…';
    }

    try {
      const response = await fetch('https://formsubmit.co/ajax/admin@novatvhub.com', {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        },
        body: data
      });

      const result = await response.json().catch(() => ({}));
      const successFlag = result.success === true || result.success === 'true';

      if (response.ok && successFlag) {
        window.location.href = 'thank-you.html';
        return;
      }

      const message = result.message || 'Le point de réception du formulaire n’accepte pas encore les envois. Activez FormSubmit depuis admin@novatvhub.com ou contactez-nous par email.';
      showAlert(error, message);
    } catch (err) {
      showAlert(error, 'Erreur réseau. Réessayez ou contactez admin@novatvhub.com directement.');
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = submit.dataset.original || 'Demander mon audit gratuit';
      }
    }
  });
})();
