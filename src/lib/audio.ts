export class AudioManager {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.1) {
    if (this.isMuted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio play failed");
    }
  }

  public playCardPlay() {
    this.playTone(400, 'sine', 0.1, 0.2);
    setTimeout(() => this.playTone(600, 'sine', 0.2, 0.2), 50);
  }

  public playCardSelect() {
    this.playTone(300, 'triangle', 0.1, 0.1);
  }

  public playImpact() {
    this.playTone(100, 'square', 0.3, 0.3);
  }

  public playMagic() {
    this.playTone(800, 'sine', 0.1, 0.1);
    setTimeout(() => this.playTone(1200, 'sine', 0.1, 0.1), 100);
    setTimeout(() => this.playTone(1600, 'sine', 0.3, 0.1), 200);
  }

  public playDebuff() {
    this.playTone(300, 'sawtooth', 0.2, 0.2);
    setTimeout(() => this.playTone(200, 'sawtooth', 0.4, 0.2), 150);
  }

  public playPullRope() {
    this.playTone(150, 'triangle', 0.2, 0.4);
  }

  public playVictory() {
    this.playTone(440, 'sine', 0.2, 0.2);
    setTimeout(() => this.playTone(554, 'sine', 0.2, 0.2), 200);
    setTimeout(() => this.playTone(659, 'sine', 0.4, 0.2), 400);
    setTimeout(() => this.playTone(880, 'sine', 0.6, 0.2), 600);
  }

  public playDefeat() {
    this.playTone(300, 'sawtooth', 0.4, 0.2);
    setTimeout(() => this.playTone(250, 'sawtooth', 0.4, 0.2), 300);
    setTimeout(() => this.playTone(200, 'sawtooth', 0.6, 0.2), 600);
  }

  public playReady() {
    this.playTone(500, 'sine', 0.1);
    setTimeout(() => this.playTone(500, 'sine', 0.1), 500);
    setTimeout(() => this.playTone(1000, 'sine', 0.3), 1000);
  }
}

export const audioManager = new AudioManager();
