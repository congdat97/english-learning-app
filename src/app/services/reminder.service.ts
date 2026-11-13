import { Injectable, inject } from '@angular/core';

import { Router } from '@angular/router';

import { Subscription, timer } from 'rxjs';

import { LearningService } from './learning.service';

import { OfflineDataService } from './offline-data.service';

import { ThemeService } from './theme.service';

import { Vocabulary } from '../models/learning.model';

const REMINDER_KEY = 'elf-reminder.enabled';

/** Số phút lặp lại (0 = không lặp). */
const INTERVAL_KEY = 'elf-reminder.interval';

/** Các giờ cố định ["08:00","20:00"]. */
const DAILY_KEY = 'elf-reminder.dailyTimes';

/** Thời điểm gửi thông báo nhắc gần nhất. */
const LAST_SENT_KEY = 'elf-reminder.lastSentAt';

/** Giờ cố định đã bắn trong ngày (chống lặp khi mở lại app). */
const FIRED_SLOTS_KEY = 'elf-reminder.firedSlots';

const TIME_PATTERN =
  /^(?:[01]?\d|2[0-3]):[0-5]\d$/;

@Injectable({ providedIn: 'root' })
export class ReminderService {

  private readonly learningService =
    inject(LearningService);

  private readonly offlineData =
    inject(OfflineDataService);

  private readonly router = inject(Router);

  private readonly theme = inject(ThemeService);

  private timerSubscription?: Subscription;

  // =====================================================
  // STATE
  // =====================================================

  enabled = false;

  permission:
    | NotificationPermission
    | 'unsupported' =
    'unsupported';

  lastRemindedAt: Date | null = null;

  lastWord: Vocabulary | null = null;

  /** Khoảng lặp lại (phút); 0 = chỉ giờ cố định. */
  intervalMinutes = 30;

  /** Các giờ cố định trong ngày ("08:00"...). */
  dailyTimes: string[] = [];

  private dailySubscription?: Subscription;

  /** Mốc giờ đã bắn trong phiên (tránh lặp). */
  private firedDailySlots = new Set<string>();


  constructor() {

    this.enabled =
      localStorage.getItem(REMINDER_KEY) === 'true';

    this.permission = this.getPermission();

    this.loadSchedule();

    this.loadLastSent();

    this.loadFiredSlots();

    this.registerServiceWorker();

  }


  /**
   * Đăng ký SW sớm: Android/Xiaomi chỉ
   * hiện thông báo web qua Service Worker.
   */
  private registerServiceWorker(): void {

    if (
      !('serviceWorker' in navigator) ||
      !window.isSecureContext
    ) {
      return;
    }

    navigator.serviceWorker
      .register(this.serviceWorkerUrl())
      .catch(() => {
        // ignore
      });

  }


  /** URL SW tuyệt đối theo <base href> của trang. */
  private serviceWorkerUrl(): string {

    return new URL(
      'reminder-sw.js',
      document.baseURI
    ).href;

  }

  // =====================================================
  // PERMISSION
  // =====================================================

  private getPermission():
    | NotificationPermission
    | 'unsupported' {

    if (!('Notification' in window)) {
      return 'unsupported';
    }

    return Notification.permission;

  }


  /**
   * Bật/tắt nhắc học.
   * Trả về trạng thái quyền thông báo
   * để UI hiện hướng dẫn nếu chưa cấp.
   */
  async toggle(): Promise<
    | NotificationPermission
    | 'unsupported'
  > {

    if (this.enabled) {

      this.enabled = false;

      this.stopTimer();

      this.saveSetting();

      return this.permission;

    }


    // Đang bật

    if (!('Notification' in window)) {

      this.permission = 'unsupported';

      return this.permission;

    }


    if (
      Notification.permission ===
      'default'
    ) {

      const result =
        await Notification.requestPermission();

      this.permission = result;

    }


    if (
      Notification.permission ===
      'granted'
    ) {

      this.enabled = true;

      this.saveSetting();

      this.resetStaleAnchor();

      this.startTimer();

      // Thông báo thử ngay sau khi
      // bật để người dùng xác nhận
      await this.remindOnce(true);

    } else {

      this.enabled = false;

      this.stopTimer();

      this.saveSetting();

    }


    return this.permission;

  }

