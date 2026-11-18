import { Injectable } from '@angular/core';
import { ThemeService } from './theme.service';
import { LearningService } from './learning.service';
import { AuthService } from './auth.service';

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
  constructor(private themeService: ThemeService, private learning: LearningService, private auth: AuthService) {}

  /** Mỗi user một bản cài đặt riêng trong localStorage. */
  private keyFor(): string {
    const uid = this.auth.currentUser()?.id;
    return uid ? `learning-settings-${uid}` : 'learning-settings-guest';
  }

  load(): LearningSettings {
    try {
      const saved = localStorage.getItem(this.keyFor());
      if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
    } catch {}
    return { ...DEFAULTS };
  }

  save(settings: LearningSettings): void {
    localStorage.setItem(this.keyFor(), JSON.stringify(settings));
    this.applyFontSize(settings.fontSize);
    // CHỈ áp theme khi khác theme đang dùng — tránh đổi tốc độ/font reset mất theme hiện tại
    if (settings.theme && this.themeService.currentTheme?.id !== settings.theme) {
      this.applyTheme(settings.theme);
    }
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
    this.savePartial({ audioSpeed: rate });
  }

  /**
   * Lưu một phần cài đặt ngay lập tức:
   * ghi localStorage + đẩy toàn bộ payload lên DB (lỗi API thì im lặng, local vẫn giữ)
   * + cập nhật cache GET /settings cho khớp.
   */
  savePartial(partial: Partial<LearningSettings>): void {
    const merged = { ...this.load(), ...partial };
    this.save(merged);
    this.learning.syncSettingsCache({
      daily_minutes: merged.dailyMinutes,
      audio_speed: merged.audioSpeed,
      show_translation: merged.showTranslation,
      font_size: merged.fontSize,
      voice: merged.voice,
      theme: merged.theme
    });
    this.learning.saveSettings({
      daily_minutes: merged.dailyMinutes,
      audio_speed: merged.audioSpeed,
      show_translation: merged.showTranslation,
      font_size: merged.fontSize,
      voice: merged.voice,
      theme: merged.theme
    }).subscribe({ error: () => {} });
  }
}
