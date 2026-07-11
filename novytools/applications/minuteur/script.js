import { Timer, formatElapsedTime } from './timer.js';

function initializeApplication() {
   updateCurrentYear();
   initializeTimerInterface();
}

function updateCurrentYear() {
   const currentYear = document.querySelector('#current-year');
   if (currentYear) currentYear.textContent = String(new Date().getFullYear());
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

initializeApplication();
