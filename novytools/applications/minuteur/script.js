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

   let isProcessingAction = false;

   renderApplication(session, elements);

   elements.startButton.addEventListener('click', () => {
      startSession(session, timer, elements);
   }, { once: true });

   elements.nextStepButton.addEventListener('click', () => {
      if (isProcessingAction || session.isFinished()) return;

      isProcessingAction = true;
      elements.nextStepButton.disabled = true;

      try {
         if (session.hasNextStep()) {
            moveToNextStep(session, timer, elements);
         } else {
            finishSession(session, timer, elements);
         }
      } finally {
         isProcessingAction = session.isFinished();
      }
   });

   window.addEventListener('pagehide', () => timer.destroy(), { once: true });
}

function updateCurrentYear() {
   const currentYear = document.querySelector('#current-year');
   if (currentYear) currentYear.textContent = String(new Date().getFullYear());
}

function getInterfaceElements() {
   const elements = {
      appIntro: document.querySelector('#app-intro'),
      sessionView: document.querySelector('#session-view'),
      reportView: document.querySelector('#report-view'),
      reportTitle: document.querySelector('#report-title'),
      stepsContainer: document.querySelector('#session-steps'),
      currentStepName: document.querySelector('#current-step-name'),
      currentStepCounter: document.querySelector('#current-step-counter'),
      startTime: document.querySelector('#step-start-time'),
      timerDisplay: document.querySelector('#timer-display'),
      startButton: document.querySelector('#session-start'),
      nextStepButton: document.querySelector('#session-next-step'),
      stateMessage: document.querySelector('#session-state-message'),
      reportSessionStart: document.querySelector('#report-session-start'),
      reportSessionEnd: document.querySelector('#report-session-end'),
      reportTotalDuration: document.querySelector('#report-total-duration'),
      reportSteps: document.querySelector('#report-steps'),
      reportTotalStart: document.querySelector('#report-total-start'),
      reportTotalEnd: document.querySelector('#report-total-end'),
      reportTableTotalDuration: document.querySelector('#report-table-total-duration')
   };

   if (Object.values(elements).some((element) => !element)) {
      console.warn("L'application ne peut pas être initialisée : un élément requis est introuvable.");
      return null;
   }

   return elements;
}

function startSession(session, timer, elements) {
   if (session.isStarted() || elements.startButton.disabled) return;

   elements.startButton.disabled = true;

   const startedStep = session.start(new Date());
   if (!startedStep || !(startedStep.startedAt instanceof Date)) {
      elements.startButton.disabled = false;
      elements.stateMessage.textContent = 'La partie n’a pas pu être démarrée. Veuillez réessayer.';
      return;
   }

   renderApplication(session, elements);
   timer.start(Math.max(0, Date.now() - startedStep.startedAt.getTime()));
}

/** Termine l'étape active et démarre la suivante avec un horodatage unique. */
function moveToNextStep(session, timer, elements) {
   if (!session.isStarted() || session.isFinished() || !session.hasNextStep()) {
      renderApplication(session, elements);
      return;
   }

   const transitionAt = new Date();
   const transition = session.completeCurrentStepAndStartNext(transitionAt);

   if (!transition) {
      elements.stateMessage.textContent = 'Le passage à l’étape suivante est momentanément impossible.';
      renderApplication(session, elements);
      return;
   }

   timer.reset();
   renderApplication(session, elements);
   timer.start(Math.max(0, Date.now() - transition.currentStep.startedAt.getTime()));
}

/** Finalise la dernière étape, arrête le minuteur et affiche le rapport. */
function finishSession(session, timer, elements) {
   if (!session.isStarted() || session.isFinished() || session.hasNextStep()) {
      renderApplication(session, elements);
      return;
   }

   elements.nextStepButton.disabled = true;

   // Cette valeur unique ferme simultanément la dernière étape et la session.
   const finishedAt = new Date();
   const summary = session.finish(finishedAt);

   if (!summary) {
      elements.stateMessage.textContent = 'La partie n’a pas pu être terminée. Veuillez réessayer.';
      elements.nextStepButton.disabled = false;
      return;
   }

   timer.pause();
   timer.destroy();
   populateReport(summary, elements);
   showReport(elements);
}