  /**
   * Gửi thử 1 thông báo thủ công.
   * Chưa cấp quyền thì xin quyền trước.
   * Trả về quyền hiện tại sau thao tác.
   */
  async testNotification(): Promise<
    | NotificationPermission
    | 'unsupported'
  > {

    if (!('Notification' in window)) {

      this.permission = 'unsupported';

      return this.permission;

    }


    this.permission = this.getPermission();

    if (
      Notification.permission ===
      'default'
    ) {

      this.permission =
        await Notification.requestPermission();

    }


    // Đã cấp quyền: nhắc thử ngay
    if (this.permission === 'granted') {
      await this.remindOnce(true);
    }


    return this.permission;

  }

  // =====================================================
  // TIMER
  // =====================================================

  /**
   * Khởi động lại timer khi mở app
   * nếu tính năng đang bật
   * (gọi từ App component).
   */
  initFromStorage(): void {

    const stored =
      localStorage.getItem(REMINDER_KEY) === 'true';

    this.enabled = stored;

    this.permission = this.getPermission();

    if (
      stored &&
      this.permission === 'granted'
    ) {

      this.startTimer();

    }

  }


  // =====================================================
  // SCHEDULE (lịch nhắc)
  // =====================================================

  /** Mô tả lịch nhắc hiện tại. */
  get scheduleText(): string {

    const parts: string[] = [];

    if (this.intervalMinutes > 0) {
      parts.push(`mỗi ${this.intervalMinutes} phút`);
    }

    if (this.dailyTimes.length) {
      parts.push(`lúc ${this.dailyTimes.join(', ')}`);
    }

    return parts.length
      ? parts.join(' và ')
      : 'chưa đặt lịch';

  }


  /** Đọc lịch nhắc đã lưu. */
  private loadSchedule(): void {

    const raw =
      localStorage.getItem(INTERVAL_KEY);

    if (raw !== null) {

      const minutes = Number(raw);

      if (
        Number.isFinite(minutes) &&
        minutes >= 0
      ) {
        this.intervalMinutes = minutes;
      }

    }

    try {

      const list = JSON.parse(
        localStorage.getItem(DAILY_KEY) ?? '[]'
      );

      if (Array.isArray(list)) {

        this.dailyTimes = list
          .filter((t): t is string =>
            typeof t === 'string' &&
            TIME_PATTERN.test(t))
          .map(t => this.normalizeTime(t)!)
          .sort();

      }

    } catch {
      this.dailyTimes = [];
    }

  }


  /** Khôi phục thời điểm gửi thông báo gần nhất. */
  private loadLastSent(): void {

    const raw =
      localStorage.getItem(LAST_SENT_KEY);

    const at = Number(raw ?? '');

    if (
      raw !== null &&
      Number.isFinite(at) &&
      at > 0
    ) {
      this.lastRemindedAt = new Date(at);
    }

  }


  /** Ghi mốc gửi thông báo (cho hẹn giờ + hiển thị). */
  private markSent(at = new Date()): void {

    this.lastRemindedAt = at;

    try {

      localStorage.setItem(
        LAST_SENT_KEY,
        String(at.getTime())
      );

    } catch {
      // ignore
    }

  }


  /** Mốc hẹn giờ đọc từ storage (0 = chưa gửi lần nào). */
  private lastSentMs(): number {

    const at = Number(
      localStorage.getItem(LAST_SENT_KEY) ?? ''
    );

    return Number.isFinite(at) && at > 0
      ? at
      : 0;

  }


  /** Khôi phục giờ cố định đã bắn trong ngày. */
  private loadFiredSlots(): void {

    try {

      const data = JSON.parse(
        localStorage.getItem(FIRED_SLOTS_KEY) ?? 'null'
      );

      const today =
        new Date().toDateString();

      if (
        data &&
        data.date === today &&
        Array.isArray(data.slots)
      ) {

        for (const time of data.slots) {

          if (typeof time === 'string') {
            this.firedDailySlots.add(
              `${today} ${time}`
            );
          }

        }

      }

    } catch {
      // ignore
    }

  }


  /** Lưu các giờ cố định đã bắn trong ngày. */
  private saveFiredSlots(): void {

    try {

      const today =
        new Date().toDateString();

      const slots =
        [...this.firedDailySlots]
          .filter(key => key.startsWith(today))
          .map(key =>
            key.slice(key.lastIndexOf(' ') + 1)
          );

      localStorage.setItem(
        FIRED_SLOTS_KEY,
        JSON.stringify({ date: today, slots })
      );

    } catch {
      // ignore
    }

  }


