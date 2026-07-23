import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import vm from "node:vm";

const root = process.cwd();
const mdPath = "/Users/Zhuanz/Desktop/龙虾 临时运行/日语语法md/高考日语语法专项_clean.md";
const ocrPath = join(root, "outputs/ocr/bluebook/高考日语蓝宝书_语法_ocr.md");
const siteSource = await readFile(join(root, "content-data.js"), "utf8");

const context = { console };
vm.createContext(context);
const siteJson = vm.runInContext(`${siteSource}
JSON.stringify(GRAMMAR_GROUPS.map((group) => ({
  id: group.id,
  title: group.title,
  expressions: group.expressions.map((item) => ({
    pattern: item.pattern,
    meaning: item.meaning,
    connection: item.connection || "",
    collocation: item.collocation || "",
    aliases: item.searchAliases || [],
    sourceBook: item.sourceBook || ""
  }))
})));
`, context);
const siteGroups = JSON.parse(siteJson);
const siteExpressions = siteGroups.flatMap((group) => group.expressions.map((item) => ({ groupId: group.id, groupTitle: group.title, ...item })));

function normalizePattern(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[「」『』【】\\[\\]\\s　]/g, "")
    .replace(/[（）()]/g, "")
    .replace(/^(一|二|三|四|五|六|七|八|九|十|[0-9]+)[.、．]\s*/, "")
    .replace(/^(动词|動詞)(「)?ます形(」)?\+?/g, "")
    .replace(/^(动词|動詞)(「)?て形(」)?\+?/g, "て")
    .replace(/^(动词|動詞)(原形|辞書形)\+?/g, "")
    .replace(/^名词の形。?/g, "")
    .replace(/^前接/g, "")
    .replace(/[~〜～…・·／/\\\\.+-]/g, "")
    .replace(/(前接|后接|接|表示|前|后|形|词干|普通体|普通形|简体|原形|名词|動詞|动词|形容词|助词|体言|用言|小句|句型|相关语法|表)$/g, "")
    .replace(/[。。，,：:；;]/g, "")
    .toLowerCase();
}

