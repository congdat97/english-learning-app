import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  theme = 'blue';

  voices: SpeechSynthesisVoice[] = [];

  constructor(private settings: SettingsService) {}

  ngOnInit(): void {
    const saved = this.settings.load();
    this.dailyMinutes = saved.dailyMinutes;
    this.audioSpeed = saved.audioSpeed;
    this.showTranslation = saved.showTranslation;
    this.fontSize = saved.fontSize;
    this.voice = saved.voice;
    this.theme = saved.theme;
    this.settings.applyFontSize(this.fontSize);
    this.settings.applyTheme(this.theme);
    if (typeof speechSynthesis !== 'undefined') {
      this.voices = speechSynthesis.getVoices();
      speechSynthesis.onvoiceschanged = () => {
        this.voices = speechSynthesis.getVoices();
      };
    }
  }

  save(): void {
    this.settings.save({
      dailyMinutes: this.dailyMinutes,
      audioSpeed: this.audioSpeed,
      showTranslation: this.showTranslation,
      fontSize: this.fontSize,
      voice: this.voice,
      theme: this.theme
    });
  }
}
