import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { ThemeService } from './services/theme.service';

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

  it('renders the sticky header', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('header.top').length).toBe(1);
  });

  it('applies saved theme on init', () => {
    localStorage.setItem('elf-theme', 'tim-mong');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(document.documentElement.getAttribute('data-theme')).toBe('tim-mong');
    const theme = TestBed.inject(ThemeService);
    expect(theme.currentTheme.id).toBe('tim-mong');
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
    const backdrop = {} as MouseEvent['target'];
    app.settingsOpen = true;
    app.closeSettingsOnBackdrop({ target: backdrop, currentTarget: backdrop } as unknown as MouseEvent);
    expect(app.settingsOpen).toBe(false);
    app.settingsOpen = true;
    app.closeSettingsOnBackdrop({ target: {}, currentTarget: {} } as unknown as MouseEvent);
    expect(app.settingsOpen).toBe(true);
  });

  it('theme.setTheme updates state and persists to localStorage', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const theme = TestBed.inject(ThemeService);
    theme.setTheme('hoang-hon');
    expect(theme.currentTheme.id).toBe('hoang-hon');
    expect(localStorage.getItem('elf-theme')).toBe('hoang-hon');
    const applied = document.documentElement.getAttribute('data-theme');
    expect(applied).toBe('hoang-hon');
  });

  it('theme.setMode toggles light/dark and persists', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const theme = TestBed.inject(ThemeService);
    theme.setMode('dark');
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark');
    expect(localStorage.getItem('elf-mode')).toBe('dark');
    theme.setMode('light');
    expect(document.documentElement.getAttribute('data-mode')).toBe('light');
  });

  it('lists 12 themes with unique ids', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const theme = TestBed.inject(ThemeService);
    const ids = theme.themes.map(t => t.id);
    expect(ids.length).toBe(12);
    expect(new Set(ids).size).toBe(12);
  });
});
