import { GameSession, STEP_STATUS } from './gameSession.js';
import { Timer, formatElapsedTime } from './timer.js';

function initializeApplication() {
   updateCurrentYear();
   initializeGameSession();
   initializeTimerInterface();
}

function updateCurrentYear() {
   const currentYear = document.querySelector('#current-year');
   if (currentYear) currentYear.textContent = String(new Date().getFullYear());
}

function initializeGameSession() {
   const stepsContainer = document.querySelector('#session-steps');
   const currentStepName = document.querySelector('#current-step-name');
   const currentStepCounter = document.querySelector('#current-step-counter');

   if (!stepsContainer || !currentStepName || !currentStepCounter) {
      console.warn("La session ne peut pas être affichée : un élément requis est introuvable.");
      return;
   }

   const session = new GameSession();
   renderSession(session, { stepsContainer, currentStepName, currentStepCounter });
}

function renderSession(session, elements) {
   const steps = session.getSteps();
   const currentStep = session.getCurrentStep();

   elements.stepsContainer.replaceChildren(...steps.map(createStepElement));

   if (currentStep) {
      elements.currentStepName.textContent = currentStep.name;
      elements.currentStepCounter.textContent = `Étape ${currentStep.number} sur ${steps.length}`;
   }
}

function createStepElement(step) {
   const item = document.createElement('li');
   item.className = `session-step session-step--${step.status}`;
   item.dataset.stepId = step.id;

   if (step.status === STEP_STATUS.CURRENT) {
      item.setAttribute('aria-current', 'step');
   }

   const marker = document.createElement('span');
   marker.className = 'session-step-marker';
   marker.setAttribute('aria-hidden', 'true');
   marker.textContent = String(step.number);

   const content = document.createElement('div');
   content.className = 'session-step-content';

   const name = document.createElement('span');
   name.className = 'session-step-name';
   name.textContent = step.name;

   const status = document.createElement('span');
   status.className = 'session-step-status';
   status.textContent = getStepStatusLabel(step.status);

   content.append(name, status);
   item.append(marker, content);
   return item;
}

function getStepStatusLabel(status) {
   const labels = {
      [STEP_STATUS.CURRENT]: 'En cours',
      [STEP_STATUS.UPCOMING]: 'À venir',
      [STEP_STATUS.COMPLETED]: 'Terminée'
   };

   return labels[status] ?? '';
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
