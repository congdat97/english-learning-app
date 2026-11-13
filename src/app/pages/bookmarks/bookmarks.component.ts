import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LearningService } from '../../services/learning.service';
import { ReminderService } from '../../services/reminder.service';
import { SettingsService } from '../../services/settings.service';
import { Vocabulary } from '../../models/learning.model';

@Component({
  selector: 'app-bookmarks',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './bookmarks.component.html',
  styleUrl: './bookmarks.component.css'
})
export class BookmarksComponent implements OnInit, OnDestroy {
  bookmarks: Vocabulary[] = [];
  filtered: Vocabulary[] = [];
  search = '';
  loading = true;
  slowApi = false;
  private slowTimer?: ReturnType<typeof setTimeout>;

  // =================================================
  // REMINDER
  // =================================================

  reminderEnabled = false;

  reminderPermission:
    | NotificationPermission
    | 'unsupported'
    = 'unsupported';

  reminderBusy = false;

  reminderTestBusy = false;

  testMsg = '';

  constructor(
    private learning: LearningService,
    private reminderService: ReminderService,
    private settings: SettingsService
  ) {}

  ngOnInit(): void {
    this.loadBookmarks();
    this.slowTimer = setTimeout(() => { if (this.loading) this.slowApi = true; }, 8000);

    this.reminderEnabled =
      this.reminderService.enabled;

    this.reminderPermission =
      this.reminderService.permission;
  }

  ngOnDestroy(): void {
    clearTimeout(this.slowTimer);
  }

  // =================================================
  // LOAD BOOKMARKS
  // =================================================

  loadBookmarks(): void {

    this.loading = true;

    this.learning.getBookmarks().subscribe({
      next: (r) => {
        this.bookmarks = r.data ?? [];
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });

  }

  applyFilter(): void {
    const q = this.search.toLowerCase();
    this.filtered = this.bookmarks.filter(v => v.word.toLowerCase().includes(q) || v.meaning_vi.toLowerCase().includes(q));
  }

  speak(text: string): void {
    if (!('speechSynthesis' in window)) return;
    const s = this.settings.load();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = s.audioSpeed;
    if (s.voice) {
      const voice = speechSynthesis.getVoices().find(v => v.name === s.voice);
      if (voice) utterance.voice = voice;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  unbookmark(v: Vocabulary): void {
    this.learning.unbookmark(v.id).subscribe({
      next: () => {
        this.bookmarks = this.bookmarks.filter(b => b.id !== v.id);
        this.learning.updateCachedBookmarks(this.bookmarks);
        this.applyFilter();
      },
      error: () => window.alert('⚠️ Không xóa được từ khỏi sổ từ vựng (API chưa hoạt động) — thử lại sau.')
    });
  }

  // =================================================
  // REMINDER
  // =================================================

  get reminderLastWord() {
    return this.reminderService.lastWord;
  }


  get reminderLastTime(): string {

    const at =
      this.reminderService.lastRemindedAt;

    if (!at) {
      return '';
    }

    return at.toLocaleTimeString(
      'vi-VN',
      {
        hour: '2-digit',
        minute: '2-digit'
      }
    );

  }


  // =================================================
  // REMINDER SCHEDULE
  // =================================================

  get reminderInterval(): number {
    return this.reminderService.intervalMinutes;
  }


  get reminderDailyTimes(): string[] {
    return this.reminderService.dailyTimes;
  }


  /** Tiêu đề: mô tả lịch nhắc. */
  get reminderTitle(): string {

    const s = this.reminderService;

    if (
      s.intervalMinutes > 0 &&
      s.dailyTimes.length
    ) {
      return 'Nhắc học ' + s.scheduleText;
    }

    if (s.intervalMinutes > 0) {
      return `Nhắc học mỗi ${s.intervalMinutes} phút`;
    }

    if (s.dailyTimes.length) {
      return `Nhắc học lúc ${s.dailyTimes.join(', ')}`;
    }

    return 'Nhắc học theo lịch của bạn';

  }


  /** Dòng mô tả dưới tiêu đề. */
  get reminderSubtitle(): string {

    const s = this.reminderService;

    if (
      !s.intervalMinutes &&
      !s.dailyTimes.length
    ) {
      return 'Chọn khoảng lặp hoặc thêm giờ cố định bên dưới.';
    }

    const base =
      'Nhận thông báo 1 từ ngẫu nhiên ' +
      'từ danh sách đã lưu ' +
      `(${s.scheduleText}).`;

    const at = s.lastRemindedAt;

    if (!at) {
      return base;
    }

    const time = at.toLocaleTimeString(
      'vi-VN',
      { hour: '2-digit', minute: '2-digit' }
    );

    const isToday =
      at.toDateString() ===
      new Date().toDateString();

    const day = isToday
      ? ''
      : ' ' + at.toLocaleDateString(
        'vi-VN',
        { day: '2-digit', month: '2-digit' }
      );

    return `${base} Gần nhất ${time}${day}.`;

  }


  onReminderIntervalChange(event: Event): void {

    const value = Number(
      (event.target as HTMLSelectElement).value
    );

    this.reminderService
      .setIntervalMinutes(value);

  }


  addDailyTime(
    value: string,
    input: HTMLInputElement
  ): void {

    if (!value) {
      return;
    }

    const ok = this.reminderService
      .addDailyTime(value);

    this.testMsg = ok
      ? `✅ Đã thêm giờ nhắc ${value}.`
      : '⚠️ Giờ này đã có hoặc không hợp lệ.';

    if (ok) {
      input.value = '';
    }

  }


  removeDailyTime(time: string): void {

    this.reminderService
      .removeDailyTime(time);

  }


  // =================================================
  // REMINDER ACTIONS
  // =================================================

  toggleReminder(): void {

    if (this.reminderBusy) {
      return;
    }

    this.reminderBusy = true;


    this.reminderService
      .toggle()
      .then((permission) => {

        this.reminderEnabled =
          this.reminderService.enabled;

        this.reminderPermission =
          permission;

        this.reminderBusy = false;

      });

  }


  testNotification(): void {

    if (this.reminderTestBusy) {
      return;
    }

    this.reminderTestBusy = true;

    this.testMsg = '';


    this.reminderService
      .testNotification()
      .then(async (permission) => {

        this.reminderEnabled =
          this.reminderService.enabled;

        this.reminderPermission =
          permission;


        if (permission !== 'granted') {
          return;
        }


        const sent =
          await this.reminderService
            .remindOnce(true);


        this.testMsg = sent
          ? '✅ Đã gửi thông báo thử — ' +
            'kiểm tra khu vực thông báo ' +
            'của trình duyệt.'
          : 'Chưa có từ đã lưu để nhắc.';

      })
      .catch(() => {
        this.testMsg =
          'Không gửi được thông báo thử.';
      })
      .finally(() => {
        this.reminderTestBusy = false;
      });

  }


  get reminderHint(): string {

    switch (this.reminderPermission) {

      case 'denied':
        return 'Bạn đã chặn thông báo. Hãy cấp lại quyền thông báo trong trình duyệt.';

      case 'unsupported':
        return 'Trình duyệt này không hỗ trợ thông báo.';

      default:
        return '';

    }

  }

}
