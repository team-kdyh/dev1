"""Synthesize original SFX and loopable faction music; export WAV, OGG, MP3.

Requires imageio-ffmpeg (see requirements-audio.txt) or ffmpeg on PATH.
"""

from __future__ import annotations

import array
import json
import math
import random
import shutil
import subprocess
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UNITS = json.loads((ROOT / "units.json").read_text(encoding="utf-8"))
SAMPLE_RATE = 44_100
TAU = math.tau
BGM_BPM = 150
BGM_BARS = 16
BGM_DURATION = BGM_BARS * 4 * 60 / BGM_BPM


def ffmpeg_path() -> str:
    path = shutil.which("ffmpeg")
    if path:
        return path
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError as error:
        raise RuntimeError("FFmpeg is needed for OGG/MP3; install assets/tools/requirements-audio.txt") from error


def samples(seconds: float) -> list[float]:
    return [0.0] * round(seconds * SAMPLE_RATE)


def waveform(phase: float, kind: str) -> float:
    if kind == "sine":
        return math.sin(phase)
    if kind == "triangle":
        return 2 / math.pi * math.asin(math.sin(phase))
    if kind == "square":
        return 1.0 if math.sin(phase) >= 0 else -1.0
    if kind == "saw":
        return 2 * ((phase / TAU) % 1) - 1
    raise ValueError(f"Unknown oscillator: {kind}")


def tone(buffer: list[float], start: float, duration: float, from_hz: float, to_hz: float, gain: float, kind: str = "sine", decay: float = 3.0, tremolo: float = 0.0) -> None:
    begin = round(start * SAMPLE_RATE)
    count = min(round(duration * SAMPLE_RATE), len(buffer) - begin)
    if count <= 0:
        return
    phase = 0.0
    for index in range(count):
        t = index / max(1, count - 1)
        frequency = from_hz * (to_hz / from_hz) ** t if from_hz > 0 and to_hz > 0 else from_hz
        phase += TAU * frequency / SAMPLE_RATE
        attack = min(1.0, index / max(1, round(0.004 * SAMPLE_RATE)))
        envelope = attack * math.exp(-decay * t) * (1 - t) ** 0.4
        vibrato = 1 - tremolo + tremolo * math.sin(TAU * 18 * index / SAMPLE_RATE) ** 2
        buffer[begin + index] += gain * envelope * vibrato * waveform(phase, kind)


def noise(buffer: list[float], start: float, duration: float, gain: float, seed: int, decay: float = 5.0, smooth: float = 0.2) -> None:
    begin = round(start * SAMPLE_RATE)
    count = min(round(duration * SAMPLE_RATE), len(buffer) - begin)
    if count <= 0:
        return
    rng = random.Random(seed)
    previous = 0.0
    for index in range(count):
        t = index / max(1, count - 1)
        previous = previous * smooth + rng.uniform(-1, 1) * (1 - smooth)
        attack = min(1.0, index / max(1, round(0.003 * SAMPLE_RATE)))
        envelope = attack * math.exp(-decay * t) * (1 - t)
        buffer[begin + index] += gain * envelope * previous


