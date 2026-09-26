using System;
using System.Collections.Generic;

namespace TechWar.Sim
{
    public enum DamageType { Melee, Ranged, Siege, Magic }
    public enum ArmorClass { Light, Heavy, Structure }

    // 두 진영의 기본 공격 데이터. 고유 스킬과 시대 해금은 별도 단계입니다.
    public static class M0Balance
    {
        public const string Version = "semicon-orchard-basic-0.2";
        public const int LaneLength = 1000;
        public const int SupplyMax = 12;
        public const int QueueMax = 5;
        public const int IncomePerSecond = 8;
        public const int CashMax = 9999;
        public const int Radius = 10;
        public const int MedicHealRange = 100;
        public const int MedicHealAmount = 6;
        public const int MedicHealTargets = 3;
        public const int MedicHealIntervalTicks = 30;

        // 이곳의 수치는 직접 수정해도 됩니다. 자동으로 명세 값으로 복구하지 않습니다.
        // cost: 가격 / supply: 인구 / hp: 체력 / armor: 방어력 / attack: 1회 공격력
        // range: 공격 사거리 / speed: 초당 이동거리
        // productionTicks: 생산시간 및 재생산 쿨다운 / attackTicks: 공격 간격 (30틱 = 1초)
        // 기존 Bud/Scout/Siege 수치는 유지했습니다. 배열은 UnitId 순서이며, 화면은 Tier 순서입니다.
        // 명세에 없는 시간·방어 분류는 임시값입니다. Fold의 0.8회/초는 정수 틱 38로 근사합니다.
        private static readonly UnitStats[] Units =
        {
            // T1 — 기존 근접 유닛. 쌍둥이 스폰은 고유 스킬 단계에서 추가합니다.
            new UnitStats(name: "버즈 트윈스", tier: 1, damageType: DamageType.Melee, armorClass: ArmorClass.Light,
                cost: 60, supply: 1, productionTicks: 30, hp: 180, armor: 0,
                attack: 14, attackTicks: 30, range: 20, speed: 95),
            // T3 — 기존 원거리 유닛.
            new UnitStats(name: "A폰 보병", tier: 3, damageType: DamageType.Ranged, armorClass: ArmorClass.Light,
                cost: 140, supply: 1, productionTicks: 42, hp: 200, armor: 0,
                attack: 22, attackTicks: 30, range: 160, speed: 70),
            // T6 — 기존 공성 유닛. 기존 가격 260을 유지합니다(전체 명세의 가격은 380).
            new UnitStats(name: "탭 포병", tier: 6, damageType: DamageType.Siege, armorClass: ArmorClass.Heavy,
                cost: 260, supply: 2, productionTicks: 90, hp: 340, armor: 8,
                attack: 48, attackTicks: 45, range: 230, speed: 50),
            // T2 — 기본 마법 공격에 더해 워치 메딕 회복이 적용됩니다.
            new UnitStats(name: "워치 메딕", tier: 2, damageType: DamageType.Magic, armorClass: ArmorClass.Light,
                cost: 120, supply: 1, productionTicks: 60, hp: 220, armor: 0,
                attack: 8, attackTicks: 30, range: 60, speed: 85),
            // T4 — 후방 우선 타겟팅과 치명타는 미구현입니다.
            new UnitStats(name: "S폰 저격수", tier: 4, damageType: DamageType.Ranged, armorClass: ArmorClass.Light,
                cost: 260, supply: 2, productionTicks: 90, hp: 260, armor: 0,
                attack: 55, attackTicks: 45, range: 260, speed: 60),
            // T5 — 기본 근접 탱커. 접힘/펼침 전환과 광역 공격은 미구현입니다.
            new UnitStats(name: "폴드 방패병", tier: 5, damageType: DamageType.Melee, armorClass: ArmorClass.Heavy,
                cost: 320, supply: 2, productionTicks: 120, hp: 900, armor: 12,
                attack: 30, attackTicks: 38, range: 25, speed: 55),
            // T7 — 설치 고정과 아군 강화 없이 이동하고 기본 포격합니다.
            new UnitStats(name: "북 워크스테이션", tier: 7, damageType: DamageType.Siege, armorClass: ArmorClass.Heavy,
                cost: 520, supply: 3, productionTicks: 150, hp: 700, armor: 0,
                attack: 70, attackTicks: 60, range: 300, speed: 40),
            // T8 — 적 약화/스킬 봉인 없이 기본 마법 공격합니다.
            new UnitStats(name: "AI 어시스턴트", tier: 8, damageType: DamageType.Magic, armorClass: ArmorClass.Light,
                cost: 600, supply: 2, productionTicks: 180, hp: 420, armor: 0,
                attack: 30, attackTicks: 45, range: 200, speed: 65),
            // T9 — 강화/소환/진영 전환 없이 기본 마법 공격합니다.
            new UnitStats(name: "회장", tier: 9, damageType: DamageType.Magic, armorClass: ArmorClass.Heavy,
                cost: 1600, supply: 3, productionTicks: 240, hp: 2600, armor: 0,
                attack: 120, attackTicks: 60, range: 90, speed: 50),
            // 오차드 T1~T9. 명세에 없는 생산·공격 간격 및 방어력은 임시값입니다.
            new UnitStats(name: "에어팟 듀오", tier: 1, damageType: DamageType.Melee, armorClass: ArmorClass.Light,
                cost: 65, supply: 1, productionTicks: 30, hp: 160, armor: 0,
                attack: 16, attackTicks: 30, range: 20, speed: 105),
            new UnitStats(name: "워치 트레이너", tier: 2, damageType: DamageType.Magic, armorClass: ArmorClass.Light,
                cost: 130, supply: 1, productionTicks: 60, hp: 210, armor: 0,
                attack: 10, attackTicks: 30, range: 70, speed: 90),
            new UnitStats(name: "폰 기본형", tier: 3, damageType: DamageType.Ranged, armorClass: ArmorClass.Light,
                cost: 150, supply: 1, productionTicks: 54, hp: 190, armor: 0,
                attack: 26, attackTicks: 30, range: 170, speed: 68),
            new UnitStats(name: "폰 프로", tier: 4, damageType: DamageType.Ranged, armorClass: ArmorClass.Light,
                cost: 280, supply: 2, productionTicks: 90, hp: 240, armor: 0,
                attack: 62, attackTicks: 45, range: 250, speed: 62),
            new UnitStats(name: "패드 방패병", tier: 5, damageType: DamageType.Melee, armorClass: ArmorClass.Heavy,
                cost: 330, supply: 2, productionTicks: 120, hp: 850, armor: 12,
                attack: 36, attackTicks: 38, range: 30, speed: 58),
            new UnitStats(name: "비전 헤드셋", tier: 6, damageType: DamageType.Magic, armorClass: ArmorClass.Light,
                cost: 420, supply: 2, productionTicks: 120, hp: 380, armor: 0,
                attack: 34, attackTicks: 45, range: 140, speed: 60),
            new UnitStats(name: "에어 노트북", tier: 7, damageType: DamageType.Siege, armorClass: ArmorClass.Heavy,
                cost: 500, supply: 2, productionTicks: 150, hp: 520, armor: 0,
                attack: 66, attackTicks: 60, range: 240, speed: 72),
            new UnitStats(name: "프로 노트북", tier: 8, damageType: DamageType.Siege, armorClass: ArmorClass.Heavy,
                cost: 640, supply: 3, productionTicks: 180, hp: 820, armor: 8,
                attack: 95, attackTicks: 60, range: 290, speed: 38),
            new UnitStats(name: "창업자", tier: 9, damageType: DamageType.Magic, armorClass: ArmorClass.Heavy,
                cost: 1700, supply: 3, productionTicks: 240, hp: 2400, armor: 0,
                attack: 100, attackTicks: 60, range: 200, speed: 52)
        };

