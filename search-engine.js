(function attachGrammarSearch(global) {
  "use strict";

  const MAX_RESULTS_PER_TIER = 12;
  const PATTERN_SEPARATORS = /[／/・|｜]/;
  const WRAPPER_CHARS = /[\s　、，。．,.。:：;；/／|｜「」『』（）()【】\[\]{}<>《》〈〉・~〜～…-]+/g;
  const KANA_RE = /[ぁ-ゖァ-ヺー]/;

  // 这些只服务于中文“意思”检索；日语句式（如「からこそ」）不会因包含「から」而展开。
  const SEMANTIC_SETS = [
    { id: "condition", terms: ["如果", "假如", "倘若", "要是", "若是", "条件", "假定", "仮定"] },
    { id: "reason", terms: ["原因", "理由", "因为", "由于", "所以", "因果", "契机", "根拠", "正因为", "正是因为"] },
    { id: "purpose", terms: ["目的", "为了", "以便", "目标"] },
    { id: "concession", terms: ["让步", "逆接", "转折", "虽然", "即使", "但是", "尽管"] },
    { id: "guess", terms: ["推测", "推量", "也许", "可能", "应该", "大概", "好像"] },
    { id: "hearsay", terms: ["传闻", "听说", "据说", "转述"] },
    { id: "duty", terms: ["必须", "义务", "必要", "不得不"] },
    { id: "prohibition", terms: ["禁止", "不要", "不可以"] },
    { id: "collocation", terms: ["固定搭配", "惯用", "搭配", "连语", "慣用"] }
  ];

  // 两个假名也可能是有意义的构造核心，因此不用普通的长度阈值一刀切。
  const GRAMMAR_COMPONENTS = [
    "こそ", "から", "ので", "ため", "わけ", "もの", "こと", "よう", "はず", "べき", "ばかり",
    "だけ", "ほど", "くらい", "かぎり", "限り", "ところ", "うえ", "上", "にしても", "といって",
    "にもかかわらず", "わりに", "くせに", "ながら", "つつ", "さえ", "すら", "まで", "しか",
    "ように", "ために", "わけではない", "ものだから", "ことから", "おかげ", "せい"
  ];
  const NON_SEMANTIC_TAGS = new Set(["蓝宝书", "paddleocr", "新完全掌握", "高考", "补充题", "我添加的"].map(compact));

  const ROMAJI_DIGRAPHS = {
    きゃ: "kya", きゅ: "kyu", きょ: "kyo", しゃ: "sha", しゅ: "shu", しょ: "sho",
    ちゃ: "cha", ちゅ: "chu", ちょ: "cho", にゃ: "nya", にゅ: "nyu", にょ: "nyo",
    ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo", みゃ: "mya", みゅ: "myu", みょ: "myo",
    りゃ: "rya", りゅ: "ryu", りょ: "ryo", ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
    じゃ: "ja", じゅ: "ju", じょ: "jo", びゃ: "bya", びゅ: "byu", びょ: "byo",
    ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo"
  };

  const ROMAJI_MONOGRAPHS = {
    あ: "a", い: "i", う: "u", え: "e", お: "o", か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
    さ: "sa", し: "shi", す: "su", せ: "se", そ: "so", た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
    な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no", は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
    ま: "ma", み: "mi", む: "mu", め: "me", も: "mo", や: "ya", ゆ: "yu", よ: "yo",
    ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro", わ: "wa", を: "o", ん: "n",
    が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go", ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
    だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do", ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
    ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po", ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o",
    ゃ: "ya", ゅ: "yu", ょ: "yo", っ: ""
  };

  function compact(value) {
    return String(value || "").toLowerCase().normalize("NFKC").replace(WRAPPER_CHARS, "");
  }

  function normalizeKana(value) {
    return String(value || "").normalize("NFKC").replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
  }

  function kanaToRomaji(value) {
    const kana = normalizeKana(value);
    let out = "";
    for (let index = 0; index < kana.length; index += 1) {
      const char = kana[index];
      if (char === "っ") {
        const next = ROMAJI_DIGRAPHS[kana.slice(index + 1, index + 3)] || ROMAJI_MONOGRAPHS[kana[index + 1]] || "";
        out += next.charAt(0);
        continue;
      }
      const pair = kana.slice(index, index + 2);
      if (ROMAJI_DIGRAPHS[pair]) {
        out += ROMAJI_DIGRAPHS[pair];
        index += 1;
        continue;
      }
      if (char === "ー") {
        out += out.match(/[aeiou]$/)?.[0] || "";
        continue;
      }
      out += ROMAJI_MONOGRAPHS[char] || char;
    }
    return out;
  }

  function patternVariants(value) {
    const raw = String(value || "");
    const withoutParenthetical = raw.replace(/[（(【\[].*?[）)】\]]/g, "");
    // Keep the complete labelled form for sense-specific searches, but remove
    // parenthetical notes before splitting.  A separator inside
    // 「ばかり（数量/程度）」 must never create fake forms such as
    // 「ばかり数量」 or the standalone label 「程度」.
    const variants = [compact(raw), ...withoutParenthetical.split(PATTERN_SEPARATORS).map(compact)];
    return [...new Set(variants.filter(Boolean))];
  }

  function registeredReadings(itemId, value) {
    return asList(global.GRAMMAR_SEARCH_READINGS?.[itemId]?.[compact(value)]).map(compact).filter(Boolean);
  }

  function queryReadings(value) {
    return asList(global.GRAMMAR_QUERY_READINGS?.[compact(value)]).map(compact).filter(Boolean);
  }

  function textVariants(value, itemId = "") {
    const normalized = compact(value);
    const kana = compact(normalizeKana(value));
    const romaji = compact(kanaToRomaji(kana));
    const readings = registeredReadings(itemId, value);
    return [...new Set([
      normalized,
      kana,
      romaji,
      ...readings,
      ...readings.map((reading) => compact(kanaToRomaji(reading)))
    ].filter(Boolean))];
  }

  function querySearchValues(value) {
    const normalized = compact(value);
    const kana = compact(normalizeKana(value));
    const readings = queryReadings(value);
    return [...new Set([
      normalized,
      kana,
      compact(kanaToRomaji(kana)),
      ...readings,
      ...readings.map((reading) => compact(kanaToRomaji(reading)))
    ].filter(Boolean))];
  }

  function hasChineseSemanticIntent(query) {
    const raw = String(query || "");
    if (KANA_RE.test(raw)) return false;
    const normalized = compact(raw);
    return SEMANTIC_SETS.some((set) => set.terms.some((term) => normalized.includes(compact(term))));
  }

  function semanticSetIdsForQuery(query) {
    if (!hasChineseSemanticIntent(query)) return [];
    const normalized = compact(query);
    return SEMANTIC_SETS
      .filter((set) => set.terms.some((term) => normalized.includes(compact(term))))
      .map((set) => set.id);
  }

  function levelMatches(level, selectedLevel) {
    if (!selectedLevel || selectedLevel === "all") return true;
    return String(level || "").split(/[^N0-9]+/).some((part) => part === selectedLevel) || String(level || "").includes(selectedLevel);
  }

  function asList(value) {
    if (Array.isArray(value)) return value;
    return value == null || value === "" ? [] : [value];
  }

  function expressionForms(item) {
    const sourceForms = [
      { value: item.pattern, kind: "pattern" },
      ...asList(item.variants).map((value) => ({ value, kind: "variant" }))
    ].filter(({ value }) => Boolean(value));
    const seen = new Set();
    return sourceForms.flatMap(({ value, kind }) => patternVariants(value).map((pattern) => ({
      value: pattern,
      kind,
      readings: registeredReadings(item.id, pattern),
      searchValues: textVariants(pattern, item.id)
    }))).filter((entry) => {
      // Keep the canonical pattern ahead of an identical entry in variants.
      const key = compact(entry.value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function aliasForms(item) {
    const seen = new Set();
    return asList(item.searchAliases).flatMap(patternVariants).map((alias) => ({
      value: alias,
      readings: registeredReadings(item.id, alias),
      searchValues: textVariants(alias, item.id)
    })).filter((entry) => {
      const key = compact(entry.value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function itemFields(item) {
    const forms = expressionForms(item);
    const aliases = aliasForms(item);
    return {
      forms,
      patterns: forms.map((entry) => entry.value),
      aliases,
      patternSearchValues: [...new Set(forms.flatMap((entry) => entry.searchValues))],
      aliasSearchValues: [...new Set(aliases.flatMap((entry) => entry.searchValues))],
      meaning: compact(item.meaning),
      connection: compact(item.connection),
      collocation: compact(item.collocation),
      tags: asList(item.tags).map(compact).filter(Boolean),
      metadata: compact([item.source, item.sourceBook, item.sourceLesson, ...(item.usageFlags ? Object.keys(item.usageFlags).filter((key) => item.usageFlags[key]) : [])].join(" "))
    };
  }

  function exactFormMatch(forms, rawQuery) {
    const query = compact(rawQuery);
    if (!query) return null;
    const queryValues = querySearchValues(rawQuery);
    for (const form of forms) {
      const direct = compact(form.value);
      if (query === direct) return { ...form, matchedBy: form.kind };
      const kana = compact(normalizeKana(form.value));
      if (query === kana) return { ...form, matchedBy: `${form.kind}-kana` };
      const romaji = compact(kanaToRomaji(normalizeKana(form.value)));
      if (romaji && romaji !== direct && query === romaji) return { ...form, matchedBy: `${form.kind}-romaji` };
      if ((form.readings || []).includes(query)) return { ...form, matchedBy: `${form.kind}-kana` };
      if ((form.readings || []).some((reading) => compact(kanaToRomaji(reading)) === query)) {
        return { ...form, matchedBy: `${form.kind}-romaji` };
      }
      if (queryValues.some((value) => form.searchValues?.includes(value))) {
        return { ...form, matchedBy: `${form.kind}-orthography` };
      }
    }
    return null;
  }

  function matchReason(match, alias = false) {
    if (!match) return "";
    if (alias) return `检索别名一致：${match.value}`;
    const label = match.kind === "variant" ? "表达变体" : "句式";
    if (match.matchedBy.endsWith("-romaji")) return `${label}罗马音命中：${match.value}`;
    if (match.matchedBy.endsWith("-kana")) return `${label}假名对应：${match.value}`;
    if (match.matchedBy.endsWith("-orthography")) return `${label}汉字/假名对应：${match.value}`;
    return match.kind === "variant" ? `表达变体完全一致：${match.value}` : "句式完全一致";
  }

  function itemSemanticText(group, fields) {
    return compact([group.title, group.summary, group.theme, group.axis, fields.meaning, ...fields.tags].join(" "));
  }

  function meaningCore(value) {
    // “正因为……才”与“正因为……”属于同一核心意思；去掉这类常见收束词后再作近义比较。
    return compact(value).replace(/才/g, "").replace(/正是/g, "正");
  }

  function commonComponents(query, patternValues) {
    const queryCompact = compact(query);
    const patternText = patternValues.join(" ");
    const components = GRAMMAR_COMPONENTS.filter((part) => {
      const normalized = compact(part);
      return normalized && queryCompact.includes(normalized) && patternText.includes(normalized);
    });
    if (components.length) return [...new Set(components)];

    // 没有预设构造时，只接受 3 字以上的连续共享片段，避免助词造成噪声。
    const candidates = [];
    for (let start = 0; start < queryCompact.length; start += 1) {
      for (let end = start + 3; end <= queryCompact.length; end += 1) {
        const fragment = queryCompact.slice(start, end);
        if (patternText.includes(fragment)) candidates.push(fragment);
      }
    }
    return [...new Set(candidates)].sort((a, b) => b.length - a.length).slice(0, 2);
  }

  function resultKey(group, item) {
    return `${group.id}::${item.id}`;
  }

  function makeResult(group, item, tier, score, reasons, match = null) {
    return {
      key: resultKey(group, item),
      groupId: group.id,
      groupTitle: group.title,
      item,
      tier,
      score,
      reasons: [...new Set(reasons.filter(Boolean))],
      matchedBy: match?.matchedBy || "",
      matchedValue: match?.value || ""
    };
  }

  function sortResults(results) {
    return results.sort((a, b) => b.score - a.score || String(a.item.pattern).localeCompare(String(b.item.pattern), "ja"));
  }

  function rank(groups, query, options = {}) {
    const rawQuery = String(query || "").trim();
    const normalizedQuery = compact(rawQuery);
    const selectedLevel = options.level || "all";
    const empty = { query: rawQuery, normalizedQuery, counts: { exact: 0, strong: 0, semantic: 0, structural: 0 }, exact: [], strong: [], semantic: [], structural: [], best: null };
    if (!normalizedQuery) return empty;

    const querySemanticSets = semanticSetIdsForQuery(rawQuery);
    const candidates = [];
    groups.forEach((group, groupOrder) => {
      (group.expressions || []).forEach((item, itemOrder) => {
        if (!levelMatches(item.level, selectedLevel)) return;
        candidates.push({ group, item, groupOrder, itemOrder, fields: itemFields(item) });
      });
    });

    const exact = [];
    const strong = [];
    const classified = new Set();
    candidates.forEach((candidate) => {
      const { group, item, fields } = candidate;
      const patternMatch = exactFormMatch(fields.forms, rawQuery);
      const aliasMatch = exactFormMatch(fields.aliases.map((entry) => ({ ...entry, kind: "alias" })), rawQuery);
      if (patternMatch) {
        exact.push(makeResult(group, item, "exact", 1000, [matchReason(patternMatch)], patternMatch));
        classified.add(resultKey(group, item));
        return;
      }

      const patternContains = fields.patternSearchValues.some((value) => value.length > normalizedQuery.length && value.includes(normalizedQuery));
      const aliasContains = Boolean(aliasMatch) || fields.aliasSearchValues.some((value) => value.length > normalizedQuery.length && value.includes(normalizedQuery));
      const meaningMatch = fields.meaning.includes(normalizedQuery) || (normalizedQuery.length >= 3 && normalizedQuery.includes(fields.meaning));
      const connectionMatch = fields.connection.includes(normalizedQuery) || fields.collocation.includes(normalizedQuery);
      const semanticGroupMatch = querySemanticSets.length && querySemanticSets.some((id) => itemSemanticText(group, fields).includes(compact(SEMANTIC_SETS.find((set) => set.id === id)?.terms[0])));
      const score = (patternContains ? 500 : 0) + (aliasContains ? (aliasMatch ? 520 : 450) : 0) + (meaningMatch ? 300 : 0) + (connectionMatch ? 140 : 0) + (semanticGroupMatch ? 90 : 0);
      if (score) {
        const reasons = [];
        if (patternContains) reasons.push("句式直接匹配");
        if (aliasContains) reasons.push(aliasMatch ? matchReason(aliasMatch, true) : "别名直接匹配");
        if (meaningMatch) reasons.push("核心意思高度一致");
        if (connectionMatch) reasons.push("接续或搭配匹配");
        if (semanticGroupMatch) reasons.push(`对应意思：${group.title}`);
        strong.push(makeResult(group, item, "strong", score, reasons, aliasMatch));
        classified.add(resultKey(group, item));
      }
    });

    const seedResults = [...exact, ...strong];
    const seedMeanings = new Set(seedResults.map((result) => compact(result.item.meaning)).filter(Boolean));
    const seedMeaningCores = new Set(seedResults.map((result) => meaningCore(result.item.meaning)).filter((value) => value.length >= 3));
    const seedGroups = new Set(seedResults.map((result) => result.groupId));
    const seedTags = new Set(seedResults.flatMap((result) => asList(result.item.tags)).map(compact).filter((tag) => tag.length >= 2 && !NON_SEMANTIC_TAGS.has(tag)));
    const semantic = [];
    const structural = [];

    candidates.forEach((candidate) => {
      const { group, item, fields } = candidate;
      const key = resultKey(group, item);
      if (classified.has(key)) return;
      const sameGroup = seedGroups.has(group.id);
      const sameMeaning = seedMeanings.has(fields.meaning) && fields.meaning.length >= 2;
      const closeMeaning = !sameMeaning && seedMeaningCores.has(meaningCore(fields.meaning));
      const sharedTags = fields.tags.filter((tag) => seedTags.has(tag));
      const querySemanticMatch = querySemanticSets.length && querySemanticSets.some((id) => {
        const set = SEMANTIC_SETS.find((entry) => entry.id === id);
        return set.terms.some((term) => itemSemanticText(group, fields).includes(compact(term)));
      });
      // 单个大类标签（例如“原因”）不足以判定为近义，避免把整库内容都塞进相关区。
      const sharedTagScore = sharedTags.length >= 2 ? sharedTags.length * 20 : 0;
      const semanticScore = (sameMeaning ? 190 : 0) + (closeMeaning ? 165 : 0) + (sameGroup ? 64 : 0) + sharedTagScore + (querySemanticMatch ? 120 : 0);
      if (semanticScore) {
        const reasons = [];
        if (sameMeaning) reasons.push("核心意思一致");
        if (closeMeaning) reasons.push("核心意思相近");
        if (sameGroup) reasons.push(`同属${group.title}`);
        if (sharedTags.length >= 2) reasons.push(`共同标签：${sharedTags.slice(0, 2).join("、")}`);
        if (querySemanticMatch) reasons.push(`对应意思：${group.title}`);
        semantic.push(makeResult(group, item, "semantic", semanticScore, reasons));
        classified.add(key);
        return;
      }

      const components = commonComponents(rawQuery, [...fields.patterns, ...fields.aliases.map((entry) => entry.value)]);
      if (components.length) {
        structural.push(makeResult(group, item, "structural", components.reduce((sum, part) => sum + compact(part).length * 22, 0), [`共享构造：${components.slice(0, 2).join("、")}`]));
      }
    });

    const all = {
      exact: sortResults(exact),
      strong: sortResults(strong),
      semantic: sortResults(semantic),
      structural: sortResults(structural)
    };
    const counts = Object.fromEntries(Object.entries(all).map(([tier, results]) => [tier, results.length]));
    const limited = Object.fromEntries(Object.entries(all).map(([tier, results]) => [tier, results.slice(0, options.limit || MAX_RESULTS_PER_TIER)]));
    return { query: rawQuery, normalizedQuery, counts, ...limited, best: limited.exact[0] || limited.strong[0] || limited.semantic[0] || limited.structural[0] || null };
  }

  function readingForms(item) {
    return expressionForms(item).flatMap((form) => (form.readings || []).map((reading) => ({
      form: form.value,
      reading,
      romaji: compact(kanaToRomaji(reading))
    })));
  }

  global.GrammarSearch = { rank, compact, normalizeKana, kanaToRomaji, patternVariants, readingForms, MAX_RESULTS_PER_TIER };
}(window));
