import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('font-size');
    TestBed.configureTestingModule({});
    service = TestBed.inject(SettingsService);
  });

  it('loads defaults when nothing is saved', () => {
    const settings = service.load();
    expect(settings.theme).toBe('mac-dinh');
    expect(settings.fontSize).toBe(16);
    expect(settings.dailyMinutes).toBe(15);
    expect(settings.audioSpeed).toBe(1);
    expect(settings.showTranslation).toBe(true);
    expect(settings.voice).toBe('');
  });

  it('falls back to defaults when saved data is corrupted', () => {
    localStorage.setItem('learning-settings', '{not-json');
    const settings = service.load();
    expect(settings.fontSize).toBe(16);
  });

  it('merges partial saved data with defaults', () => {
    localStorage.setItem('learning-settings', JSON.stringify({ fontSize: 20 }));
    const settings = service.load();
    expect(settings.fontSize).toBe(20);
    expect(settings.theme).toBe('mac-dinh');
  });

  it('saves and loads settings', () => {
    service.save({ dailyMinutes: 30, audioSpeed: 1.25, showTranslation: false, fontSize: 20, voice: 'Alex', theme: 'tim-mong' });
    const settings = service.load();
    expect(settings.dailyMinutes).toBe(30);
    expect(settings.theme).toBe('tim-mong');
    expect(settings.voice).toBe('Alex');
  });

  it('applies theme to documentElement', () => {
    service.applyTheme('dem-than');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dem-than');
  });

  it('applies font size to documentElement', () => {
    service.applyFontSize(18);
    expect(document.documentElement.style.fontSize).toBe('18px');
  });

  it('save() also applies theme and font size', () => {
    service.save({ dailyMinutes: 15, audioSpeed: 1, showTranslation: true, fontSize: 22, voice: '', theme: 'sakura' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('sakura');
    expect(document.documentElement.style.fontSize).toBe('22px');
  });

  it('exposes audioSpeed and showTranslation getters', () => {
    service.save({ dailyMinutes: 15, audioSpeed: 1.5, showTranslation: false, fontSize: 16, voice: '', theme: 'mac-dinh' });
    expect(service.audioSpeed).toBe(1.5);
    expect(service.showTranslation).toBe(false);
  });
});
