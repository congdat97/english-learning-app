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

  ngOnInit(): void {
    const saved = localStorage.getItem('learning-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      this.dailyMinutes = parsed.dailyMinutes ?? this.dailyMinutes;
      this.audioSpeed = parsed.audioSpeed ?? this.audioSpeed;
      this.showTranslation = parsed.showTranslation ?? this.showTranslation;
      this.fontSize = parsed.fontSize ?? this.fontSize;
    }
    this.applyFontSize();
  }

  save(): void {
    localStorage.setItem('learning-settings', JSON.stringify({
      dailyMinutes: this.dailyMinutes,
      audioSpeed: this.audioSpeed,
      showTranslation: this.showTranslation,
      fontSize: this.fontSize
    }));
    this.applyFontSize();
  }

  private applyFontSize(): void {
    document.documentElement.style.fontSize = `${this.fontSize}px`;
  }
}
