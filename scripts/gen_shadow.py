"""
モンスター画像から影版webpを生成するスクリプト。
透明部分はそのまま、不透明ピクセルはすべて暗紫色 (25, 20, 50) に置換する。
出力先: public/monsters/shadow/dark/ および public/monsters/shadow/light/
"""
import os
from pathlib import Path
from PIL import Image

SHADOW_COLOR = (25, 20, 50)  # 暗紫色シルエット

def make_shadow(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(src).convert("RGBA")
    r, g, b, a = img.split()
    # 不透明部分を SHADOW_COLOR で塗りつぶし
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    pixels = shadow.load()
    alpha = a.load()
    for y in range(img.height):
        for x in range(img.width):
            if alpha[x, y] > 0:
                pixels[x, y] = (*SHADOW_COLOR, alpha[x, y])
    shadow.save(dst, "WEBP", quality=80)
    print(f"  {src.name} → {dst.relative_to(dst.parents[2])}")

def main() -> None:
    base = Path(__file__).parent.parent / "public" / "monsters"
    targets = [
        (base / "dark", base / "shadow" / "dark"),
        (base / "light", base / "shadow" / "light"),
    ]
    for src_dir, dst_dir in targets:
        if not src_dir.exists():
            continue
        webps = [p for p in src_dir.iterdir() if p.suffix == ".webp" and p.parent == src_dir]
        print(f"\n{src_dir} ({len(webps)} files)")
        for src in sorted(webps):
            make_shadow(src, dst_dir / src.name)

if __name__ == "__main__":
    main()
