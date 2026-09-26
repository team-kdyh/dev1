# Orchard Basic Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add nine Orchard basic units and make the default match Semicon player 0 versus Orchard player 1.

**Architecture:** Append Orchard IDs to the current stable enum and data array. Validate faction ownership in the simulation command path; adapters use side-specific rosters.

**Tech Stack:** Unity 6000.3.2f1, C#, NUnit, .NET 10.

**Spec:** `docs/superpowers/specs/2026-09-26-orchard-basic-design.md`

## Global Constraints

- Preserve existing Semicon stat values and IDs 0–8.
- Do not add Orchard special skills in this slice.
- Keep deterministic integer-tick simulation and Unity-free Sim assembly.
- No Git repository exists in this project, so no commit steps.

---

### Task 1: Faction and Orchard data

**Files:** `Assets/Scripts/Sim/Contracts.cs`, `Assets/Scripts/Sim/M0Balance.cs`, `Assets/Scripts/Sim/Simulation.cs`, `Assets/Tests/Editor/OrchardTests.cs`, `Tools/SimChecks/SimChecks.csproj`, `Tools/SimChecks/Program.cs`.

- [x] Add failing tests for nine Orchard entries, wrong-faction rejection in both directions, and basic production/attack.
- [x] Run standalone tests and confirm those tests fail due to missing Orchard data/validation (38/41 before implementation).
- [x] Add Orchard IDs 9–17, roster and stats; validate spawn faction before payment/reservation; include factions in checksum.
- [x] Run standalone suite, updating legacy mirror tests to request explicit mirror sides (41/41).

### Task 2: Adapters and documentation

**Files:** `Assets/Scripts/Play/SimulationPlayer.cs`, `Assets/Editor/TechWar/SimulationWindow.cs`, `Tools/Headless/Program.cs`, `Assets/Tests/Editor/PlayButtonTests.cs`, `README-M0.md`, `AGENTS.md`.

- [x] Add Play test that the scripted opponent spawns Orchard and never a Semicon unit.
- [ ] Run filtered Unity test and confirm red. The original project was open in Unity, so the batch process exited before running the test.
- [x] Route opponent production and Editor controls through Orchard roster; update headless sample and docs.
- [x] Run standalone checks, Unity EditMode suite on a temporary project copy (44/44), and two identical headless seeds (`63722FAF`).