  /**
   * Đang bật lại mà mốc hẹn giờ đã quá hạn:
   * bắt đầu chu kỳ mới từ bây giờ
   * (tránh báo bù + báo thử cùng lúc).
   */
  private resetStaleAnchor(): void {

    if (this.intervalMinutes <= 0) {
      return;
    }

    const ms =
      this.intervalMinutes * 60 * 1000;

    const last = this.lastSentMs();

    if (
      last === 0 ||
      Date.now() - last >= ms
    ) {

      try {
        localStorage.setItem(
          LAST_SENT_KEY,
          String(Date.now())
        );
      } catch {
        // ignore
      }

    }

  }


  /** "8:00" -> "08:00"; không hợp lệ -> null. */
  private normalizeTime(value: string): string | null {

    const trimmed = value.trim();

    if (!TIME_PATTERN.test(trimmed)) {
      return null;
    }

    const [h, m] = trimmed.split(':');

    return `${h.padStart(2, '0')}:${m}`;

  }


  /** Đổi khoảng lặp (phút; 0 = tắt lặp). */
  setIntervalMinutes(minutes: number): void {

    this.intervalMinutes = minutes;

    localStorage.setItem(
      INTERVAL_KEY, String(minutes)
    );

    if (this.enabled) {
      this.startTimer();
    }

  }


  /** Thêm giờ cố định. Trả false nếu trùng/sai. */
  addDailyTime(value: string): boolean {

    const time = this.normalizeTime(value);

    if (!time || this.dailyTimes.includes(time)) {
      return false;
    }

    this.dailyTimes =
      [...this.dailyTimes, time].sort();

    this.saveDailyTimes();

    if (this.enabled) {
      this.startTimer();
    }

    return true;

  }


  /** Xóa 1 giờ cố định. */
  removeDailyTime(value: string): void {

    this.dailyTimes = this.dailyTimes
      .filter(t => t !== value);

    this.saveDailyTimes();

    if (this.enabled) {
      this.startTimer();
    }

  }


  private saveDailyTimes(): void {

    localStorage.setItem(
      DAILY_KEY,
      JSON.stringify(this.dailyTimes)
    );

  }


  /**
   * Kiểm tra giờ cố định (tick 30 giây).
   * Bắn trong cửa sổ graceMs sau mốc giờ
   * (5 phút khi chạy thường, 30 phút ở
   * lần kiểm tra đầu để bù giờ đã lỡ),
   * mỗi mốc chỉ bắn 1 lần mỗi ngày.
   */
  private checkDailyTimes(
    graceMs = 5 * 60 * 1000
  ): void {

    if (
      !this.enabled ||
      !this.dailyTimes.length
    ) {
      return;
    }

    const nowMs = Date.now();

    for (const time of this.dailyTimes) {

      const [h, m] = time.split(':').map(Number);

      const slot = new Date();

      slot.setHours(h, m, 0, 0);

      const diff = nowMs - slot.getTime();

      if (diff < 0 || diff >= graceMs) {
        continue;
      }

      const key =
        `${slot.toDateString()} ${time}`;

      if (this.firedDailySlots.has(key)) {
        continue;
      }

      this.firedDailySlots.add(key);

      this.saveFiredSlots();

      this.remindOnce();

    }

  }


  private startTimer(): void {

    this.stopTimer();


    // Lặp theo khoảng phút đã set,
    // tính tiếp từ lần gửi gần nhất đã lưu:
    // mở app mà đã quá hạn thì bắn bù ngay
    if (this.intervalMinutes > 0) {

      const ms =
        this.intervalMinutes * 60 * 1000;

      const last = this.lastSentMs();

      const elapsed =
        last > 0
          ? Date.now() - last
          : ms;

      const delay = Math.min(
        ms,
        Math.max(0, ms - elapsed)
      );

      this.timerSubscription =
        timer(delay, ms)
          .subscribe(() => this.remindOnce());

    }


    // Kiểm tra giờ cố định định kỳ
    // (lần đầu: cửa sổ 30 phút để bù giờ lỡ)
    if (this.dailyTimes.length) {

      this.dailySubscription =
        timer(15 * 1000, 30 * 1000)
          .subscribe(index =>
            this.checkDailyTimes(
              index === 0
                ? 30 * 60 * 1000
                : 5 * 60 * 1000
            ));

    }

  }


  private stopTimer(): void {

    this.timerSubscription
      ?.unsubscribe();

    this.timerSubscription = undefined;

    this.dailySubscription
      ?.unsubscribe();

    this.dailySubscription = undefined;

  }

  // =====================================================
  // REMIND
  // =====================================================

