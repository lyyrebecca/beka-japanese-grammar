#!/usr/bin/env python3
"""Verify ruby coverage and high-risk grammar distinctions in the built-in library."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

_GENERATOR_SPEC = importlib.util.spec_from_file_location('generate_furigana_data', Path(__file__).with_name('generate-furigana-data.py'))
assert _GENERATOR_SPEC and _GENERATOR_SPEC.loader
_GENERATOR = importlib.util.module_from_spec(_GENERATOR_SPEC)
_GENERATOR_SPEC.loader.exec_module(_GENERATOR)
OUT_PATH = _GENERATOR.OUT_PATH
build_readings = _GENERATOR.build_readings
load_groups = _GENERATOR.load_groups

ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / 'outputs' / 'extraction' / 'furigana-and-accuracy-audit.json'


def read_generated_map() -> dict[str, str]:
    source = OUT_PATH.read_text(encoding='utf-8')
    pairs = re.findall(r'^\s*("(?:[^"\\]|\\.)*"):\s*("(?:[^"\\]|\\.)*"),$', source, flags=re.M)
    return {json.loads(key): json.loads(value) for key, value in pairs}


def expression_index(groups: list[dict]) -> dict[str, list[dict]]:
    result: dict[str, list[dict]] = {}
    for group in groups:
        for item in group['expressions']:
            result.setdefault(item['pattern'], []).append({**item, '_group': group['id']})
    return result


def main() -> None:
    groups = load_groups()
    auto_map = read_generated_map()
    expected_readings = build_readings(groups)
    missing_readings = sorted(set(expected_readings) - set(auto_map))
    invalid_readings = sorted(word for word, reading in auto_map.items() if not re.fullmatch(r'[ぁ-ゖゝゞー]+', reading))

    items = [item for group in groups for item in group['expressions']]
    missing_fields = [
        item['id'] for item in items
        if not all(str(item.get(key, '')).strip() for key in ('pattern', 'meaning', 'connection', 'nuance', 'example', 'translation', 'sourceBook'))
    ]
    accuracy_checks: list[dict] = []

    def check(pattern: str, predicate, note: str) -> None:
        cards = expression_index(groups).get(pattern, [])
        passed = bool(cards) and all(predicate(card) for card in cards)
        accuracy_checks.append({'pattern': pattern, 'passed': passed, 'note': note, 'cards': len(cards)})

    check('に従って / に従い', lambda item: '辞书形 + に従って；名词 + に従って' in item['connection'], '动词变化与名词遵从两种接续均保留。')
    check('ことに', lambda item: 'ことにする' not in item['connection'] and 'ことにしている' not in item['collocation'], '感叹评价句型不得混入「ことにする」的个人决定用法。')
    check('ことにする', lambda item: 'ことにする' in item['connection'], '个人决定的接续保留。')
    check('ことになる', lambda item: 'ことになる' in item['connection'], '外部决定或结果的接续保留。')
    check('ように', lambda item: '可能形' in item['connection'] and '非意志动词' in item['connection'], '目的用法正确区分可能/非意志动词。')
    check('ために', lambda item: '意志动词' in item['connection'] and '原因' in item['connection'], '目的和原因两种用法均明确标出。')
    check('そうだ', lambda item: '样态' in item['connection'] and '传闻' in item['connection'], '样态与传闻接续分开说明。')
    check('に限る', lambda item: '辞书形' in item['connection'] and 'ない形' in item['connection'], '「最好」与「限定」的接续未遗漏。')
    check('限りは', lambda item: '限りは' in item['connection'], '条件表达保留。')
    check('に対して', lambda item: 'に対する' in item['connection'] and 'のに対して' in item['connection'], '对象与对比两种用法均保留。')
    check('おそれがある', lambda item: '辞书形 + おそれがある' in item['connection'], '风险表达接续准确。')

    # Render a representative card with the same longest-first replacement used by app.js.
    sample = 'に従って / に従い'
    pattern = re.compile('|'.join(re.escape(key) for key in sorted(auto_map, key=len, reverse=True)))
    rendered = pattern.sub(lambda match: f'<ruby>{match.group(0)}<rt>{auto_map[match.group(0)]}</rt></ruby>', sample)
    ruby_sample_ok = '<ruby>従って<rt>したがって</rt></ruby>' in rendered and '<ruby>従い<rt>したがい</rt></ruby>' in rendered

    report = {
        'totals': {'groups': len(groups), 'expressions': len(items), 'autoFuriganaEntries': len(auto_map)},
        'furigana': {
            'missingGeneratedReadings': missing_readings,
            'invalidGeneratedReadings': invalid_readings,
            'representativeRender': rendered,
            'representativeRenderPassed': ruby_sample_ok
        },
        'contentAccuracy': {'missingRequiredFields': missing_fields, 'checks': accuracy_checks}
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    failed_checks = [check for check in accuracy_checks if not check['passed']]
    print(json.dumps({
        **report['totals'],
        'missingReadings': len(missing_readings),
        'invalidReadings': len(invalid_readings),
        'missingRequiredFields': len(missing_fields),
        'failedAccuracyChecks': len(failed_checks),
        'representativeRenderPassed': ruby_sample_ok
    }, ensure_ascii=False))
    if missing_readings or invalid_readings or missing_fields or failed_checks or not ruby_sample_ok:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
