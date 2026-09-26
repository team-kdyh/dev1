using NUnit.Framework;
using TechWar.Sim;

namespace TechWar.Tests
{
    public sealed class MedicSkillTests
    {
        [Test]
        public void MedicHealsAnInjuredNearbyAllyByUpToSixEveryThirtyTicks()
        {
            var simulation = CreateMedicBattle();
            SimEvent firstHeal = null;
            SimEvent secondHeal = null;
            var firstTick = -1;
            var secondTick = -1;

            for (var i = 0; i < 3000 && secondHeal == null; i++)
            {
                simulation.Step();
                foreach (var e in simulation.GetSnapshot().Events)
                {
                    if (e.Type != "heal" || e.Player != 0) continue;
                    if (firstHeal == null) { firstHeal = e; firstTick = simulation.Tick; }
                    else { secondHeal = e; secondTick = simulation.Tick; break; }
                }
            }

            Assert.That(firstHeal, Is.Not.Null, "A Medic beside an injured ally must heal it.");
            Assert.That(firstHeal.UnitType, Is.EqualTo(UnitId.Medic));
            Assert.That(firstHeal.Damage, Is.GreaterThan(0).And.LessThanOrEqualTo(6));
            Assert.That(firstHeal.Unit, Is.Not.EqualTo(firstHeal.Target));
            Assert.That(secondHeal, Is.Not.Null);
            Assert.That(secondTick - firstTick, Is.EqualTo(30));
        }

        [Test]
        public void HealingNeverRaisesHpPastMaximum()
        {
            var simulation = CreateMedicBattle();
            var sawPartialHeal = false;

            for (var i = 0; i < 4000 && !sawPartialHeal; i++)
            {
                simulation.Step();
                var snapshot = simulation.GetSnapshot();
                foreach (var e in snapshot.Events)
                {
                    if (e.Type != "heal") continue;
                    var target = snapshot.Units.Find(u => u.Id == e.Target);
                    if (target == null) continue;
                    Assert.That(target.Hp, Is.LessThanOrEqualTo(target.HpMax));
                    sawPartialHeal |= e.Damage < 6;
                }
            }

            Assert.That(sawPartialHeal, Is.True, "The final heal should report only the missing HP.");
        }

        [Test]
        public void MedicHealingIsDeterministic()
        {
            var first = CreateMedicBattle();
            var second = CreateMedicBattle();
            var healingOccurred = false;

            for (var tick = 0; tick < 1200; tick++)
            {
                first.Step();
                second.Step();
                var firstView = first.GetSnapshot();
                var secondView = second.GetSnapshot();
                healingOccurred |= firstView.Events.Exists(e => e.Type == "heal");
                Assert.That(firstView.Checksum, Is.EqualTo(secondView.Checksum), "tick " + tick);
            }

            Assert.That(healingOccurred, Is.True);
        }

        [Test]
        public void SkillTimerIsExposedWithoutAllowingSnapshotMutation()
        {
            var simulation = new Simulation(123, startCash: 5000);
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Medic)));
            for (var tick = 0; tick < 63; tick++) simulation.Step();

            var snapshot = simulation.GetSnapshot();
            var medic = snapshot.Units.Find(unit => unit.UnitId == UnitId.Medic);
            Assert.That(medic, Is.Not.Null);
            Assert.That(medic.SkillCooldownTicks, Is.GreaterThan(0).And.LessThanOrEqualTo(30));
            var checksum = simulation.GetChecksum();
            medic.SkillCooldownTicks = 0;
            medic.Buffs = new[] { "corrupted" };

            Assert.That(simulation.GetChecksum(), Is.EqualTo(checksum));
            var fresh = simulation.GetSnapshot().Units.Find(unit => unit.UnitId == UnitId.Medic);
            Assert.That(fresh.SkillCooldownTicks, Is.GreaterThan(0));
            Assert.That(fresh.Buffs, Is.Empty);
        }

        private static Simulation CreateMedicBattle()
        {
            var simulation = new Simulation(9876, baseHealth: 100000, startCash: 5000, timeLimitSeconds: 300,
                player1Faction: Faction.Semicon);
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Fold)));
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand(UnitId.Medic)));
            simulation.PushCommand(new TickInput(2, 1, new SpawnUnitCommand(UnitId.Scout)));
            return simulation;
        }
    }
}
