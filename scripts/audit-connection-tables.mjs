import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const context = {
  console,
  structuredClone,
  URLSearchParams,
  localStorage: { getItem: () => null, setItem: () => {} },
  location: { search: "" },
  matchMedia: () => ({ matches: false })
};
context.window = context;
vm.createContext(context);
await vm.runInContext(await readFile(join(root, "content-data.js"), "utf8"), context);
await vm.runInContext(await readFile(join(root, "furigana-data.js"), "utf8"), context);
const appSource = (await readFile(join(root, "app.js"), "utf8"))
  .replace(/\ninit\(\);\s*$/, "\nglobalThis.__parseConnectionRows = parseConnectionRows; globalThis.__renderConnectionTable = renderConnectionTable; globalThis.__grammarGroups = GRAMMAR_GROUPS;");
await vm.runInContext(appSource, context);

const { __parseConnectionRows: parse, __renderConnectionTable: render, __grammarGroups: groups } = context;
const cards = groups.flatMap((group) => group.expressions);
const normalize = (value) => String(value || "").replace(/\s+/g, "").trim();

for (const card of cards) {
  const original = String(card.connection || "").split(/[；;]/).map((part) => part.trim()).filter(Boolean);
  const rows = parse(card.connection);
  assert.ok(rows.length >= 1, `${card.id} 必须至少生成一行接续表`);
  if (!original.length) {
    assert.equal(JSON.stringify(rows.map(({ scope, form, note }) => ({ scope, form, note }))), JSON.stringify([{ scope: "—", form: "—", note: "" }]), `${card.id} 的空接续必须降级显示`);
    continue;
  }
  const retained = rows.flatMap((row) => String(row.raw || "").split(/[；;]/).map((part) => part.trim()).filter(Boolean));
  assert.equal(JSON.stringify(retained.map(normalize)), JSON.stringify(original.map(normalize)), `${card.id} 的分号规则不得丢失`);
}

const byId = new Map(cards.map((card) => [card.id, card]));
const checks = [
  ["reason-2-ために", 3, ["动词 / い形容词", "な形容词", "名词"]],
  ["purpose-2-ように", 1, ["动词"]],
  ["guess-16-そうだ-样态", 3, ["动词", "い形容词", "な形容词"]],
  ["reason-1-ので", 1, ["普通形"]],
  ["sequence-3-うちに", 3, ["动词 / い形容词", "な形容词", "名词"]],
  ["desire-17-限りだ", 3, ["い形容词", "な形容词", "名词"]]
];
for (const [id, rowCount, scopes] of checks) {
  const card = byId.get(id);
  assert.ok(card, `找不到审计样本 ${id}`);
  const rows = parse(card.connection);
  assert.equal(rows.length, rowCount, `${card.pattern} 应拆成 ${rowCount} 行`);
  assert.equal(JSON.stringify(rows.map((row) => row.scope)), JSON.stringify(scopes), `${card.pattern} 的词类列不正确`);
}

const visibleRows = (value) => parse(value).map(({ scope, form, note }) => ({ scope, form, note }));
assert.equal(JSON.stringify(visibleRows("动词て形 + てもいい")), JSON.stringify([{ scope: "动词", form: "て形 + てもいい", note: "" }]), "单一动词接续必须解析");
assert.equal(JSON.stringify(visibleRows("句首连接")), JSON.stringify([{ scope: "句首", form: "连接", note: "" }]), "句首连接词必须解析");
assert.equal(JSON.stringify(visibleRows("自定义规则，无分号")), JSON.stringify([{ scope: "固定形式", form: "自定义规则，无分号", note: "" }]), "自定义无分号文本必须保留");
assert.equal(JSON.stringify(visibleRows("")), JSON.stringify([{ scope: "—", form: "—", note: "" }]), "空值必须降级");

const html = render(byId.get("reason-2-ために").connection);
assert.match(html, /<table class="connection-table">/, "接续必须渲染为表格");
assert.match(html, /词类 \/ 场景/, "表格必须有词类列");
assert.match(html, /接续形式/, "表格必须有接续形式列");
assert.match(html, /注意/, "表格必须有注意列");
assert.equal((html.match(/<tr>/g) || []).length, 4, "三条规则应渲染表头加三行");

console.log(`Connection table audit passed: ${cards.length} cards.`);
