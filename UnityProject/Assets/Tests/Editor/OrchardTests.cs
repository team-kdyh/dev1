using NUnit.Framework;
using TechWar.Sim;

namespace TechWar.Tests
{
    public sealed class OrchardTests
    {
        [Test]
        public void OrchardHasNineDistinctBasicUnits()
        {
            var names = new[] { "에어팟 듀오", "워치 트레이너", "폰 기본형", "폰 프로",
                "패드 방패병", "비전 헤드셋", "에어 노트북", "프로 노트북", "창업자" };
            Assert.That(M0Balance.OrchardUnits, Is.EqualTo(new[] { UnitId.AirPodsDuo, UnitId.WatchTrainer,
                UnitId.PhoneBasic, UnitId.PhonePro, UnitId.PadShield, UnitId.VisionHeadset,
                UnitId.AirNotebook, UnitId.ProNotebook, UnitId.Founder }));
            for (var tier = 1; tier <= 9; tier++)
            {
                var type = (UnitId)(8 + tier);
                var stats = M0Balance.Get(type);
                Assert.That(stats.Name, Is.EqualTo(names[tier - 1]));
                Assert.That(stats.Tier, Is.EqualTo(tier));
                Assert.That(M0Balance.GetFaction(type), Is.EqualTo(Faction.Orchard));
                Assert.That(stats.Cost, Is.GreaterThan(0));
                Assert.That(stats.Attack, Is.GreaterThan(0));
            }
        }

        [Test]
        public void BothPlayersRejectTheOtherFactionWithoutSpendingResources()
        {
            var simulation = new Simulation(42);
            simulation.PushCommand(new TickInput(2, 0, new SpawnUnitCommand((UnitId)9)));
            simulation.PushCommand(new TickInput(2, 1, new SpawnUnitCommand(UnitId.Bud)));
            for (var tick = 0; tick < 3; tick++) simulation.Step();
            var snapshot = simulation.GetSnapshot();
            Assert.That(snapshot.Events.FindAll(e => e.Type == "rejected" && e.Reason == "WRONG_FACTION").Count, Is.EqualTo(2));
            Assert.That(snapshot.Players[0].Cash, Is.EqualTo(300.8).Within(0.001));
            Assert.That(snapshot.Players[1].Cash, Is.EqualTo(300.8).Within(0.001));
            Assert.That(snapshot.Players[0].Queue, Is.Empty);
            Assert.That(snapshot.Players[1].Queue, Is.Empty);
            Assert.That(snapshot.Players[0].Supply, Is.Zero);
            Assert.That(snapshot.Players[1].Supply, Is.Zero);
            Assert.That(snapshot.Players[0].Cooldowns[9], Is.Zero);
            Assert.That(snapshot.Players[1].Cooldowns[(int)UnitId.Bud], Is.Zero);
        }

        [Test]
        public void EveryOrchardUnitCanBeProducedMoveAndAttackTheEnemyBase()
        {
            for (var tier = 1; tier <= 9; tier++)
            {
                var type = (UnitId)(8 + tier);
                var simulation = new Simulation(77, baseHealth: 100000, startCash: 5000);
                simulation.PushCommand(new TickInput(2, 1, new SpawnUnitCommand(type)));
                for (var tick = 0; tick < 3; tick++) simulation.Step();
                var reserved = simulation.GetSnapshot().Players[1];
                Assert.That(reserved.Queue, Is.EqualTo(new[] { type }));
                Assert.That(reserved.Cash, Is.EqualTo(5000.8 - M0Balance.Get(type).Cost).Within(0.001));
                Assert.That(reserved.Supply, Is.EqualTo(M0Balance.Get(type).Supply));
                Assert.That(reserved.Cooldowns[(int)type], Is.GreaterThan(0));
                var spawned = false;
                var moved = false;
                var attacked = false;
                for (var tick = 0; tick < 3000 && !attacked; tick++)
                {
                    simulation.Step();
                    var snapshot = simulation.GetSnapshot();
                    foreach (var unit in snapshot.Units)
                    {
                        if (unit.UnitId != type) continue;
                        spawned = true;
                        Assert.That(unit.Owner, Is.EqualTo(1));
                        moved |= unit.X < 940;
                    }
                    attacked |= snapshot.Events.Exists(e => e.Type == "baseHit" && e.Player == 0 && e.Damage > 0);
                }
                Assert.That(spawned, Is.True, "T" + tier + " spawn");
                Assert.That(moved, Is.True, "T" + tier + " move");
                Assert.That(attacked, Is.True, "T" + tier + " attack");
            }
        }
    }
}
