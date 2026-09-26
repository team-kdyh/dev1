using System;
using TechWar.Sim;
using UnityEditor;
using UnityEngine;

namespace TechWar.Editor
{
    public sealed class SimulationWindow : EditorWindow
    {
        private Simulation simulation;
        private Snapshot snapshot;
        private bool running, autoOpponent = true;
        private int seed = 12345, speed = 1;
        private double lastTime, accumulator;
        private string lastMessage = "유닛 버튼으로 생산을 예약하세요.";
        private GUIStyle unitButtonStyle;

        [MenuItem("Tech War/Simulation Sandbox")]
        public static void Open()
        {
            var window = GetWindow<SimulationWindow>("TECH WAR · 세미콘 vs 오차드");
            window.minSize = new Vector2(760, 620);
        }

        private void OnEnable()
        {
            ResetMatch();
            EditorApplication.update += Advance;
        }

        private void OnDisable() => EditorApplication.update -= Advance;

        private void ResetMatch()
        {
            simulation = new Simulation(unchecked((uint)seed));
            snapshot = simulation.GetSnapshot();
            running = false;
            accumulator = 0;
            lastTime = EditorApplication.timeSinceStartup;
            lastMessage = "시작을 누른 뒤 왼쪽 유닛을 생산하세요. 우측은 자동 생산합니다.";
        }

        private void Advance()
        {
            var now = EditorApplication.timeSinceStartup;
            if (running && !EditorApplication.isPlayingOrWillChangePlaymode && !simulation.IsOver())
            {
                accumulator += Math.Min(0.25, now - lastTime) * speed;
                while (accumulator >= 1.0 / Simulation.TicksPerSecond && !simulation.IsOver())
                {
                    StepOnce();
                    accumulator -= 1.0 / Simulation.TicksPerSecond;
                }
                Repaint();
            }
            lastTime = now;
        }

        private void StepOnce()
        {
            if (simulation.IsOver()) return;
            // A scripted producer to exercise the public API, not the track C tactical AI.
            if (autoOpponent && simulation.Tick % 90 == 0)
            {
                var roster = M0Balance.OrchardUnits;
                var type = roster[(simulation.Tick / 90) % roster.Count];
                if (snapshot.Players[1].Cash < M0Balance.Get(type).Cost) type = UnitId.AirPodsDuo;
                Send(1, new SpawnUnitCommand(type));
            }
            simulation.Step();
            snapshot = simulation.GetSnapshot();
            foreach (var e in snapshot.Events)
            {
                if (e.Type == "rejected") lastMessage = e.Reason == "QUEUE_CHANGED"
                    ? $"P{e.Player}: 생산 큐가 바뀌었습니다. 취소할 항목을 다시 선택하세요."
                    : $"P{e.Player} 명령 거부: " + e.Reason;
                else if (e.Type == "kill") lastMessage = $"P{e.Player} 유닛 #{e.Unit} → #{e.Target} 처치";
                else if (e.Type == "gameOver")
                {
                    lastMessage = e.Winner.HasValue ? $"P{e.Winner.Value} 승리" : "무승부";
                    running = false;
                }
            }
        }

        private void Send(int owner, ICommand command) =>
            simulation.PushCommand(new TickInput(simulation.Tick + Simulation.InputDelay, owner, command));

