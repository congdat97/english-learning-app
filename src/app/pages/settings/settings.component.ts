import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LearningService } from '../../services/learning.service';
import { SettingsService } from '../../services/settings.service';

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
  themePickerOpen = false;

  voices: SpeechSynthesisVoice[] = [];

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
    if (typeof speechSynthesis !== 'undefined') {
      this.voices = speechSynthesis.getVoices();
      speechSynthesis.onvoiceschanged = () => {
        this.voices = speechSynthesis.getVoices();
      };
    }
  }

  save(): void {
    const payload = {
      daily_minutes: this.dailyMinutes,
      audio_speed: this.audioSpeed,
      show_translation: this.showTranslation,
      font_size: this.fontSize,
      voice: this.voice,
      theme: this.theme
    };
    this.learning.saveSettings(payload).subscribe({
      next: () => this.persistLocal(),
      error: () => this.persistLocal()
    });
  }

  openThemePicker(): void {
    this.themePickerOpen = true;
  }

  closeThemePicker(): void {
    this.themePickerOpen = false;
  }

  selectTheme(theme: string): void {
    this.theme = theme;
    this.settings.applyTheme(theme);
    this.themePickerOpen = false;
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
    this.settings.applyTheme(this.theme);
  }
}
