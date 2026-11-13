import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { SettingsService } from './services/settings.service';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('nav')).toBeTruthy();
  });

  it('renders exactly one bottom-nav', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.bottom-nav').length).toBe(1);
  });

  it('applies saved theme on init', () => {
    localStorage.setItem('learning-settings', JSON.stringify({ theme: 'tim-mong' }));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(document.documentElement.getAttribute('data-theme')).toBe('tim-mong');
    expect(fixture.componentInstance.currentTheme).toBe('tim-mong');
  });

  it('opens and closes the settings popup', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.settingsOpen).toBe(false);
    app.openSettings();
    expect(app.settingsOpen).toBe(true);
    app.closeSettings();
    expect(app.settingsOpen).toBe(false);
  });

  it('closes popup when clicking the backdrop only', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.settingsOpen = true;
    app.closeSettingsOnBackdrop({ target: { classList: { contains: () => true } } } as unknown as MouseEvent);
    expect(app.settingsOpen).toBe(false);
    app.settingsOpen = true;
    app.closeSettingsOnBackdrop({ target: { classList: { contains: () => false } } } as unknown as MouseEvent);
    expect(app.settingsOpen).toBe(true);
  });

  it('setTheme updates state and persists to localStorage', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.setTheme('hoang-hon');
    expect(app.currentTheme).toBe('hoang-hon');
    const saved = JSON.parse(localStorage.getItem('learning-settings') || '{}');
    expect(saved.theme).toBe('hoang-hon');
    const applied = document.documentElement.getAttribute('data-theme');
    expect(applied).toBe('hoang-hon');
  });

  it('lists 12 themes with unique ids', () => {
    const fixture = TestBed.createComponent(App);
    const ids = fixture.componentInstance.themes.map(t => t.id);
    expect(ids.length).toBe(12);
    expect(new Set(ids).size).toBe(12);
  });
});
