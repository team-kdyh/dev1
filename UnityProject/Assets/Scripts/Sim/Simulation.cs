using System;
using System.Collections.Generic;
using System.IO;

namespace TechWar.Sim
{
    public sealed class Simulation
    {
        public const int TicksPerSecond = 30;
        public const int InputDelay = 2;

        private sealed class Unit
        {
            public int Id, Owner, X, Hp, MoveRemainder, AttackCooldown, TargetId, SkillCooldownTicks;
            public UnitId Type;
            public string State = "move";
            public bool TargetBase;
            public readonly List<StatusEffect> Statuses = new List<StatusEffect>();
        }

        private sealed class Player
        {
            public int Cash, IncomeRemainder, Supply, ProductionRemaining, QueueRevision;
            public readonly List<UnitId> Queue = new List<UnitId>();
            public readonly int[] Cooldowns = new int[M0Balance.UnitCount];
        }

        private readonly Rng rng;
        private readonly List<Unit> units = new List<Unit>();
        private readonly List<TickInput> commands = new List<TickInput>();
        private readonly List<SimEvent> events = new List<SimEvent>();
        private readonly Player[] players = { new Player(), new Player() };
        private readonly int[] baseHp = new int[2];
        private readonly Faction[] factions = new Faction[2];
        private readonly int baseHpMax, timeLimitTicks;
        private int nextUnitId = 1;
        private bool over;
        private int? winner;

        public int Tick { get; private set; }

        public Simulation(uint seed, int baseHealth = 5000, int startCash = 300, int timeLimitSeconds = 480,
            Faction player0Faction = Faction.Semicon, Faction player1Faction = Faction.Orchard)
        {
            if (baseHealth <= 0) throw new ArgumentOutOfRangeException(nameof(baseHealth));
            if (startCash < 0 || startCash > M0Balance.CashMax) throw new ArgumentOutOfRangeException(nameof(startCash));
            if (timeLimitSeconds <= 0) throw new ArgumentOutOfRangeException(nameof(timeLimitSeconds));
            M0Balance.GetRoster(player0Faction);
            M0Balance.GetRoster(player1Faction);
            factions[0] = player0Faction;
            factions[1] = player1Faction;
            rng = new Rng(seed);
            baseHpMax = Fixed.FromInt(baseHealth);
            timeLimitTicks = checked(timeLimitSeconds * TicksPerSecond);
            for (var i = 0; i < 2; i++)
            {
                baseHp[i] = baseHpMax;
                players[i].Cash = Fixed.FromInt(startCash);
            }
        }

        public bool IsOver() => over;

        public void PushCommand(TickInput input)
        {
            if (input.PlayerId < 0 || input.PlayerId > 1) throw new ArgumentOutOfRangeException(nameof(input.PlayerId));
            if (input.Tick < Tick + InputDelay) throw new ArgumentOutOfRangeException(nameof(input.Tick), "Schedule at least Tick + 2.");
            if (!(input.Command is SpawnUnitCommand) && !(input.Command is CancelQueueCommand) &&
                !(input.Command is SurrenderCommand)) throw new ArgumentException("Unsupported M0 command.", nameof(input));
            if (over) return;
            // Stable within one player; caller order is the command log order for that player.
            var index = commands.Count;
            while (index > 0 && (commands[index - 1].Tick > input.Tick ||
                (commands[index - 1].Tick == input.Tick && commands[index - 1].PlayerId > input.PlayerId))) index--;
            commands.Insert(index, input);
        }

        public void Step()
        {
            if (over) return;
            events.Clear();
            while (commands.Count > 0 && commands[0].Tick == Tick)
            {
                var input = commands[0];
                commands.RemoveAt(0);
                Apply(input);
            }
            if (!over)
            {
                AddIncome();
                ProduceUnits();
                UpdateCooldowns();
                UpdateStatuses();
                RunSkills();
                SelectTargets();
                MoveUnits();
                Attack();
                // M1 skill triggers belong here, before death cleanup and rewards.
                RemoveDeadUnits();
                if (baseHp[0] == 0 || baseHp[1] == 0 || Tick + 1 >= timeLimitTicks)
                    Finish(baseHp[0] == baseHp[1] ? (int?)null : baseHp[0] > baseHp[1] ? 0 : 1);
            }
            Tick++;
        }

