export const ELEVENLABS_VOICES = [
  { name: "Patrick · ElevenLabs v4", alias: "patrick", voiceURI: "elevenlabs-patrick", provider: "elevenlabs" },
  { name: "Anna · ElevenLabs v4", alias: "anna", voiceURI: "elevenlabs-anna", provider: "elevenlabs" },
];

export function audioEndpoint(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.search || url.hash) return "";
    return url.href.replace(/\/$/, "");
  } catch { return ""; }
}

export class RemoteAudioReader {
  constructor({ endpoint = "", getToken, onState = () => {}, Audio = globalThis.Audio,
    fetch = globalThis.fetch?.bind(globalThis), urls = globalThis.URL } = {}) {
    Object.assign(this, { endpoint, getToken, onState, Audio, fetch, urls });
    this.state = "idle";
    this.generation = 0;
    this.message = "";
    this.audio = null;
  }
  get supported() { return Boolean(audioEndpoint(this.endpoint) && this.Audio); }
  update(state) { this.state = state; this.onState(state); }

  stop() {
    this.generation++;
    this.controller?.abort();
    this.controller = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.audio = null;
    }
    if (this.objectUrl) this.urls.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.message = "";
    this.accessDenied = false;
    this.update("idle");
  }

  async start(request, rate = 1, expectedText) {
    this.stop();
    if (!this.supported) return;
    const generation = this.generation;
    const controller = this.controller = new AbortController();
    this.update("loading");
    try {
      const url = new URL(`${audioEndpoint(this.endpoint)}/audio`);
      for (const [key, value] of Object.entries(request)) url.searchParams.set(key, value);
      if (typeof expectedText === "string") {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(expectedText));
        url.searchParams.set("text_hash", [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join(""));
        if (generation !== this.generation) return;
      }
      let response = await this.fetch(url, { signal: controller.signal, credentials: "omit", cache: "no-store" });
      if (generation !== this.generation) return;
      if (!response.ok) {
        const problem = await response.json().catch(() => ({}));
        if (response.status !== 404 || problem.code !== "not_generated") throw new Error(problem.message || "Le service audio est indisponible.");
        const token = await this.getToken(controller.signal);
        if (generation !== this.generation) return;
        if (!token) { this.update("idle"); return; }
        response = await this.fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal, credentials: "omit", cache: "no-store" });
        if (generation !== this.generation) return;
        if (!response.ok) {
          const problem = await response.json().catch(() => ({}));
          const error = new Error(problem.message || "La génération audio a échoué.");
          error.accessDenied = response.status === 401;
          throw error;
        }
      }
      if (!response.headers.get("Content-Type")?.startsWith("audio/")) throw new Error("L’enregistrement reçu n’est pas lisible.");
      const blob = await response.blob();
      if (generation !== this.generation) return;
      const audio = this.audio = new this.Audio();
      this.objectUrl = this.urls.createObjectURL(blob);
      audio.src = this.objectUrl;
      audio.playbackRate = Math.min(1.5, Math.max(.5, Number(rate) || 1));
      audio.onended = () => { if (generation === this.generation) this.update("finished"); };
      audio.onerror = () => {
        if (generation !== this.generation) return;
        this.message = "L’appareil ne parvient pas à lire cet enregistrement.";
        this.update("error");
      };
      await this.playReady();
    } catch (error) {
      if (generation !== this.generation || controller.signal.aborted) return;
      this.accessDenied = Boolean(error.accessDenied);
      this.message = error.message || "Le service audio est indisponible.";
      this.update("error");
    }
  }

  async playReady() {
    if (!this.audio) return;
    const generation = this.generation;
    try {
      await this.audio.play();
      if (generation === this.generation) this.update("playing");
    } catch (error) {
      if (generation !== this.generation) return;
      if (error.name === "NotAllowedError") this.update("ready");
      else { this.message = "La lecture de cet audio a échoué."; this.update("error"); }
    }
  }
  pause() { if (this.state === "playing") { this.audio.pause(); this.update("paused"); } }
  resume() { if (this.state === "paused" || this.state === "ready") return this.playReady(); }
}
