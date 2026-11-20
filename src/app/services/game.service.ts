import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { GameResult } from '../models/game.model';

type StoredResults = Record<string, GameResult>;

@Injectable({ providedIn: 'root' })
export class GameService {
  private auth = inject(AuthService);
  private readonly lastResultSignal = signal<GameResult | null>(this.readLastResult());
  readonly lastResult = this.lastResultSignal.asReadonly();

  stageId(lessonId: number): string {
    return `lesson-${lessonId}`;
  }

  lessonIdFromStage(stageId: string): number | null {
    const match = /^lesson-(\d+)$/.exec(stageId || '');
    return match ? Number(match[1]) : null;
  }

  starsFor(score: number, total: number, pronunciation: number | null): number {
    const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;
    if (accuracy < 50) return 0;
    if (accuracy < 80) return 1;
    if (accuracy < 100) return 2;
    return pronunciation !== null && pronunciation >= 90 ? 3 : 2;
  }

  getResult(stageId: string): GameResult | null {
    return this.read()[stageId] ?? null;
  }

  getAllResults(): GameResult[] {
    return Object.values(this.read());
  }

  saveResult(result: GameResult): GameResult {
    const all = this.read();
    const previous = all[result.stageId] ?? null;
    const best = this.isBetter(result, previous) ? result : previous!;
    all[result.stageId] = best;

    try {
      localStorage.setItem(this.key(), JSON.stringify(all));
      localStorage.setItem(this.lastKey(), JSON.stringify(result));
    } catch {}

    this.lastResultSignal.set(result);
    return best;
  }

  lastResultFor(stageId: string): GameResult | null {
    const last = this.lastResultSignal();
    return last?.stageId === stageId ? last : this.getResult(stageId);
  }

  shuffle<T>(items: T[], seed: string): T[] {
    const copy = [...items];
    let next = this.hash(seed);
    for (let i = copy.length - 1; i > 0; i--) {
      next = (Math.imul(next, 1664525) + 1013904223) >>> 0;
      const j = next % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key());
      localStorage.removeItem(this.lastKey());
    } catch {}
    this.lastResultSignal.set(null);
  }

  private isBetter(candidate: GameResult, previous: GameResult | null): boolean {
    if (!previous) return true;
    if (candidate.stars !== previous.stars) return candidate.stars > previous.stars;
    return candidate.accuracy > previous.accuracy;
  }

  private read(): StoredResults {
    try {
      const raw = localStorage.getItem(this.key());
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed as StoredResults : {};
    } catch {
      return {};
    }
  }

  private readLastResult(): GameResult | null {
    try {
      const raw = localStorage.getItem(this.lastKey());
      return raw ? JSON.parse(raw) as GameResult : null;
    } catch {
      return null;
    }
  }

  private key(): string {
    return `elf-game.${this.auth.currentUser()?.id ?? 'guest'}`;
  }

  private lastKey(): string {
    return `${this.key()}.last`;
  }

  private hash(value: string): number {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}
