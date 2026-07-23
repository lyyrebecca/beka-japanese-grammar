#!/usr/bin/env python3
from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import subprocess
from pathlib import Path

import fitz


DEFAULT_PDF = "/Users/Zhuanz/Downloads/高考日语蓝宝书 语法 (许小明、Reika、新世界教育、樱花国际日语图书事业部) (z-library.sk, 1lib.sk, z-lib.sk).pdf"
TESSERACT = "/opt/homebrew/bin/tesseract"
TESSDATA = "/opt/homebrew/Cellar/tesseract-lang/4.1.0/share/tessdata"


def page_count(pdf_path: Path) -> int:
    with fitz.open(pdf_path) as doc:
        return doc.page_count


def run(cmd: list[str], env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)


def ocr_page(args: tuple[Path, Path, int, int]) -> dict[str, object]:
    pdf_path, out_dir, page, dpi = args
    image_prefix = out_dir / "pages" / f"page-{page:03d}"
    image_path = out_dir / "pages" / f"page-{page:03d}-{page:03d}.png"
    text_path = out_dir / "text" / f"page-{page:03d}.txt"
    text_path.parent.mkdir(parents=True, exist_ok=True)
    image_path.parent.mkdir(parents=True, exist_ok=True)

    if not image_path.exists():
      run([
          "pdftoppm",
          "-f",
          str(page),
          "-l",
          str(page),
          "-r",
          str(dpi),
          "-png",
          str(pdf_path),
          str(image_prefix),
      ])

    env = os.environ.copy()
    env["TESSDATA_PREFIX"] = TESSDATA
    text = run([
        TESSERACT,
        str(image_path),
        "stdout",
        "-l",
        "chi_sim+jpn",
        "--psm",
        "6",
    ], env=env).stdout
    text_path.write_text(text.strip() + "\n", encoding="utf-8")
    jp_chars = len(re.findall(r"[\u3040-\u30ff]", text))
    zh_chars = len(re.findall(r"[\u4e00-\u9fff]", text))
    return {
        "page": page,
        "chars": len(text),
        "japanese_kana_chars": jp_chars,
        "cjk_chars": zh_chars,
        "text_path": str(text_path),
        "image_path": str(image_path),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", default=DEFAULT_PDF)
    parser.add_argument("--out", default="outputs/ocr/bluebook")
    parser.add_argument("--dpi", type=int, default=220)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--pages", default="")
    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    total = page_count(pdf_path)
    if args.pages:
        pages = sorted({int(item) for part in args.pages.split(",") for item in part.split() if item})
    else:
        pages = list(range(1, total + 1))

    tasks = [(pdf_path, out_dir, page, args.dpi) for page in pages]
    results: list[dict[str, object]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for result in pool.map(ocr_page, tasks):
            results.append(result)
            if len(results) % 20 == 0:
                print(f"OCR {len(results)}/{len(tasks)} pages")

    results.sort(key=lambda item: int(item["page"]))
    markdown_parts = []
    for result in results:
        page = int(result["page"])
        text = Path(str(result["text_path"])).read_text(encoding="utf-8").strip()
        markdown_parts.append(f"\n\n## Page {page}\n\n{text}\n")

    md_path = out_dir / "高考日语蓝宝书_语法_ocr.md"
    md_path.write_text("# 高考日语蓝宝书 语法 OCR\n" + "".join(markdown_parts), encoding="utf-8")

    sample_pages = [1, 2, 3, 10, 50, 120, 220, 330]
    quality = {
        "sourcePdf": str(pdf_path),
        "pagesTotal": total,
        "pagesOcr": len(results),
        "engine": "Tesseract 5.5.2 via Homebrew",
        "languages": "chi_sim+jpn",
        "dpi": args.dpi,
        "samplePages": [item for item in results if int(item["page"]) in sample_pages],
        "notes": [
            "The PDF is scanned; pdftotext produced no usable text.",
            "Tesseract output is sufficient for identifying grammar headings, patterns, notes, and clear examples.",
            "OCR has visible character noise, so site cards should use only manually checked OCR snippets."
        ],
        "markdown": str(md_path),
    }
    (out_dir / "ocr-quality.json").write_text(json.dumps(quality, ensure_ascii=False, indent=2), encoding="utf-8")
    print(md_path)


if __name__ == "__main__":
    main()