function populateReport(summary, elements) {
   const startText = formatLocalTime(summary.startedAt);
   const endText = formatLocalTime(summary.endedAt);
   const totalDurationText = formatDuration(summary.durationMilliseconds);

   elements.reportSessionStart.textContent = startText;
   elements.reportSessionEnd.textContent = endText;
   elements.reportTotalDuration.textContent = totalDurationText;
   elements.reportTotalStart.textContent = startText;
   elements.reportTotalEnd.textContent = endText;
   elements.reportTableTotalDuration.textContent = totalDurationText;

   const rows = Array.isArray(summary.steps)
      ? summary.steps.map(createReportRow)
      : [];

   elements.reportSteps.replaceChildren(...rows);
}

function createReportRow(step) {
   const row = document.createElement('tr');

   const nameCell = document.createElement('th');
   nameCell.scope = 'row';

   const marker = document.createElement('span');
   marker.className = 'report-step-marker';
   marker.textContent = Number.isFinite(step?.number) ? String(step.number) : '–';
   marker.setAttribute('aria-hidden', 'true');

   const name = document.createElement('span');
   name.textContent = typeof step?.name === 'string' && step.name.trim()
      ? step.name
      : 'Étape non disponible';

   nameCell.append(marker, name);

   const startCell = document.createElement('td');
   startCell.dataset.label = 'Début';
   startCell.textContent = formatLocalTime(step?.startedAt);

   const endCell = document.createElement('td');
   endCell.dataset.label = 'Fin';
   endCell.textContent = formatLocalTime(step?.endedAt);

   const durationCell = document.createElement('td');
   durationCell.dataset.label = 'Durée';
   durationCell.className = 'report-duration-cell';
   durationCell.textContent = formatDuration(step?.durationMilliseconds);

   row.append(nameCell, startCell, endCell, durationCell);
   return row;
}

function showReport(elements) {
   elements.sessionView.classList.add('view-is-leaving');
   elements.appIntro.classList.add('view-is-leaving');

   window.setTimeout(() => {
      elements.sessionView.hidden = true;
      elements.appIntro.hidden = true;
      elements.reportView.hidden = false;
      elements.reportView.classList.add('view-is-entering');

      requestAnimationFrame(() => {
         elements.reportView.classList.remove('view-is-entering');
         elements.reportTitle.focus({ preventScroll: false });
      });
   }, getTransitionDuration());
}

function getTransitionDuration() {
   return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
}

function renderApplication(session, elements) {
   if (session.isFinished()) return;

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

   const hasNextStep = session.hasNextStep();
   elements.nextStepButton.textContent = hasNextStep ? 'Étape suivante' : 'Terminer la partie';
   elements.nextStepButton.disabled = false;
   elements.nextStepButton.setAttribute(
      'aria-label',
      hasNextStep
         ? `Terminer ${currentStep.name} et démarrer l’étape suivante`
         : 'Terminer la partie et afficher le rapport de session'
   );
}

function createStepElement(step, isSessionStarted) {
   const item = document.createElement('li');
   item.className = `session-step session-step--${step.status}`;
   item.dataset.stepId = step.id;

   if (step.status === STEP_STATUS.CURRENT) item.setAttribute('aria-current', 'step');

   const marker = document.createElement('span');
   marker.className = 'session-step-marker';
   marker.setAttribute('aria-hidden', 'true');
   marker.textContent = step.status === STEP_STATUS.COMPLETED ? '✓' : String(step.number);

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

function formatDuration(milliseconds) {
   return Number.isFinite(milliseconds) && milliseconds >= 0
      ? formatElapsedTime(milliseconds)
      : 'Non disponible';
}

initializeApplication();
