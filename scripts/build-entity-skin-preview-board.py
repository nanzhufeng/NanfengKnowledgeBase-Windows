from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".runtime-qa" / "knowledge-final-layout-evidence"
OUTPUT = ROOT / "docs" / "screenshots" / "skin-previews" / "implemented-v141"
OUTPUT.mkdir(parents=True, exist_ok=True)

SKINS = (
    ("entity-mist", "实体工作台 · 雾蓝", "#173A61"),
    ("entity-sage", "实体工作台 · 鼠尾草", "#304B43"),
    ("entity-terracotta", "实体工作台 · 暖陶", "#493830"),
)
PAGES = (
    ("hypotheses", "主题洞察"),
    ("all-notes", "全部笔记"),
    ("topic-management", "主题管理"),
)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "msyhbd.ttc" if bold else "msyh.ttc"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size=size)


for skin_id, skin_name, accent in SKINS:
    cards: list[tuple[str, Image.Image]] = []
    for suffix, label in PAGES:
        image = Image.open(SOURCE / f"{skin_id}-{suffix}.png").convert("RGB")
        image.thumbnail((1030, 645), Image.Resampling.LANCZOS)
        cards.append((label, image))

    canvas = Image.new("RGB", (3320, 820), "#F5F7F9")
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((34, 28, 3286, 792), radius=28, fill="#FFFFFF", outline="#DCE3EA", width=2)
    draw.rounded_rectangle((60, 54, 80, 132), radius=10, fill=accent)
    draw.text((100, 52), skin_name, fill="#102F55", font=font(34, True))
    draw.text((100, 101), "真实当前页面 · 三入口同屏 · 布局与功能保持现行基线", fill="#6A788A", font=font(18))

    x = 60
    for label, image in cards:
        draw.text((x, 151), label, fill="#183A63", font=font(22, True))
        y = 192
        draw.rounded_rectangle((x - 2, y - 2, x + 1034, y + 649), radius=15, fill="#E9EEF3")
        canvas.paste(image, (x, y))
        x += 1080

    canvas.save(OUTPUT / f"{skin_id}-three-entries.png", optimize=True)
