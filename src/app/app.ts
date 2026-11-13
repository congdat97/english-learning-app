import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Subscription } from 'rxjs';

import { ThemeService } from './services/theme.service';
import { OfflineDataService } from './services/offline-data.service';
import { ReminderService } from './services/reminder.service';
import { SettingsService } from './services/settings.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {

  private offlineDataService =
    inject(OfflineDataService);

  private readonly reminderService =
    inject(ReminderService);

  private readonly settings =
    inject(SettingsService);

  readonly theme =
    inject(ThemeService);

  readonly auth = inject(AuthService);

  private syncSubscription?: Subscription;

  mobileMenuOpen = false;

  settingsOpen = false;

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

    // Tự động tải dữ liệu về
    // localStorage nếu chưa có
    this.offlineDataService
      .ensureData()
      .subscribe(() => this.refreshStatus());

    // Khởi động nhắc học
    // nếu đang bật từ trước
    this.reminderService.initFromStorage();

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
    this.auth.logout();
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
      .syncAll()
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
