class VoiceGuidanceService {
  private isMuted: boolean = false;
  private lastSpokenText: string = '';
  private lastSpokenTime: number = 0;

  constructor() {
    try {
      const savedMute = localStorage.getItem('carnav_muted');
      if (savedMute !== null) {
        this.isMuted = savedMute === 'true';
      }
    } catch {
      // LocalStorage not available or restricted
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    try {
      localStorage.setItem('carnav_muted', muted ? 'true' : 'false');
    } catch {
      // ignore
    }
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public speak(text: string, force: boolean = false): void {
    if (this.isMuted && !force) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    // Throttle identical announcements within 4 seconds
    const now = Date.now();
    if (text === this.lastSpokenText && now - this.lastSpokenTime < 4000 && !force) {
      return;
    }

    try {
      // Chrome bug workaround: speechSynthesis may get paused
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      // Cancel any ongoing speech to avoid lag
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05; // Slightly brisk for car prompt
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Select an English voice if available
      const voices = window.speechSynthesis.getVoices();
      const engVoice = voices.find(
        (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.localService)
      ) || voices.find((v) => v.lang.startsWith('en'));

      if (engVoice) {
        utterance.voice = engVoice;
      }

      utterance.onend = () => {
        this.lastSpokenText = text;
        this.lastSpokenTime = Date.now();
      };

      utterance.onerror = (e) => {
        console.warn('Speech synthesis event error:', e);
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  public testVoice(): void {
    this.speak('Voice guidance active. In 200 meters, continue straight.', true);
  }
}

export const voiceGuidance = new VoiceGuidanceService();
