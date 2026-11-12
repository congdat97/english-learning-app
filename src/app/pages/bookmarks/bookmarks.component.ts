import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LearningService } from '../../services/learning.service';
import { Vocabulary } from '../../models/learning.model';

@Component({
  selector: 'app-bookmarks',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './bookmarks.component.html',
  styleUrl: './bookmarks.component.css'
})
export class BookmarksComponent implements OnInit {
  bookmarks: Vocabulary[] = [];
  filtered: Vocabulary[] = [];
  search = '';
  loading = true;

  constructor(private learning: LearningService) {}

  ngOnInit(): void {
    this.learning.getBookmarks().subscribe({
      next: (r) => { this.bookmarks = r.data; this.applyFilter(); this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  applyFilter(): void {
    const q = this.search.toLowerCase();
    this.filtered = this.bookmarks.filter(v => v.word.toLowerCase().includes(q) || v.meaning_vi.toLowerCase().includes(q));
  }

  speak(text: string): void {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  unbookmark(v: Vocabulary): void {
    this.learning.unbookmark(v.id).subscribe({ next: () => { this.bookmarks = this.bookmarks.filter(b => b.id !== v.id); this.applyFilter(); } });
  }
}
