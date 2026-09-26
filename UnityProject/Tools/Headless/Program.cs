using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text.Json;
using TechWar.Sim;

internal static class Program
{
    private static int Main(string[] args)
    {
        uint seed = 12345;
        var batch = 1;
        string outputPath = null;
        try
        {
            for (var i = 0; i < args.Length; i++)
            {
                if (args[i] == "--help")
                {
                    Console.WriteLine("dotnet run --project Tools/Headless -- [--seed 12345] [--batch 1..1000] [--out new-file.json]");
                    Console.WriteLine("Semicon player 0 versus Orchard player 1, scripted producers. One match: JSON; multiple matches: CSV. Existing output files are not overwritten.");
                    return 0;
                }
                if (i + 1 >= args.Length) throw new ArgumentException("Missing option value: " + args[i]);
                var option = args[i++];
                if (option == "--seed") seed = uint.Parse(args[i], CultureInfo.InvariantCulture);
                else if (option == "--batch") batch = int.Parse(args[i], CultureInfo.InvariantCulture);
                else if (option == "--out") outputPath = args[i];
                else throw new ArgumentException("Unknown option: " + option);
            }
            if (batch < 1 || batch > 1000) throw new ArgumentOutOfRangeException(nameof(batch), "Use 1..1000 matches.");
            if (outputPath == null) Run(seed, batch, Console.Out);
            else
            {
                using (var file = new FileStream(outputPath, FileMode.CreateNew, FileAccess.Write))
                using (var writer = new StreamWriter(file)) Run(seed, batch, writer);
            }
            return 0;
        }
        catch (Exception error) when (error is ArgumentException || error is FormatException ||
            error is OverflowException || error is IOException || error is UnauthorizedAccessException)
        {
            Console.Error.WriteLine(error.Message);
            return 1;
        }
    }

    private static void Run(uint seed, int batch, TextWriter output)
    {
        if (batch > 1) output.WriteLine("seed,winner,durationTicks,leftBaseHp,rightBaseHp,checksum");
        for (var match = 0; match < batch; match++)
        {
            var matchSeed = unchecked(seed + (uint)match);
            var simulation = new Simulation(matchSeed);
            var log = new List<object>();
            var produced = new int[M0Balance.UnitCount];
            var killed = 0;
            Snapshot snapshot = simulation.GetSnapshot();
            while (!simulation.IsOver())
            {
                if (simulation.Tick % 90 == 0)
                    for (var player = 0; player < 2; player++)
                    {
                        // Deterministic scripted input exercises the same command validation as a human.
                        var roster = M0Balance.GetRoster(player == 0 ? Faction.Semicon : Faction.Orchard);
                        var type = roster[(simulation.Tick / 90 + player + (int)(matchSeed % (uint)roster.Count)) % roster.Count];
                        if (snapshot.Players[player].Cash < M0Balance.Get(type).Cost) type = roster[0];
                        var input = new TickInput(simulation.Tick + Simulation.InputDelay, player, new SpawnUnitCommand(type));
                        simulation.PushCommand(input);
                        if (batch == 1) log.Add(new { tick = input.Tick, playerId = player, cmd = "SPAWN_UNIT", unitId = type.ToString() });
                    }
                simulation.Step();
                snapshot = simulation.GetSnapshot();
                foreach (var e in snapshot.Events)
                {
                    if (e.Type == "spawn") produced[(int)e.UnitType]++;
                    if (e.Type == "kill") killed++;
                }
            }
            if (batch == 1)
            {
                var productionCounts = new Dictionary<string, int>();
                foreach (var type in M0Balance.SemiconUnits) productionCounts.Add(type.ToString(), produced[(int)type]);
                foreach (var type in M0Balance.OrchardUnits) productionCounts.Add(type.ToString(), produced[(int)type]);
                output.WriteLine(JsonSerializer.Serialize(new { seed = matchSeed, contractVersion = Contracts.Version,
                    balanceVersion = M0Balance.Version, scenario = "Semicon player 0 versus Orchard player 1, scripted producers", winner = snapshot.Winner,
                    durationTicks = snapshot.Tick, finalBaseHp = new[] { snapshot.Bases[0].Hp, snapshot.Bases[1].Hp },
                    unitsProduced = productionCounts, unitsKilled = killed,
                    checksum = snapshot.Checksum, commandLog = log }, new JsonSerializerOptions { WriteIndented = true }));
            }
            else
                output.WriteLine(FormattableString.Invariant($"{matchSeed},{snapshot.Winner?.ToString() ?? "draw"},{snapshot.Tick},{snapshot.Bases[0].Hp},{snapshot.Bases[1].Hp},{snapshot.Checksum}"));
        }
    }
}
