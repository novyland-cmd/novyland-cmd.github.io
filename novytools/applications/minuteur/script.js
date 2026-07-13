import { GameSession, STEP_STATUS } from './gameSession.js';
import { Timer, formatElapsedTime } from './timer.js';

function initializeApplication() {
   updateCurrentYear();

   const elements = getInterfaceElements();
   if (!elements) return;

   const session = new GameSession();
   const timer = new Timer({
      now: () => Date.now(),
      onTick(elapsedMilliseconds) {
         elements.timerDisplay.textContent = formatElapsedTime(elapsedMilliseconds);
      }
   });

   renderApplication(session, elements);

   elements.startButton.addEventListener('click', () => {
      startSession(session, timer, elements);
   }, { once: true });

   // Le comportement de progression sera branché ici à l'étape suivante.
   elements.nextStepButton.addEventListener('click', () => {
      // Intentionnellement sans transition dans cette version.
   });

   window.addEventListener('pagehide', () => timer.destroy(), { once: true });
}

function updateCurrentYear() {
   const currentYear = document.querySelector('#current-year');
   if (currentYear) currentYear.textContent = String(new Date().getFullYear());
}

function getInterfaceElements() {
   const elements = {
      stepsContainer: document.querySelector('#session-steps'),
      currentStepName: document.querySelector('#current-step-name'),
      currentStepCounter: document.querySelector('#current-step-counter'),
      startTime: document.querySelector('#step-start-time'),
      timerDisplay: document.querySelector('#timer-display'),
      startButton: document.querySelector('#session-start'),
      nextStepButton: document.querySelector('#session-next-step'),
      stateMessage: document.querySelector('#session-state-message')
   };

   if (Object.values(elements).some((element) => !element)) {
      console.warn("L'application ne peut pas être initialisée : un élément requis est introuvable.");
      return null;
   }

   return elements;
}

function startSession(session, timer, elements) {
   if (session.isStarted() || elements.startButton.disabled) return;

   // Le verrou visuel est posé immédiatement afin de neutraliser les doubles clics.
   elements.startButton.disabled = true;

   const startedStep = session.start(new Date());
   if (!startedStep || !(startedStep.startedAt instanceof Date)) {
      elements.startButton.disabled = false;
      elements.stateMessage.textContent = 'La partie n’a pas pu être démarrée. Veuillez réessayer.';
      return;
   }

   renderApplication(session, elements);

   // Le minuteur repart de l'heure réelle enregistrée pour l'étape.
   const elapsedSinceStepStart = Date.now() - startedStep.startedAt.getTime();
   timer.start(elapsedSinceStepStart);
}

function renderApplication(session, elements) {
   const steps = session.getSteps();
   const currentStep = session.getCurrentStep();

   elements.stepsContainer.replaceChildren(...steps.map((step) => createStepElement(step, session.isStarted())));

   if (!currentStep) return;

   elements.currentStepName.textContent = currentStep.name;
   elements.currentStepCounter.textContent = `Étape ${currentStep.number} sur ${steps.length}`;

   if (!session.isStarted()) {
      elements.startTime.textContent = 'Non démarrée';
      elements.timerDisplay.textContent = '00:00:00';
      elements.stateMessage.textContent = 'La session commencera lorsque vous appuierez sur le bouton.';
      elements.startButton.hidden = false;
      elements.startButton.disabled = false;
      elements.nextStepButton.hidden = true;
      return;
   }

   elements.startTime.textContent = formatLocalTime(currentStep.startedAt);
   elements.stateMessage.textContent = `${currentStep.name} est en cours.`;
   elements.startButton.hidden = true;
   elements.nextStepButton.hidden = false;
   elements.nextStepButton.disabled = true;
}

function createStepElement(step, isSessionStarted) {
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
   status.textContent = getStepStatusLabel(step, isSessionStarted);

   content.append(name, status);
   item.append(marker, content);
   return item;
}

function getStepStatusLabel(step, isSessionStarted) {
   if (!isSessionStarted && step.number === 1) return 'À démarrer';

   const labels = {
      [STEP_STATUS.CURRENT]: 'En cours',
      [STEP_STATUS.UPCOMING]: 'À venir',
      [STEP_STATUS.COMPLETED]: 'Terminée'
   };

   return labels[step.status] ?? '';
}

function formatLocalTime(date) {
   if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'Non disponible';

   return new Intl.DateTimeFormat('fr-CA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
   }).format(date);
}

initializeApplication();
