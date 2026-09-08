import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const context = { console };
context.window = context;
vm.createContext(context);
await vm.runInContext(await readFile(join(root, "content-data.js"), "utf8"), context);
await vm.runInContext(await readFile(join(root, "grammar-search-readings.js"), "utf8"), context);
await vm.runInContext(await readFile(join(root, "search-engine.js"), "utf8"), context);
await vm.runInContext("globalThis.__groups = GRAMMAR_GROUPS;", context);

const { GrammarSearch, __groups: groups } = context;
const rank = (query, level = "all") => GrammarSearch.rank(groups, query, { level, limit: 1000 });
const patterns = (items) => items.map((item) => item.item.pattern);
const cards = [...groups].flatMap((group) => [...group.expressions].map((item) => ({ group, item })));
const registeredExactIds = (query) => {
  const normalized = GrammarSearch.compact(query);
  const queryReadings = context.GRAMMAR_QUERY_READINGS?.[normalized] || [];
  const queryValues = new Set([
    normalized,
    GrammarSearch.compact(GrammarSearch.normalizeKana(query)),
    GrammarSearch.compact(GrammarSearch.kanaToRomaji(GrammarSearch.normalizeKana(query))),
    ...queryReadings,
    ...queryReadings.map((reading) => GrammarSearch.compact(GrammarSearch.kanaToRomaji(reading)))
  ].filter(Boolean));
  return cards.filter(({ item }) => [item.pattern, ...(item.variants || [])].flatMap(GrammarSearch.patternVariants).some((form) => {
    const readings = GrammarSearch.readingForms(item).filter((entry) => GrammarSearch.compact(entry.form) === GrammarSearch.compact(form));
    const forms = [
      GrammarSearch.compact(form),
      GrammarSearch.compact(GrammarSearch.normalizeKana(form)),
      GrammarSearch.compact(GrammarSearch.kanaToRomaji(GrammarSearch.normalizeKana(form))),
      ...readings.map((entry) => GrammarSearch.compact(entry.reading)),
      ...readings.map((entry) => GrammarSearch.compact(entry.romaji))
    ];
    return forms.some((value) => queryValues.has(value));
  })).map(({ item }) => item.id).sort();
};
const exactIds = (query) => [...rank(query).exact].map((result) => result.item.id).sort();

const karaKoso = rank("からこそ");
assert.equal(karaKoso.counts.exact, 1, "からこそ 应只有一条完全一致结果");
assert.equal(karaKoso.exact[0]?.item.pattern, "からこそ", "からこそ 必须位于完全一致首项");
assert.ok(karaKoso.counts.exact + karaKoso.counts.strong < 10, "不能把大量原因表达误判为直接命中");
assert.ok(patterns(karaKoso.semantic).some((pattern) => ["ばこそ", "ばかりに", "だけに"].includes(pattern)), "相近意思应优先保留正因为类表达");
assert.ok(karaKoso.structural.some((item) => item.reasons.some((reason) => reason.includes("共享构造"))), "应提供相近构造结果");

for (const query of ["kara koso", "〜からこそ", "　からこそ　"]) {
  const result = rank(query);
  assert.equal(result.exact[0]?.item.pattern, "からこそ", `${query} 应定位到 からこそ`);
}

const positiveReason = rank("正因为");
assert.ok(["exact", "strong"].some((tier) => patterns(positiveReason[tier]).includes("からこそ")), "中文意思“正因为”应直接找到 からこそ");
assert.ok(rank("原因").best, "中文功能词“原因”应有结果");

const missing = rank("不存在的句式");
assert.equal(missing.counts.exact, 0, "不存在的句式不应伪造完全一致结果");

const dakeDenaku = rank("だけでなく");
assert.deepEqual(exactIds("だけでなく"), ["addition-2-だけではなく"], "だけでなく 只能精确命中自己的主卡");
assert.equal(dakeDenaku.exact[0]?.matchedBy, "variant", "だけでなく 必须标为表达变体精确命中");
assert.equal(dakeDenaku.exact[0]?.matchedValue, "だけでなく", "だけでなく 必须记录实际命中的变体");
assert.ok(!dakeDenaku.exact.some((result) => result.item.id === "addition-1-ばかりでなく"), "ばかりでなく 不能因别名混入 だけでなく 的完全一致");
assert.deepEqual(exactIds("ばかりでなく"), ["addition-1-ばかりでなく"], "ばかりでなく 必须保持独立精确命中");
assert.deepEqual(exactIds("ばかりではなく"), ["addition-1-ばかりでなく"], "ばかりではなく 必须命中 ばかりでなく 的变体主卡");