        private void OnGUI()
        {
            if (simulation == null) ResetMatch();
            GUILayout.Label("TECH WAR / 시뮬레이션 테스트", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox("왼쪽 세미콘 9종 / 오른쪽 오차드 9종. 기본 공격과 워치 메딕 회복 적용.", MessageType.Info);
            using (new EditorGUILayout.HorizontalScope())
            {
                seed = EditorGUILayout.IntField("Seed", seed, GUILayout.Width(220));
                if (GUILayout.Button("새 대전")) ResetMatch();
                using (new EditorGUI.DisabledScope(snapshot.IsOver || EditorApplication.isPlayingOrWillChangePlaymode))
                {
                    if (GUILayout.Button(running ? "일시정지" : "시작")) running = !running;
                    using (new EditorGUI.DisabledScope(running))
                        if (GUILayout.Button("1틱 진행")) StepOnce();
                }
                speed = EditorGUILayout.IntPopup(speed, new[] { "1배속", "2배속", "4배속" }, new[] { 1, 2, 4 }, GUILayout.Width(80));
                autoOpponent = GUILayout.Toggle(autoOpponent, "우측 자동 생산");
            }
            GUILayout.Label($"{snapshot.Tick / 30.0:0.0} / 480초    Tick {snapshot.Tick}    Checksum {snapshot.Checksum}");
            DrawLane(GUILayoutUtility.GetRect(100, 185, GUILayout.ExpandWidth(true)));
            using (new EditorGUILayout.HorizontalScope())
            {
                DrawPlayer(0);
                DrawPlayer(1);
            }
            EditorGUILayout.HelpBox(lastMessage, MessageType.None);
            if (snapshot.IsOver)
                GUILayout.Label(snapshot.Winner.HasValue ? $"대전 종료 — P{snapshot.Winner} 승리" : "대전 종료 — 무승부", EditorStyles.boldLabel);
        }

        private void DrawPlayer(int owner)
        {
            var player = snapshot.Players[owner];
            if (unitButtonStyle == null) unitButtonStyle = new GUIStyle(GUI.skin.button) { wordWrap = true, fontSize = 12 };
            using (new EditorGUILayout.VerticalScope(EditorStyles.helpBox))
            {
                GUILayout.Label($"P{owner} {(owner == 0 ? "세미콘 · 왼쪽" : "오차드 · 오른쪽")}  캐시 {player.Cash:0}  인구 {player.Supply}/{player.SupplyMax}", EditorStyles.boldLabel);
                using (new EditorGUI.DisabledScope(snapshot.IsOver))
                {
                    for (var row = 0; row < 3; row++)
                    {
                        using (new EditorGUILayout.HorizontalScope())
                        {
                            for (var column = 0; column < 3; column++)
                            {
                                var type = M0Balance.GetRoster(owner == 0 ? Faction.Semicon : Faction.Orchard)[row * 3 + column];
                                var stats = M0Balance.Get(type);
                                using (new EditorGUI.DisabledScope(player.Cash < stats.Cost || player.Cooldowns[(int)type] > 0 ||
                                    player.Supply + stats.Supply > player.SupplyMax || player.Queue.Length >= M0Balance.QueueMax))
                                    if (GUILayout.Button($"T{stats.Tier} {Label(type)}\n{stats.Cost} C", unitButtonStyle, GUILayout.Height(46)))
                                        Send(owner, new SpawnUnitCommand(type));
                            }
                        }
                    }
                    GUILayout.Label($"생산 대기 {player.Queue.Length}/5  ·  선두 {player.QueueProgress:P0}");
                    using (new EditorGUILayout.HorizontalScope())
                    {
                        for (var i = 0; i < player.Queue.Length; i++)
                            if (GUILayout.Button($"{Label(player.Queue[i])} 취소")) Send(owner, new CancelQueueCommand(i, player.QueueRevision));
                    }
                    if (GUILayout.Button("항복")) Send(owner, new SurrenderCommand());
                }
            }
        }

        private void DrawLane(Rect rect)
        {
            EditorGUI.DrawRect(rect, new Color(0.08f, 0.10f, 0.15f));
            var left = rect.x + 36;
            var width = rect.width - 72;
            var ground = rect.y + 134;
            EditorGUI.DrawRect(new Rect(left, ground, width, 2), Color.gray);
            for (var i = 0; i < 2; i++)
            {
                var x = left + i * width;
                EditorGUI.DrawRect(new Rect(x - 18, ground - 65, 36, 65), TeamColor(i));
                GUI.Label(new Rect(x - (i == 0 ? 16 : 120), rect.y + 8, 160, 24), $"P{i} 본진 {snapshot.Bases[i].Hp:0}", EditorStyles.whiteLabel);
            }
            foreach (var unit in snapshot.Units)
            {
                var x = left + (float)(unit.X / M0Balance.LaneLength) * width;
                var tier = M0Balance.Get(unit.UnitId).Tier;
                var height = 24 + tier * 3;
                var body = new Rect(x - 9, ground - height, 18, height);
                EditorGUI.DrawRect(body, unit.State == "attack" ? Color.Lerp(TeamColor(unit.Owner), Color.white, 0.5f) : TeamColor(unit.Owner));
                EditorGUI.DrawRect(new Rect(x - 10, body.y - 7, 20, 3), Color.black);
                EditorGUI.DrawRect(new Rect(x - 10, body.y - 7, 20 * (float)(unit.Hp / unit.HpMax), 3), Color.green);
                GUI.Label(new Rect(x - 13, body.y - 29, 45, 22), "T" + tier, EditorStyles.whiteMiniLabel);
            }
            GUI.Label(new Rect(rect.x + 10, ground + 15, rect.width - 20, 24), "파랑: 세미콘  /  밝은 회색: 오차드  /  초록: 체력  /  밝은 색: 교전", EditorStyles.whiteLabel);
        }

        private static string Label(UnitId type) => M0Balance.Get(type).Name;
        private static Color TeamColor(int owner) => owner == 0 ? new Color(0.20f, 0.55f, 1f) : new Color(0.78f, 0.81f, 0.86f);
    }
}