        private void Apply(TickInput input)
        {
            if (over) return;
            var player = players[input.PlayerId];
            if (input.Command is SurrenderCommand) { Finish(1 - input.PlayerId); return; }
            if (input.Command is CancelQueueCommand cancel)
            {
                if (cancel.ExpectedQueueRevision.HasValue && cancel.ExpectedQueueRevision.Value != player.QueueRevision)
                { Reject(input.PlayerId, "QUEUE_CHANGED"); return; }
                if (cancel.Index < 0 || cancel.Index >= player.Queue.Count) { Reject(input.PlayerId, "INVALID_QUEUE_INDEX"); return; }
                var stats = M0Balance.Get(player.Queue[cancel.Index]);
                player.Cash = Math.Min(Fixed.FromInt(M0Balance.CashMax), player.Cash + Fixed.FromInt(stats.Cost) * 4 / 5);
                player.Supply -= stats.Supply;
                player.Queue.RemoveAt(cancel.Index);
                player.QueueRevision++;
                if (cancel.Index == 0) player.ProductionRemaining = player.Queue.Count == 0 ? 0 : M0Balance.Get(player.Queue[0]).ProductionTicks;
                return;
            }
            var type = ((SpawnUnitCommand)input.Command).UnitId;
            if ((int)type < 0 || (int)type >= M0Balance.UnitCount) { Reject(input.PlayerId, "UNKNOWN_UNIT"); return; }
            if (M0Balance.GetFaction(type) != factions[input.PlayerId]) { Reject(input.PlayerId, "WRONG_FACTION"); return; }
            var definition = M0Balance.Get(type);
            string reason = player.Queue.Count >= M0Balance.QueueMax ? "QUEUE_FULL" :
                player.Cooldowns[(int)type] > 0 ? "ON_COOLDOWN" :
                player.Cash < Fixed.FromInt(definition.Cost) ? "NO_CASH" :
                player.Supply + definition.Supply > M0Balance.SupplyMax ? "NO_SUPPLY" : null;
            if (reason != null) { Reject(input.PlayerId, reason); return; }
            player.Cash -= Fixed.FromInt(definition.Cost);
            player.Supply += definition.Supply; // Queue entries reserve population too.
            player.Queue.Add(type);
            player.QueueRevision++;
            player.Cooldowns[(int)type] = definition.ProductionTicks;
            if (player.Queue.Count == 1) player.ProductionRemaining = definition.ProductionTicks;
        }

        private void Reject(int player, string reason) => events.Add(new SimEvent { Type = "rejected", Player = player, Reason = reason });

        private void AddIncome()
        {
            foreach (var player in players)
            {
                player.IncomeRemainder += Fixed.FromInt(M0Balance.IncomePerSecond);
                player.Cash = Math.Min(Fixed.FromInt(M0Balance.CashMax), player.Cash + player.IncomeRemainder / TicksPerSecond);
                player.IncomeRemainder %= TicksPerSecond;
            }
        }

        private void ProduceUnits()
        {
            for (var owner = 0; owner < 2; owner++)
            {
                var player = players[owner];
                if (player.Queue.Count == 0) continue;
                if (player.ProductionRemaining > 0) player.ProductionRemaining--;
                var x = Fixed.FromInt(owner == 0 ? 60 : 940);
                if (player.ProductionRemaining > 0 || units.Exists(u => u.Hp > 0 &&
                    Math.Abs(u.X - x) < Fixed.FromInt(M0Balance.Radius * 2))) continue;
                var type = player.Queue[0];
                var unit = new Unit
                {
                    Id = nextUnitId++, Owner = owner, X = x, Type = type,
                    Hp = Fixed.FromInt(M0Balance.Get(type).Hp),
                    SkillCooldownTicks = type == UnitId.Medic ? M0Balance.MedicHealIntervalTicks : 0
                };
                units.Add(unit);
                events.Add(new SimEvent { Type = "spawn", UnitType = type, Player = owner, Unit = unit.Id, X = x / (double)Fixed.Scale });
                player.Queue.RemoveAt(0);
                player.QueueRevision++;
                player.ProductionRemaining = player.Queue.Count == 0 ? 0 : M0Balance.Get(player.Queue[0]).ProductionTicks;
            }
        }

