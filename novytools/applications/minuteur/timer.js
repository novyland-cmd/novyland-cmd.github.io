/**
 * Formate une durée en millisecondes au format HH:MM:SS.
 * Les heures peuvent dépasser 99 sans être tronquées.
 *
 * @param {number} elapsedMilliseconds
 * @returns {string}
 */
export function formatElapsedTime(elapsedMilliseconds) {
   const safeMilliseconds = Math.max(0, Number(elapsedMilliseconds) || 0);
   const totalSeconds = Math.floor(safeMilliseconds / 1000);
   const hours = Math.floor(totalSeconds / 3600);
   const minutes = Math.floor((totalSeconds % 3600) / 60);
   const seconds = totalSeconds % 60;

   return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, '0'))
      .join(':');
}

/**
 * Minuteur générique basé sur des horodatages haute précision.
 * La boucle d'affichage ne sert qu'à notifier le consommateur.
 */
export class Timer {
   /**
    * @param {object} options
    * @param {(elapsedMilliseconds: number) => void} options.onTick
    * @param {() => number} [options.now]
    */
   constructor({ onTick, now = () => performance.now() } = {}) {
      if (typeof onTick !== 'function') {
         throw new TypeError('Timer nécessite une fonction onTick.');
      }

      this.onTick = onTick;
      this.now = now;
      this.isRunning = false;
      this.startedAt = 0;
      this.elapsedBeforeStart = 0;
      this.animationFrameId = null;

      this.runLoop = this.runLoop.bind(this);
      this.notify();
   }

   /**
    * Retourne la durée réellement écoulée en millisecondes.
    *
    * @returns {number}
    */
   getElapsedMilliseconds() {
      if (!this.isRunning) {
         return this.elapsedBeforeStart;
      }

      return this.elapsedBeforeStart + (this.now() - this.startedAt);
   }

   /** Démarre le minuteur ou reprend après une pause. */
   start() {
      if (this.isRunning) {
         return;
      }

      this.isRunning = true;
      this.startedAt = this.now();
      this.animationFrameId = requestAnimationFrame(this.runLoop);
   }

   /** Met le minuteur en pause en conservant la durée écoulée. */
   pause() {
      if (!this.isRunning) {
         return;
      }

      this.elapsedBeforeStart = this.getElapsedMilliseconds();
      this.isRunning = false;
      this.startedAt = 0;
      this.stopLoop();
      this.notify();
   }

   /** Arrête le minuteur et remet sa durée à zéro. */
   reset() {
      this.isRunning = false;
      this.startedAt = 0;
      this.elapsedBeforeStart = 0;
      this.stopLoop();
      this.notify();
   }

   /** Libère la boucle active lorsque le minuteur n'est plus utilisé. */
   destroy() {
      this.isRunning = false;
      this.stopLoop();
   }

   /** @private */
   runLoop() {
      this.notify();

      if (this.isRunning) {
         this.animationFrameId = requestAnimationFrame(this.runLoop);
      }
   }

   /** @private */
   notify() {
      this.onTick(this.getElapsedMilliseconds());
   }

   /** @private */
   stopLoop() {
      if (this.animationFrameId === null) {
         return;
      }

      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
   }
}
