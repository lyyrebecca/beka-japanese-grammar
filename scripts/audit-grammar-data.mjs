import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import vm from "node:vm";

const root = process.cwd();
const source = await readFile(join(root, "content-data.js"), "utf8");
const context = { console };
vm.createContext(context);
const snapshot = vm.runInContext(`${source}
JSON.stringify({
  groups: GRAMMAR_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    expressions: group.expressions.map((item) => ({
      id: item.id,
      level: item.level,
      pattern: item.pattern,
      meaning: item.meaning,
      connection: item.connection || "",
      collocation: item.collocation || "",
      nuance: item.nuance || "",
      sourceBook: item.sourceBook || "",
      sourceLesson: item.sourceLesson || "",
      searchAliases: item.searchAliases || []
    }))
  })),
  gaokaoSupplementReport: globalThis.GAOKAO_SUPPLEMENT_REPORT || { added: [], merged: [] },
  connectionAuditReport: globalThis.CONNECTION_AUDIT_REPORT || []
}, null, 2);
`, context);

const data = JSON.parse(snapshot);
const expressions = data.groups.flatMap((group) => group.expressions.map((item) => ({ groupId: group.id, groupTitle: group.title, ...item })));
const missing = expressions
  .filter((item) => !item.pattern || !item.meaning || !item.connection || !item.nuance || !item.sourceBook)
  .map((item) => ({
    groupId: item.groupId,
    pattern: item.pattern,
    missing: [
      !item.pattern && "pattern",
      !item.meaning && "meaning",
      !item.connection && "connection",
      !item.nuance && "nuance",
      !item.sourceBook && "sourceBook"
    ].filter(Boolean)
  }));

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    groups: data.groups.length,
    expressions: expressions.length,
    withCollocation: expressions.filter((item) => item.collocation).length,
    withSearchAliases: expressions.filter((item) => item.searchAliases.length).length
  },
  gaokaoSupplementReport: data.gaokaoSupplementReport,
  connectionAudit: {
    patchedCount: data.connectionAuditReport.length,
    patched: data.connectionAuditReport
  },
  missingRequiredFields: missing,
  focusChecks: [
    "と/ば/たら/なら",
    "ように/ために",
    "よう/みたい/らしい/そう",
    "はず/べき",
    "あげる/くれる/もらう",
    "敬语",
    "助词"
  ].map((label) => ({
    label,
    hits: expressions
      .filter((item) => label.split(/[\/・]/).some((token) => item.pattern.includes(token) || item.meaning.includes(token) || item.connection.includes(token) || item.collocation.includes(token)))
      .slice(0, 20)
      .map((item) => ({ groupId: item.groupId, pattern: item.pattern, connection: item.connection, collocation: item.collocation }))
  }))
};

await mkdir(join(root, "outputs", "extraction"), { recursive: true });
await writeFile(join(root, "outputs", "extraction", "grammar-data-audit.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report.totals, null, 2));
console.log(`Missing required field rows: ${missing.length}`);
