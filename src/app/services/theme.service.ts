import { Injectable } from '@angular/core';

export interface ThemeOption {
  id: string;
  name: string;
  collection: string;
  primary: string;
  secondary: string;
}

export type ThemeMode = 'light' | 'dark';

// =====================================================
// DANH SÁCH 12 THEME (port từ Chinese Flow)
// =====================================================

export const APP_THEMES: ThemeOption[] = [
  { id: 'mac-dinh',   name: 'Mặc định',   collection: 'Miễn phí', primary: '#c66b2c', secondary: '#e8a34e' },
  { id: 'tim-mong',   name: 'Tím Mộng',   collection: 'Miễn phí', primary: '#6c5ce7', secondary: '#00b894' },
  { id: 'may-sang',   name: 'Mây Sáng',   collection: 'Miễn phí', primary: '#2f80ed', secondary: '#22b8cf' },
  { id: 'dem-than',   name: 'Đêm Than',   collection: 'Miễn phí', primary: '#8b5cf6', secondary: '#2dd4bf' },
  { id: 'hong-dao',   name: 'Hồng Đào',   collection: 'Màu sắc',  primary: '#ec4899', secondary: '#fb923c' },
  { id: 'dai-duong',  name: 'Đại Dương',  collection: 'Màu sắc',  primary: '#0369a1', secondary: '#06b6d4' },
  { id: 'hoang-hon',  name: 'Hoàng Hôn',  collection: 'Màu sắc',  primary: '#f97316', secondary: '#f43f5e' },
  { id: 'rung-thong', name: 'Rừng Thông', collection: 'Màu sắc',  primary: '#047857', secondary: '#84cc16' },
  { id: 'sakura',     name: 'Sakura',     collection: 'Màu sắc',  primary: '#d878ac', secondary: '#c084fc' },
  { id: 'neon-dem',   name: 'Neon Đêm',   collection: 'Màu sắc',  primary: '#22d3ee', secondary: '#a855f7' },
  { id: 'ca-phe',     name: 'Cà Phê',     collection: 'Màu sắc',  primary: '#92400e', secondary: '#d97706' },
  { id: 'mat-ong',    name: 'Mật Ong',    collection: 'Màu sắc',  primary: '#ea580c', secondary: '#f59e0b' }
];

const THEME_STORAGE_KEY = 'elf-theme';
const MODE_STORAGE_KEY = 'elf-mode';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  themes = APP_THEMES;

  currentTheme: ThemeOption;

  currentMode: ThemeMode;

  constructor() {

    // Theme đã lưu (mặc định = mac-dinh)
    const savedThemeId =
      localStorage.getItem(THEME_STORAGE_KEY) ?? '';

    this.currentTheme =
      this.themes.find(t => t.id === savedThemeId)
      ?? APP_THEMES[0];

    // Chế độ sáng/tối (mặc định = sáng)
    const savedMode =
      localStorage.getItem(MODE_STORAGE_KEY);

    this.currentMode =
      savedMode === 'dark' ? 'dark' : 'light';

    this.apply();

  }

  // ==================================================
  // ĐỔI THEME / CHẾ ĐỘ
  // ==================================================

  setTheme(id: string): void {

    const theme =
      this.themes.find(t => t.id === id);

    if (!theme) {
      return;
    }

    this.currentTheme = theme;

    localStorage.setItem(THEME_STORAGE_KEY, id);

    this.apply();

  }

  setMode(mode: ThemeMode): void {

    this.currentMode = mode;

    localStorage.setItem(MODE_STORAGE_KEY, mode);

    this.apply();

  }

  toggleMode(): void {
    this.setMode(
      this.currentMode === 'light' ? 'dark' : 'light'
    );
  }

  // ==================================================
  // ÁP DỤNG LÊN <html data-theme="" data-mode="">
  // CSS variables nằm trong styles.css
  // ==================================================

  private apply(): void {

    document.documentElement
      .setAttribute('data-theme', this.currentTheme.id);

    document.documentElement
      .setAttribute('data-mode', this.currentMode);

  }

}