        private void UpdateCooldowns()
        {
            foreach (var player in players)
                for (var i = 0; i < player.Cooldowns.Length; i++)
                    if (player.Cooldowns[i] > 0) player.Cooldowns[i]--;
            foreach (var unit in units)
                if (unit.AttackCooldown > 0) unit.AttackCooldown--;
        }

        private void UpdateStatuses()
        {
            foreach (var unit in units)
            {
                for (var i = unit.Statuses.Count - 1; i >= 0; i--)
                {
                    if (unit.Statuses[i].RemainingTicks > 0) unit.Statuses[i].RemainingTicks--;
                    if (unit.Statuses[i].RemainingTicks <= 0) unit.Statuses.RemoveAt(i);
                }
                if (unit.SkillCooldownTicks > 0) unit.SkillCooldownTicks--;
            }
        }

        private void RunSkills()
        {
            foreach (var medic in units)
            {
                if (medic.Hp <= 0 || medic.Type != UnitId.Medic || medic.SkillCooldownTicks > 0) continue;
                medic.SkillCooldownTicks = M0Balance.MedicHealIntervalTicks;
                var range = Fixed.FromInt(M0Balance.MedicHealRange);
                var targets = units.FindAll(unit => unit.Hp > 0 && unit.Owner == medic.Owner &&
                    unit.Hp < Fixed.FromInt(M0Balance.Get(unit.Type).Hp) && Math.Abs(unit.X - medic.X) <= range);
                targets.Sort((left, right) =>
                {
                    var leftMax = Fixed.FromInt(M0Balance.Get(left.Type).Hp);
                    var rightMax = Fixed.FromInt(M0Balance.Get(right.Type).Hp);
                    var health = ((long)left.Hp * rightMax).CompareTo((long)right.Hp * leftMax);
                    if (health != 0) return health;
                    var distance = Math.Abs(left.X - medic.X).CompareTo(Math.Abs(right.X - medic.X));
                    return distance != 0 ? distance : left.Id.CompareTo(right.Id);
                });
                for (var i = 0; i < Math.Min(M0Balance.MedicHealTargets, targets.Count); i++)
                    ApplyHeal(medic, targets[i], Fixed.FromInt(M0Balance.MedicHealAmount));
            }
        }

        private void ApplyHeal(Unit source, Unit target, int amount)
        {
            var maximum = Fixed.FromInt(M0Balance.Get(target.Type).Hp);
            var actual = Math.Min(amount, maximum - target.Hp);
            if (actual <= 0) return;
            target.Hp += actual;
            events.Add(new SimEvent
            {
                Type = "heal", UnitType = source.Type, Player = source.Owner,
                Unit = source.Id, Target = target.Id, Damage = actual / (double)Fixed.Scale,
                X = target.X / (double)Fixed.Scale
            });
        }

        private void SelectTargets()
        {
            foreach (var unit in units)
            {
                unit.TargetId = 0; unit.TargetBase = false;
                var nearest = int.MaxValue;
                var range = Fixed.FromInt(M0Balance.Get(unit.Type).Range);
                foreach (var enemy in units)
                {
                    if (enemy.Owner == unit.Owner || enemy.Hp <= 0) continue;
                    var distance = Math.Abs(enemy.X - unit.X);
                    if (distance > range || distance >= nearest) continue;
                    nearest = distance;
                    unit.TargetId = enemy.Id;
                }
                if (unit.TargetId == 0) unit.TargetBase = BaseDistance(unit) <= range;
            }
        }

        private static int BaseDistance(Unit unit) => unit.Owner == 0 ? Fixed.FromInt(M0Balance.LaneLength) - unit.X : unit.X;

