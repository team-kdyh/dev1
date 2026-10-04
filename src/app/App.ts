import type { Application } from 'pixi.js';
import { LocalSimAdapter, type LocalMatchOptions } from '../adapter/LocalSimAdapter';
import type { BalanceData } from '../sim/contracts';
import { Codex } from '../screens/Codex';
import { CampaignScreen, FactionScreen, ResearchScreen, type CampaignStage } from '../screens/ContentScreens';
import { loadProgress, saveProgress } from '../data/progress';
import { MainMenu, ResultScreen, SettingsScreen, Splash, type MatchResult } from '../screens/Screens';
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
        campaign: () => this.show(new CampaignScreen((stage) => this.startCampaign(stage), () => this.mainMenu())),
        quickMatch: () => this.show(new FactionScreen((faction) =>
          this.startMatch({ me: faction === 'semicon' ? 0 : 1 }), () => this.mainMenu())),
        codex: () => this.show(new Codex(this.balance, () => this.mainMenu())),
        lab: () => this.show(new ResearchScreen(() => this.mainMenu())),
        online: () => {},
        settings: () => this.show(new SettingsScreen(() => this.mainMenu())),
      }),
    );
  }

  private startCampaign(stage: CampaignStage): void {
    this.startMatch({
      me: stage.faction === 'semicon' ? 0 : 1,
      difficulty: stage.aiDifficulty as LocalMatchOptions['difficulty'],
      startCash: stage.rules.startCash,
      baseHp: stage.rules.baseHp,
      enemyBaseHp: stage.rules.enemyBaseHp,
      timeLimitSeconds: stage.rules.timeLimit,
      startAge: stage.rules.startAge,
      bannedUnits: stage.rules.bannedUnits,
    }, stage);
  }

  private startMatch(options: LocalMatchOptions = {}, stage?: CampaignStage): void {
    this.clearScreen();
    this.stopGame();

    const matchBalance: BalanceData = stage ? {
      ...this.balance,
      units: this.balance.units.map((unit) => ({
        ...unit,
        cost: Math.round(unit.cost * stage.rules.unitCostMod),
        buildMs: Math.round(unit.buildMs * stage.rules.productionCooldownMod),
        cooldownMs: Math.round(unit.cooldownMs * stage.rules.productionCooldownMod),
      })),
      cashPerSecond: this.balance.cashPerSecond * stage.rules.cashRateMod,
      upgrades: stage.rules.upgradesEnabled ? this.balance.upgrades : [],
    } : this.balance;
    const adapter = new LocalSimAdapter(matchBalance, 1337, { ...options, research: loadProgress().research });
    this.game = new Game(
      this.app,
      adapter,
      matchBalance,
      (result) => this.showResult(result, options, stage),
      () => this.mainMenu(),
    );
    this.game.start();
  }

  private showResult(result: MatchResult, options: LocalMatchOptions, stage?: CampaignStage): void {
    let finalResult = result;
    if (stage) {
      const progress = loadProgress();
      const firstClear = !progress.cleared.includes(stage.id);
      const rp = result.won ? stage.rewards.rp + (firstClear ? stage.rewards.firstClearRp : 0) : 0;
      if (result.won && firstClear) progress.cleared.push(stage.id);
      progress.rp += rp;
      saveProgress(progress);
      finalResult = { ...result, rp };
    }
    this.show(
      new ResultScreen(
        finalResult,
        () => this.startMatch(options, stage),
        () => this.mainMenu(),
      ),
    );
  }

  private stopGame(): void {
    this.game?.stop();
    this.game = null;
  }
}
