(() => {
   const toggle = document.querySelector('#menu-toggle');
   const close = document.querySelector('#menu-close');
   const menu = document.querySelector('#applications-menu');
   const overlay = document.querySelector('#menu-overlay');
   if (!toggle || !menu || !overlay) return;
   const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
   let lastFocused = null;

   function openMenu() {
      lastFocused = document.activeElement;
      menu.hidden = false;
      overlay.hidden = false;
      requestAnimationFrame(() => {
         menu.classList.add('is-open');
         overlay.classList.add('is-open')
      });
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
      (menu.querySelector(focusableSelector) || menu).focus();
   }

   function closeMenu() {
      menu.classList.remove('is-open');
      overlay.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
      setTimeout(() => {
         menu.hidden = true;
         overlay.hidden = true
      }, 260);
      (lastFocused || toggle).focus();
   }

   function handleKeydown(event) {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') closeMenu();
      if (event.key === 'Tab' && toggle.getAttribute('aria-expanded') === 'true') {
         const items = [...menu.querySelectorAll(focusableSelector)];
         if (!items.length) return;
         const first = items[0],
            last = items[items.length - 1];
         if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus()
         } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus()
         }
      }
   }
   toggle.addEventListener('click', () => toggle.getAttribute('aria-expanded') === 'true' ? closeMenu() : openMenu());
   close?.addEventListener('click', closeMenu);
   overlay.addEventListener('click', closeMenu);
   document.addEventListener('keydown', handleKeydown);
})();