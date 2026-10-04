import artUnitsSource from '../../assets/units.json';

export interface ArtUnitDefinition {
  id: string;
  faction: 'semicon' | 'orchard';
  tier: number;
  name: string;
  shape: string;
}

/**
 * C의 게임플레이 ID를 D의 배포 에셋 ID로 연결한다.
 * 이름이 다른 8종만 명시하고, 나머지는 같은 ID를 그대로 사용한다.
 */
export const UNIT_ASSET_ALIASES: Readonly<Record<string, string>> = {
  semicon_t3_aphone: 'semicon_t3_aphone_soldier',
  semicon_t7_book_station: 'semicon_t7_workstation',
  semicon_t9_chairman: 'semicon_t9_trifold',
  orchard_t1_airpods: 'orchard_t1_airpod_duo',
  orchard_t5_pad_shield: 'orchard_t5_pad_guard',
  orchard_t7_air_notebook: 'orchard_t7_air_laptop',
  orchard_t8_pro_notebook: 'orchard_t8_pro_laptop',
  orchard_t9_founder: 'orchard_t9_imac',
};

export const ART_UNITS = artUnitsSource as ArtUnitDefinition[];
const ART_UNIT_IDS = new Set(ART_UNITS.map((unit) => unit.id));

export function resolveAssetUnitId(gameplayId: string): string {
  return UNIT_ASSET_ALIASES[gameplayId] ?? gameplayId;
}

export function hasUnitArt(gameplayId: string): boolean {
  return ART_UNIT_IDS.has(resolveAssetUnitId(gameplayId));
}
