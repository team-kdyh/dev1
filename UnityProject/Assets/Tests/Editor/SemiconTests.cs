using NUnit.Framework;
using TechWar.Sim;

namespace TechWar.Tests
{
    public sealed class SemiconTests
    {
        [Test]
        public void AllNineUnitsCanReserveAndCancelProduction()
        {
            for (var id = 0; id < 9; id++)
            {
                var type = (UnitId)id;
                var simulation = new Simulation(123, startCash: 5000);
                simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(type)));
                for (var tick = 0; tick < 3; tick++) simulation.Step();
                var player = simulation.GetSnapshot().Players[0];
                Assert.That(player.Queue, Is.EqualTo(new[] { type }), "Unit " + id);
                var stats = M0Balance.Get(type);
                Assert.That(player.Supply, Is.EqualTo(stats.Supply));
                Assert.That(player.Cash, Is.EqualTo(5000.8 - stats.Cost).Within(0.001));
                Assert.That(player.Cooldowns[id], Is.GreaterThan(0));

                simulation.PushCommand(new TickInput(5, 0, new CancelQueueCommand(0, player.QueueRevision)));
                for (var tick = 0; tick < 3; tick++) simulation.Step();
                player = simulation.GetSnapshot().Players[0];
                Assert.That(player.Queue, Is.Empty);
                Assert.That(player.Supply, Is.Zero);
                Assert.That(player.Cash, Is.EqualTo(5001.6 - stats.Cost * 0.2).Within(0.001));
            }
        }

        [Test]
        public void AllNineUnitsSpawnMoveAndAttackAtTheirConfiguredInterval()
        {
            for (var id = 0; id < 9; id++)
            {
                var simulation = new Simulation(123, startCash: 5000);
                var type = (UnitId)id;
                simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(type)));
                var spawned = false;
                var moved = false;
                var firstHit = -1;
                var secondHit = -1;
                for (var tick = 0; tick < 3000 && secondHit < 0; tick++)
                {
                    simulation.Step();
                    var view = simulation.GetSnapshot();
                    foreach (var unit in view.Units)
                    {
                        spawned = true;
                        Assert.That(unit.UnitId, Is.EqualTo(type));
                        Assert.That(unit.Hp, Is.EqualTo(M0Balance.Get(type).Hp));
                        moved |= unit.X > 60;
                    }
                    foreach (var e in view.Events)
                    {
                        if (e.Type != "baseHit") continue;
                        Assert.That(e.Damage, Is.GreaterThan(0));
                        Assert.That(1000 - view.Units[0].X, Is.LessThanOrEqualTo(M0Balance.Get(type).Range));
                        if (firstHit < 0) firstHit = view.Tick;
                        else secondHit = view.Tick;
                    }
                }
                Assert.That(spawned, Is.True, "Unit " + id + " did not spawn.");
                Assert.That(moved, Is.True, "Unit " + id + " did not advance.");
                Assert.That(secondHit, Is.GreaterThan(firstHit), "Unit " + id + " did not attack twice.");
                Assert.That(secondHit - firstHit, Is.EqualTo(M0Balance.Get(type).AttackTicks));
            }
        }

        [Test]
        public void NinthUnitCooldownIsValidatedAndSnapshotIsIsolated()
        {
            var simulation = new Simulation(123, startCash: 5000);
            var type = (UnitId)8;
            var input = new TickInput(2, 0, new SpawnUnitCommand(type));
            simulation.PushCommand(input);
            simulation.PushCommand(input);
            for (var tick = 0; tick < 3; tick++) simulation.Step();
            var snapshot = simulation.GetSnapshot();
            Assert.That(snapshot.Players[0].Cooldowns.Length, Is.EqualTo(18));
            Assert.That(snapshot.Events.Exists(e => e.Reason == "ON_COOLDOWN"), Is.True);
            Assert.That(snapshot.Players[0].Queue.Length, Is.EqualTo(1));
            var checksum = simulation.GetChecksum();
            snapshot.Players[0].Cooldowns[8] = 0;
            Assert.That(simulation.GetChecksum(), Is.EqualTo(checksum));
            Assert.That(simulation.GetSnapshot().Players[0].Cooldowns[8], Is.GreaterThan(0));
        }

        [Test]
        public void NewUnitsUseTheirDamageTypeAgainstStructures()
        {
            // IDs retain the original three values. Medic, sniper, fold, workstation, assistant, chairman follow.
            var multipliers = new[] { 0.8, 0.5, 0.6, 2.0, 0.8, 0.8 };
            for (var id = 3; id < 9; id++)
            {
                var simulation = new Simulation(123, startCash: 5000, player1Faction: Faction.Semicon);
                var type = (UnitId)id;
                simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(type)));
                SimEvent hit = null;
                for (var tick = 0; tick < 3000 && hit == null; tick++)
                {
                    simulation.Step();
                    hit = simulation.GetSnapshot().Events.Find(e => e.Type == "baseHit");
                }
                Assert.That(hit, Is.Not.Null, "Unit " + id);
                Assert.That(hit.Damage, Is.EqualTo(System.Math.Max(1, M0Balance.Get(type).Attack * multipliers[id - 3])).Within(0.001));
            }
        }

        [Test]
        public void AllNineUnitsApplyDamageAndArmorAgainstAnEnemyTank()
        {
            // Independent expectations from the heavy-armor column, in stable UnitId order.
            var multipliers = new[] { 0.8, 0.7, 1.4, 1.0, 0.7, 0.8, 1.4, 1.0, 1.0 };
            for (var id = 0; id < 9; id++)
            {
                var simulation = new Simulation(123, startCash: 5000, player1Faction: Faction.Semicon);
                var type = (UnitId)id;
                simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(type)));
                simulation.PushCommand(new TickInput(2, 1, new SpawnUnitCommand(UnitId.Fold)));
                SimEvent hit = null;
                for (var tick = 0; tick < 3000 && hit == null; tick++)
                {
                    simulation.Step();
                    hit = simulation.GetSnapshot().Events.Find(e => e.Type == "hit" && e.Player == 1);
                }
                Assert.That(hit, Is.Not.Null, "Unit " + id + " must attack enemy units, not only bases.");
                var target = M0Balance.Get(UnitId.Fold);
                var expected = System.Math.Min(target.Hp, System.Math.Max(1, M0Balance.Get(type).Attack * multipliers[id] - target.Armor));
                Assert.That(hit.Damage, Is.EqualTo(expected).Within(0.001), "Unit " + id);
            }
        }

        [Test]
        public void UnknownUnitDoesNotSpendCashOrReservePopulation()
        {
            foreach (var id in new[] { -1, 18, 999 })
            {
                var simulation = new Simulation(123);
                simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand((UnitId)id)));
                for (var tick = 0; tick < 3; tick++) simulation.Step();
                var view = simulation.GetSnapshot();
                Assert.That(view.Events.Exists(e => e.Reason == "UNKNOWN_UNIT"), Is.True);
                Assert.That(view.Players[0].Cash, Is.EqualTo(300.8).Within(0.001));
                Assert.That(view.Players[0].Supply, Is.Zero);
                Assert.That(view.Players[0].Queue, Is.Empty);
            }
        }
    }
}