function splitPattern(text) {
  return String(text || "")
    .split(/[·・／/、,，]|和|及|以及/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sourceCandidatesFromCleanMd(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (let lineNo = 0; lineNo < lines.length; lineNo += 1) {
    const line = lines[lineNo];
    const quoted = [...line.matchAll(/「([^」]{1,34})」/g)].map((match) => match[1]);
    const heading = line.match(/^##\s+(.+)/)?.[1] || line.match(/^\*\*「([^」]+)」/)?.[1] || "";
    const strongPattern = line.match(/^\*\*「?([^」*]{1,38})」?/)?.[1] || "";
    for (const raw of [...quoted, heading, strongPattern]) {
      for (const part of splitPattern(raw)) {
        addCandidate(rows, part, "高考日语语法专项", lineNo + 1, line);
      }
    }
  }
  return rows;
}

function sourceCandidatesFromOcr(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  let page = "";
  for (let lineNo = 0; lineNo < lines.length; lineNo += 1) {
    const line = lines[lineNo];
    const pageMatch = line.match(/^## Page (\d+)/);
    if (pageMatch) page = pageMatch[1];
    const unit = line.match(/Unit\s*\d+\s+(.{2,50})/)?.[1] || "";
    for (const raw of [unit]) {
      for (const part of splitPattern(raw)) {
        addCandidate(rows, part, "高考日语蓝宝书 OCR", page || lineNo + 1, line);
      }
    }
  }
  return rows;
}

function addCandidate(rows, raw, source, locator, contextLine) {
  const clean = raw
    .replace(/^[「『#*\s]+|[」』#*\s]+$/g, "")
    .replace(/^(一|二|三|四|五|六|七|八|九|十)、/, "")
    .trim();
  const key = canonicalizeKey(normalizePattern(clean), clean, contextLine);
  if (!key || key.length < 2) return;
  if (/^[0-9a-z.\- ]+$/i.test(key)) return;
  if (isNoiseCandidate(clean, key, contextLine)) return;
  rows.push({ raw: clean, key, source, locator, context: contextLine.trim().slice(0, 180) });
}

function canonicalizeKey(key, raw, contextLine = "") {
  const text = `${raw} ${contextLine}`;
  const table = new Map([
    ["だりする", "たりたりする"],
    ["たりたりする", "たりたりする"],
    ["ねえ", "ねねえ"],
    ["なあ", "ななあ"],
    ["かなあ", "かな"],
    ["动词ます", ""],
    ["て", ""],
    ["置く", "ておく"],
    ["ございる", "ございます"],
    ["ござる", "ございます"],
    ["参られる", "参る"]
  ]);
  if (table.has(key)) return table.get(key);
  if (/そう/.test(key) && /ます形/.test(text)) return "そうだ";
  if (/すぎる|過ぎる/.test(key)) return "すぎる";
  if (/やすい/.test(key)) return "やすい";
  if (/にくい/.test(key)) return "にくい";
  if (/始める|はじめる/.test(key)) return "始める";
  if (/終わる|おわる/.test(key)) return "終わる";
  if (/続ける|つづける/.test(key)) return "続ける";
  if (/出す|だす/.test(key)) return "出す";
  if (/直す|なおす/.test(key)) return "直す";
  if (/切る|きる/.test(key)) return "切る";
  if (/かける/.test(key)) return "かける";
  if (/抜く|ぬく/.test(key)) return "抜く";
  if (/てある/.test(key)) return "てある";
  if (/ておく/.test(key)) return "ておく";
  if (/てしまう/.test(key)) return "てしまう";
  if (/ていく/.test(key)) return "ていく";
  if (/てくる/.test(key)) return "てくる";
  if (/ご.*ください/.test(key)) return "ごください";
  return key;
}

function isNoiseCandidate(raw, key, contextLine = "") {
  if (/^(title|authors|language|publisher|date|identifier|unit|page|第一部分|第二部分|第三部分|前言|目录)$/.test(key)) return true;
  if (/^(数词|基数词|序数词|常用量词|表示顺序的量词|表示时间的量词|表示单位的量词|其他量词|ページ|ヶ月|キロ|パーセント|てん)$/.test(raw)) return true;
  if (/^(第|号|流|位|長|次|本|才)$/.test(key)) return true;
  if (/^(第だい|号ごう|流りゅう|位い|長ちょう|次じ)$/.test(key)) return true;
  if (/^(形1原形|形2な形|形2变形表部分参考|动词分类|动词变形69|助动词190|助动词299|形式名词本|语气助词36)$/.test(key)) return true;
  if (/^(え段る|あ段る|あ段す|い段る|お段す)$/.test(key)) return true;
  if (/^(必须相关语法|无法忍受相关语法|终于相关语法|限る相关语法)$/.test(key)) return true;
  if (/^(表示正在做某事常跟副词今|表示客观时间上刚做完某事常跟副词今|在时候|递进|原因)$/.test(key)) return true;
  if (/^(表示正在做某事|表示客观时间上刚做完某事|名词の形。表示|前接动词原形|限る」相关语法|“必须”相关语法|“无法忍受”相关语法|“终于”相关语法)/.test(raw)) return true;
  if (/^(形1原形|形2な形|语气助词|形式名词|助动词|对象的句型)$/.test(raw.trim())) return true;
  if (/^(お借りして|さしあげます|あげましょう)$/.test(raw)) return true;
  if (/(句型|助动词|补助动词|语气助词|形式名词)/.test(raw) && !/[ぁ-んァ-ヶー]/.test(raw)) return true;
  if (/^(王さん|李さん|ジョンさん|高橋くん|どちらさま|いいえ|うん|えっ|ええ|じゃ|ううん|まだだよ|早いね|寒い|寒い。|すみません|うみ)$/.test(raw)) return true;
  if (/^(聞く|知る|調べる|会う|置く|来られる|お待ち|王さん|今ちょうど|買う|急ぐ|返す|待つ|死ぬ|遊ぶ|食べる|降る|飲む|言う|使う|かかる|想像する|考える|設計する|発見する|必要だ|不可欠だ)$/.test(raw.replace(/\s+/g, ""))) return true;
  if (/^(どうしましたか|どうぞ|お願いします|わかりました|覚えている|よく覚えているよ|貸してあげるよ|食べていいかな|このコート|この仕事|この葉書|アイスクリームを二つ|お名前|お母さん|大山くん|中川さん|そのカメラ)$/.test(raw)) return true;
  if (/^[ぁ-んァ-ヶー一-龯]+[。?？]?$/.test(raw) && String(contextLine).length < 18) return true;
  if (/^(\\d+\\.|[0-9０-９].+|.*pp\\s*\\d+.*|.*[|].*|.*ee\\s*\\d+.*|.*\\d{2,}.*)$/.test(raw)) return true;
  if (/[記窜欄欢凡究]|人部終|名何|二名同|この名|ご\)|到为|词于十万|美導|参[らや叶呈史]|幸李|寺字|計字|T半|大や|ご二名/.test(raw)) return true;
  return false;
}

const siteDocs = siteExpressions.map((item) => {
  const docs = [item.pattern, item.meaning, item.connection, item.collocation, item.sourceBook, ...(item.aliases || [])].join(" ");
  return { ...item, key: normalizePattern(item.pattern), doc: normalizePattern(docs) };
});

function findCoverage(candidate) {
  const keys = keyAlternatives(candidate.key);
  return siteDocs.find((item) => keys.some((key) => item.key === key))
    || siteDocs.find((item) => keys.some((key) => item.key.includes(key) || key.includes(item.key)))
    || siteDocs.find((item) => keys.some((key) => item.doc.includes(key)));
}

function keyAlternatives(key) {
  const alternatives = new Set([key]);
  if (key === "たりたりする") alternatives.add("たりたり");
  if (key === "ごください") alternatives.add("おください");
  if (key === "ご説明いただきます") alternatives.add("させていただく");
  if (key === "出席させていただきます") alternatives.add("させていただく");
  if (key === "お借りして") alternatives.add("借りる");
  if (key === "おかけして" || key === "ごかけして") alternatives.add("かける");
  if (key === "参られる") alternatives.add("参る");
  if (key === "さしあげます") alternatives.add("あげますてあげます");
  if (key === "かぎり") alternatives.add("限り");
  if (key === "かぎりだ") alternatives.add("限りだ");
  return [...alternatives].filter(Boolean);
}

const allCandidates = [
  ...sourceCandidatesFromCleanMd(await readFile(mdPath, "utf8")),
  ...sourceCandidatesFromOcr(await readFile(ocrPath, "utf8"))
];
const unique = new Map();
for (const candidate of allCandidates) {
  if (!unique.has(`${candidate.source}:${candidate.key}`)) unique.set(`${candidate.source}:${candidate.key}`, candidate);
}

const compared = [...unique.values()].map((candidate) => {
  const hit = findCoverage(candidate);
  return {
    ...candidate,
    covered: Boolean(hit),
    siteGroup: hit?.groupTitle || "",
    sitePattern: hit?.pattern || ""
  };
});

const highSignalMissing = compared
  .filter((item) => !item.covered)
  .filter((item) => /[ぁ-んァ-ヶー]|[一-龯].*(だ|です|ない|する|なる|形|词|助词|语法|句型)/.test(item.raw))
  .filter((item) => !/^(格助词|提示助词|并列助词|接续助词|副助词|语气助词|表示.+句型|尊敬语句型|谦让语句型)$/.test(item.raw))
  .filter((item) => !/^(聞こえる|静か|書く|読む|読んだ|書いたり|赤い|好きだ|柔らかだ|好き|柔らか|多い|少ない|よい|よくない|よくなかった|同じ|大きい|小さい|大きな|小さな|かわいい|きれい|難しい|高い|寒い|涼しい|暖かい|だれ|どんな|ここ|こちら|そちら|あちら|こんな|あんな|あそこ|どうして|いくつ)$/.test(item.raw))
  .filter((item) => !/^(常见疑问词|疑问词的用法|人称代词|指示代词|形容词的叠加|相同读音汉字不同的形容词)$/.test(item.raw))
  .slice(0, 160);

const report = {
  generatedAt: new Date().toISOString(),
  siteTotals: {
    groups: siteGroups.length,
    expressions: siteExpressions.length
  },
  sourceTotals: {
    candidates: compared.length,
    covered: compared.filter((item) => item.covered).length,
    missing: compared.filter((item) => !item.covered).length,
    highSignalMissing: highSignalMissing.length
  },
  notes: [
    "This is an automated coverage comparison using grammar headings, quoted patterns, and OCR unit headings.",
    "The OCR source is noisy, so highSignalMissing should be treated as review candidates, not guaranteed omissions.",
    "Coverage is counted when a source pattern appears in a site pattern, connection, collocation, aliases, or source metadata."
  ],
  highSignalMissing,
  coveredSamples: compared.filter((item) => item.covered).slice(0, 120)
};

await mkdir(join(root, "outputs", "extraction"), { recursive: true });
await writeFile(join(root, "outputs/extraction/source-coverage-report.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report.sourceTotals, null, 2));
