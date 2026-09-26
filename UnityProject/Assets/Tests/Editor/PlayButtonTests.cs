using System.Collections;
using System.Reflection;
using NUnit.Framework;
using TechWar.Play;
using TechWar.Sim;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.TestTools;

namespace TechWar.Tests
{
    public sealed class PlayButtonTests
    {
        [Test]
        public void HealEventUpdatesThePlayerMessage()
        {
            var gameObject = new GameObject("SimulationPlayer test");
            try
            {
                var player = gameObject.AddComponent<SimulationPlayer>();
                var snapshot = new Snapshot();
                snapshot.Events.Add(new SimEvent { Type = "heal", Player = 0, UnitType = UnitId.Medic, Damage = 6 });
                var handleEvents = typeof(SimulationPlayer).GetMethod("HandleEvents", BindingFlags.Instance | BindingFlags.NonPublic);

                Assert.That(handleEvents, Is.Not.Null);
                handleEvents.Invoke(player, new object[] { snapshot });
                var message = (string)typeof(SimulationPlayer).GetField("message", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(player);
                Assert.That(message, Does.Contain("회복"));
            }
            finally { Object.DestroyImmediate(gameObject); }
        }

        [UnityTest]
        public IEnumerator SemiconButtonsProduceTheDisplayedTier()
        {
            EditorSceneManager.OpenScene("Assets/Scenes/SampleScene.unity");
            yield return new EnterPlayMode();
            var player = Object.FindFirstObjectByType<SimulationPlayer>();
            var gameViewType = typeof(EditorWindow).Assembly.GetType("UnityEditor.GameView");
            var window = EditorWindow.GetWindow(gameViewType);
            window.Show();
            window.Focus();
            // Unity 6's GameView forwards pixel-space mouse events through this method.
            // Exercise the real runtime GUI, not an EditorWindow wrapper with different DPI/clipping rules.
            var queueInput = typeof(EditorGUIUtility).GetMethod("QueueGameViewInputEvent", BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public);
            Assert.That(queueInput, Is.Not.Null);
            var idsByTier = new[] { 0, 3, 1, 4, 5, 2, 6, 7, 8 };
            try
            {
                for (var index = 0; index < idsByTier.Length; index++)
                {
                    // Start every button check with enough cash and empty population, without adding a cheat API.
                    var simulation = new Simulation(123, startCash: 5000);
                    typeof(SimulationPlayer).GetField("simulation", BindingFlags.Instance | BindingFlags.NonPublic).SetValue(player, simulation);
                    typeof(SimulationPlayer).GetField("snapshot", BindingFlags.Instance | BindingFlags.NonPublic).SetValue(player, simulation.GetSnapshot());
                    player.SetPaused(false);
                    window.Repaint();
                    yield return null;
                    var size = (Vector2)gameViewType.GetProperty("targetRenderSize", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(window);
                    Assert.That(size.x, Is.GreaterThan(0));
                    var scale = Mathf.Min(size.x / 1200f, size.y / 760f);
                    var point = new Vector2((size.x - 1200 * scale) / 2 + (90 + index * 127) * scale,
                        (size.y - 760 * scale) / 2 + 554 * scale);
                    queueInput.Invoke(null, new object[] { new Event { type = EventType.MouseDown, mousePosition = point, button = 0 } });
                    queueInput.Invoke(null, new object[] { new Event { type = EventType.MouseUp, mousePosition = point, button = 0 } });
                    var type = (UnitId)idsByTier[index];
                    var deadline = Time.realtimeSinceStartup + 2;
                    while (Time.realtimeSinceStartup < deadline &&
                        !System.Array.Exists(player.CurrentSnapshot.Players[0].Queue, id => id == type) &&
                        !player.CurrentSnapshot.Units.Exists(u => u.Owner == 0 && u.UnitId == type)) yield return null;
                    var snapshot = player.CurrentSnapshot;
                    Assert.That(System.Array.Exists(snapshot.Players[0].Queue, id => id == type) ||
                        snapshot.Units.Exists(u => u.Owner == 0 && u.UnitId == type), Is.True, "Production button T" + (index + 1));
                }
            }
            finally { player.SetPaused(true); }
            yield return new ExitPlayMode();
        }

        [UnityTest]
        public IEnumerator SampleScenePlayStartsMatchAndAcceptsPlayerActions()
        {
            EditorSceneManager.OpenScene("Assets/Scenes/SampleScene.unity");
            yield return new EnterPlayMode();
            var player = Object.FindFirstObjectByType<SimulationPlayer>();
            Assert.That(player, Is.Not.Null, "Pressing Play must create the runtime match without manual setup.");
            Assert.That(Object.FindObjectsByType<SimulationPlayer>(FindObjectsSortMode.None).Length, Is.EqualTo(1));
            yield return new WaitForSecondsRealtime(0.25f);
            Assert.That(player.CurrentSnapshot.Tick, Is.GreaterThan(0));

            player.QueueUnit(UnitId.Bud);
            yield return new WaitForSecondsRealtime(1.4f);
            Assert.That(player.CurrentSnapshot.Units.Exists(u => u.Owner == 0 && u.UnitId == UnitId.Bud), Is.True);
            Assert.That(player.CurrentSnapshot.Units.Exists(u => u.Owner == 1 && M0Balance.GetFaction(u.UnitId) == Faction.Orchard),
                Is.True, "The scripted opponent must produce Orchard units through its command API.");
            Assert.That(player.CurrentSnapshot.Units.Exists(u => u.Owner == 1 && M0Balance.GetFaction(u.UnitId) == Faction.Semicon), Is.False);

            player.SetPaused(true);
            var tick = player.CurrentSnapshot.Tick;
            yield return new WaitForSecondsRealtime(0.2f);
            Assert.That(player.CurrentSnapshot.Tick, Is.EqualTo(tick));
            player.RestartMatch();
            Assert.That(player.IsPaused, Is.False);
            Assert.That(player.CurrentSnapshot.Tick, Is.Zero);
            Assert.That(player.CurrentSnapshot.Players[0].Cash, Is.EqualTo(300));
            Assert.That(player.CurrentSnapshot.Units, Is.Empty);

            player.Surrender();
            yield return new WaitForSecondsRealtime(0.2f);
            Assert.That(player.CurrentSnapshot.IsOver, Is.True);
            Assert.That(player.CurrentSnapshot.Winner, Is.EqualTo(1));
            yield return new ExitPlayMode();
            yield return new EnterPlayMode();
            Assert.That(Object.FindObjectsByType<SimulationPlayer>(FindObjectsSortMode.None).Length, Is.EqualTo(1));
            yield return new ExitPlayMode();
        }

        [UnityTearDown]
        public IEnumerator ExitIfStillPlaying()
        {
            if (EditorApplication.isPlaying) yield return new ExitPlayMode();
        }
    }

}