const customGroups = structuredClone(groups);
customGroups[0].expressions.push({
  id: "custom-search-proof",
  level: "N3",
  pattern: "極光文型",
  meaning: "仅供检索测试",
  connection: "普通形 + 極光文型",
  nuance: "自定义条目",
  variants: ["極光文型です"],
  searchAliases: ["aurora grammar"]
});
assert.equal(GrammarSearch.rank(customGroups, "極光文型").exact[0]?.item.id, "custom-search-proof", "用户新增条目必须进入同一检索模型");
assert.equal(GrammarSearch.rank(customGroups, "極光文型です").exact[0]?.item.id, "custom-search-proof", "用户新增变体必须精确命中主卡");
const customAlias = GrammarSearch.rank(customGroups, "aurora grammar");
assert.equal(customAlias.counts.exact, 0, "检索别名不能冒充完全一致");
assert.equal(customAlias.strong[0]?.item.id, "custom-search-proof", "用户新增别名必须进入强相关结果");
assert.equal(rank("からこそ", "N2").counts.exact, 0, "等级筛选必须排除 N3 的 からこそ");

const politeVariant = rank("てもいいです");
assert.equal(politeVariant.exact[0]?.item.id, "permission-0-てもいい", "礼貌体变体必须命中同一主卡");
assert.equal(rank("そうです（样态）").exact[0]?.item.id, "guess-16-そうだ-样态", "样态 そうです 必须命中样态主卡");
const karaHomographs = rank("から").exact.map((result) => result.item.id);
assert.ok(karaHomographs.includes("reason-0-から") && karaHomographs.includes("causeeffect-0-から"), "同形异义的 から 必须同时返回原因和起点两义");

for (const query of ["に関して", "にかんして", "ni kanshite", "に関する", "にかんする", "ni kansuru"]) {
  assert.equal(rank(query).exact[0]?.item.id, "topic-2-に関して", `${query} 应精确命中 に関して 主卡`);
}
assert.ok((rank("にも関わらず").exact || []).some((result) => result.item.id === "concession-3-にもかかわらず"), "汉字表记必须找到假名主卡");
assert.ok((rank("にもかかわらず").exact || []).some((result) => result.item.id === "concession-3-にもかかわらず"), "假名表记必须找到同一主卡");
assert.ok(!exactIds("ばかり数量").includes("degree-7-ばかり-数量-程度"), "括号内说明不得被拼成表达变体");
assert.ok(!JSON.stringify(context.GRAMMAR_SEARCH_READINGS).includes("ばかり数量"), "括号内说明不得混入读音索引");

for (const { item } of cards) {
  for (const reading of GrammarSearch.readingForms(item)) {
    assert.ok(rank(reading.reading).exact.some((result) => result.item.id === item.id), `平假名必须精确命中汉字词条：${item.id} / ${reading.reading}`);
    assert.ok(rank(reading.romaji).exact.some((result) => result.item.id === item.id), `罗马音必须精确命中汉字词条：${item.id} / ${reading.romaji}`);
  }
}

// 全库检查：任何精确结果都必须有相同的主句式/已登记变体；别名只可进入强相关。
for (const { item } of cards) {
  for (const form of [...new Set([item.pattern, ...(item.variants || [])].flatMap(GrammarSearch.patternVariants))]) {
    assert.deepEqual(exactIds(form), registeredExactIds(form), `精确结果必须只包含已登记形式：${form}`);
  }
  for (const alias of item.searchAliases || []) {
    for (const aliasForm of GrammarSearch.patternVariants(alias)) {
      assert.deepEqual(exactIds(aliasForm), registeredExactIds(aliasForm), `别名不得单独产生完全一致：${aliasForm}`);
      const result = rank(aliasForm);
      const ownerIsRegistered = registeredExactIds(aliasForm).includes(item.id);
      assert.ok(ownerIsRegistered || result.strong.some((entry) => entry.item.id === item.id), `别名必须保留可检索入口：${item.id} / ${aliasForm}`);
    }
  }
}

console.log("Search ranking audit passed.");
