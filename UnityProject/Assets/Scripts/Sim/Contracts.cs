using System.Collections.Generic;

namespace TechWar.Sim
{
    public static class Contracts
    {
        // Local Unity draft; not the team's ratified TypeScript 1.0.0 contract.
        public const string Version = "0.5.0-unity-orchard-basic-draft";
    }

    public enum Faction { Semicon, Orchard }

    public enum UnitId
    {
        // Keep the original three IDs stable; display order comes from M0Balance.SemiconUnits.
        Bud = 0,
        Scout = 1,
        Siege = 2,
        Medic = 3,
        Sniper = 4,
        Fold = 5,
        Workstation = 6,
        Assistant = 7,
        Chairman = 8,
        AirPodsDuo = 9,
        WatchTrainer = 10,
        PhoneBasic = 11,
        PhonePro = 12,
        PadShield = 13,
        VisionHeadset = 14,
        AirNotebook = 15,
        ProNotebook = 16,
        Founder = 17
    }

    public interface ICommand { }

    public sealed class SpawnUnitCommand : ICommand
    {
        public readonly UnitId UnitId;
        public SpawnUnitCommand(UnitId unitId) => UnitId = unitId;
    }

    public sealed class CancelQueueCommand : ICommand
    {
        public readonly int Index;
        public readonly int? ExpectedQueueRevision;
        public CancelQueueCommand(int index, int? expectedQueueRevision = null)
        {
            Index = index;
            ExpectedQueueRevision = expectedQueueRevision;
        }
    }

    public sealed class SurrenderCommand : ICommand { }

    public readonly struct TickInput
    {
        // Requested execution tick. The caller supplies simulation.Tick + 2.
        public readonly int Tick;
        public readonly int PlayerId;
        public readonly ICommand Command;

        public TickInput(int tick, int playerId, ICommand command)
        {
            Tick = tick;
            PlayerId = playerId;
            Command = command;
        }
    }

    public sealed class Snapshot
    {
        public int Tick;
        public readonly List<UnitView> Units = new List<UnitView>();
        public readonly BaseView[] Bases = { new BaseView(), new BaseView() };
        public readonly PlayerView[] Players = { new PlayerView(), new PlayerView() };
        public readonly List<SimEvent> Events = new List<SimEvent>();
        public bool IsOver;
        public int? Winner;
        public string Checksum = string.Empty;
    }

    public sealed class UnitView
    {
        public int Id;
        public UnitId UnitId;
        public int Owner;
        public double X;
        public double Hp;
        public double HpMax;
        public string State;
        public int Facing;
        public string[] Buffs = new string[0];
        public int SkillCooldownTicks;
    }

    public sealed class BaseView
    {
        public double Hp = 5000;
        public double HpMax = 5000;
    }

    public sealed class PlayerView
    {
        public double Cash;
        public int Supply;
        public int SupplyMax;
        public UnitId[] Queue = new UnitId[0];
        public int QueueRevision;
        public double QueueProgress;
        public double[] Cooldowns = new double[M0Balance.UnitCount];
    }

    public sealed class SimEvent
    {
        public string Type;
        public UnitId UnitType; // Used by spawn events, even if the unit dies in the same tick.
        public int Player;
        public int Unit;
        public int Target;
        public double Damage;
        public double X;
        public string Reason;
        public int? Winner;
    }
}
