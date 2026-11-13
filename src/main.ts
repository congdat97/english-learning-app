import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

const savedSettings = localStorage.getItem('learning-settings');
if (savedSettings) {
  try {
    const parsed = JSON.parse(savedSettings);
    const themes: Record<string, Record<string, string>> = {
      blue: { '--blue': '#5267e8', '--blue2': '#7485ff', '--pale': '#eef1ff' },
      green: { '--blue': '#10b981', '--blue2': '#34d399', '--pale': '#e7f8f0' },
      purple: { '--blue': '#7c3aed', '--blue2': '#a78bfa', '--pale': '#f2eaff' },
      orange: { '--blue': '#f97316', '--blue2': '#fb923c', '--pale': '#fff0e6' }
    };
    const selected = themes[parsed.theme || 'blue'] || themes['blue'];
    Object.keys(selected).forEach((key) => document.documentElement.style.setProperty(key, selected[key]));
    if (parsed.fontSize) document.documentElement.style.fontSize = `${parsed.fontSize}px`;
  } catch {
    // ignore invalid settings
  }
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