        public static int UnitCount => Units.Length;

        public static readonly IReadOnlyList<UnitId> SemiconUnits = Array.AsReadOnly(new[]
        {
            UnitId.Bud, UnitId.Medic, UnitId.Scout, UnitId.Sniper, UnitId.Fold,
            UnitId.Siege, UnitId.Workstation, UnitId.Assistant, UnitId.Chairman
        });

        public static readonly IReadOnlyList<UnitId> OrchardUnits = Array.AsReadOnly(new[]
        {
            UnitId.AirPodsDuo, UnitId.WatchTrainer, UnitId.PhoneBasic, UnitId.PhonePro,
            UnitId.PadShield, UnitId.VisionHeadset, UnitId.AirNotebook, UnitId.ProNotebook, UnitId.Founder
        });

        public static IReadOnlyList<UnitId> GetRoster(Faction faction) => faction == Faction.Semicon ? SemiconUnits :
            faction == Faction.Orchard ? OrchardUnits : throw new ArgumentOutOfRangeException(nameof(faction));

        public static Faction GetFaction(UnitId id)
        {
            if ((int)id < 0 || (int)id >= Units.Length) throw new ArgumentOutOfRangeException(nameof(id));
            return (int)id < 9 ? Faction.Semicon : Faction.Orchard;
        }

        // 피해 계수 ×1000. 열: 경장갑 / 중장갑 / 구조물.
        private static readonly int[,] DamageMultipliers =
        {
            { 1000, 800, 600 },  // 근접
            { 1200, 700, 500 },  // 원거리
            { 600, 1400, 2000 }, // 공성
            { 1000, 1000, 800 }  // 마법
        };

        public static int GetDamageMultiplier(DamageType damageType, ArmorClass armorClass) =>
            DamageMultipliers[(int)damageType, (int)armorClass];

        public static UnitStats Get(UnitId id)
        {
            if ((int)id < 0 || (int)id >= Units.Length) throw new ArgumentOutOfRangeException(nameof(id));
            return Units[(int)id];
        }
    }

    public sealed class UnitStats
    {
        public readonly string Name;
        public readonly int Tier;
        public readonly DamageType DamageType;
        public readonly ArmorClass ArmorClass;
        public readonly int Cost, Supply, ProductionTicks, Hp, Armor, Attack, AttackTicks, Range, Speed;

        internal UnitStats(string name, int tier, DamageType damageType, ArmorClass armorClass,
            int cost, int supply, int productionTicks, int hp, int armor,
            int attack, int attackTicks, int range, int speed)
        {
            Name = name; Tier = tier; DamageType = damageType; ArmorClass = armorClass;
            Cost = cost; Supply = supply; ProductionTicks = productionTicks;
            Hp = hp; Armor = armor; Attack = attack;
            AttackTicks = attackTicks; Range = range; Speed = speed;
        }
    }
}
