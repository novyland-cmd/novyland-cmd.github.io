import { GameSession, STEP_STATUS } from './gameSession.js';
import { Timer, formatElapsedTime, formatReadableDuration } from './timer.js';

const NEUTRAL_TIME_TEXT = 'Non disponible';
const COPY_BUTTON_DEFAULT_TEXT = 'Copier le rapport';
const COPY_FEEDBACK_DURATION = 2000;

function initializeApplication() {
   updateCurrentYear();

   const elements = getInterfaceElements();
   if (!elements) return;

   // L'état mutable de l'application vit ici afin qu'une nouvelle partie
   // puisse remplacer la session et le minuteur sans recréer les écouteurs.
   const state = {
      session: new GameSession(),
      timer: createTimer(elements),
      isProcessingAction: false,
      isResetting: false,
      isCopying: false,
      copyFeedbackTimeoutId: null
   };

   renderApplication(state.session, elements);

   elements.startButton.addEventListener('click', () => {
      startSession(state, elements);
   });

   elements.nextStepButton.addEventListener('click', () => {
      if (state.isProcessingAction || state.session.isFinished()) return;

      state.isProcessingAction = true;
      elements.nextStepButton.disabled = true;

      try {
         if (state.session.hasNextStep()) {
            moveToNextStep(state, elements);
         } else {
            finishSession(state, elements);
         }
      } finally {
         state.isProcessingAction = state.session.isFinished();
      }
   });

   elements.copyReportButton.addEventListener('click', async () => {
      await copySessionReport(state, elements);
   });

   elements.newGameButton.addEventListener('click', () => {
      resetApplication(state, elements);
   });

   window.addEventListener('pagehide', () => state.timer.destroy(), { once: true });
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
      copyReportButton: document.querySelector('#report-copy'),
      copyReportStatus: document.querySelector('#copy-report-status'),
      newGameButton: document.querySelector('#report-new-game'),
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

/** Crée un minuteur générique relié à l'affichage courant. */
function createTimer(elements) {
   return new Timer({
      now: () => Date.now(),
      onTick(elapsedMilliseconds) {
         elements.timerDisplay.textContent = formatElapsedTime(elapsedMilliseconds);
      }
   });
}

function startSession(state, elements) {
   if (state.session.isStarted() || elements.startButton.disabled) return;

   elements.startButton.disabled = true;

   const startedStep = state.session.start(new Date());
   if (!startedStep || !(startedStep.startedAt instanceof Date)) {
      elements.startButton.disabled = false;
      elements.stateMessage.textContent = 'La partie n’a pas pu être démarrée. Veuillez réessayer.';
      return;
   }

   renderApplication(state.session, elements);
   state.timer.start(Math.max(0, Date.now() - startedStep.startedAt.getTime()));
}

/** Termine l'étape active et démarre la suivante avec un horodatage unique. */
function moveToNextStep(state, elements) {
   const { session, timer } = state;

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
function finishSession(state, elements) {
   const { session, timer } = state;

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

/** Génère une version texte autonome du rapport à partir des données brutes. */
function generateSessionReportText(summary) {
   const steps = Array.isArray(summary?.steps) ? summary.steps : [];
   const lines = [
      'RAPPORT DE SESSION',
      'Partie terminée',
      `Début de la session : ${formatLocalTime(summary?.startedAt)}`,
      `Fin de la session : ${formatLocalTime(summary?.endedAt)}`,
      `Durée totale : ${formatReadableDurationBetween(summary?.startedAt, summary?.endedAt)}`,
      '',
      'DÉTAIL DES ÉTAPES'
   ];

   const fixedStepCount = 4;
   for (let index = 0; index < fixedStepCount; index += 1) {
      const step = steps[index] ?? {};
      const number = Number.isFinite(step.number) ? step.number : index + 1;
      const name = typeof step.name === 'string' && step.name.trim()
         ? step.name.trim()
         : 'Étape non disponible';

      lines.push(
         `${number}. ${name}`,
         `Début : ${formatLocalTime(step.startedAt)}`,
         `Fin : ${formatLocalTime(step.endedAt)}`,
         `Durée : ${formatReadableDurationBetween(step.startedAt, step.endedAt)}`
      );

      if (index < fixedStepCount - 1) lines.push('');
   }

   return lines.join('\n');
}

/** Copie le rapport avec l'API moderne, puis avec une méthode de secours. */
async function copySessionReport(state, elements) {
   if (!state.session.isFinished() || state.isCopying) return;

   state.isCopying = true;
   const reportText = generateSessionReportText(state.session.getSummary());
   elements.copyReportButton.disabled = true;

   let copied = false;
   let modernClipboardError = null;

   if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
         await navigator.clipboard.writeText(reportText);
         copied = true;
      } catch (error) {
         modernClipboardError = error;
      }
   }

   if (!copied) {
      copied = copyTextWithFallback(reportText);
   }

   if (!copied) {
      console.error('Impossible de copier le rapport avec les méthodes disponibles.', modernClipboardError);
   }

   state.isCopying = false;
   showCopyFeedback(state, elements, copied);
}

/** Copie de secours au moyen d'un textarea temporaire immédiatement nettoyé. */
function copyTextWithFallback(text) {
   const temporaryTextArea = document.createElement('textarea');
   temporaryTextArea.value = text;
   temporaryTextArea.setAttribute('readonly', '');
   temporaryTextArea.setAttribute('aria-hidden', 'true');
   temporaryTextArea.style.position = 'fixed';
   temporaryTextArea.style.inset = '0 auto auto -9999px';
   temporaryTextArea.style.width = '1px';
   temporaryTextArea.style.height = '1px';
   temporaryTextArea.style.opacity = '0';

   document.body.appendChild(temporaryTextArea);

   try {
      temporaryTextArea.focus({ preventScroll: true });
      temporaryTextArea.select();
      temporaryTextArea.setSelectionRange(0, temporaryTextArea.value.length);
      return document.execCommand('copy');
   } catch (error) {
      console.error('La méthode de copie de secours a échoué.', error);
      return false;
   } finally {
      temporaryTextArea.remove();
      elementsSafeFocus(document.querySelector('#report-copy'));
   }
}

function elementsSafeFocus(element) {
   if (element instanceof HTMLElement) element.focus({ preventScroll: true });
}

/** Centralise le retour visuel et empêche les délais concurrents. */
function showCopyFeedback(state, elements, copied) {
   if (state.copyFeedbackTimeoutId !== null) {
      window.clearTimeout(state.copyFeedbackTimeoutId);
   }

   elements.copyReportButton.disabled = false;
   elements.copyReportButton.textContent = copied ? 'Rapport copié ✓' : 'Copie impossible';
   elements.copyReportButton.classList.toggle('report-copy-button--success', copied);
   elements.copyReportButton.classList.toggle('report-copy-button--error', !copied);
   elements.copyReportStatus.textContent = copied
      ? 'Le rapport a été copié dans le presse-papiers.'
      : 'La copie du rapport est impossible.';

   state.copyFeedbackTimeoutId = window.setTimeout(() => {
      resetCopyButtonState(state, elements);
   }, COPY_FEEDBACK_DURATION);
}

function resetCopyButtonState(state, elements) {
   if (state.copyFeedbackTimeoutId !== null) {
      window.clearTimeout(state.copyFeedbackTimeoutId);
      state.copyFeedbackTimeoutId = null;
   }

   state.isCopying = false;
   elements.copyReportButton.textContent = COPY_BUTTON_DEFAULT_TEXT;
   elements.copyReportButton.disabled = false;
   elements.copyReportButton.classList.remove('report-copy-button--success', 'report-copy-button--error');
   elements.copyReportStatus.textContent = '';
}

/**
 * Réinitialise complètement l'application afin de permettre le démarrage
 * d'une nouvelle partie sans recharger la page. Idempotente : un appel alors
 * que l'application est déjà à l'état initial ne produit aucune erreur.
 */
function resetApplication(state, elements) {
   if (state.isResetting) return;

   // Rien à faire si aucune session n'a jamais démarré et que le rapport
   // n'est pas affiché : l'application est déjà à son état initial.
   if (!state.session.isStarted() && elements.reportView.hidden) return;

   state.isResetting = true;
   elements.newGameButton.disabled = true;
   resetCopyButtonState(state, elements);

   // Arrête définitivement l'ancien minuteur avant toute autre opération,
   // pour empêcher qu'il ne mette encore à jour l'interface.
   state.timer.pause();
   state.timer.destroy();

   // Nouvelle structure de session indépendante : aucune référence à
   // l'ancienne session n'est conservée.
   state.session = new GameSession();
   state.timer = createTimer(elements);
   state.isProcessingAction = false;

   clearReport(elements);
   showSessionView(elements, () => {
      elements.startButton.disabled = false;
      elements.newGameButton.disabled = false;
      state.isResetting = false;
      renderApplication(state.session, elements);
      elements.startButton.focus({ preventScroll: false });
   });
}

/** Vide les champs dynamiques du rapport afin de ne rien laisser dans le DOM. */
function clearReport(elements) {
   elements.reportSessionStart.textContent = NEUTRAL_TIME_TEXT;
   elements.reportSessionEnd.textContent = NEUTRAL_TIME_TEXT;
   elements.reportTotalDuration.textContent = NEUTRAL_TIME_TEXT;
   elements.reportTotalStart.textContent = NEUTRAL_TIME_TEXT;
   elements.reportTotalEnd.textContent = NEUTRAL_TIME_TEXT;
   elements.reportTableTotalDuration.textContent = NEUTRAL_TIME_TEXT;
   elements.reportSteps.replaceChildren();
}

function populateReport(summary, elements) {
   const startText = formatLocalTime(summary.startedAt);
   const endText = formatLocalTime(summary.endedAt);
   const totalDurationText = formatDurationBetween(summary.startedAt, summary.endedAt);

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
   durationCell.textContent = formatDurationBetween(step?.startedAt, step?.endedAt);

   row.append(nameCell, startCell, endCell, durationCell);
   return row;
}

function showReport(elements) {
   elements.copyReportButton.hidden = false;
   elements.sessionView.classList.add('view-is-leaving');
   elements.appIntro.classList.add('view-is-leaving');

   window.setTimeout(() => {
      elements.sessionView.hidden = true;
      elements.appIntro.hidden = true;
      elements.sessionView.classList.remove('view-is-leaving');
      elements.appIntro.classList.remove('view-is-leaving');
      elements.reportView.hidden = false;
      elements.reportView.classList.add('view-is-entering');

      requestAnimationFrame(() => {
         elements.reportView.classList.remove('view-is-entering');
         elements.reportTitle.focus({ preventScroll: false });
      });
   }, getTransitionDuration());
}

/** Masque le rapport et réaffiche l'écran initial, puis exécute onShown. */
function showSessionView(elements, onShown) {
   elements.reportView.classList.add('view-is-leaving');

   window.setTimeout(() => {
      elements.reportView.hidden = true;
      elements.reportView.classList.remove('view-is-leaving');
      elements.appIntro.hidden = false;
      elements.sessionView.hidden = false;
      elements.appIntro.classList.add('view-is-entering');
      elements.sessionView.classList.add('view-is-entering');

      requestAnimationFrame(() => {
         elements.appIntro.classList.remove('view-is-entering');
         elements.sessionView.classList.remove('view-is-entering');
         if (typeof onShown === 'function') onShown();
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
      elements.startButton.textContent = 'Démarrer la partie';
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

function isValidDate(date) {
   return date instanceof Date && !Number.isNaN(date.getTime());
}

/**
 * Seconde entière depuis l'epoch, tronquée comme le fait l'affichage de
 * l'heure (les millisecondes ne sont jamais montrées). Utiliser cette même
 * valeur pour l'heure ET pour la durée garantit que les durées des étapes
 * s'additionnent toujours exactement à la durée totale affichée : comme
 * la fin d'une étape et le début de la suivante partagent le même instant,
 * la somme des différences se télescope vers (fin de session − début de
 * session), sans perte d'arrondi cumulée.
 */
function toEpochSeconds(date) {
   return Math.floor(date.getTime() / 1000);
}

function formatLocalTime(date) {
   if (!isValidDate(date)) return NEUTRAL_TIME_TEXT;

   return new Intl.DateTimeFormat('fr-CA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
   }).format(date);
}

/** Formate la durée entre deux horodatages à partir des mêmes secondes entières que celles affichées pour le début et la fin. */
function formatDurationBetween(startDate, endDate) {
   if (!isValidDate(startDate) || !isValidDate(endDate)) return NEUTRAL_TIME_TEXT;

   const durationSeconds = toEpochSeconds(endDate) - toEpochSeconds(startDate);
   if (durationSeconds < 0) return NEUTRAL_TIME_TEXT;

   return formatElapsedTime(durationSeconds * 1000);
}

function formatReadableDurationBetween(startDate, endDate) {
   if (!isValidDate(startDate) || !isValidDate(endDate)) return NEUTRAL_TIME_TEXT;

   const durationSeconds = toEpochSeconds(endDate) - toEpochSeconds(startDate);
   if (durationSeconds < 0) return NEUTRAL_TIME_TEXT;

   return formatReadableDuration(durationSeconds * 1000);
}

initializeApplication();
