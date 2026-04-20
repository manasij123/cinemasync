#!/usr/bin/env python3
"""One-shot theme migration: pastel purple/pink → dark + yellow + neon glow.

Run once from /app:
    python3 scripts/migrate_theme.py

Acts on every .jsx / .tsx / .js inside /app/frontend/src.
"""
from pathlib import Path

ROOT = Path("/app/frontend/src")

# Mapping order matters: longer / gradient patterns first so they don't get
# partially clobbered by single-color rules later.
REPLACEMENTS = [
    # ---------- Gradient CTAs (from/to pairs → solid yellow) ----------
    ("bg-gradient-to-r from-[#7209b7] to-[#f72585]", "bg-[#ffd100]"),
    ("bg-gradient-to-r from-[#f72585] to-[#7209b7]", "bg-[#ffd100]"),
    ("bg-gradient-to-br from-[#7209b7] to-[#f72585]", "bg-[#ffd100]"),
    ("bg-gradient-to-br from-[#f72585] to-[#7209b7]", "bg-[#ffd100]"),
    ("bg-gradient-to-l from-[#7209b7] to-[#f72585]", "bg-[#ffd100]"),
    ("bg-gradient-to-l from-[#f72585] to-[#7209b7]", "bg-[#ffd100]"),
    ("from-[#f72585] to-[#7209b7]", "bg-[#ffd100]"),
    ("from-[#7209b7] to-[#f72585]", "bg-[#ffd100]"),

    # Hover shadows — keep the glow but recolour to yellow
    ("rgba(247,37,133,0.35)", "rgba(255,209,0,0.35)"),
    ("rgba(247, 37, 133, 0.35)", "rgba(255,209,0,0.35)"),
    ("rgba(247,37,133,0.25)", "rgba(255,209,0,0.25)"),
    ("rgba(247, 37, 133, 0.25)", "rgba(255,209,0,0.25)"),
    ("rgba(247,37,133,0.18)", "rgba(255,209,0,0.18)"),
    ("rgba(247,37,133,0.12)", "rgba(255,209,0,0.12)"),
    ("rgba(247,37,133,0.6)", "rgba(57,255,20,0.6)"),
    ("rgba(247, 37, 133, 0.6)", "rgba(57,255,20,0.6)"),
    ("rgba(247,37,133,0)", "rgba(57,255,20,0)"),
    ("rgba(114,9,183,0.15)", "rgba(255,255,255,0.12)"),
    ("rgba(114, 9, 183, 0.15)", "rgba(255,255,255,0.12)"),
    ("rgba(114,9,183,0.30)", "rgba(106,20,255,0.3)"),
    ("rgba(114, 9, 183, 0.30)", "rgba(106,20,255,0.3)"),
    ("rgba(114,9,183,0.25)", "rgba(106,20,255,0.25)"),
    ("rgba(114,9,183,0.08)", "rgba(0,0,0,0.35)"),
    ("rgba(114, 9, 183, 0.08)", "rgba(0,0,0,0.35)"),
    ("rgba(114,9,183,0.14)", "rgba(255,209,0,0.14)"),
    ("rgba(26,11,46,0.45)", "rgba(0,0,0,0.7)"),
    ("rgba(26,11,46,0.4)",  "rgba(0,0,0,0.65)"),
    ("rgba(26,11,46,0.35)", "rgba(0,0,0,0.55)"),
    ("rgba(26,11,46,0.18)", "rgba(0,0,0,0.45)"),
    ("rgba(26,11,46,0.10)", "rgba(0,0,0,0.35)"),
    ("rgba(26, 11, 46, 0.7)", "rgba(0,0,0,0.7)"),

    # ---------- Main palette mapping ----------
    # Surfaces
    ("#fdf4ff", "#2a2a2a"),
    ("#f0e5ff", "#2a2a2a"),
    ("#fde5f1", "#2a2a2a"),
    ("#ffd6ff", "#2a2a2a"),
    ("#c8b6ff", "#3a3a3a"),
    ("#b8c0ff", "#3a3a3a"),
    ("#bbd0ff", "#3a3a3a"),

    # Primary / accent brand colors
    ("#7209b7", "#6a14ff"),
    ("#4a0580", "#5a0fd6"),
    ("#f72585", "#ffd100"),
    ("#d81674", "#e8bd00"),
    ("#e7c6ff", "#3a3a3a"),

    # Text
    ("#1a0b2e", "#ffffff"),
    ("#6b5b84", "#cccccc"),
    ("#a597c4", "#888888"),

    # Dark stage bg stays dark-ish
    ("#0A0908", "#000000"),
    ("#0a0908", "#000000"),

    # Stop-share banner backgrounds that need re-contrast
    ("bg-[#ffffff]/95", "bg-[#2a2a2a]/95"),
    ("bg-[#ffffff]/80", "bg-[#2a2a2a]/80"),
    ("bg-[#ffffff]/75", "bg-[#2a2a2a]/75"),

    # Yellow buttons should have black text (the CTA gradients were white→now yellow, text must flip)
    ("bg-[#ffd100] text-white", "bg-[#ffd100] text-black"),

    # Focus border after color flip
    ("focus:border-[#6a14ff]", "focus:border-[#ffd100]"),
]


def migrate_file(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    original = text
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    if text != original:
        path.write_text(text, encoding="utf-8")
        return 1
    return 0


def main():
    changed = 0
    scanned = 0
    for ext in ("*.jsx", "*.tsx", "*.js"):
        for p in ROOT.rglob(ext):
            # skip ui/ primitives that reference CSS vars only
            scanned += 1
            if migrate_file(p):
                changed += 1
                print(f"✔ {p.relative_to(ROOT)}")
    print(f"\nScanned: {scanned} files · Modified: {changed}")


if __name__ == "__main__":
    main()
