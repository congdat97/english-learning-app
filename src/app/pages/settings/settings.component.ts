import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

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
  theme = 'blue';
  voice = '';

  voices: SpeechSynthesisVoice[] = [];

  ngOnInit(): void {
    const saved = localStorage.getItem('learning-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      this.dailyMinutes = parsed.dailyMinutes ?? this.dailyMinutes;
      this.audioSpeed = parsed.audioSpeed ?? this.audioSpeed;
      this.showTranslation = parsed.showTranslation ?? this.showTranslation;
      this.fontSize = parsed.fontSize ?? this.fontSize;
      this.theme = parsed.theme ?? this.theme;
    }
    this.applyFontSize();
    this.applyTheme();
    if (typeof speechSynthesis !== 'undefined') {
      this.voices = speechSynthesis.getVoices();
      speechSynthesis.onvoiceschanged = () => {
        this.voices = speechSynthesis.getVoices();
      };
    }
  }

  save(): void {
    localStorage.setItem('learning-settings', JSON.stringify({
      dailyMinutes: this.dailyMinutes,
      audioSpeed: this.audioSpeed,
      showTranslation: this.showTranslation,
      fontSize: this.fontSize,
      theme: this.theme
    }));
    this.applyFontSize();
    this.applyTheme();
  }

  private applyFontSize(): void {
    document.documentElement.style.fontSize = `${this.fontSize}px`;
  }

  private applyTheme(): void {
    const themes: Record<string, Record<string, string>> = {
      blue: { '--blue': '#5267e8', '--blue2': '#7485ff', '--pale': '#eef1ff' },
      green: { '--blue': '#10b981', '--blue2': '#34d399', '--pale': '#e7f8f0' },
      purple: { '--blue': '#7c3aed', '--blue2': '#a78bfa', '--pale': '#f2eaff' },
      orange: { '--blue': '#f97316', '--blue2': '#fb923c', '--pale': '#fff0e6' }
    };
    const selected = themes[this.theme] || themes['blue'];
    Object.keys(selected).forEach((key) => {
      document.documentElement.style.setProperty(key, selected[key]);
    });
  }
}
