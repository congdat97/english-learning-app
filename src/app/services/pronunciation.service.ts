import { Injectable, NgZone, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PronunciationService {
  private zone = inject(NgZone);

  supported(): boolean {
    if (typeof window === 'undefined') return false;
    const scope = window as any;
    return Boolean(scope.SpeechRecognition || scope.webkitSpeechRecognition);
  }

  score(target: string): Observable<number> {
    return new Observable<number>(subscriber => {
      if (!this.supported()) {
        subscriber.next(0);
        subscriber.complete();
        return;
      }

      const scope = window as any;
      const SpeechRecognition = scope.SpeechRecognition || scope.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      const wanted = this.normalize(target);
      let settled = false;
      const finish = (value: number) => {
        if (settled) return;
        settled = true;
        this.zone.run(() => {
          subscriber.next(value);
          subscriber.complete();
        });
      };

      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 5;

      recognition.onresult = (event: any) => {
        const candidates: string[] = [];
        for (const result of event.results) {
          for (const alternative of result) {
            candidates.push(this.normalize(alternative.transcript));
          }
        }
        finish(this.bestSimilarity(wanted, candidates));
      };
      recognition.onerror = () => finish(0);
      recognition.onend = () => finish(0);

      try {
        recognition.start();
      } catch {
        finish(0);
      }

      return () => {
        try { recognition.abort(); } catch {}
      };
    });
  }

  private normalize(text: string): string {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z' ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private bestSimilarity(target: string, candidates: string[]): number {
    let best = 0;
    for (const candidate of candidates) {
      if (!candidate) continue;
      best = Math.max(best, this.similarity(target, candidate));
      for (const word of target.split(' ')) {
        best = Math.max(best, this.similarity(word, candidate));
      }
    }
    return best;
  }

  private similarity(a: string, b: string): number {
    if (!a || !b) return 0;
    const distance = this.levenshtein(a, b);
    return Math.round((1 - distance / Math.max(a.length, b.length)) * 100);
  }

  private levenshtein(a: string, b: string): number {
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
      const current = [i];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      }
      previous = current;
    }
    return previous[b.length];
  }
}
