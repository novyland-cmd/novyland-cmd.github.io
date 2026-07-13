/**
 * États possibles d'une étape de partie.
 * Cette liste centralisée prépare les futures évolutions de l'application.
 */
export const STEP_STATUS = Object.freeze({
   UPCOMING: 'upcoming',
   CURRENT: 'current',
   COMPLETED: 'completed'
});

/**
 * Parcours de base d'une partie.
 * Les noms et l'ordre des étapes ne doivent être définis qu'ici.
 */
export const DEFAULT_GAME_STEPS = Object.freeze([
   Object.freeze({ id: 'setup', name: 'Placement du jeu' }),
   Object.freeze({ id: 'rules', name: 'Explication des règles' }),
   Object.freeze({ id: 'gameplay', name: 'Partie' }),
   Object.freeze({ id: 'scoring', name: 'Calcul des points' })
]);

/**
 * Crée les données internes d'une étape pour une nouvelle session.
 *
 * @param {{ id: string, name: string }} step
 * @param {number} index
 * @returns {object}
 */
function createSessionStep(step, index) {
   return {
      id: step.id,
      number: index + 1,
      name: step.name,
      status: index === 0 ? STEP_STATUS.CURRENT : STEP_STATUS.UPCOMING,
      startedAt: null,
      endedAt: null,
      durationMilliseconds: 0,
      comment: ''
   };
}

/**
 * Représente le parcours logique d'une partie.
 * La classe ne dépend volontairement pas du minuteur ni de l'interface.
 */
export class GameSession {
   /**
    * @param {Array<{ id: string, name: string }>} [steps]
    */
   constructor(steps = DEFAULT_GAME_STEPS) {
      if (!Array.isArray(steps) || steps.length === 0) {
         throw new TypeError('Une session doit contenir au moins une étape.');
      }

      this.steps = steps.map(createSessionStep);
      this.currentStepIndex = 0;
   }

   /** @returns {object|null} */
   getCurrentStep() {
      return this.steps[this.currentStepIndex] ?? null;
   }

   /** @returns {Array<object>} */
   getSteps() {
      return this.steps.map((step) => ({ ...step }));
   }

   /**
    * Passe uniquement à l'étape suivante du parcours.
    * Aucun index cible n'est accepté afin d'empêcher les sauts directs.
    *
    * @returns {object|null} La nouvelle étape active, ou null si la session est terminée.
    */
   moveToNextStep() {
      if (this.isFinished()) {
         return null;
      }

      const currentStep = this.getCurrentStep();
      if (currentStep) {
         currentStep.status = STEP_STATUS.COMPLETED;
      }

      this.currentStepIndex += 1;
      const nextStep = this.getCurrentStep();

      if (nextStep) {
         nextStep.status = STEP_STATUS.CURRENT;
      }

      return nextStep;
   }

   /** @returns {boolean} */
   isFinished() {
      return this.currentStepIndex >= this.steps.length;
   }
}
