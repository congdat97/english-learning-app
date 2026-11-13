import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LearningService } from '../../services/learning.service';
import { SettingsService } from '../../services/settings.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  dailyMinutes = 15;
  audioSpeed = 1;
  showTranslation = true;
  fontSize = 16;
  voice = '';
  theme = 'mac-dinh';

  voices: SpeechSynthesisVoice[] = [];

  saving = false;
  saveMsg = '';

  readonly themeService = inject(ThemeService);

  constructor(private learning: LearningService, private settings: SettingsService) {}

  ngOnInit(): void {
    this.learning.getSettings().subscribe({
      next: (res) => {
        const data = res.data || {};
        this.dailyMinutes = data.daily_minutes ?? this.dailyMinutes;
        this.audioSpeed = data.audio_speed ?? this.audioSpeed;
        this.showTranslation = data.show_translation ?? this.showTranslation;
        this.fontSize = data.font_size ?? this.fontSize;
        this.voice = data.voice ?? this.voice;
        this.theme = data.theme ?? this.theme;
        this.apply();
      },
      error: () => {
        const saved = this.settings.load();
        this.dailyMinutes = saved.dailyMinutes;
        this.audioSpeed = saved.audioSpeed;
        this.showTranslation = saved.showTranslation;
        this.fontSize = saved.fontSize;
        this.voice = saved.voice;
        this.theme = saved.theme;
        this.apply();
      }
    });
    this.loadVoices();
  }

  private loadVoices(): void {
    if (typeof speechSynthesis === 'undefined') return;
    const refresh = () => {
      this.voices = speechSynthesis
        .getVoices()
        .filter(v => v.lang.toLowerCase().startsWith('en'))
        .sort((a, b) => a.name.localeCompare(b.name));
    };
    refresh();
    speechSynthesis.onvoiceschanged = refresh;
  }

  /** Áp dụng thử ngay khi kéo thanh cỡ chữ. */
  previewFontSize(): void {
    this.settings.applyFontSize(this.fontSize);
  }

  /** Đọc câu mẫu bằng giọng + tốc độ hiện tại để kiểm tra trước khi lưu. */
  testVoice(): void {
    if (typeof speechSynthesis === 'undefined') return;
    const utterance = new SpeechSynthesisUtterance("Hello! Let's learn English, step by step.");
    utterance.lang = 'en-US';
    utterance.rate = this.audioSpeed;
    if (this.voice) {
      const v = speechSynthesis.getVoices().find(x => x.name === this.voice);
      if (v) utterance.voice = v;
    }
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  save(): void {
    if (this.saving) return;
    this.saving = true;
    this.saveMsg = '';
    const payload = {
      daily_minutes: this.dailyMinutes,
      audio_speed: this.audioSpeed,
      show_translation: this.showTranslation,
      font_size: this.fontSize,
      voice: this.voice,
      theme: this.theme
    };
    this.learning.saveSettings(payload).subscribe({
      next: () => {
        this.persistLocal();
        this.saving = false;
        this.saveMsg = '✅ Đã lưu cài đặt.';
      },
      error: () => {
        this.persistLocal();
        this.saving = false;
        this.saveMsg = '⚠️ Lưu tạm trên máy này (API chưa phản hồi) — sẽ tự đồng bộ khi API hoạt động.';
      }
    });
  }

  selectTheme(theme: string): void {
    this.theme = theme;
    // Ủy quyền ThemeService (lưu localStorage elf-theme + data-mode)
    this.themeService.setTheme(theme);
  }

  private persistLocal(): void {
    this.settings.save({
      dailyMinutes: this.dailyMinutes,
      audioSpeed: this.audioSpeed,
      showTranslation: this.showTranslation,
      fontSize: this.fontSize,
      voice: this.voice,
      theme: this.theme
    });
  }

  private apply(): void {
    this.settings.applyFontSize(this.fontSize);
    // Theme do ThemeService quản lý (đã áp khi khởi động)
  }
}
