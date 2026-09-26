using NUnit.Framework;
using TechWar.Sim;

namespace TechWar.Tests
{
    internal static class SimTestFactory
    {
        public static Simulation Create() => new Simulation(12345, player1Faction: Faction.Semicon);
    }

    public class SimulationTests
    {
        [Test]
        public void SameSeedAndCommandsProduceSameChecksum()
        {
            var first = SimTestFactory.Create();
            var second = SimTestFactory.Create();

            for (var tick = 0; tick < 300; tick++)
            {
                if (tick % 30 == 0)
                {
                    first.PushCommand(new TickInput(tick + 2, 0, new SpawnUnitCommand(UnitId.Bud)));
                    second.PushCommand(new TickInput(tick + 2, 0, new SpawnUnitCommand(UnitId.Bud)));
                    first.PushCommand(new TickInput(tick + 2, 1, new SpawnUnitCommand(UnitId.Scout)));
                    second.PushCommand(new TickInput(tick + 2, 1, new SpawnUnitCommand(UnitId.Scout)));
                }

                first.Step();
                second.Step();
                Assert.That(first.GetChecksum(), Is.EqualTo(second.GetChecksum()));
            }
        }

        [Test]
        public void SpawnCommandReservesCashThenCompletesProduction()
        {
            var simulation = SimTestFactory.Create();
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Bud)));

            simulation.Step();
            Assert.That(simulation.GetSnapshot().Units.Count, Is.EqualTo(0));

            simulation.Step();
            Assert.That(simulation.GetSnapshot().Units.Count, Is.EqualTo(0));

            simulation.Step();
            Assert.That(simulation.GetSnapshot().Players[0].Queue.Length, Is.EqualTo(1));
            Assert.That(simulation.GetSnapshot().Players[0].Cash, Is.EqualTo(240.8).Within(0.001));
            Assert.That(simulation.GetSnapshot().Units.Count, Is.EqualTo(0));
            for (var i = 0; i < 29; i++) simulation.Step();
            Assert.That(simulation.GetSnapshot().Units.Count, Is.EqualTo(1));
            Assert.That(simulation.GetSnapshot().Units[0].Owner, Is.EqualTo(0));
        }

        [Test]
        public void OpposingUnitsFightBeforeReachingBases()
        {
            var simulation = SimTestFactory.Create();
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Scout)));
            simulation.PushCommand(new TickInput(2, 1, new SpawnUnitCommand(UnitId.Scout)));

            for (var i = 0; i < 230; i++) simulation.Step();

            var snapshot = simulation.GetSnapshot();
            Assert.That(snapshot.Bases[0].Hp, Is.EqualTo(snapshot.Bases[0].HpMax));
            Assert.That(snapshot.Bases[1].Hp, Is.EqualTo(snapshot.Bases[1].HpMax));
            Assert.That(snapshot.Units.Exists(u => u.Hp < u.HpMax), Is.True);
        }

        [Test]
        public void FutureCommandDoesNotExecuteEarly()
        {
            var simulation = SimTestFactory.Create();
            simulation.PushCommand(new TickInput(100, 0, new SpawnUnitCommand(UnitId.Bud)));
            for (var i = 0; i < 30; i++) simulation.Step();
            Assert.That(simulation.GetSnapshot().Units.Count, Is.EqualTo(0));
        }

        [Test]
        public void PendingCommandsAreCoveredByChecksum()
        {
            var first = SimTestFactory.Create();
            var second = SimTestFactory.Create();
            first.PushCommand(new TickInput(100, 0, new SpawnUnitCommand(UnitId.Bud)));
            Assert.That(first.GetChecksum(), Is.Not.EqualTo(second.GetChecksum()));
        }

        [Test]
        public void SeedStateIsCoveredByChecksum()
        {
            Assert.That(new Simulation(1).GetChecksum(), Is.Not.EqualTo(new Simulation(2).GetChecksum()));
        }

        [Test]
        public void FixedMultiplicationDoesNotOverflowBeforeDivision()
        {
            Assert.That(Fixed.Mul(5000000, 1200), Is.EqualTo(6000000));
        }

        [Test]
        public void FixedDivisionDoesNotOverflowBeforeDivision()
        {
            Assert.That(Fixed.Div(5000000, 2000), Is.EqualTo(2500000));
        }

        [Test]
        public void SnapshotMutationDoesNotChangeSimulation()
        {
            var simulation = SimTestFactory.Create();
            var before = simulation.GetChecksum();
            simulation.GetSnapshot().Bases[0].Hp = 0;
            Assert.That(simulation.GetChecksum(), Is.EqualTo(before));
        }

        [Test]
        public void IncomeHasNoRoundingDriftAfterThirtyTicks()
        {
            var simulation = SimTestFactory.Create();
            for (var i = 0; i < 30; i++) simulation.Step();
            Assert.That(simulation.GetSnapshot().Players[0].Cash, Is.EqualTo(308));
        }

        [Test]
        public void UnaffordableCommandDoesNotCreateFreeUnits()
        {
            var simulation = SimTestFactory.Create();
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Siege)));
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Scout)));
            for (var i = 0; i < 3; i++) simulation.Step();
            Assert.That(simulation.GetSnapshot().Events.Exists(e => e.Reason == "NO_CASH"), Is.True);
            Assert.That(simulation.GetSnapshot().Players[0].Queue.Length, Is.EqualTo(1));
        }

        [Test]
        public void CancellationRefundsEightyPercentAndReleasesSupply()
        {
            var simulation = SimTestFactory.Create();
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Bud)));
            simulation.PushCommand(new TickInput(3, 0, new CancelQueueCommand(0)));
            for (var i = 0; i < 30; i++) simulation.Step();
            var snapshot = simulation.GetSnapshot();
            Assert.That(snapshot.Players[0].Cash, Is.EqualTo(296));
            Assert.That(snapshot.Players[0].Supply, Is.Zero);
            Assert.That(snapshot.Players[0].Queue, Is.Empty);
            Assert.That(snapshot.Units, Is.Empty);
        }

        [Test]
        public void SurrenderEmitsResultAndStopsTicks()
        {
            var simulation = SimTestFactory.Create();
            simulation.PushCommand(new TickInput(2, 0, new SurrenderCommand()));
            for (var i = 0; i < 3; i++) simulation.Step();
            var result = simulation.GetSnapshot();
            Assert.That(result.IsOver, Is.True);
            Assert.That(result.Winner, Is.EqualTo(1));
            Assert.That(result.Events.Exists(e => e.Type == "gameOver"), Is.True);
            simulation.Step();
            Assert.That(simulation.GetChecksum(), Is.EqualTo(result.Checksum));
        }

        [Test]
        public void InvalidPlayerIsRejectedAtBoundary()
        {
            Assert.Throws<System.ArgumentOutOfRangeException>(() =>
                SimTestFactory.Create().PushCommand(new TickInput(2, 2, new SpawnUnitCommand(UnitId.Bud))));
        }

        [Test]
        public void IdenticalInputsFromPlayersAreOrderedCanonically()
        {
            var first = SimTestFactory.Create();
            var second = SimTestFactory.Create();
            var left = new TickInput(2, 0, new SpawnUnitCommand(UnitId.Bud));
            var right = new TickInput(2, 1, new SpawnUnitCommand(UnitId.Scout));
            first.PushCommand(left); first.PushCommand(right);
            second.PushCommand(right); second.PushCommand(left);
            Assert.That(first.GetChecksum(), Is.EqualTo(second.GetChecksum()));
            for (var i = 0; i < 300; i++)
            {
                first.Step(); second.Step();
                Assert.That(first.GetChecksum(), Is.EqualTo(second.GetChecksum()));
            }
        }

        [Test]
        public void UnopposedSiegeDestroysBaseAndEndsMatch()
        {
            var simulation = SimTestFactory.Create();
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Siege)));
            while (!simulation.IsOver() && simulation.Tick < 6000) simulation.Step();
            var result = simulation.GetSnapshot();
            Assert.That(result.IsOver, Is.True);
            Assert.That(result.Winner, Is.EqualTo(0));
            Assert.That(result.Bases[1].Hp, Is.Zero);
        }

        [Test]
        public void EqualBasesDrawExactlyAtTimeLimit()
        {
            var simulation = new Simulation(12345, timeLimitSeconds: 1);
            for (var i = 0; i < 29; i++) simulation.Step();
            Assert.That(simulation.IsOver(), Is.False);
            simulation.Step();
            Assert.That(simulation.IsOver(), Is.True);
            Assert.That(simulation.GetSnapshot().Winner, Is.Null);
            Assert.That(simulation.GetSnapshot().Tick, Is.EqualTo(30));
        }

        [Test]
        public void MovingUnitKeepsFractionalDistanceWithoutDrift()
        {
            var simulation = SimTestFactory.Create();
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Bud)));
            for (var i = 0; i < 32; i++) simulation.Step();
            var start = simulation.GetSnapshot().Units[0].X;
            for (var i = 0; i < 30; i++) simulation.Step();
            Assert.That(simulation.GetSnapshot().Units[0].X - start, Is.EqualTo(95).Within(0.001));
        }

        [Test]
        public void FasterUnitCannotOvertakeFriendlySiege()
        {
            var simulation = new Simulation(12345, startCash: 1000);
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Siege)));
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Bud)));
            for (var i = 0; i < 800; i++)
            {
                simulation.Step();
                var units = simulation.GetSnapshot().Units;
                if (units.Count == 2) Assert.That(units[0].X - units[1].X, Is.GreaterThanOrEqualTo(19.999));
            }
        }

        [Test]
        public void PopulationIncludesQueuedUnitsAndNeverExceedsLimit()
        {
            var simulation = new Simulation(12345, startCash: 9999);
            var rejected = false;
            for (var tick = 0; tick < 720; tick++)
            {
                if (tick % 90 == 0) simulation.PushCommand(new TickInput(tick + 2, 0, new SpawnUnitCommand(UnitId.Siege)));
                simulation.Step();
                var view = simulation.GetSnapshot();
                rejected |= view.Events.Exists(e => e.Reason == "NO_SUPPLY");
                Assert.That(view.Players[0].Supply, Is.LessThanOrEqualTo(12));
            }
            Assert.That(rejected, Is.True);
        }

        [Test]
        public void QueueRejectsSixthReservation()
        {
            var simulation = new Simulation(12345, startCash: 9999);
            var rejected = false;
            for (var tick = 0; tick < 90; tick++)
            {
                if (tick % 30 == 0)
                    for (var type = 2; type >= 0; type--)
                        simulation.PushCommand(new TickInput(tick + 2, 0, new SpawnUnitCommand((UnitId)type)));
                simulation.Step();
                var view = simulation.GetSnapshot();
                rejected |= view.Events.Exists(e => e.Reason == "QUEUE_FULL");
                Assert.That(view.Players[0].Queue.Length, Is.LessThanOrEqualTo(5));
            }
            Assert.That(rejected, Is.True);
        }

        [Test]
        public void RepeatedProductionRespectsCooldown()
        {
            var simulation = SimTestFactory.Create();
            var command = new TickInput(2, 0, new SpawnUnitCommand(UnitId.Bud));
            simulation.PushCommand(command); simulation.PushCommand(command);
            for (var i = 0; i < 3; i++) simulation.Step();
            Assert.That(simulation.GetSnapshot().Events.Exists(e => e.Reason == "ON_COOLDOWN"), Is.True);
            Assert.That(simulation.GetSnapshot().Players[0].Queue.Length, Is.EqualTo(1));
        }

        [Test]
        public void DeepSnapshotChangesCannotAffectQueueUnitsOrEvents()
        {
            var simulation = SimTestFactory.Create();
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Bud)));
            for (var i = 0; i < 32; i++) simulation.Step();
            var copy = simulation.GetSnapshot();
            var checksum = copy.Checksum;
            copy.Units[0].Hp = 0;
            copy.Players[0].Cash = 9999;
            copy.Players[0].Cooldowns[0] = 9999;
            copy.Events[0].Type = "corrupted";
            Assert.That(simulation.GetChecksum(), Is.EqualTo(checksum));
            Assert.That(simulation.GetSnapshot().Events[0].Type, Is.EqualTo("spawn"));
            simulation.Step();
            Assert.That(simulation.GetSnapshot().Events, Is.Empty);
        }

        [Test]
        public void TenThousandActiveTicksRemainDeterministic()
        {
            var first = new Simulation(123, baseHealth: 1000000, timeLimitSeconds: 1000, player1Faction: Faction.Semicon);
            var second = new Simulation(123, baseHealth: 1000000, timeLimitSeconds: 1000, player1Faction: Faction.Semicon);
            for (var tick = 0; tick < 10000; tick++)
            {
                if (tick % 90 == 0)
                    for (var player = 0; player < 2; player++)
                    {
                        var input = new TickInput(tick + 2, player, new SpawnUnitCommand((UnitId)((tick / 90 + player) % 3)));
                        first.PushCommand(input); second.PushCommand(input);
                    }
                first.Step(); second.Step();
                Assert.That(first.GetChecksum(), Is.EqualTo(second.GetChecksum()), "tick " + tick);
            }
            Assert.That(first.Tick, Is.EqualTo(10000));
            Assert.That(first.IsOver(), Is.False);
        }

        [Test]
        public void PastCommandsAreNotSilentlyRescheduled()
        {
            var simulation = SimTestFactory.Create();
            simulation.Step();
            Assert.Throws<System.ArgumentOutOfRangeException>(() =>
                simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Bud))));
        }

        [Test]
        public void RngRejectsInvalidBoundAndRepeatsSeededSequence()
        {
            var first = new Rng(0);
            var second = new Rng(0);
            Assert.Throws<System.ArgumentOutOfRangeException>(() => first.Int(0));
            Assert.Throws<System.ArgumentOutOfRangeException>(() => first.Int(-1));
            var initial = first.Next();
            Assert.That(second.Next(), Is.EqualTo(initial));
            var varied = false;
            for (var i = 0; i < 100; i++)
            {
                var value = first.Next();
                varied |= value != initial;
                Assert.That(second.Next(), Is.EqualTo(value));
            }
            Assert.That(varied, Is.True);
        }

        [Test]
        public void EnemyAtSpawnPointBlocksOverlappingProduction()
        {
            var simulation = SimTestFactory.Create();
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Bud)));
            simulation.PushCommand(new TickInput(279, 1, new SpawnUnitCommand(UnitId.Bud)));
            for (var i = 0; i < 309; i++) simulation.Step();
            var snapshot = simulation.GetSnapshot();
            Assert.That(snapshot.Units.Count, Is.EqualTo(1));
            Assert.That(snapshot.Players[1].Queue.Length, Is.EqualTo(1));
            Assert.That(snapshot.Players[1].QueueProgress, Is.EqualTo(1));
        }

        [Test]
        public void CancelFromOldSnapshotCannotRefundAnotherUnit()
        {
            var simulation = new Simulation(12345, startCash: 1000);
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Bud)));
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Scout)));
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Siege)));
            for (var i = 0; i < 31; i++) simulation.Step();
            var snapshot = simulation.GetSnapshot();
            simulation.PushCommand(new TickInput(33, 0, new CancelQueueCommand(1, snapshot.Players[0].QueueRevision)));
            for (var i = 0; i < 3; i++) simulation.Step();
            var result = simulation.GetSnapshot();
            Assert.That(result.Events.Exists(e => e.Reason == "QUEUE_CHANGED"), Is.True);
            Assert.That(result.Players[0].Queue, Is.EqualTo(new[] { UnitId.Scout, UnitId.Siege }));
        }
    }
}
