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
await vm.runInContext(await readFile(join(root, "search-engine.js"), "utf8"), context);
await vm.runInContext("globalThis.__groups = GRAMMAR_GROUPS;", context);

const { GrammarSearch, __groups: groups } = context;
const rank = (query, level = "all") => GrammarSearch.rank(groups, query, { level });
const patterns = (items) => items.map((item) => item.item.pattern);

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

const customGroups = structuredClone(groups);
customGroups[0].expressions.push({
  id: "custom-search-proof",
  level: "N3",
  pattern: "極光文型",
  meaning: "仅供检索测试",
  connection: "普通形 + 極光文型",
  nuance: "自定义条目",
  searchAliases: ["aurora grammar"]
});
assert.equal(GrammarSearch.rank(customGroups, "極光文型").exact[0]?.item.id, "custom-search-proof", "用户新增条目必须进入同一检索模型");
assert.equal(GrammarSearch.rank(customGroups, "aurora grammar").exact[0]?.item.id, "custom-search-proof", "用户新增别名必须可精确检索");
assert.equal(rank("からこそ", "N2").counts.exact, 0, "等级筛选必须排除 N3 的 からこそ");

console.log("Search ranking audit passed.");
