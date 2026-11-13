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
    // Styles dùng px nên đổi font-size gốc là vô hiệu —
    // zoom toàn trang theo tỷ lệ size/16 để cỡ chữ nhìn thấy được.
    const scale = size / 16;
    document.documentElement.style.fontSize = `${size}px`;
    (document.body.style as CSSStyleDeclaration & { zoom: string }).zoom = String(scale);
  }

  get audioSpeed(): number {
    return this.load().audioSpeed;
  }

  get showTranslation(): boolean {
    return this.load().showTranslation;
  }

  /** Đổi tốc độ đọc ngay trong bài học và lưu lại localStorage. */
  setAudioSpeed(rate: number): void {
    this.save({ ...this.load(), audioSpeed: rate });
  }
}
