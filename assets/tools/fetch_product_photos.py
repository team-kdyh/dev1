"""Download selected official product photos used by the photo sprite pipeline."""

from __future__ import annotations

import html
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "source" / "product-photos"

SAMSUNG = {
    "semicon_t1_buds": ("galaxy-buds3-pro", "001-galaxy-buds3pro-silver-front.jpg"),
    "semicon_t2_watch_medic": ("galaxy-watch-ultra", "001-galaxy-watch-ultra-titanium-blue-frontjpg.jpg"),
    "semicon_t3_aphone_soldier": ("galaxy-a56-5g", "003-galaxy-a56-5g-awesomelightgray-back.jpg"),
    "semicon_t4_sphone_sniper": ("galaxy-s25-ultra", "005-galaxy-s25ultra-titaniumsilverblue-device-spen-back.jpg"),
    "semicon_t5_fold": ("galaxy-z-fold6", "002-galaxy-zfold6-silvershadow-openback115.jpg"),
    "semicon_t6_tab_artillery": ("galaxy-tab-s10-ultra", "001-kv-main-galaxy-tabs10ultra-spen.jpg"),
    "semicon_t7_workstation": ("galaxy-book4-ultra", "001-galaxy-book4-ultra-16-us-moonstonegray-front.jpg"),
}

SAMSUNG_EXTRA = {
    "semicon_t5_fold_closed": ("galaxy-z-fold6", "003-galaxy-zfold6-silvershadow-front.jpg"),
}

APPLE = {
    "orchard_t1_airpod_duo": ("https://www.apple.com/newsroom/2022/09/apple-announces-the-next-generation-of-airpods-pro/", "Apple-AirPods-Pro-2nd-gen-l-and-r-220907_inline.jpg.large.jpg"),
    "orchard_t3_phone": ("https://www.apple.com/newsroom/2024/09/get-ready-to-upgrade-to-the-new-iphone-16-apple-watch-and-airpods-lineups/", "Apple-iPhone-16_inline.jpg.large.jpg"),
    "orchard_t5_pad_guard": ("https://www.apple.com/uk/newsroom/2024/05/apple-unveils-stunning-new-ipad-pro-with-m4-chip-and-apple-pencil-pro/", "Apple-iPad-Pro-Ultra-Retina-XDR-with-OLED-240507_big.jpg.large.jpg"),
    "orchard_t6_vision": ("https://www.apple.com/newsroom/2023/06/introducing-apple-vision-pro/", "Apple-WWDC23-Vision-Pro-with-battery-230605_big.jpg.large.jpg"),
    "orchard_t7_air_laptop": ("https://www.apple.com/newsroom/2024/03/apple-unveils-the-new-13-and-15-inch-macbook-air-with-the-powerful-m3-chip/", "Apple-MacBook-Air-Liquid-Retina-Display-240304_big.jpg.large.jpg"),
}

STORE = {
    "orchard_t2_watch_trainer": (
        "https://www.apple.com/shop/product/freh3lw/a/Refurbished-Apple-Watch-Ultra-2-GPS-Cellular-49mm-Natural-Titanium-Case-with-Orange-Ocean-Band",
        "refurb-49-cell-titanium-ocean-orange-ultra",
    ),
    "orchard_t4_phone_pro": (
        "https://www.apple.com/ca/shop/product/fyn23vc/a/refurbished-iphone-16-pro-256gb-desert-titanium-unlocked",
        "refurb-iphone-16-pro-deserttitanium-202509",
    ),
    "orchard_t8_pro_laptop": (
        "https://www.apple.com/shop/product/g1dw0ll/a/refurbished-14-inch-macbook-pro-apple-m4-chip-with-10-core-cpu-and-10-core-gpu-silver",
        "refurb-mbp14-m4-silver-202502",
    ),
}


def download(url: str) -> bytes:
    result = subprocess.run(
        ["curl", "-fLsS", "--max-time", "30", url],
        check=True, capture_output=True,
    )
    return result.stdout


def image_url(page: str, filename: str) -> str:
    body = download(page).decode("utf-8", "ignore")
    for match in re.finditer(r"<img\b[^>]*>", body, re.I):
        tag = html.unescape(match.group(0))
        if filename not in tag:
            continue
        source = re.search(r'(?:src|data-src)="([^"]+)', tag)
        if source:
            return urljoin(page, source.group(1))
    raise ValueError(f"Photo not found: {filename} in {page}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sources = {}
    for unit_id, (slug, filename) in {**SAMSUNG, **SAMSUNG_EXTRA}.items():
        page = f"https://api.samsungmobilepress.com/media-assets/{slug}"
        url = image_url(page, filename)
        path = OUT / f"{unit_id}.jpg"
        path.write_bytes(download(url))
        sources[unit_id] = {"page": page, "image": url, "file": path.relative_to(ROOT).as_posix()}
        print(f"{unit_id}: {path.stat().st_size} bytes")
    for unit_id, (page, filename) in APPLE.items():
        url = image_url(page, filename)
        path = OUT / f"{unit_id}.jpg"
        path.write_bytes(download(url))
        sources[unit_id] = {"page": page, "image": url, "file": path.relative_to(ROOT).as_posix()}
        print(f"{unit_id}: {path.stat().st_size} bytes")
    for unit_id, (page, image_name) in STORE.items():
        url = f"https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/{image_name}?wid=1144&hei=1144&fmt=jpeg&qlt=90"
        path = OUT / f"{unit_id}.jpg"
        path.write_bytes(download(url))
        sources[unit_id] = {"page": page, "image": url, "file": path.relative_to(ROOT).as_posix()}
        print(f"{unit_id}: {path.stat().st_size} bytes")
    unit_id = "semicon_t8_ai_assistant"
    page = "https://www.samsung.com/sec/projectors/home-robot-ballie/"
    url = "https://images.samsung.com/kdp/static/mkt/tvs/ballie/teasing-page/2025-ballie-teasing-f02-manifesto-pc.jpg?$1440_N_JPG$"
    path = OUT / f"{unit_id}.jpg"
    path.write_bytes(download(url))
    sources[unit_id] = {"page": page, "image": url, "file": path.relative_to(ROOT).as_posix()}
    print(f"{unit_id}: {path.stat().st_size} bytes")
    (OUT / "sources.json").write_text(json.dumps(sources, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