  /**
   * Nhắc 1 từ ngẫu nhiên
   * từ danh sách đã lưu.
   * Trả về true nếu đã gửi được.
   */
  async remindOnce(isTest = false): Promise<boolean> {

    try {

      const bookmarks =
        await this.latestBookmarks();

      const words = (bookmarks ?? [])
        .filter(word => word?.word);

      if (!words.length) {
        return false;
      }


      const word =
        words[
          Math.floor(
            Math.random() * words.length
          )
        ];

      this.lastWord = word;

      // Ghi lại thời điểm gửi:
      // hẹn giờ tính tiếp từ đây,
      // UI hiện "Gần nhất HH:mm"
      this.markSent();

      this.showNotification(
        word,
        isTest
      );

      return true;

    } catch {
      // Bỏ qua: không nhắc được lần này
      return false;
    }

  }


  /**
   * Lấy bookmark mới nhất.
   * Ưu tiên API (dữ liệu mới),
   * API lỗi thì dùng bản lưu trong
   * localStorage.
   */
  private latestBookmarks():
    Promise<Vocabulary[]> {

    return new Promise((resolve) => {

      let settled = false;


      this.learningService
        .getBookmarks()
        .subscribe({

          next: (response) => {

            settled = true;

            resolve(response?.data ?? []);

          },

          // API ngủ: dùng bản cache ngay
          error: () => {

            if (settled) {
              return;
            }

            settled = true;

            resolve(
              this.cachedBookmarks()
            );

          }

        });


      // Đợi tối đa 6 giây cho API,
      // quá lâu thì dùng cache
      setTimeout(() => {

        if (!settled) {

          settled = true;

          resolve(
            this.cachedBookmarks()
          );

        }

      }, 6000);

    });

  }


  private cachedBookmarks():
    Vocabulary[] {

    return (
      this.offlineData
        .get<Vocabulary[]>('bookmarks') ??
      this.offlineData
        .getStale<Vocabulary[]>(
          'bookmarks'
        ) ??
      []
    );

  }

  // =====================================================
  // NOTIFICATION
  // =====================================================

  private themeIcon(theme: { primary: string; secondary: string }): string {

    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192">',
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
      `<stop offset="0%" stop-color="${theme.primary}"/>`,
      `<stop offset="100%" stop-color="${theme.secondary}"/>`,
      '</linearGradient></defs>',
      '<rect width="192" height="192" rx="42" fill="url(#g)"/>',
      '<text x="96" y="130" font-size="100" text-anchor="middle" fill="#ffffff" font-family="sans-serif">A</text>',
      '</svg>'
    ].join('');

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;

  }

  private showNotification(
    word: Vocabulary,
    isTest = false
  ): void {

    const title =
      isTest
        ? '✅ Đã bật nhắc học!'
        : '⏰ Nhắc học tiếng Anh!';

    const body =
      isTest
        ? `Lịch nhắc: ${this.scheduleText}.\n` +
          `${word.word} ` +
          `(${word.ipa || '?'}) - ` +
          `${word.meaning_vi || ''}`
        : `${word.word} ` +
          `(${word.ipa || '?'})\n` +
          `${word.meaning_vi || ''}`;

    const theme = this.theme.currentTheme;

    const options: NotificationOptions = {
      body,
      tag: `elf-reminder-${theme.id}`,
      icon: this.themeIcon(theme),
      data: {
        url: '/bookmarks'
      }
    };


    // Android/Xiaomi: Chrome chỉ hiện thông
    // báo từ trang web qua Service Worker
    // (new Notification chỉ chạy khi tab mở)
    if (
      'serviceWorker' in navigator &&
      window.isSecureContext
    ) {

      navigator.serviceWorker
        .getRegistration()
        .then(registration =>
          registration ??
          navigator.serviceWorker.register(this.serviceWorkerUrl())
        )
        .then(registration =>
          registration.showNotification(
            title, options
          )
        )
        .catch(() =>
          this.showNotificationFallback(
            title, options
          )
        );

      return;

    }

    this.showNotificationFallback(title, options);

  }


  /** Desktop: hiện trực tiếp qua constructor. */
  private showNotificationFallback(
    title: string,
    options: NotificationOptions
  ): void {

    try {

      const notification =
        new Notification(title, options);

      notification.onclick = () => {

        window.focus();

        this.router.navigate(
          ['/bookmarks']
        );

        notification.close();

      };

    } catch (error) {

      console.warn(
        'Không hiện được thông báo:',
        error
      );

    }

  }

  // =====================================================
  // SETTINGS
  // =====================================================

  private saveSetting(): void {

    try {

      localStorage.setItem(
        REMINDER_KEY,
        this.enabled
          ? 'true'
          : 'false'
      );

    } catch {

      // ignore

    }

  }

}