        private void MoveUnits()
        {
            // ponytail: O(n^2) neighbour scans suit the M0 population cap; index only after profiling.
            foreach (var unit in units)
            {
                unit.State = unit.TargetId != 0 || unit.TargetBase ? "attack" : "move";
                if (unit.State == "attack") continue;
                var direction = unit.Owner == 0 ? 1 : -1;
                unit.MoveRemainder += Fixed.FromInt(M0Balance.Get(unit.Type).Speed);
                var distance = unit.MoveRemainder / TicksPerSecond;
                unit.MoveRemainder %= TicksPerSecond;
                distance = Math.Min(distance, BaseDistance(unit));
                foreach (var other in units)
                {
                    if (other.Id == unit.Id || other.Hp <= 0) continue;
                    var ahead = (other.X - unit.X) * direction;
                    if (ahead < 0 || (ahead == 0 && other.Owner == unit.Owner && other.Id > unit.Id)) continue;
                    distance = Math.Min(distance, Math.Max(0, ahead - Fixed.FromInt(M0Balance.Radius * 2)));
                }
                unit.X += direction * distance;
            }
        }

        private void Attack()
        {
            foreach (var unit in units)
            {
                if (unit.Hp <= 0 || unit.AttackCooldown > 0) continue;
                var target = unit.TargetId == 0 ? null : units.Find(u => u.Id == unit.TargetId && u.Hp > 0);
                if (target == null && !unit.TargetBase) continue;
                var stats = M0Balance.Get(unit.Type);
                var targetArmor = target == null ? ArmorClass.Structure : M0Balance.Get(target.Type).ArmorClass;
                var multiplier = M0Balance.GetDamageMultiplier(stats.DamageType, targetArmor);
                var armor = target == null ? 0 : Fixed.FromInt(M0Balance.Get(target.Type).Armor);
                var damage = Math.Max(Fixed.Scale, Fixed.Mul(Fixed.FromInt(stats.Attack), multiplier) - armor);
                unit.AttackCooldown = stats.AttackTicks;
                if (target == null)
                {
                    var owner = 1 - unit.Owner;
                    if (baseHp[owner] <= 0) continue;
                    var actual = Math.Min(damage, baseHp[owner]);
                    baseHp[owner] -= actual;
                    events.Add(new SimEvent { Type = "baseHit", Player = owner, Unit = unit.Id, Damage = actual / (double)Fixed.Scale });
                }
                else
                {
                    var actual = Math.Min(damage, target.Hp);
                    target.Hp -= actual;
                    events.Add(new SimEvent { Type = "hit", Player = target.Owner, Unit = unit.Id, Target = target.Id, Damage = actual / (double)Fixed.Scale, X = target.X / (double)Fixed.Scale });
                    if (target.Hp == 0)
                        events.Add(new SimEvent { Type = "kill", Player = unit.Owner, Unit = unit.Id, Target = target.Id, X = target.X / (double)Fixed.Scale });
                }
            }
        }

        private void RemoveDeadUnits()
        {
            foreach (var unit in units)
            {
                if (unit.Hp > 0) continue;
                var stats = M0Balance.Get(unit.Type);
                players[unit.Owner].Supply -= stats.Supply;
                var opponent = players[1 - unit.Owner];
                opponent.Cash = Math.Min(Fixed.FromInt(M0Balance.CashMax), opponent.Cash + Fixed.FromInt(stats.Cost) * 2 / 5);
            }
            units.RemoveAll(u => u.Hp <= 0); // Stable order; no swap-remove.
        }

        private void Finish(int? result)
        {
            over = true; winner = result;
            events.Add(new SimEvent { Type = "gameOver", Winner = result });
        }

