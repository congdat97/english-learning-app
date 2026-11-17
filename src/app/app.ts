import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Subscription } from 'rxjs';

import { environment } from '../environments/environment';
import { ThemeService } from './services/theme.service';
import { OfflineDataService } from './services/offline-data.service';
import { ReminderService } from './services/reminder.service';
import { SettingsService } from './services/settings.service';
import { AuthService } from './services/auth.service';
import { ToastService } from './services/toast.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {

  private readonly http = inject(HttpClient);

  private offlineDataService =
    inject(OfflineDataService);

  private readonly reminderService =
    inject(ReminderService);

  private readonly settings =
    inject(SettingsService);

  readonly theme =
    inject(ThemeService);

  readonly auth = inject(AuthService);

  readonly toast = inject(ToastService);

  private syncSubscription?: Subscription;

  /** Popup chọn avatar. */
  avatarPickerOpen = false;

  /** Bộ avatar động vật (Cute Vật + Kawaii) từ CentBot — local, gộp thành 1 nhóm. */
  readonly avatarGroups: { label: string; items: string[] }[] = [
    {
      label: '🐾 Động vật',
      items: [
        ...Array.from({ length: 20 }, (_, i) => `/avatars/animals/cutevat_${String(i + 1).padStart(2, '0')}.png`),
        '/avatars/animals/kawaii_01a.png',
        ...Array.from({ length: 23 }, (_, i) => `/avatars/animals/kawaii_${String(i + 2).padStart(2, '0')}.png`)
      ]
    }
  ];

  get currentAvatar(): string | null {
    return this.auth.currentUser()?.avatar || null;
  }

  /** Đánh thức Render API (free tier ngủ sau ~15 phút) + giữ ấm khi app đang mở. */
  private keepAliveTimer?: ReturnType<typeof setInterval>;

  mobileMenuOpen = false;

  settingsOpen = false;

  /** Menu tài khoản (avatar) trên header. */
  userMenuOpen = false;

  // =====================================================
  // SYNC STATUS
  // =====================================================

  syncing = false;

  syncError = '';

  syncedAt = '--';

  dataCount = 0;

  ngOnInit(): void {

    // Áp dụng cỡ chữ đã lưu
    this.settings.applyFontSize(
      this.settings.load().fontSize
    );

    // Đánh thức API (tránh trang admin/quản lý load chờ Render khởi động lại)
    this.warmUpApi();
    this.keepAliveTimer = setInterval(() => this.warmUpApi(), 10 * 60 * 1000);

    // Tự động tải dữ liệu về
    // localStorage nếu chưa có
    this.offlineDataService
      .ensureData()
      .subscribe(() => this.refreshStatus());

    // Khởi động nhắc học
    // nếu đang bật từ trước
    this.reminderService.initFromStorage();

  }

  ngOnDestroy(): void {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    if (this.syncSubscription) this.syncSubscription.unsubscribe();
  }

  /** Ping nền im lặng — chỉ để API không ngủ. */
  private warmUpApi(): void {
    this.http
      .get(`${environment.apiUrl}/courses?warm=${Date.now()}`)
      .subscribe({ error: () => {} });
  }


  private refreshStatus(): void {

    const meta =
      this.offlineDataService.getMeta();

    this.syncedAt =
      meta.syncedAt
        ? new Date(meta.syncedAt)
          .toLocaleString('vi-VN')
        : '--';

    this.dataCount =
      meta.counts.bookmarks ?? 0;

  }


  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  /** Đăng xuất và về trang chủ. */
  logout(): void {
    this.userMenuOpen = false;
    this.auth.logout();
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
  }

  closeUserMenu(): void {
    this.userMenuOpen = false;
  }

  openAvatarPicker(): void {
    this.userMenuOpen = false;
    this.avatarPickerOpen = true;
  }

  closeAvatarPicker(): void {
    this.avatarPickerOpen = false;
  }

  closeAvatarPickerOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeAvatarPicker();
  }

  /** Chọn avatar từ bộ gợi ý và lưu lên server. */
  pickAvatar(url: string): void {
    this.auth.updateAvatar(url).subscribe({
      next: () => {
        this.avatarPickerOpen = false;
        this.toast.success('Đã cập nhật avatar của bạn!');
      },
      error: () => this.toast.error('Không lưu được avatar — thử lại sau.')
    });
  }

  /** Bỏ avatar, quay lại chữ cái đầu. */
  resetAvatar(): void {
    this.auth.updateAvatar('').subscribe({
      next: () => {
        this.avatarPickerOpen = false;
        this.toast.info('Đã dùng lại chữ cái đầu làm avatar.');
      },
      error: () => this.toast.error('Không lưu được avatar — thử lại sau.')
    });
  }


  // =====================================================
  // SETTINGS / THEME
  // =====================================================

  openSettings(): void {
    this.settingsOpen = true;
  }


  closeSettings(): void {
    this.settingsOpen = false;
  }


  closeSettingsOnBackdrop(event: MouseEvent): void {

    if (event.target === event.currentTarget) {
      this.closeSettings();
    }

  }

  /**
   * Gọi API, tải mới dữ liệu
   * và tạo lại JSON trong localStorage.
   */
  syncData(): void {

    if (this.syncing) {
      return;
    }

    this.syncing = true;

    this.syncError = '';

    this.syncSubscription = this
      .offlineDataService
      .syncAll(true)
      .subscribe({
        next: () => {

          this.syncing = false;

          this.refreshStatus();

        },

        error: () => {

          this.syncing = false;

          this.syncError =
            'Không thể đồng bộ. API chưa sẵn sàng.';

        }
      });

  }

}
