# Semicon Skill Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic shared status/effect storage and implement Watch Medic's periodic healing without changing user-edited balance values.

**Architecture:** Extend the pure C# simulation unit state with integer-tick skill/status data. Keep target selection in a small Semicon skill pass and perform healing through one common effect method, leaving JSON interpretation and other units out of scope.

**Tech Stack:** Unity 6000.3.2f1, C#, NUnit, existing .NET 10 `Tools/SimChecks` runner.

**Spec:** `docs/superpowers/specs/2026-09-25-semicon-skill-foundation-design.md`

## Global Constraints

- Do not modify user-edited values in `Assets/Scripts/Sim/M0Balance.cs` except to add explicit skill constants requested by this plan.
- The simulation assembly must keep `noEngineReferences: true` and import no Unity APIs.
- All simulation time and status durations use integer ticks; 30 ticks equal one second.
- Same seed plus same commands must produce the same checksum every tick.
- Keep Orchard, age gates, JSON loading, and all non-Medic skills out of scope.
- This project is not a Git repository, so commit steps are intentionally omitted.

---

### Task 1: Healing Behavior Contract

**Files:** Create `Assets/Tests/Editor/MedicSkillTests.cs`; modify `Tools/SimChecks/SimChecks.csproj` and `Tools/SimChecks/Program.cs`.

**Interfaces:** Consume the existing simulation API. Produce tests defining a 30-tick interval, range 100, amount 6, three-target limit, max-HP clamp, and deterministic event order.

- [x] Write real-simulation tests covering periodic healing, max-HP clamping, and determinism.
- [x] Add `MedicSkillTests.cs` and `typeof(MedicSkillTests)` to the standalone runner.
- [x] Run `dotnet run --project Tools/SimChecks`; verify the new tests fail because no healing occurs.

### Task 2: Minimal Shared State and Heal Effect

**Files:** Create `Assets/Scripts/Sim/Effects.cs`; modify `Simulation.cs`, `Contracts.cs`, and `M0Balance.cs`; test with `MedicSkillTests.cs`.

**Interfaces:** Produce `StatusKind`, `StatusEffect`, internal unit status/timer storage, `ApplyHeal`, `UpdateStatuses`, and `RunSkills`.

- [x] Define `StatusEffect` with kind, remaining ticks, magnitude, and source ID. Add an ordered status list and skill timer to each internal unit.
- [x] Implement `ApplyHeal`: clamp at target max HP and emit `heal` only for a positive actual amount.
- [x] Add named Medic skill constants `range = 100`, `amount = 6`, `targets = 3`, `interval = 30` without altering any user-editable combat stat.
- [x] Select living damaged allies by integer HP ratio, distance, then spawn ID; heal at most three and reset the timer.
- [x] Run status/timer updates and skills after ordinary cooldown updates but before targeting and attacks.
- [x] Run `dotnet run --project Tools/SimChecks`; verify all tests pass.

### Task 3: Snapshot and Checksum Contract

**Files:** Modify `Contracts.cs`, `Simulation.cs`, and `MedicSkillTests.cs`.

**Interfaces:** Produce deep-copied `UnitView.Buffs`, `UnitView.SkillCooldownTicks`, and checksum coverage of all future-affecting skill state.

- [x] First add a failing skill snapshot isolation test; determinism tests cover checksum equality across active healing.
- [x] Run `dotnet run --project Tools/SimChecks`; verify the failure identifies missing snapshot state.
- [x] Copy status names and timer values into `UnitView`; serialize each timer and ordered status field in `GetChecksum()`.
- [x] Run the complete standalone suite and verify zero failures.

### Task 4: Unity Integration and Documentation

**Files:** Modify `SimulationPlayer.cs`, `README-M0.md`, and `PlayButtonTests.cs`.

**Interfaces:** Consume `heal` events and expose minimal visible healing feedback while preserving existing controls.

- [x] Add a failing Play integration test that observes Medic healing through the runtime adapter.
- [x] Run the filtered Unity test and verify RED.
- [x] Handle `heal` events with a short Korean message and document behavior, tick order, constants, and deferred skills. Add no new panel or asset.
- [x] Run `dotnet run --project Tools/SimChecks`, two identical Headless seeds, and all Unity `TechWar.Tests`; require zero failures and matching repeated checksums.
