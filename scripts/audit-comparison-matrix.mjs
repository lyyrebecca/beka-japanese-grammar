import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const context = { console };
context.window = context;
vm.createContext(context);
await vm.runInContext(await readFile(join(root, "content-data.js"), "utf8"), context);
await vm.runInContext(await readFile(join(root, "comparison-data.js"), "utf8"), context);
await vm.runInContext("globalThis.__comparisonGroups = GRAMMAR_GROUPS; globalThis.__comparisonData = GRAMMAR_COMPARISON_DATA;", context);

const groups = context.__comparisonGroups;
const data = context.__comparisonData;
assert.ok(data?.groups && data?.profiles && data?.fallbackProfile, "辨析数据必须完整加载");
let total = 0;
for (const group of groups) {
  const sections = data.groups[group.id];
  assert.ok(Array.isArray(sections) && sections.length, `${group.id} 必须有至少一个辨析板块`);
  if (group.expressions.length > 8) assert.ok(sections.length >= 2, `${group.id} 超过 8 条时必须细分`);
  const ids = sections.flatMap((section) => {
    assert.ok(section.id && section.title && section.summary, `${group.id} 的辨析板块字段不完整`);
    assert.ok(Array.isArray(section.expressionIds) && section.expressionIds.length, `${group.id}/${section.id} 不能空`);
    return section.expressionIds;
  });
  assert.equal(new Set(ids).size, ids.length, `${group.id} 中的表达只能归入一个主辨析板块`);
  assert.equal(ids.length, group.expressions.length, `${group.id} 必须覆盖每张内置卡`);
  for (const item of group.expressions) {
    assert.ok(ids.includes(item.id), `${item.id} 未归类`);
    const profile = data.profiles[item.id] || data.fallbackProfile(item);
    for (const field of ["coreDifference", "usageScene", "avoidScene", "register", "polarity"]) {
      assert.ok(String(profile[field] || "").trim(), `${item.id} 缺少 ${field}`);
    }
    if (item.usageFlags?.negative && item.usageFlags?.positive) assert.match(profile.polarity, /可正可负|按词条/, `${item.id} 的双向标签和辨析倾向冲突`);
    else if (item.usageFlags?.negative) assert.match(profile.polarity, /消极|负面|按词条/, `${item.id} 的消极标签和辨析倾向冲突`);
    else if (item.usageFlags?.positive) assert.match(profile.polarity, /积极|正面|按词条/, `${item.id} 的积极标签和辨析倾向冲突`);
    total += 1;
  }
}
const profile = (id) => data.profiles[id] || data.fallbackProfile(groups.flatMap((group) => group.expressions).find((item) => item.id === id));
assert.match(profile("reason-0-から").coreDifference, /主观|直接/, "から必须说明主观直接");
assert.match(profile("reason-1-ので").coreDifference, /客观|柔和/, "ので必须说明客观柔和");
assert.match(profile("reason-4-せいで").avoidScene, /正面结果不可/, "せいで不得用于正面结果");
assert.match(profile("reason-5-ばかりに").polarity, /消极/, "ばかりに必须是消极倾向");
assert.match(profile("condition-1-と").avoidScene, /不可接.*意志.*命令.*请求/, "と后项限制必须保留");
assert.match(profile("concession-2-のに").coreDifference, /意外|遗憾|不满/, "のに必须说明情绪逆接");
assert.match(profile("concession-3-にもかかわらず").register, /书面/, "にもかかわらず必须标为书面");
console.log(`Comparison matrix audit passed: ${groups.length} groups, ${total} cards.`);
