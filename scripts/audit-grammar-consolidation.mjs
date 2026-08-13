import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const context = { console };
context.window = context;
vm.createContext(context);
await vm.runInContext(await readFile(join(root, "content-data.js"), "utf8"), context);
await vm.runInContext(await readFile(join(root, "search-engine.js"), "utf8"), context);
await vm.runInContext("globalThis.__grammarGroups = GRAMMAR_GROUPS;", context);

const groups = context.__grammarGroups;
const cards = groups.flatMap((group) => group.expressions.map((item) => ({ groupId: group.id, groupTitle: group.title, ...item })));
const compact = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const semanticKey = (item) => `${compact(item.pattern).replace(/[目的原因愿望回忆习惯感慨一般论起点]/g, "")}|${compact(item.meaning)}`;

assert.equal(new Set(cards.map((item) => item.id)).size, cards.length, "卡片 ID 必须唯一");
assert.equal(cards.filter((item) => !item.connection || !String(item.connection).trim()).length, 0, "所有卡片必须有接续");
assert.ok(cards.every((item) => Array.isArray(item.variants)), "所有卡片必须具有 variants 数组");

const duplicateSemanticCards = new Map();
for (const card of cards) {
  const key = semanticKey(card);
  if (!key || key === "|") continue;
  (duplicateSemanticCards.get(key) || duplicateSemanticCards.set(key, []).get(key)).push(card);
}
const unresolvedDuplicates = [...duplicateSemanticCards.values()]
  .filter((items) => items.length > 1)
  .map((items) => items.map((item) => ({ id: item.id, pattern: item.pattern, meaning: item.meaning, groupId: item.groupId })));
assert.equal(unresolvedDuplicates.length, 0, "不得保留未登记的同形同义重复卡");

const rank = (query) => context.GrammarSearch.rank(groups, query, { limit: 1000 });
const variantChecks = [];
for (const card of cards) {
  for (const variant of [...new Set(card.variants.filter(Boolean))]) {
    const exact = rank(variant).exact.filter((result) => result.item.id === card.id);
    assert.equal(exact.length, 1, `变体「${variant}」必须精确命中 ${card.id}`);
    variantChecks.push({ id: card.id, variant, exactCount: rank(variant).counts.exact });
  }
}

const homographGroups = new Map();
for (const card of cards.filter((item) => item.homographKey)) {
  (homographGroups.get(card.homographKey) || homographGroups.set(card.homographKey, []).get(card.homographKey)).push(card);
}
for (const [key, items] of homographGroups) {
  assert.ok(items.length >= 2, `${key} 必须至少包含两个同形异义项`);
  const query = items.flatMap((item) => item.variants || []).sort((a, b) => String(a).length - String(b).length)[0] || items[0].pattern;
  const resultIds = new Set(rank(query).exact.map((result) => result.item.id));
  for (const item of items) assert.ok(resultIds.has(item.id), `同形异义「${query}」必须返回 ${item.id}`);
}

const migrations = context.GRAMMAR_CARD_ID_MIGRATIONS || {};
for (const target of Object.values(migrations)) assert.ok(cards.some((item) => item.id === target), `迁移目标 ${target} 必须存在`);

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    groups: groups.length,
    cards: cards.length,
    mergedCards: Object.keys(migrations).length,
    variants: variantChecks.length,
    homographGroups: homographGroups.size
  },
  mergeReport: context.GRAMMAR_CARD_MERGE_REPORT || [],
  migrations,
  homographs: Object.fromEntries([...homographGroups].map(([key, items]) => [key, items.map((item) => ({ id: item.id, pattern: item.pattern, meaning: item.meaning }))])),
  connectionAudit: context.CONNECTION_AUDIT_REPORT || [],
  variantChecks,
  unresolvedDuplicates
};

await mkdir(join(root, "outputs", "audits"), { recursive: true });
await writeFile(join(root, "outputs", "audits", "grammar-card-consolidation-audit.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report.totals, null, 2));
