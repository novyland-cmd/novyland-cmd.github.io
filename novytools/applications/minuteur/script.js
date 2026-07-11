import { Timer, formatElapsedTime } from './timer.js';

const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function initializeApplication() {
   updateCurrentYear();
   initializeMenu();
   initializeTimerInterface();
}

function updateCurrentYear() {
   const currentYear = document.querySelector('#current-year');

   if (currentYear) {
      currentYear.textContent = String(new Date().getFullYear());
   }
}

function initializeTimerInterface() {
   const display = document.querySelector('#timer-display');
   const startButton = document.querySelector('#timer-start');
   const pauseButton = document.querySelector('#timer-pause');
   const resetButton = document.querySelector('#timer-reset');

   if (!display || !startButton || !pauseButton || !resetButton) {
      console.warn('Le minuteur ne peut pas être initialisé : un élément requis est introuvable.');
      return;
   }

   const timer = new Timer({
      onTick(elapsedMilliseconds) {
         display.textContent = formatElapsedTime(elapsedMilliseconds);
      }
   });

   startButton.addEventListener('click', () => timer.start());
   pauseButton.addEventListener('click', () => timer.pause());
   resetButton.addEventListener('click', () => timer.reset());

   window.addEventListener('pagehide', () => timer.destroy(), { once: true });
}

function initializeMenu() {
   const toggle = document.querySelector('#menu-toggle');
   const close = document.querySelector('#menu-close');
   const menu = document.querySelector('#applications-menu');
   const overlay = document.querySelector('#menu-overlay');

   if (!toggle || !menu || !overlay) {
      return;
   }

   let lastFocused = null;

   function openMenu() {
      lastFocused = document.activeElement;
      menu.hidden = false;
      overlay.hidden = false;

      requestAnimationFrame(() => {
         menu.classList.add('is-open');
         overlay.classList.add('is-open');
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

      window.setTimeout(() => {
         menu.hidden = true;
         overlay.hidden = true;
      }, 260);

      (lastFocused || toggle).focus();
   }

   function handleKeydown(event) {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
         closeMenu();
      }

      if (event.key !== 'Tab' || toggle.getAttribute('aria-expanded') !== 'true') {
         return;
      }

      const items = [...menu.querySelectorAll(focusableSelector)];
      if (!items.length) {
         return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
         event.preventDefault();
         last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
         event.preventDefault();
         first.focus();
      }
   }

   toggle.addEventListener('click', () => {
      if (toggle.getAttribute('aria-expanded') === 'true') {
         closeMenu();
      } else {
         openMenu();
      }
   });

   close?.addEventListener('click', closeMenu);
   overlay.addEventListener('click', closeMenu);
   document.addEventListener('keydown', handleKeydown);
}

initializeApplication();
