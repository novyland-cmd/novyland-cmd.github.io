// Lecture par petites unités pour éviter les limites des moteurs sur les longs récits.
export function speechChunks(text, limit = 220) {
  const chunks = [];
  let chunk = "";
  for (const word of text.trim().match(/\S+\s*/gu) ?? []) {
    if (chunk && chunk.length + word.length > limit) {
      chunks.push(chunk.trim());
      chunk = "";
    }
    chunk += word;
  }
  if (chunk.trim()) chunks.push(chunk.trim());
  return chunks;
}

export class SpeechReader {
  constructor(synthesis, Utterance, onState = () => {}) {
    this.synth = synthesis;
    this.Utterance = Utterance;
    this.onState = onState;
    this.state = "idle";
    this.generation = 0;
    this.current = null;
  }

  get supported() { return Boolean(this.synth && this.Utterance); }

  update(state) {
    this.state = state;
    this.onState(state);
  }

  stop() {
    this.generation++;
    this.current = null;
    this.chunks = [];
    this.synth?.cancel();
    this.update("idle");
  }

  start(text, { voice, lang, rate = 1 } = {}) {
    this.stop();
    if (!this.supported) return;
    this.chunks = speechChunks(text);
    if (!this.chunks.length) return;
    this.options = { voice, lang, rate: Math.min(1.5, Math.max(.5, Number(rate) || 1)) };
    this.index = 0;
    this.update("playing");
    // Certains moteurs conservent l'état pause après cancel().
    this.synth.resume();
    this.next();
  }

  next() {
    if (this.state !== "playing") return;
    if (this.index >= this.chunks.length) {
      this.current = null;
      this.update("finished");
      return;
    }
    const generation = this.generation;
    const utterance = new this.Utterance(this.chunks[this.index]);
    const { voice, lang, rate } = this.options;
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || lang || "fr";
    utterance.rate = rate;
    this.current = utterance;
    utterance.onend = () => {
      if (generation !== this.generation || this.current !== utterance) return;
      this.current = null;
      this.index++;
      this.next();
    };
    utterance.onerror = () => {
      if (generation !== this.generation) return;
      this.generation++;
      this.current = null;
      this.synth.cancel();
      this.update("error");
    };
    try { this.synth.speak(utterance); } catch { utterance.onerror(); }
  }

  pause() {
    if (this.state !== "playing") return;
    this.update("paused");
    this.synth.pause();
  }

  resume() {
    if (this.state !== "paused") return;
    this.update("playing");
    this.synth.resume();
    if (!this.current) this.next();
  }
}
