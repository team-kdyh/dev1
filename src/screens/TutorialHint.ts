import type { BalanceData, PlayerId, SimEvent } from '../sim/contracts';
import { button, el, uiRoot } from './dom';

const HINTS: Record<string, string> = {
  spawn_melee: '하단 첫 번째 카드를 눌러 근접 유닛을 생산하세요. 숫자키 1도 사용할 수 있습니다.',
  unit_counters: '근접 유닛 뒤에 세 번째 원거리 유닛을 배치해 전선을 밀어 보세요.',
  unit_synergy: '두 번째 지원 유닛과 세 번째 원거리 유닛을 함께 생산해 보세요.',
  age_up: '캐시를 모으고 누적 수급 조건을 채운 뒤 E 버튼으로 다음 시대로 발전하세요.',
};

/** 캠페인 목표를 방해하지 않는 작은 안내. 실제 명령 성공 이벤트가 오면 닫힌다. */
export class TutorialHint {
  private readonly root = el('aside', 'sw-tutorial');
  private readonly produced = new Set<number>();

  constructor(
    private readonly focus: string,
    private readonly me: PlayerId,
    private readonly balance: BalanceData,
  ) {
    this.root.setAttribute('aria-live', 'polite');
    this.root.append(el('strong', undefined, '전투 안내'), el('span', undefined, HINTS[focus] ?? '상대 본진을 파괴하세요.'));
    const close = button('닫기', () => this.hide());
    close.setAttribute('aria-label', '전투 안내 닫기');
    this.root.append(close);
  }

  mount(): void { uiRoot().append(this.root); }
  hide(): void { this.root.remove(); }

  handle(events: readonly SimEvent[]): void {
    for (const event of events) {
      if (event.type === 'gameOver') { this.hide(); return; }
      if (event.type === 'ageup' && event.owner === this.me && this.focus === 'age_up') {
        this.hide(); return;
      }
      if (event.type !== 'spawn' || event.owner !== this.me) continue;
      const tier = this.balance.units.find((unit) => unit.id === event.defId)?.tier;
      if (tier === undefined) continue;
      this.produced.add(tier);
      if (this.focus === 'spawn_melee' && tier === 1 ||
          this.focus === 'unit_counters' && this.produced.has(1) && this.produced.has(3) ||
          this.focus === 'unit_synergy' && this.produced.has(2) && this.produced.has(3)) {
        this.hide(); return;
      }
    }
  }
}
