(function () {
  class GameAudio {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.master = null;
      this.ready = false;
    }

    unlock() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.28;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.ready = true;
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.28;
      return this.muted;
    }

    play(name) {
      if (!this.ctx || !this.ready || this.muted) return;
      const map = {
        shoot: [540, 0.045, "square", 0.07],
        hit: [130, 0.06, "sawtooth", 0.08],
        jump: [320, 0.09, "triangle", 0.08],
        pickup: [720, 0.13, "sine", 0.1],
        hurt: [95, 0.16, "sawtooth", 0.12],
        explosion: [70, 0.28, "sawtooth", 0.16],
        boss: [46, 0.42, "square", 0.14],
        victory: [660, 0.28, "triangle", 0.12],
        defeat: [82, 0.35, "sine", 0.12],
      };
      const cfg = map[name] || map.hit;
      this.tone(...cfg);
      if (name === "explosion") this.noise(0.18, 0.08);
      if (name === "pickup") setTimeout(() => this.tone(920, 0.08, "sine", 0.08), 55);
      if (name === "victory") {
        setTimeout(() => this.tone(880, 0.22, "triangle", 0.1), 120);
        setTimeout(() => this.tone(1040, 0.22, "triangle", 0.1), 240);
      }
    }

    tone(freq, duration, type, volume) {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, freq * 0.52), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain).connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    }

    noise(duration, volume) {
      const now = this.ctx.currentTime;
      const size = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < size; i += 1) data[i] = Math.random() * 2 - 1;
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 820;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      source.buffer = buffer;
      source.connect(filter).connect(gain).connect(this.master);
      source.start(now);
    }
  }

  window.HDLAudio = { GameAudio };
})();
