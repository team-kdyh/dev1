"""Check audio deliverables against the TECH WAR asset contract."""

from __future__ import annotations

import array
import json
import math
import shutil
import subprocess
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAMPLE_RATE = 44_100
BGM_BPM = 150
BGM_DURATION = 16 * 4 * 60 / BGM_BPM


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def ffmpeg_path() -> str | None:
    path = shutil.which("ffmpeg")
    if path:
        return path
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return None


def validate_entry(entry: dict, label: str, channels: int, ffmpeg: str | None) -> int:
    for key in ("source", "ogg", "mp3", "frames", "channels"):
        require(key in entry, f"{label}: missing {key}")
    source = ROOT / entry["source"]
    ogg = ROOT / entry["ogg"]
    mp3 = ROOT / entry["mp3"]
    require(source.exists() and ogg.exists() and mp3.exists(), f"{label}: WAV/OGG/MP3 file missing")
    require(source.suffix == ".wav" and ogg.suffix == ".ogg" and mp3.suffix == ".mp3", f"{label}: wrong extension")
    require(ogg.read_bytes()[:4] == b"OggS", f"{label}: invalid OGG header")
    mp3_header = mp3.read_bytes()[:4]
    require(mp3_header[:3] == b"ID3" or mp3_header[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"), f"{label}: invalid MP3 header")
    with wave.open(str(source), "rb") as audio:
        require(audio.getframerate() == SAMPLE_RATE, f"{label}: sample rate must be 44.1kHz")
        require(audio.getnchannels() == channels == entry["channels"], f"{label}: channel count mismatch")
        require(audio.getsampwidth() == 2, f"{label}: expected 16-bit WAV master")
        frames = audio.getnframes()
        require(frames == entry["frames"], f"{label}: frame count mismatch")
        raw = audio.readframes(frames)
    pcm = array.array("h")
    pcm.frombytes(raw)
    peak = max((abs(sample) for sample in pcm), default=0) / 32767
    rms = math.sqrt(sum(sample * sample for sample in pcm) / max(1, len(pcm))) / 32767
    require(peak <= 10 ** (-6 / 20) + 0.0001, f"{label}: peak exceeds -6 dBFS")
    require(rms > 0.001, f"{label}: audio is effectively silent")
    duration = frames / SAMPLE_RATE
    if channels == 1:
        require(0.1 <= duration <= 1.5, f"{label}: SFX duration outside 0.1–1.5 seconds")
    else:
        require(abs(duration - BGM_DURATION) < 1 / SAMPLE_RATE, f"{label}: BGM loop length mismatch")
        require(entry["loopStart"] == 0 and entry["loopEnd"] == frames, f"{label}: loop points mismatch")
        require(entry["tempoBpm"] == BGM_BPM, f"{label}: tempo mismatch")
    if ffmpeg:
        for encoded in (ogg, mp3):
            result = subprocess.run(
                [ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(encoded), "-f", "null", "-"],
                capture_output=True, text=True,
            )
            require(result.returncode == 0, f"{label}: decoding {encoded.name} failed: {result.stderr.strip()}")
    return frames


def main() -> int:
    path = ROOT / "audio" / "manifest.json"
    require(path.exists(), "Missing audio/manifest.json; run generate:audio")
    manifest = json.loads(path.read_text(encoding="utf-8"))
    require(manifest.get("sampleRate") == SAMPLE_RATE, "Audio manifest sample rate mismatch")
    unit_ids = {item["id"] for item in json.loads((ROOT / "units.json").read_text(encoding="utf-8"))}
    require(set(manifest["sfx"]) == unit_ids | {"misc"}, "SFX unit IDs differ from units.json")
    ffmpeg = ffmpeg_path()
    sfx_count = 0
    for unit_id in sorted(unit_ids):
        actions = manifest["sfx"][unit_id]
        require(set(actions) == {"attack", "death", "skill"}, f"{unit_id}: missing SFX action")
        for action, entry in actions.items():
            validate_entry(entry, f"{unit_id}/{action}", 1, ffmpeg)
            sfx_count += 1
    for key, entry in manifest["sfx"]["misc"].items():
        validate_entry(entry, key, 1, ffmpeg)
        sfx_count += 1
    require(sfx_count == 67, f"Expected 67 SFX, found {sfx_count}")
    require(set(manifest["bgm"]) == {"semicon", "orchard"}, "BGM factions missing")
    bgm_count = 0
    for faction, layers in manifest["bgm"].items():
        require(set(layers) == {"bass_drums", "synth", "strings", "age4"}, f"{faction}: BGM layers missing")
        for layer, entry in layers.items():
            validate_entry(entry, f"{faction}/{layer}", 2, ffmpeg)
            bgm_count += 1
    print(f"Audio validation passed: {sfx_count} SFX, {bgm_count} BGM, WAV/OGG/MP3; encoded decode {'checked' if ffmpeg else 'not checked (FFmpeg missing)'}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError, wave.Error) as error:
        print(f"validate:audio failed: {error}", file=sys.stderr)
        sys.exit(1)
