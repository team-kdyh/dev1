"""Build a local gallery for every PNG under assets, with no server required."""

from __future__ import annotations

import html
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UNITS = json.loads((ROOT / "units.json").read_text(encoding="utf-8"))
BY_ID = {unit["id"]: unit for unit in UNITS}
ORDER = {"previews": 0, "concepts": 1, "frames": 2, "source": 3, "atlases": 4, "placeholders": 5, "other": 6}
LABELS = {
    "previews": "전체 비교 시트",
    "concepts": "콘셉트",
    "frames": "현재 게임용 프레임",
    "source": "제품 누끼·보스 얼굴",
    "atlases": "아틀라스",
    "placeholders": "기존 플레이스홀더",
    "other": "기타",
}


def describe(path: Path) -> tuple[str, str, str, str]:
    rel = path.relative_to(ROOT).as_posix()
    category = path.parts[len(ROOT.parts)] if len(path.parts) > len(ROOT.parts) else "other"
    if category not in LABELS:
        category = "other"
    faction = "semicon" if "/semicon/" in rel or path.name.startswith("semicon_") else "orchard" if "/orchard/" in rel or path.name.startswith("orchard_") else ""
    title = path.stem.replace("-", " ").replace("_", " ")
    subtitle = ""
    if category in ("frames", "placeholders"):
        for unit_id, unit in BY_ID.items():
            prefix = unit_id + "_"
            if path.name.startswith(prefix):
                tail = path.stem[len(prefix):]
                state, frame = tail.rsplit("_", 1)
                title = f"{unit['name']} · {state} {int(frame) + 1}"
                subtitle = f"{faction} T{unit['tier']} · {state}"
                break
    return category, faction, title, subtitle


def main() -> None:
    images = sorted(
        ROOT.rglob("*.png"),
        key=lambda path: (
            ORDER.get(describe(path)[0], 9),
            path.relative_to(ROOT).as_posix(),
        ),
    )
    counts = Counter(describe(path)[0] for path in images)
    cards = []
    for path in images:
        category, faction, title, subtitle = describe(path)
        rel = path.relative_to(ROOT).as_posix()
        label = f"{title} {subtitle} {rel}".lower()
        cards.append(
            f'<figure class="card" data-category="{category}" data-faction="{faction}" '
            f'data-search="{html.escape(label, quote=True)}">'
            f'<a href="{html.escape(rel, quote=True)}" target="_blank" rel="noopener">'
            f'<img src="{html.escape(rel, quote=True)}" alt="{html.escape(title, quote=True)}" loading="lazy"></a>'
            f'<figcaption><b>{html.escape(title)}</b>'
            f'<small>{html.escape(subtitle or LABELS[category])}</small>'
            f'<code>{html.escape(rel)}</code></figcaption></figure>'
        )
    options = "".join(
        f'<option value="{key}">{label} ({counts[key]})</option>'
        for key, label in LABELS.items()
        if counts[key]
    )
    output = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TECH WAR · 전체 이미지 {len(images)}장</title>
<style>
:root {{ color-scheme: dark; font: 15px system-ui, sans-serif; background: #141925; color: #f4f6fa; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; padding: 24px; }}
main {{ max-width: 1500px; margin: auto; }}
h1 {{ margin: 0 0 8px; font-size: 27px; }}
p {{ color: #bec8d6; line-height: 1.5; }}
a {{ color: #9dd3ff; }}
.links {{ display: flex; gap: 18px; flex-wrap: wrap; margin: 14px 0 24px; }}
.controls {{ position: sticky; top: 0; z-index: 2; display: flex; gap: 10px; flex-wrap: wrap;
  align-items: end; padding: 14px; border: 1px solid #3c465b; border-radius: 9px; background: #222b3b; }}
label {{ display: grid; gap: 5px; font-size: 12px; color: #c2cad5; }}
input, select {{ min-height: 39px; padding: 7px 9px; border: 1px solid #5b6880; border-radius: 5px;
  color: #fff; background: #182131; font: inherit; }}
input {{ min-width: min(380px, 80vw); }}
#count {{ color: #dce7f8; font-weight: 700; padding: 9px; }}
.grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(185px, 1fr)); gap: 12px; margin: 20px 0 40px; }}
.card {{ margin: 0; border: 1px solid #3b455b; border-radius: 7px; overflow: hidden; background: #222a38; }}
.card[hidden] {{ display: none; }}
.card a {{ display: grid; place-items: center; height: 145px; padding: 8px; background: #404653; }}
.card img {{ max-width: 100%; max-height: 100%; object-fit: contain; image-rendering: pixelated; }}
figcaption {{ display: grid; gap: 3px; padding: 9px; min-height: 84px; }}
figcaption b {{ font-size: 13px; }}
figcaption small {{ color: #bac5d4; }}
figcaption code {{ overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; color: #95a9bf; }}
</style>
</head>
<body><main>
<h1>TECH WAR 전체 이미지 · {len(images)}장</h1>
<p>현재 일반 유닛 16종과 인물 보스 2종의 애니메이션 444장, 제품 누끼, 기존 플레이스홀더, 비교 시트·콘셉트·아틀라스를 모두 모았습니다.
이미지를 누르면 원본 크기로 열립니다. 이 파일은 서버 없이 브라우저에서 바로 열 수 있습니다.</p>
<nav class="links"><a href="previews/unit-art-contact-sheet.png">18종 한눈에 보기</a>
<a href="frames/units/semicon/semicon_t9_trifold_idle_00.png">이재용 보스</a>
<a href="frames/units/orchard/orchard_t9_imac_idle_00.png">스티브 잡스 보스</a>
<a href="previews/photo-animation-gallery.html">사진·애니메이션 나란히 보기</a>
<a href="previews/index.html">개별 애니메이션 보기</a>
<a href="audio/index.html">사운드 듣기</a></nav>
<div class="controls">
  <label>종류<select id="category"><option value="">전체 ({len(images)})</option>{options}</select></label>
  <label>진영<select id="faction"><option value="">전체</option><option value="semicon">세미콘</option><option value="orchard">오차드</option></select></label>
  <label>검색<input id="search" type="search" placeholder="유닛 이름, 상태, 파일명"></label>
  <span id="count">{len(images)}장 표시</span>
</div>
<div class="grid" id="gallery">{''.join(cards)}</div>
<script>
const cards = [...document.querySelectorAll('.card')];
const category = document.getElementById('category');
const faction = document.getElementById('faction');
const search = document.getElementById('search');
const count = document.getElementById('count');
function filter() {{
  const query = search.value.trim().toLowerCase();
  let visible = 0;
  for (const card of cards) {{
    const match = (!category.value || card.dataset.category === category.value) &&
      (!faction.value || card.dataset.faction === faction.value) &&
      (!query || card.dataset.search.includes(query));
    card.hidden = !match;
    if (match) visible++;
  }}
  count.textContent = visible + '장 표시';
}}
for (const control of [category, faction, search]) control.addEventListener('input', filter);
category.value = 'frames';
filter();
</script>
</main></body></html>
"""
    target = ROOT / "image-gallery.html"
    target.write_text(output, encoding="utf-8")
    print(f"Wrote {target.relative_to(ROOT)} with {len(images)} PNGs: {dict(counts)}")


if __name__ == "__main__":
    main()