        public Snapshot GetSnapshot()
        {
            var snapshot = new Snapshot { Tick = Tick, IsOver = over, Winner = winner, Checksum = GetChecksum() };
            for (var i = 0; i < 2; i++)
            {
                snapshot.Bases[i].Hp = baseHp[i] / (double)Fixed.Scale;
                snapshot.Bases[i].HpMax = baseHpMax / (double)Fixed.Scale;
                var player = players[i];
                var view = snapshot.Players[i];
                view.Cash = player.Cash / (double)Fixed.Scale;
                view.Supply = player.Supply; view.SupplyMax = M0Balance.SupplyMax;
                view.Queue = player.Queue.ToArray();
                view.QueueRevision = player.QueueRevision;
                view.QueueProgress = player.Queue.Count == 0 ? 0 : 1 - player.ProductionRemaining / (double)M0Balance.Get(player.Queue[0]).ProductionTicks;
                for (var j = 0; j < player.Cooldowns.Length; j++) view.Cooldowns[j] = player.Cooldowns[j] / (double)TicksPerSecond;
            }
            foreach (var unit in units)
                snapshot.Units.Add(new UnitView { Id = unit.Id, UnitId = unit.Type, Owner = unit.Owner,
                    X = unit.X / (double)Fixed.Scale, Hp = unit.Hp / (double)Fixed.Scale,
                    HpMax = M0Balance.Get(unit.Type).Hp, State = unit.State, Facing = unit.Owner == 0 ? 1 : -1,
                    SkillCooldownTicks = unit.SkillCooldownTicks,
                    Buffs = unit.Statuses.ConvertAll(status => status.Kind.ToString()).ToArray() });
            foreach (var e in events)
                snapshot.Events.Add(new SimEvent { Type = e.Type, UnitType = e.UnitType, Player = e.Player, Unit = e.Unit, Target = e.Target,
                    Damage = e.Damage, X = e.X, Reason = e.Reason, Winner = e.Winner });
            return snapshot;
        }

        public string GetChecksum()
        {
            // BinaryWriter fixes integer byte order to little endian. Hash future-affecting state, not just views.
            using (var buffer = new MemoryStream())
            using (var writer = new BinaryWriter(buffer))
            {
                writer.Write(Contracts.Version); writer.Write(M0Balance.Version);
                writer.Write(Tick); writer.Write(nextUnitId); writer.Write(over); writer.Write(winner ?? -1);
                writer.Write(baseHpMax); writer.Write(timeLimitTicks);
                writer.Write((int)factions[0]); writer.Write((int)factions[1]);
                rng.WriteState(writer);
                for (var i = 0; i < 2; i++)
                {
                    writer.Write(baseHp[i]);
                    var player = players[i];
                    writer.Write(player.Cash); writer.Write(player.IncomeRemainder); writer.Write(player.Supply);
                    writer.Write(player.ProductionRemaining); writer.Write(player.QueueRevision); writer.Write(player.Queue.Count);
                    foreach (var type in player.Queue) writer.Write((int)type);
                    foreach (var cooldown in player.Cooldowns) writer.Write(cooldown);
                }
                writer.Write(units.Count);
                foreach (var unit in units)
                {
                    writer.Write(unit.Id); writer.Write((int)unit.Type); writer.Write(unit.Owner);
                    writer.Write(unit.X); writer.Write(unit.Hp); writer.Write(unit.MoveRemainder);
                    writer.Write(unit.AttackCooldown); writer.Write(unit.TargetId); writer.Write(unit.TargetBase); writer.Write(unit.State);
                    writer.Write(unit.SkillCooldownTicks);
                    writer.Write(unit.Statuses.Count);
                    foreach (var status in unit.Statuses)
                    {
                        writer.Write((int)status.Kind);
                        writer.Write(status.RemainingTicks);
                        writer.Write(status.Magnitude);
                        writer.Write(status.SourceId);
                    }
                }
                writer.Write(commands.Count);
                foreach (var input in commands)
                {
                    writer.Write(input.Tick); writer.Write(input.PlayerId);
                    if (input.Command is SpawnUnitCommand spawn) { writer.Write(0); writer.Write((int)spawn.UnitId); }
                    else if (input.Command is CancelQueueCommand cancel)
                    {
                        writer.Write(1); writer.Write(cancel.Index);
                        writer.Write(cancel.ExpectedQueueRevision.HasValue);
                        if (cancel.ExpectedQueueRevision.HasValue) writer.Write(cancel.ExpectedQueueRevision.Value);
                    }
                    else writer.Write(2);
                }
                writer.Flush();
                var hash = 2166136261u;
                foreach (var value in buffer.ToArray()) hash = unchecked((hash ^ value) * 16777619u);
                return hash.ToString("X8");
            }
        }
    }
}
