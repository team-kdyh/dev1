import type { Application } from 'pixi.js';
import { FakeSimAdapter } from '../adapter/FakeSimAdapter';
import type { BalanceData } from '../sim/contracts';
import { Codex } from '../screens/Codex';
import { MainMenu, PlaceholderScreen, ResultScreen, Splash, type MatchResult } from '../screens/Screens';
import { Game } from './Game';

interface Screen {
  mount(): void;
  unmount(): void;
}

/**
 * 화면 흐름. (명세 §7)
 * 스플래시 → 메인메뉴 → 캠페인/빠른대전/도감/연구소/온라인 대전(M3)/설정 → 인게임 → 결과
 */
export class App {
  private current: Screen | null = null;
  private game: Game | null = null;

  constructor(
    private readonly app: Application,
    private readonly balance: BalanceData,
  ) {}

  start(): void {
    this.show(new Splash(() => this.mainMenu()));
  }

  private show(screen: Screen): void {
    this.current?.unmount();
    this.current = screen;
    screen.mount();
  }

  private clearScreen(): void {
    this.current?.unmount();
    this.current = null;
  }

  private mainMenu(): void {
    this.stopGame();
    this.show(
      new MainMenu({
        campaign: () => this.startMatch(),
        quickMatch: () => this.startMatch(),
        codex: () => this.show(new Codex(this.balance, () => this.mainMenu())),
        lab: () =>
          this.show(
            new PlaceholderScreen('연구소', 'RP·연구 데이터가 아직 없습니다 (C 대기).', () =>
              this.mainMenu(),
            ),
          ),
        online: () => {},
        settings: () =>
          this.show(
            new PlaceholderScreen('설정', '명세에 설정 항목이 정의되어 있지 않습니다.', () =>
              this.mainMenu(),
            ),
          ),
      }),
    );
  }

  private startMatch(): void {
    this.clearScreen();
    this.stopGame();

    // M1 3주차에 이 한 줄이 LocalSimAdapter로 바뀐다. 다른 곳은 손대지 않는다.
    const adapter = new FakeSimAdapter(this.balance);
    this.game = new Game(
      this.app,
      adapter,
      this.balance,
      (result) => this.showResult(result),
      () => this.mainMenu(),
    );
    this.game.start();
  }

  private showResult(result: MatchResult): void {
    this.show(
      new ResultScreen(
        result,
        () => this.startMatch(),
        () => this.mainMenu(),
      ),
    );
  }

  private stopGame(): void {
    this.game?.stop();
    this.game = null;
  }
}
