/**
 * États possibles d'une étape de partie.
 */
export const STEP_STATUS = Object.freeze({
   UPCOMING: 'upcoming',
   CURRENT: 'current',
   COMPLETED: 'completed'
});

/**
 * Parcours de base d'une partie. Les noms et l'ordre ne sont définis qu'ici.
 */
export const DEFAULT_GAME_STEPS = Object.freeze([
   Object.freeze({ id: 'setup', name: 'Placement du jeu' }),
   Object.freeze({ id: 'rules', name: 'Explication des règles' }),
   Object.freeze({ id: 'gameplay', name: 'Partie' }),
   Object.freeze({ id: 'scoring', name: 'Calcul des points' })
]);

function createSessionStep(step, index) {
   return {
      id: step.id,
      number: index + 1,
      name: step.name,
      status: STEP_STATUS.UPCOMING,
      startedAt: null,
      endedAt: null,
      durationMilliseconds: null,
      comment: ''
   };
}

function isValidDate(value) {
   return value instanceof Date && !Number.isNaN(value.getTime());
}

function cloneDate(value) {
   return isValidDate(value) ? new Date(value.getTime()) : null;
}

function cloneStep(step) {
   return {
      ...step,
      startedAt: cloneDate(step.startedAt),
      endedAt: cloneDate(step.endedAt)
   };
}

/**
 * Source de vérité unique pour l'état d'une session.
 * Cette classe ne dépend ni du DOM ni du minuteur visuel.
 */
export class GameSession {
   constructor(steps = DEFAULT_GAME_STEPS) {
      if (!Array.isArray(steps) || steps.length === 0) {
         throw new TypeError('Une session doit contenir au moins une étape.');
      }

      this.steps = steps.map(createSessionStep);
      this.currentStepIndex = 0;
      this.started = false;
      this.finished = false;
      this.startedAt = null;
      this.endedAt = null;
      this.durationMilliseconds = null;
   }

   isStarted() {
      return this.started;
   }

   isFinished() {
      return this.finished;
   }

   getCurrentStep() {
      if (this.finished) return null;
      return this.steps[this.currentStepIndex] ?? null;
   }

   getSteps() {
      return this.steps.map(cloneStep);
   }

   getSummary() {
      return {
         started: this.started,
         finished: this.finished,
         startedAt: cloneDate(this.startedAt),
         endedAt: cloneDate(this.endedAt),
         durationMilliseconds: this.durationMilliseconds,
         steps: this.getSteps()
      };
   }

   hasNextStep() {
      return this.started && !this.finished && this.currentStepIndex < this.steps.length - 1;
   }

   /**
    * Démarre une seule fois la session et sa première étape.
    * @param {Date} [startedAt]
    * @returns {object|null}
    */
   start(startedAt = new Date()) {
      if (this.started || this.finished) return null;

      const validDate = isValidDate(startedAt)
         ? new Date(startedAt.getTime())
         : new Date();

      this.started = true;
      this.startedAt = validDate;

      const currentStep = this.getCurrentStep();
      currentStep.status = STEP_STATUS.CURRENT;
      currentStep.startedAt = validDate;

      return cloneStep(currentStep);
   }

   /**
    * Termine l'étape actuelle et démarre la suivante au même instant.
    * @param {Date} transitionAt Heure unique de la transition.
    * @returns {{completedStep: object, currentStep: object}|null}
    */
   completeCurrentStepAndStartNext(transitionAt = new Date()) {
      const currentStep = this.getCurrentStep();
      const nextStep = this.steps[this.currentStepIndex + 1] ?? null;

      if (
         !this.started
         || this.finished
         || !currentStep
         || !nextStep
         || currentStep.status !== STEP_STATUS.CURRENT
         || !isValidDate(currentStep.startedAt)
         || isValidDate(currentStep.endedAt)
         || currentStep.durationMilliseconds !== null
         || nextStep.status !== STEP_STATUS.UPCOMING
      ) {
         return null;
      }

      const validTransition = isValidDate(transitionAt)
         ? new Date(transitionAt.getTime())
         : null;

      if (!validTransition || validTransition.getTime() < currentStep.startedAt.getTime()) {
         return null;
      }

      const transitionTimestamp = validTransition.getTime();
      currentStep.endedAt = new Date(transitionTimestamp);
      currentStep.durationMilliseconds = transitionTimestamp - currentStep.startedAt.getTime();
      currentStep.status = STEP_STATUS.COMPLETED;

      this.currentStepIndex += 1;
      nextStep.startedAt = new Date(transitionTimestamp);
      nextStep.endedAt = null;
      nextStep.durationMilliseconds = null;
      nextStep.status = STEP_STATUS.CURRENT;

      return {
         completedStep: cloneStep(currentStep),
         currentStep: cloneStep(nextStep)
      };
   }

   /**
    * Termine la dernière étape et la session avec un horodatage unique.
    * L'opération est idempotente.
    * @param {Date} endedAt
    * @returns {object|null}
    */
   finish(endedAt = new Date()) {
      const currentStep = this.getCurrentStep();
      const isLastStep = this.currentStepIndex === this.steps.length - 1;

      if (
         !this.started
         || this.finished
         || !isLastStep
         || !currentStep
         || currentStep.status !== STEP_STATUS.CURRENT
         || !isValidDate(this.startedAt)
         || !isValidDate(currentStep.startedAt)
         || isValidDate(currentStep.endedAt)
         || currentStep.durationMilliseconds !== null
      ) {
         return null;
      }

      const validEnd = isValidDate(endedAt) ? new Date(endedAt.getTime()) : null;
      if (!validEnd || validEnd.getTime() < currentStep.startedAt.getTime()) return null;

      const endTimestamp = validEnd.getTime();
      currentStep.endedAt = new Date(endTimestamp);
      currentStep.durationMilliseconds = endTimestamp - currentStep.startedAt.getTime();
      currentStep.status = STEP_STATUS.COMPLETED;

      this.endedAt = new Date(endTimestamp);
      this.durationMilliseconds = Math.max(0, endTimestamp - this.startedAt.getTime());
      this.finished = true;

      return this.getSummary();
   }
}
