# Orchard Basic Roster and Fixed Sides

The current Unity match is Semicon on the left (player 0) and Orchard on the right (player 1). This applies to Play, the Editor sandbox, and the headless sample match. Both sides still use the same deterministic command and simulation rules.

Keep Semicon IDs 0–8 and existing balance values. Add Orchard IDs 9–17 in tier order, using the master specification's cost, supply, HP, attack, range, speed, and damage type. Armor values and tick intervals absent from the specification are provisional. Each unit uses the existing single-target basic attack, movement, production, queue, and cooldown systems. Semicon Medic healing remains active. Orchard special skills are a later increment.

The simulation validates a spawn command against that player's faction and emits `WRONG_FACTION` without changing cash, supply, queue, or cooldown. Its default sides are Semicon/Orchard; an explicit faction pair permits controlled mirror-match tests. The faction pair is part of the checksum. The UI only exposes the nine player-side Semicon buttons; the scripted opponent chooses exclusively from Orchard's nine IDs. The Editor sandbox and headless runner use the same split. Existing Semicon balance edits are preserved.

Verification: reserve/spawn/attack for all nine Orchard IDs, both rejection directions, snapshot isolation, deterministic checksum, Play opponent spawn, Editor tests, and headless output.