def finish(buffer: list[float], peak_db: float = -6.5) -> list[float]:
    fade = min(round(0.008 * SAMPLE_RATE), len(buffer) // 4)
    for index in range(fade):
        buffer[index] *= index / fade
        buffer[-index - 1] *= index / fade
    peak = max((abs(value) for value in buffer), default=0)
    if peak:
        factor = min(8.0, 10 ** (peak_db / 20) / peak)
        return [max(-1.0, min(1.0, value * factor)) for value in buffer]
    return buffer


def make_unit_sfx(unit: dict, action: str) -> list[float]:
    tier = unit["tier"]
    semicon = unit["faction"] == "semicon"
    seed = sum(ord(char) for char in unit["id"] + action)
    base = 165 + tier * 29 + (0 if semicon else 47)
    length = {"attack": 0.26 + tier * 0.045, "death": 0.40 + tier * 0.072, "skill": 0.48 + tier * 0.067}[action]
    length = min(1.38, length)
    result = samples(length)

    if action == "attack":
        if tier == 1:
            for offset in (0.0, 0.11 if semicon else 0.09):
                tone(result, offset, 0.13, base * 1.9, base * 0.6, 0.52, "triangle", 4.2)
                noise(result, offset, 0.07, 0.25, seed + round(offset * 100), 7.0, 0.15)
        elif tier == 2:
            for offset, multiplier in ((0.0, 1), (0.10, 1.25), (0.20, 1.5)):
                tone(result, offset, 0.22, base * multiplier, base * multiplier * 1.35, 0.23, "sine", 2.2)
            tone(result, 0.02, 0.24, base / 2, base / 2, 0.19, "triangle", 3.0)
        elif tier == 3:
            tone(result, 0.0, 0.24, base * 2.1, base * 0.75, 0.48, "saw" if semicon else "sine", 3.8)
            noise(result, 0, 0.055, 0.17, seed, 8.0, 0.05)
        elif tier == 4:
            tone(result, 0.0, 0.25, base * 1.3, base * 2.5, 0.24, "sine", 2.5)
            tone(result, 0.18, 0.24, base * 3.8, base * 0.65, 0.60, "saw" if semicon else "triangle", 5.0)
            noise(result, 0.18, 0.12, 0.28, seed, 8.0, 0.1)
        elif tier == 5:
            tone(result, 0.0, 0.32, base * 0.6, base * 0.24, 0.73, "triangle", 4.0)
            noise(result, 0.0, 0.22, 0.52, seed, 5.2, 0.45)
            if not semicon:
                tone(result, 0.10, 0.14, base * 2.1, base * 1.0, 0.36, "saw", 6.0)
        elif tier == 6:
            tone(result, 0, 0.42, base * 0.72, base * 0.32, 0.67, "saw" if semicon else "sine", 4.4)
            noise(result, 0.19 if semicon else 0.08, 0.24, 0.54, seed, 6.0, 0.25)
            tone(result, 0.18, 0.18, base * 1.4, base * 0.55, 0.26, "triangle", 5.0)
        elif tier in (7, 8):
            tone(result, 0, 0.46, base * 0.8, base * 0.35, 0.68, "saw", 3.7)
            tone(result, 0.08, 0.34, base * 1.95, base * 0.85, 0.35, "triangle", 3.0)
            noise(result, 0.12, 0.23, 0.52 if tier == 8 else 0.37, seed, 5.8, 0.38)
        else:
            for multiplier in (1, 1.25, 1.5):
                tone(result, 0, 0.55, base * multiplier, base * multiplier * 0.64, 0.28, "triangle", 2.1)
            noise(result, 0.20, 0.28, 0.25, seed, 5.0, 0.55)
    elif action == "death":
        tone(result, 0, length * 0.74, base * 1.4, base * 0.18, 0.49, "triangle" if semicon else "sine", 3.0)
        noise(result, 0, length * 0.52, 0.54 if semicon else 0.62, seed, 3.5, 0.35 if semicon else 0.05)
        for index in range(3 + tier // 3):
            offset = 0.05 + index * 0.07
            tone(result, offset, 0.13, base * (1.3 + index * 0.32), base * (0.4 + index * 0.12), 0.22, "sine", 5.0)
            noise(result, offset, 0.05, 0.16, seed + index, 10.0, 0.05)
        if tier == 9:
            for offset, multiplier in ((0.12, 1), (0.32, 0.75), (0.52, 0.5)):
                tone(result, offset, 0.4, base * multiplier, base * multiplier * 0.55, 0.23, "sine", 2.5)
    else:
        for index in range(3 + tier // 4):
            offset = 0.06 + index * 0.09
            multiplier = (1.0 + index * 0.2) * (1.0 if semicon else 1.13)
            tone(result, offset, 0.28, base * multiplier, base * multiplier * (1.8 if semicon else 1.45), 0.30, "sine" if not semicon else "triangle", 2.6)
        tone(result, 0.02, length * 0.7, base / 2, base * 0.74, 0.28, "triangle", 2.3)
        if tier in (6, 8, 9):
            noise(result, 0.12, length * 0.55, 0.2, seed, 5.0, 0.5)
    return finish(result, -6.5 if action != "skill" else -8.0)


def make_misc_sfx(name: str) -> list[float]:
    lengths = {
        "button_click": 0.12, "purchase_fail": 0.31, "base_hit": 0.58,
        "age_up": 1.18, "victory": 1.43, "defeat": 1.35,
        "ui_transition": 0.27, "t9_semicon_cutin": 1.45, "t9_orchard_cutin": 1.45,
        "semicon_fast_charge": 0.68, "semicon_mass_production": 0.71,
        "orchard_airdrop": 0.72, "orchard_ota_update": 0.84,
    }
    length = lengths[name]
    result = samples(length)
    seed = sum(ord(char) for char in name)
    if name == "button_click":
        tone(result, 0, 0.10, 940, 650, 0.30, "sine", 4.0)
        noise(result, 0, 0.035, 0.14, seed, 10.0)
    elif name == "purchase_fail":
        for offset, pitch in ((0, 390), (0.13, 300)):
            tone(result, offset, 0.17, pitch, pitch * 0.9, 0.35, "triangle", 2.0)
    elif name == "base_hit":
        tone(result, 0, 0.52, 120, 47, 0.76, "sine", 4.0)
        noise(result, 0, 0.36, 0.60, seed, 4.0, 0.45)
        tone(result, 0.08, 0.30, 310, 95, 0.27, "saw", 5.0)
    elif name in ("victory", "age_up"):
        notes = (330, 415, 494, 659) if name == "victory" else (262, 330, 392, 523)
        for index, pitch in enumerate(notes):
            tone(result, 0.10 + index * 0.21, 0.50, pitch, pitch, 0.26, "triangle", 1.7)
            tone(result, 0.10 + index * 0.21, 0.50, pitch * 2, pitch * 2, 0.07, "sine", 2.3)
    elif name == "defeat":
        for index, pitch in enumerate((392, 330, 262, 196)):
            tone(result, 0.10 + index * 0.23, 0.53, pitch, pitch * 0.94, 0.25, "sine", 2.0)
        noise(result, 0.45, 0.40, 0.13, seed, 3.0, 0.7)
    elif name == "ui_transition":
        tone(result, 0, 0.23, 610, 1100, 0.28, "sine", 3.3)
        noise(result, 0, 0.10, 0.09, seed, 5.0)
    elif "cutin" in name:
        orchard = "orchard" in name
        for index, pitch in enumerate((176, 220, 264) if not orchard else (220, 277, 330)):
            tone(result, index * 0.16, 1.25 - index * 0.12, pitch, pitch * 1.2, 0.27, "triangle" if not orchard else "sine", 1.7)
        noise(result, 0.52, 0.50, 0.23, seed, 4.0, 0.65)
    else:
        base = 290 if "semicon" in name else 410
        for index in range(4):
            offset = index * 0.11
            tone(result, offset, 0.25, base * (1 + index * 0.24), base * (1.4 + index * 0.22), 0.26, "triangle", 2.5)
        noise(result, 0.08, 0.17, 0.17, seed, 5.0)
    return finish(result, -8.0 if name.startswith("button") or name.startswith("ui") else -6.5)


def write_wave(path: Path, mono: list[float] | tuple[list[float], list[float]]) -> tuple[int, int]:
    if isinstance(mono, tuple):
        left, right = mono
        if len(left) != len(right):
            raise ValueError("Stereo channels have different lengths")
        data = array.array("h")
        for a, b in zip(left, right):
            data.append(round(max(-1, min(1, a)) * 32767))
            data.append(round(max(-1, min(1, b)) * 32767))
        channels, frame_count = 2, len(left)
    else:
        data = array.array("h", (round(max(-1, min(1, value)) * 32767) for value in mono))
        channels, frame_count = 1, len(mono)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as output:
        output.setnchannels(channels)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(data.tobytes())
    return channels, frame_count


def encode(ffmpeg: str, source: Path, ogg: Path, mp3: Path, *, music: bool = False) -> None:
    ogg.parent.mkdir(parents=True, exist_ok=True)
    settings = [
        (ogg, ["-c:a", "libvorbis", "-qscale:a", "5" if music else "4"]),
        (mp3, ["-c:a", "libmp3lame", "-b:a", "192k" if music else "160k"]),
    ]
    for target, codec in settings:
        completed = subprocess.run(
            [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(source), *codec, str(target)],
            capture_output=True, text=True,
        )
        if completed.returncode:
            raise RuntimeError(f"FFmpeg failed for {target}: {completed.stderr.strip()}")


def add_note(left: list[float], right: list[float], start: float, duration: float, hz: float, gain: float, kind: str, pan: float = 0, fade: float = 0.05) -> None:
    begin = round(start * SAMPLE_RATE)
    count = min(round(duration * SAMPLE_RATE), len(left) - begin)
    if count <= 0:
        return
    phase = 0.0
    left_gain = gain * math.sqrt((1 - pan) / 2)
    right_gain = gain * math.sqrt((1 + pan) / 2)
    attack_samples = max(1, round(fade * SAMPLE_RATE))
    for index in range(count):
        t = index / SAMPLE_RATE
        phase += TAU * hz / SAMPLE_RATE
        envelope = min(1.0, index / attack_samples) * min(1.0, (count - 1 - index) / attack_samples)
        value = waveform(phase, kind) * envelope
        left[begin + index] += left_gain * value
        right[begin + index] += right_gain * value


def add_drum(left: list[float], right: list[float], start: float, kind: str, seed: int) -> None:
    duration = 0.30 if kind == "kick" else (0.18 if kind == "snare" else 0.09)
    begin = round(start * SAMPLE_RATE)
    count = min(round(duration * SAMPLE_RATE), len(left) - begin)
    rng = random.Random(seed)
    phase = 0.0
    previous = 0.0
    for index in range(count):
        t = index / SAMPLE_RATE
        if kind == "kick":
            frequency = 48 + 170 * math.exp(-43 * t)
            phase += TAU * frequency / SAMPLE_RATE
            click = rng.uniform(-1, 1) * math.exp(-190 * t) * 0.14
            value = math.sin(phase) * math.exp(-14 * t) * 0.78 + click
        else:
            previous = previous * 0.1 + rng.uniform(-1, 1) * 0.9
            if kind == "snare":
                body = math.sin(TAU * 184 * t) * math.exp(-25 * t) * 0.24
                value = body + previous * math.exp(-19 * t) * 0.28
            else:
                value = previous * math.exp(-55 * t) * 0.15
        left[begin + index] += value * 0.85
        right[begin + index] += value * 0.85


def midi(note: int) -> float:
    return 440.0 * 2 ** ((note - 69) / 12)


def make_bgm(faction: str, layer: str) -> tuple[list[float], list[float]]:
    """16-bar minor-key combat electronica. Every stem starts on the same beat."""
    count = round(BGM_DURATION * SAMPLE_RATE)
    left, right = [0.0] * count, [0.0] * count
    beat = 60 / BGM_BPM
    bar_length = beat * 4
    semicon = faction == "semicon"
    # Dm-Bb-C-A versus F#m-D-A-E: different identities, same tempo.
    roots = ([38, 34, 36, 33, 38, 34, 31, 33] if semicon
             else [42, 38, 33, 40, 42, 38, 35, 40])
    motif = ([0, 3, 7, 10, 7, 3, 0, 12] if semicon
             else [0, 7, 10, 12, 10, 7, 3, 7])

    if layer in ("bass_drums", "age4"):
        for bar in range(BGM_BARS):
            root = roots[bar % 8]
            start = bar * bar_length
            for step in range(16):
                at = start + step * beat / 4
                if step % 4 == 0:
                    add_drum(left, right, at, "kick", bar * 100 + step)
                if step in (4, 12):
                    add_drum(left, right, at, "snare", bar * 100 + step + 1000)
                if step % 2 == 1 or (layer == "age4" and step in (14, 15)):
                    add_drum(left, right, at, "hat", bar * 100 + step + 2000)
                if step in (0, 3, 6, 8, 11, 14):
                    pitch = midi(root + (7 if step == 14 else 0))
                    add_note(left, right, at, beat * (0.61 if step in (0, 8) else 0.37),
                             pitch, 0.21, "saw" if semicon else "triangle", 0, 0.004)
                    add_note(left, right, at, beat * 0.3, pitch / 2, 0.08, "sine", 0, 0.003)
    if layer in ("synth", "age4"):
        for bar in range(BGM_BARS):
            root = roots[bar % 8] + 24
            for step in range(16):
                if step in (3, 7, 11, 15) and bar < 4 and layer != "age4":
                    continue
                at = bar * bar_length + step * beat / 4
                degree = motif[(step + (bar % 2) * 2) % 8]
                pitch = midi(root + degree)
                gain = 0.08 if step % 4 else 0.13
                pan = -0.42 if step % 2 else 0.42
                add_note(left, right, at, beat * 0.21, pitch, gain,
                         "saw" if semicon else "triangle", pan, 0.005)
                if step % 4 == 0:
                    add_note(left, right, at, beat * 0.32, pitch * 2, 0.035,
                             "sine", -pan, 0.005)
    if layer in ("strings", "age4"):
        for bar in range(BGM_BARS):
            root = roots[bar % 8] + 24
            start = bar * bar_length
            # Short synthetic brass/strings stabs against sustained minor chord.
            for degree, pan in ((0, -0.5), (3, 0), (7, 0.5)):
                add_note(left, right, start, bar_length - 0.09, midi(root + degree),
                         0.046, "saw" if semicon else "triangle", pan, 0.09)
            for offset in (0.0, 1.5, 2.75):
                at = start + offset * beat
                for degree in (0, 7, 12):
                    add_note(left, right, at, beat * 0.21, midi(root + degree),
                             0.075, "saw" if semicon else "triangle",
                             -0.3 if degree == 0 else 0.3, 0.009)
    if layer == "age4":
        for bar in range(BGM_BARS):
            if bar % 4 == 3:
                for step in range(8):
                    at = bar * bar_length + (3 + step / 8) * beat
                    add_drum(left, right, at, "snare", 4000 + bar * 8 + step)

    # Note tails finish before the boundary; a short fade avoids PCM clicks.
    fade_samples = round(0.018 * SAMPLE_RATE)
    for index in range(fade_samples):
        scale_down = index / fade_samples
        left[index] *= scale_down
        right[index] *= scale_down
        left[-index - 1] *= scale_down
        right[-index - 1] *= scale_down
    peak = max(max(map(abs, left)), max(map(abs, right)))
    target = {"bass_drums": 0.18, "synth": 0.16, "strings": 0.14, "age4": 0.43}[layer]
    factor = target / peak if peak else 1.0
    return [value * factor for value in left], [value * factor for value in right]


def main() -> None:
    ffmpeg = ffmpeg_path()
    manifest = {"version": "0.2", "sampleRate": SAMPLE_RATE, "sfx": {}, "bgm": {}}
    effect_count = 0
    for unit in UNITS:
        manifest["sfx"][unit["id"]] = {}
        for action in ("attack", "death", "skill"):
            name = f"sfx_{unit['id']}_{action}"
            source = ROOT / "audio" / "source" / "sfx" / f"{name}.wav"
            data = make_unit_sfx(unit, action)
            channels, frames = write_wave(source, data)
            ogg = ROOT / "audio" / "sfx" / f"{name}.ogg"
            mp3 = ROOT / "audio" / "sfx" / f"{name}.mp3"
            encode(ffmpeg, source, ogg, mp3)
            manifest["sfx"][unit["id"]][action] = {
                "ogg": ogg.relative_to(ROOT).as_posix(), "mp3": mp3.relative_to(ROOT).as_posix(),
                "source": source.relative_to(ROOT).as_posix(), "channels": channels, "frames": frames,
            }
            effect_count += 1
    misc = (
        "button_click", "purchase_fail", "base_hit", "age_up", "victory", "defeat",
        "ui_transition", "t9_semicon_cutin", "t9_orchard_cutin",
        "semicon_fast_charge", "semicon_mass_production", "orchard_airdrop", "orchard_ota_update",
    )
    manifest["sfx"]["misc"] = {}
    for key in misc:
        name = f"sfx_{key}"
        source = ROOT / "audio" / "source" / "sfx" / f"{name}.wav"
        channels, frames = write_wave(source, make_misc_sfx(key))
        ogg = ROOT / "audio" / "sfx" / f"{name}.ogg"
        mp3 = ROOT / "audio" / "sfx" / f"{name}.mp3"
        encode(ffmpeg, source, ogg, mp3)
        manifest["sfx"]["misc"][key] = {
            "ogg": ogg.relative_to(ROOT).as_posix(), "mp3": mp3.relative_to(ROOT).as_posix(),
            "source": source.relative_to(ROOT).as_posix(), "channels": channels, "frames": frames,
        }
        effect_count += 1
    for faction in ("semicon", "orchard"):
        manifest["bgm"][faction] = {}
        for layer in ("bass_drums", "synth", "strings", "age4"):
            name = f"bgm_{faction}_{layer}"
            source = ROOT / "audio" / "source" / "bgm" / f"{name}.wav"
            channels, frames = write_wave(source, make_bgm(faction, layer))
            ogg = ROOT / "audio" / "bgm" / f"{name}.ogg"
            mp3 = ROOT / "audio" / "bgm" / f"{name}.mp3"
            encode(ffmpeg, source, ogg, mp3, music=True)
            manifest["bgm"][faction][layer] = {
                "ogg": ogg.relative_to(ROOT).as_posix(), "mp3": mp3.relative_to(ROOT).as_posix(),
                "source": source.relative_to(ROOT).as_posix(), "channels": channels,
                "loopStart": 0, "loopEnd": frames, "frames": frames, "tempoBpm": BGM_BPM,
            }
    destination = ROOT / "audio" / "manifest.json"
    destination.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Audio: created {effect_count} mono SFX and 8 stereo BGM loops (WAV + OGG + MP3)")


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
        print(f"generate:audio failed: {error}", file=sys.stderr)
        sys.exit(1)
