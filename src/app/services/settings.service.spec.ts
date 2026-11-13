import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SettingsService);
  });

  it('loads defaults', () => {
    const settings = service.load();
    expect(settings.theme).toBe('mac-dinh');
    expect(settings.fontSize).toBe(16);
  });

  it('saves and loads settings', () => {
    service.save({ dailyMinutes: 30, audioSpeed: 1.25, showTranslation: false, fontSize: 20, voice: '', theme: 'tim-mong' });
    const settings = service.load();
    expect(settings.dailyMinutes).toBe(30);
    expect(settings.theme).toBe('tim-mong');
  });
});
