import { Injectable } from '@angular/core';
import { ThemeService } from './theme.service';

export interface LearningSettings {
  dailyMinutes: number;
  audioSpeed: number;
  showTranslation: boolean;
  fontSize: number;
  voice: string;
  theme: string;
}

const DEFAULTS: LearningSettings = {
  dailyMinutes: 15,
  audioSpeed: 1,
  showTranslation: true,
  fontSize: 16,
  voice: '',
  theme: 'mac-dinh'
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private key = 'learning-settings';

  constructor(private themeService: ThemeService) {}

  load(): LearningSettings {
    try {
      const saved = localStorage.getItem(this.key);
      if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
    } catch {}
    return { ...DEFAULTS };
  }

  save(settings: LearningSettings): void {
    localStorage.setItem(this.key, JSON.stringify(settings));
    this.applyFontSize(settings.fontSize);
    this.applyTheme(settings.theme);
  }

  applyTheme(theme: string): void {
    // Ủy quyền cho ThemeService (quản lý data-theme + data-mode)
    this.themeService.setTheme(theme);
  }

  applyFontSize(size: number): void {
    document.documentElement.style.fontSize = `${size}px`;
  }

  get audioSpeed(): number {
    return this.load().audioSpeed;
  }

  get showTranslation(): boolean {
    return this.load().showTranslation;
  }
}
