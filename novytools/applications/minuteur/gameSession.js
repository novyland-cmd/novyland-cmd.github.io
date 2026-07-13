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
      durationMilliseconds: 0,
      comment: ''
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
      this.startedAt = null;
   }

   isStarted() {
      return this.started;
   }

   getCurrentStep() {
      return this.steps[this.currentStepIndex] ?? null;
   }

   getSteps() {
      return this.steps.map((step) => ({ ...step }));
   }

   /**
    * Démarre une seule fois la session et sa première étape.
    * @param {Date} [startedAt]
    * @returns {object|null}
    */
   start(startedAt = new Date()) {
      if (this.started || this.isFinished()) {
         return null;
      }

      const validDate = startedAt instanceof Date && !Number.isNaN(startedAt.getTime())
         ? new Date(startedAt.getTime())
         : new Date();

      this.started = true;
      this.startedAt = validDate;

      const currentStep = this.getCurrentStep();
      currentStep.status = STEP_STATUS.CURRENT;
      currentStep.startedAt = validDate;

      return { ...currentStep };
   }

   /**
    * Prépare la future progression séquentielle. Cette méthode n'est pas
    * encore reliée à l'interface dans la présente version.
    */
   moveToNextStep() {
      if (!this.started || this.isFinished()) {
         return null;
      }

      const currentStep = this.getCurrentStep();
      if (currentStep) currentStep.status = STEP_STATUS.COMPLETED;

      this.currentStepIndex += 1;
      const nextStep = this.getCurrentStep();
      if (nextStep) nextStep.status = STEP_STATUS.CURRENT;

      return nextStep ? { ...nextStep } : null;
   }

   isFinished() {
      return this.currentStepIndex >= this.steps.length;
   }
}
