import { Injectable, inject } from '@angular/core';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class SpeechService {
  private settings = inject(SettingsService);

  supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  speak(text: string): void {
    if (!text || !this.supported()) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = this.settings.audioSpeed || 1;
    const voices = window.speechSynthesis.getVoices().filter(voice => voice.lang.toLowerCase().startsWith('en'));
    if (voices.length) utterance.voice = voices[0];
    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (this.supported()) window.speechSynthesis.cancel();
  }
}
