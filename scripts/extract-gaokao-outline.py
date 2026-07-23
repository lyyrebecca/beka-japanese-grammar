#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path


MD_SOURCE = Path("/Users/Zhuanz/Desktop/龙虾 临时运行/日语语法md/高考日语语法专项_clean.md")
BLUEBOOK_OCR = Path("outputs/ocr/bluebook/高考日语蓝宝书_语法_ocr.md")
OUT = Path("outputs/extraction/gaokao-source-outline.json")


def outline_from_markdown(path: Path) -> list[dict[str, object]]:
    rows = []
    for index, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if line.startswith("#") or re.match(r"\*\*.+\*\*", line):
            text = re.sub(r"^[#\s]+|\*\*", "", line).strip()
            if text:
                rows.append({"line": index, "title": text})
    return rows


def ocr_unit_index(path: Path) -> list[dict[str, object]]:
    rows = []
    page = None
    for index, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        match = re.match(r"## Page (\d+)", line)
        if match:
            page = int(match.group(1))
            continue
        if re.search(r"第\d+章|第[一二三四五六七八九十]+章|Unit\s*\d+|表示.+句型|授受|敬語|敬语|助词", line):
            clean = re.sub(r"\s+", " ", line).strip()
            if clean:
                rows.append({"line": index, "page": page, "title": clean[:120]})
    return rows


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "generatedAt": __import__("datetime").datetime.now().isoformat(),
        "sources": [
            {
                "path": str(MD_SOURCE),
                "type": "provided markdown",
                "outline": outline_from_markdown(MD_SOURCE),
            },
            {
                "path": str(BLUEBOOK_OCR),
                "type": "local OCR markdown",
                "outline": ocr_unit_index(BLUEBOOK_OCR),
            },
        ],
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(OUT)


if __name__ == "__main__":
    main()
