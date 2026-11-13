import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { SettingsService } from './services/settings.service';

interface ThemeOption {
  id: string;
  name: string;
  collection: string;
  primary: string;
  secondary: string;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  settingsOpen = false;
  currentTheme = 'mac-dinh';

  themes: ThemeOption[] = [
    { id: 'mac-dinh', name: 'Mặc định', collection: 'Classic', primary: '#c66b2c', secondary: '#e8a34e' },
    { id: 'tim-mong', name: 'Tím mộng', collection: 'Pastel', primary: '#6c5ce7', secondary: '#00b894' },
    { id: 'may-sang', name: 'Mây sáng', collection: 'Sky', primary: '#2f80ed', secondary: '#22b8cf' },
    { id: 'dem-than', name: 'Đêm thẳm', collection: 'Dark', primary: '#8b5cf6', secondary: '#2dd4bf' },
    { id: 'hong-dao', name: 'Hồng đào', collection: 'Warm', primary: '#ec4899', secondary: '#fb923c' },
    { id: 'dai-duong', name: 'Đại dương', collection: 'Ocean', primary: '#0369a1', secondary: '#06b6d4' },
    { id: 'hoang-hon', name: 'Hoàng hôn', collection: 'Sunset', primary: '#f97316', secondary: '#f43f5e' },
    { id: 'rung-thong', name: 'Rừng thông', collection: 'Nature', primary: '#059669', secondary: '#10b981' },
    { id: 'sakura', name: 'Sakura', collection: 'Blossom', primary: '#ec4899', secondary: '#f9a8d4' },
    { id: 'neon-dem', name: 'Neon đêm', collection: 'Neon', primary: '#22d3ee', secondary: '#a78bfa' },
    { id: 'ca-phe', name: 'Cà phê', collection: 'Cozy', primary: '#92400e', secondary: '#d97706' },
    { id: 'mat-ong', name: 'Mật ong', collection: 'Honey', primary: '#ca8a04', secondary: '#facc15' }
  ];

  constructor(private router: Router, private settings: SettingsService) {}

  ngOnInit(): void {
    const saved = this.settings.load();
    this.currentTheme = saved.theme || 'mac-dinh';
    this.settings.applyTheme(this.currentTheme);
    this.settings.applyFontSize(saved.fontSize);
  }

  openSettings(): void {
    this.settingsOpen = true;
  }

  closeSettings(): void {
    this.settingsOpen = false;
  }

  closeSettingsOnBackdrop(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('settings-overlay')) {
      this.closeSettings();
    }
  }

  setTheme(id: string): void {
    this.currentTheme = id;
    this.settings.applyTheme(id);
    const saved = this.settings.load();
    saved.theme = id;
    this.settings.save(saved);
  }
}
