using System;
using TechWar.Sim;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace TechWar.Play
{
    // M0 runtime adapter. Simulation remains independent of Unity and rendering.
    public sealed class SimulationPlayer : MonoBehaviour
    {
        private const float Width = 1200, Height = 760;
        private static readonly Color Blue = new Color(0.22f, 0.58f, 1f);
        private static readonly Color OrchardColor = new Color(0.78f, 0.81f, 0.86f);
        private Simulation simulation;
        private Snapshot snapshot;
        private double accumulator;
        private bool paused;
        private string message;
        private GUIStyle titleStyle, textStyle, smallStyle, buttonStyle, unitButtonStyle;

        public Snapshot CurrentSnapshot => snapshot;
        public bool IsPaused => paused;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void StartSampleScene()
        {
            // Scoped to the existing demo scene; no edit-time scene changes or setup required.
            if (SceneManager.GetActiveScene().path != "Assets/Scenes/SampleScene.unity") return;
            if (FindFirstObjectByType<SimulationPlayer>() == null)
                new GameObject("Tech War - M0 Match").AddComponent<SimulationPlayer>();
        }

        private void Awake() => RestartMatch();

        public void RestartMatch()
        {
            simulation = new Simulation(12345);
            snapshot = simulation.GetSnapshot();
            accumulator = 0;
            paused = false;
            message = "세미콘 T1~T9를 생산하세요. 오른쪽 오차드와 대전합니다.";
        }

        public void SetPaused(bool value)
        {
            paused = value;
            accumulator = 0;
        }

        public void QueueUnit(UnitId type) => Send(0, new SpawnUnitCommand(type));
        public void CancelQueuedUnit(int index) => Send(0, new CancelQueueCommand(index, snapshot.Players[0].QueueRevision));
        public void Surrender() => Send(0, new SurrenderCommand());

        private void Send(int owner, ICommand command)
        {
            if (!simulation.IsOver())
                simulation.PushCommand(new TickInput(simulation.Tick + Simulation.InputDelay, owner, command));
        }

        private void Update()
        {
            if (paused || simulation.IsOver()) return;
            accumulator += Math.Min(0.25, Time.unscaledDeltaTime);
            while (accumulator >= 1.0 / Simulation.TicksPerSecond && !simulation.IsOver())
            {
                // Same scripted producer as the editor sandbox; tactical AI belongs to track C.
                if (simulation.Tick % 90 == 0)
                {
                    var roster = M0Balance.OrchardUnits;
                    var type = roster[(simulation.Tick / 90) % roster.Count];
                    if (snapshot.Players[1].Cash < M0Balance.Get(type).Cost) type = UnitId.AirPodsDuo;
                    Send(1, new SpawnUnitCommand(type));
                }
                simulation.Step();
                snapshot = simulation.GetSnapshot();
                HandleEvents(snapshot);
                accumulator -= 1.0 / Simulation.TicksPerSecond;
            }
        }

        private void HandleEvents(Snapshot current)
        {
            foreach (var e in current.Events)
            {
                if (e.Type == "rejected" && e.Player == 0)
                    message = e.Reason == "QUEUE_CHANGED" ? "생산 큐가 변경됐습니다. 취소할 항목을 다시 선택하세요." : "명령을 실행할 수 없습니다: " + e.Reason;
                else if (e.Type == "heal" && e.Player == 0) message = "워치 메딕이 아군을 회복했습니다.";
                else if (e.Type == "kill") message = e.Player == 0 ? "적 유닛 처치! 캐시를 획득했습니다." : "아군 유닛이 파괴됐습니다.";
                else if (e.Type == "gameOver") message = ResultLabel();
            }
        }

        private void OnGUI()
        {
            if (snapshot == null || Screen.width == 0 || Screen.height == 0) return;
            if (titleStyle == null)
            {
                titleStyle = new GUIStyle(GUI.skin.label) { fontSize = 30, fontStyle = FontStyle.Bold };
                textStyle = new GUIStyle(GUI.skin.label) { fontSize = 19 };
                smallStyle = new GUIStyle(GUI.skin.label) { fontSize = 15 };
                buttonStyle = new GUIStyle(GUI.skin.button) { fontSize = 19, wordWrap = true };
                unitButtonStyle = new GUIStyle(GUI.skin.button) { fontSize = 14, wordWrap = true };
                titleStyle.normal.textColor = textStyle.normal.textColor = smallStyle.normal.textColor = Color.white;
            }
            var oldMatrix = GUI.matrix;
            var oldEnabled = GUI.enabled;
            var scale = Mathf.Min(Screen.width / Width, Screen.height / Height);
            GUI.matrix = Matrix4x4.TRS(new Vector3((Screen.width - Width * scale) / 2,
                (Screen.height - Height * scale) / 2, 0), Quaternion.identity, Vector3.one * scale);
            try
            {
                Fill(new Rect(0, 0, Width, Height), new Color(0.055f, 0.075f, 0.12f));
                GUI.Label(new Rect(30, 20, 420, 45), "TECH WAR  /  SEMICON", titleStyle);
                GUI.Label(new Rect(465, 30, 220, 30), $"{snapshot.Tick / 30.0:0.0} / 480초", textStyle);
                GUI.enabled = !snapshot.IsOver;
                if (GUI.Button(new Rect(845, 22, 145, 40), paused ? "계속하기" : "일시정지", buttonStyle)) SetPaused(!paused);
                GUI.enabled = true;
                if (GUI.Button(new Rect(1005, 22, 165, 40), "다시 시작", buttonStyle)) RestartMatch();

                DrawBase(0, new Rect(30, 90, 430, 22));
                DrawBase(1, new Rect(740, 90, 430, 22));
                DrawBattlefield();
                DrawControls();
                if (paused || snapshot.IsOver)
                {
                    Fill(new Rect(390, 230, 420, 95), new Color(0.08f, 0.1f, 0.16f, 0.96f));
                    GUI.Label(new Rect(425, 255, 370, 50), snapshot.IsOver ? ResultLabel() : "일시정지", titleStyle);
                }
            }
            finally { GUI.matrix = oldMatrix; GUI.enabled = oldEnabled; }
        }

        private void DrawBase(int owner, Rect bar)
        {
            var health = snapshot.Bases[owner];
            GUI.Label(new Rect(bar.x, bar.y + 28, bar.width, 30), $"{(owner == 0 ? "내 본진" : "적 본진")}  {health.Hp:0} / {health.HpMax:0}", textStyle);
            Fill(bar, new Color(0.14f, 0.17f, 0.22f));
            Fill(new Rect(bar.x, bar.y, bar.width * (float)(health.Hp / health.HpMax), bar.height), owner == 0 ? Blue : OrchardColor);
        }

        private void DrawBattlefield()
        {
            const float ground = 405;
            Fill(new Rect(30, 165, 1140, 290), new Color(0.075f, 0.105f, 0.17f));
            Fill(new Rect(70, ground, 1060, 3), new Color(0.26f, 0.34f, 0.45f));
            for (var i = 0; i <= 10; i++) Fill(new Rect(100 + i * 100, ground + 3, 1, 10), Color.gray);
            for (var owner = 0; owner < 2; owner++)
            {
                var x = owner == 0 ? 68 : 1100;
                var color = owner == 0 ? Blue : OrchardColor;
                Fill(new Rect(x, ground - 95, 32, 95), color);
                Fill(new Rect(x - 7, ground - 108, 46, 14), color);
            }
            foreach (var unit in snapshot.Units)
            {
                var x = 100 + (float)unit.X;
                var tier = M0Balance.Get(unit.UnitId).Tier;
                var height = 24 + tier * 3;
                var color = unit.Owner == 0 ? Blue : OrchardColor;
                if (unit.State == "attack") color = Color.Lerp(color, Color.white, 0.5f);
                Fill(new Rect(x - 8, ground - height, 16, height), color);
                Fill(new Rect(x - 6, ground - height - 7, 12, 7), color);
                Fill(new Rect(x + (unit.Facing == 1 ? 8 : -17), ground - height + 8, 9, 5), color);
                Fill(new Rect(x - 10, ground - height - 16, 20, 4), Color.black);
                Fill(new Rect(x - 10, ground - height - 16, 20 * (float)(unit.Hp / unit.HpMax), 4), Color.green);
                GUI.Label(new Rect(x - 14, ground - height - 40, 48, 23), "T" + tier, smallStyle);
            }
            GUI.Label(new Rect(50, 420, 1090, 26), "파랑: 세미콘(아군)   /   밝은 회색: 오차드(적군)   /   체력바가 있는 도형들이 자동으로 교전합니다.", smallStyle);
        }

        private void DrawControls()
        {
            var player = snapshot.Players[0];
            GUI.Label(new Rect(30, 473, 400, 30), $"캐시  {player.Cash:0}     인구  {player.Supply}/{player.SupplyMax}", textStyle);
            GUI.Label(new Rect(610, 473, 560, 30), $"생산 대기 {player.Queue.Length}/5    진행 {player.QueueProgress:P0}", textStyle);
            for (var i = 0; i < M0Balance.SemiconUnits.Count; i++)
            {
                var type = M0Balance.SemiconUnits[i];
                var stats = M0Balance.Get(type);
                GUI.enabled = !paused && !snapshot.IsOver && player.Cash >= stats.Cost && player.Cooldowns[(int)type] <= 0 &&
                    player.Supply + stats.Supply <= player.SupplyMax && player.Queue.Length < M0Balance.QueueMax;
                var cooldown = player.Cooldowns[(int)type] > 0 ? $" · {player.Cooldowns[(int)type]:0.0}초" : "";
                if (GUI.Button(new Rect(30 + i * 127, 515, 120, 78), $"T{stats.Tier}\n{UnitLabel(type)}\n{stats.Cost} 캐시{cooldown}", unitButtonStyle)) QueueUnit(type);
            }
            GUI.enabled = !paused && !snapshot.IsOver;
            for (var i = 0; i < player.Queue.Length; i++)
                if (GUI.Button(new Rect(30 + i * 150, 610, 143, 46), $"{UnitLabel(player.Queue[i])}\n취소", unitButtonStyle)) CancelQueuedUnit(i);
            if (GUI.Button(new Rect(1005, 615, 165, 40), "항복", buttonStyle)) Surrender();
            GUI.enabled = true;
            GUI.Label(new Rect(30, 675, 1140, 30), message, textStyle);
            GUI.Label(new Rect(30, 725, 1140, 25), "세미콘 9종 vs 오차드 9종 · 워치 메딕 회복 적용 · 나머지 고유 스킬/시대 해금은 후속 작업", smallStyle);
        }

        private string ResultLabel() => !snapshot.Winner.HasValue ? "무승부" : snapshot.Winner.Value == 0 ? "승리!" : "패배";
        private static string UnitLabel(UnitId type) => M0Balance.Get(type).Name;

        private static void Fill(Rect rect, Color color)
        {
            var previous = GUI.color;
            GUI.color = color;
            GUI.DrawTexture(rect, Texture2D.whiteTexture);
            GUI.color = previous;
        }
    }
}
