import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LearningService } from '../../services/learning.service';
import { SettingsService } from '../../services/settings.service';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';

/** Nguồn avatar: DiceBear (miễn phí, nhiều phong cách, không cần API key) */
const AVATAR_STYLES = ['adventurer', 'big-smile', 'lorelei', 'micah', 'fun-emoji', 'bottts'];
const AVATAR_SEEDS = ['felix', 'sunny', 'nova', 'bolt'];

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  voice = '';
  theme = 'mac-dinh';

  voices: SpeechSynthesisVoice[] = [];

  saving = false;
  saveMsg = '';

  /** Avatar: danh sách lựa chọn + lựa chọn hiện tại */
  avatarOptions: { url: string; style: string; seed: string }[] = [];
  selectedAvatar = '';

  readonly themeService = inject(ThemeService);

  constructor(private learning: LearningService, private settings: SettingsService, private auth: AuthService) {}

  ngOnInit(): void {
    this.selectedAvatar = this.auth.currentUser()?.avatar || '';
    this.buildAvatarOptions();
    const saved = this.settings.load();
    this.voice = saved.voice;
    this.theme = saved.theme;
    this.learning.getSettings().subscribe({
      next: (res) => {
        const data = res.data || {};
        this.voice = data.voice ?? this.voice;
        this.theme = data.theme ?? this.theme;
        this.themeService.setTheme(this.theme);
      },
      error: () => {
        // Đã dùng giá trị local ở trên
      }
    });
    this.loadVoices();
  }

  private loadVoices(): void {
    if (typeof speechSynthesis === 'undefined') return;
    const refresh = () => {
      // Hiện TẤT CẢ giọng (máy có thể không cài giọng en),
      // giọng tiếng Anh xếp lên trước.
      this.voices = speechSynthesis
        .getVoices()
        .sort((a, b) => {
          const ae = a.lang.toLowerCase().startsWith('en') ? 0 : 1;
          const be = b.lang.toLowerCase().startsWith('en') ? 0 : 1;
          return ae - be || a.name.localeCompare(b.name);
        });
    };
    refresh();
    speechSynthesis.addEventListener('voiceschanged', refresh);
    // Chrome/Edge có lúc load danh sách giọng trễ -> thử lại vài lần
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (this.voices.length > 0 || tries >= 12) { clearInterval(timer); return; }
      refresh();
    }, 500);
  }

  /** Đọc câu mẫu bằng giọng hiện tại để kiểm tra. */
  testVoice(): void {
    if (typeof speechSynthesis === 'undefined') return;
    const utterance = new SpeechSynthesisUtterance("Hello! Let's learn English, step by step.");
    utterance.lang = 'en-US';
    utterance.rate = this.settings.audioSpeed;
    if (this.voice) {
      const v = speechSynthesis.getVoices().find(x => x.name === this.voice);
      if (v) utterance.voice = v;
    }
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  save(): void {
    if (this.saving) return;
    this.saving = true;
    this.saveMsg = '';
    const current = this.settings.load();
    const payload = {
      daily_minutes: current.dailyMinutes,
      audio_speed: current.audioSpeed,
      show_translation: current.showTranslation,
      font_size: current.fontSize,
      voice: this.voice,
      theme: this.theme
    };
    this.learning.saveSettings(payload).subscribe({
      next: () => {
        this.persistLocal();
        this.saving = false;
        this.saveMsg = '✅ Đã lưu cài đặt.';
      },
      error: () => {
        this.persistLocal();
        this.saving = false;
        this.saveMsg = '⚠️ Lưu tạm trên máy này (API chưa phản hồi) — sẽ tự đồng bộ khi API hoạt động.';
      }
    });
  }

  selectTheme(theme: string): void {
    this.theme = theme;
    // Ủy quyền ThemeService (lưu localStorage elf-theme + data-mode) và tự lưu DB
    this.themeService.setTheme(theme);
    this.settings.savePartial({ theme });
  }

  onVoiceChange(): void {
    this.settings.savePartial({ voice: this.voice });
  }

  /** Tạo danh sách avatar từ DiceBear: 6 phong cách x 4 seed */
  private buildAvatarOptions(): void {
    const options: { url: string; style: string; seed: string }[] = [];
    for (const style of AVATAR_STYLES) {
      for (const seed of AVATAR_SEEDS) {
        options.push({
          url: `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}&backgroundType=gradientLinear`,
          style,
          seed
        });
      }
    }
    this.avatarOptions = options;
  }

  /** 🎲 Ngẫu nhiên: sinh avatar mới theo seed bất kỳ */
  randomAvatar(): void {
    const style = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];
    const seed = Math.random().toString(36).slice(2, 8);
    this.selectedAvatar = `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}&backgroundType=gradientLinear`;
    this.saveAvatar();
  }

  /** Chọn 1 avatar trong lưới -> lưu ngay */
  chooseAvatar(url: string): void {
    this.selectedAvatar = url;
    this.saveAvatar();
  }

  /** Bỏ avatar -> về chữ cái đầu */
  clearAvatar(): void {
    this.selectedAvatar = '';
    this.saveAvatar();
  }

  private saveAvatar(): void {
    this.saveMsg = '';
    this.auth.updateAvatar(this.selectedAvatar).subscribe({
      next: () => { this.saveMsg = '✅ Đã cập nhật ảnh đại diện.'; },
      error: () => { this.saveMsg = '⚠️ Không lưu được ảnh đại diện (API chưa phản hồi).'; }
    });
  }

  private persistLocal(): void {
    this.settings.save({
      ...this.settings.load(),
      voice: this.voice,
      theme: this.theme
    });
  }
}
