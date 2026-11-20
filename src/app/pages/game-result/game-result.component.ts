import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GameResult } from '../../models/game.model';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-game-result',
  imports: [CommonModule, RouterLink],
  templateUrl: './game-result.component.html',
  styleUrl: './game-result.component.css'
})
export class GameResultComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private game = inject(GameService);

  stageId = '';
  result: GameResult | null = null;
  readonly starSlots = [0, 1, 2];

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.stageId = params.get('stageId') || '';
      this.result = this.game.lastResultFor(this.stageId);
    });
  }

  title(): string {
    const stars = this.result?.stars ?? 0;
    if (stars === 3) return 'Tuyệt vời!';
    if (stars === 2) return 'Tốt lắm!';
    if (stars === 1) return 'Cố thêm chút nữa!';
    return 'Luyện lại để cao hơn nhé!';
  }

  trackBy(_: number, answer: { questionId: string }): string {
    return answer.questionId;
  }
}
