import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

const savedSettings = localStorage.getItem('learning-settings');
if (savedSettings) {
  try {
    const parsed = JSON.parse(savedSettings);
    document.documentElement.setAttribute('data-theme', parsed.theme || 'mac-dinh');
    if (parsed.fontSize) document.documentElement.style.fontSize = `${parsed.fontSize}px`;
  } catch {
    // ignore invalid settings
  }
} else {
  document.documentElement.setAttribute('data-theme', 'mac-dinh');
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
