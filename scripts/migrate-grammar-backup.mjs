import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const input = process.argv[2];
if (!input) throw new Error("用法：node scripts/migrate-grammar-backup.mjs <beka-japanese-grammar-backup-*.json>");
const source = JSON.parse(await readFile(input, "utf8"));
if (source.app !== "beka-japanese-grammar" || ![1, 2, 3].includes(source.version)) throw new Error("不是本站 v1/v2/v3 备份文件");

const contentContext = { console };
vm.createContext(contentContext);
await vm.runInContext(await readFile(join(root, "content-data.js"), "utf8"), contentContext);
await vm.runInContext("globalThis.__grammarGroups = GRAMMAR_GROUPS;", contentContext);
const custom = source.custom || {};
custom.edits ||= {};
custom.notes ||= {};
custom.additions ||= {};
custom.deleted ||= {};
custom.preferences ||= {};
const migrations = contentContext.GRAMMAR_CARD_ID_MIGRATIONS || {};
const appendNote = (id, text) => { if (text) custom.notes[id] = [custom.notes[id], text].filter(Boolean).join("\n\n"); };
const supplement = (item, label) => {
  const fields = [["文型", item.pattern], ["意思", item.meaning], ["接续", item.connection], ["固定搭配", item.collocation], ["语感", item.nuance], ["例句", item.example], ["译文", item.translation]]
    .filter(([, value]) => value).map(([name, value]) => `${name}：${value}`);
  return fields.length ? `【原自定义补充：${label}】\n${fields.join("\n")}` : "";
};
for (const [fromId, toId] of Object.entries(migrations)) {
  if (custom.notes[fromId]) appendNote(toId, custom.notes[fromId]);
  if (custom.edits[fromId]) {
    appendNote(toId, supplement(custom.edits[fromId], `已合并卡片 ${fromId}`));
    if (custom.edits[fromId].usageFlags) custom.preferences[toId] = {
      ...(custom.preferences[toId] || {}),
      usageFlags: { ...(custom.preferences[toId]?.usageFlags || {}), ...custom.edits[fromId].usageFlags }
    };
    delete custom.edits[fromId];
  }
  delete custom.notes[fromId];
}
for (const report of contentContext.GRAMMAR_CARD_MERGE_REPORT || []) {
  const ids = [report.primaryId, ...(report.mergedFromIds || [])];
  if (ids.every((id) => custom.deleted[id])) custom.deleted[report.primaryId] = true;
  for (const id of report.mergedFromIds || []) delete custom.deleted[id];
}
const builtIns = contentContext.__grammarGroups.flatMap((group) => group.expressions.map((item) => ({ group, item })));
const compact = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
for (const [groupId, additions] of Object.entries(custom.additions)) {
  const kept = [];
  for (const addition of additions || []) {
    const key = compact(addition.pattern);
    const matches = key ? builtIns.filter(({ group, item }) => {
      if (!(item.relatedGroups || [group.id]).includes(groupId)) return false;
      return [item.pattern, ...(item.variants || [])].some((value) => compact(value) === key);
    }) : [];
    if (matches.length !== 1) {
      kept.push(addition);
      continue;
    }
    const target = matches[0].item;
    appendNote(target.id, supplement(addition, `自定义条目 ${addition.pattern || addition.id}`));
    if (addition.usageFlags) custom.preferences[target.id] = {
      ...(custom.preferences[target.id] || {}),
      usageFlags: { ...(custom.preferences[target.id]?.usageFlags || {}), ...addition.usageFlags }
    };
    if (custom.notes[addition.id]) appendNote(target.id, custom.notes[addition.id]);
    delete custom.notes[addition.id];
    delete custom.edits[addition.id];
    delete custom.deleted[addition.id];
  }
  custom.additions[groupId] = kept;
}
custom.schemaVersion = 3;
const output = { ...source, version: 3, exportedAt: new Date().toISOString(), custom };
const outputDir = join(root, "outputs", "backups");
await mkdir(outputDir, { recursive: true });
await copyFile(input, join(outputDir, `${basename(input, ".json")}-original.json`));
const outputPath = join(outputDir, `${basename(input, ".json")}-v3.json`);
await writeFile(outputPath, JSON.stringify(output, null, 2), "utf8");
console.log(outputPath);
