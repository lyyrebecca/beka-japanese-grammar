import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../conjugation-data.js", import.meta.url), "utf8");
const context = {};
vm.runInNewContext(`${source}\n;this.__cards = CONJUGATION_CARDS; this.__categories = CONJUGATION_CATEGORIES;`, context);

const cards = context.__cards;
const categories = context.__categories;
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function card(id) {
  const found = cards.find((item) => item.id === id);
  check(Boolean(found), `缺少卡片：${id}`);
  return found || {};
}

function textOf(item) {
  return JSON.stringify(item);
}

check(Array.isArray(cards) && cards.length >= 49, `卡片数量异常：${cards?.length ?? "不可读"}`);
check(new Set(cards.map((item) => item.id)).size === cards.length, "存在重复卡片 id");

const categoryPairs = new Set(
  categories.flatMap((category) => category.subcategories.map((subcategory) => `${category.id}\u0000${subcategory.id}`))
);
for (const item of cards) {
  check(item.id && item.title && item.formation && item.example && item.exampleTranslation, `卡片必填字段缺失：${item.id || "unknown"}`);
  check(categoryPairs.has(`${item.category}\u0000${item.subcategory}`), `卡片分类未在导航中定义：${item.id} -> ${item.category}/${item.subcategory}`);
  check(Array.isArray(item.table?.headers) && Array.isArray(item.table?.rows), `卡片表格结构错误：${item.id}`);
  for (const [index, row] of (item.table?.rows || []).entries()) {
    check(row.length === item.table.headers.length, `表格列数不一致：${item.id} 第 ${index + 1} 行`);
  }
}

const plain = card("plain-form-overview");
check(plain.table?.headers?.length === 5, "普通形总览必须覆盖词性和四种基础形态");
check(textOf(plain).includes("食べなかった") && textOf(plain).includes("静かではなかった"), "普通形总览未完整覆盖过去否定");
check(textOf(plain).includes("辞书形只是动词普通形"), "未明确辞书形只是动词普通形的一部分");
check(plain.aliases?.includes("动词简体形") && plain.aliases?.includes("动词基本形"), "普通形总览缺少动词简体形/动词基本形检索词");

const dict = card("dict-form");
check(dict.subcategory === "辞書形", "辞书形仍被错误归入普通形子分类");
check(dict.table?.rows?.length === 3 && dict.table.rows.every((row) => row[0].startsWith("动词")), "辞书形卡不应把形容词或名词称为辞书形");
check(dict.aliases?.includes("动词基本形") && dict.aliases?.includes("动词简体形"), "辞书形卡缺少动词基本形/动词简体形对照检索词");

const mustContain = [
  ["masu-form", "う段 → い段 + ます"],
  ["ba-form", "書か<b>なければ</b>"],
  ["imperative-form", "去る + ろ"],
  ["volitional-form", "い段（ます形词干）+ ましょう"],
  ["nai-de", "ない形 + で"],
  ["nai-to", "ない形 + と"],
  ["dict-tsumori", "辞书形 + つもり"],
  ["dict-hajimeru", "ます形词干 + はじめる"],
  ["nominalization-no-koto", "学生であること"],
  ["nominalization-no-koto", "名词不能机械写成"],
];
for (const [id, expected] of mustContain) {
  check(textOf(card(id)).includes(expected), `${id} 未包含已校正规则：${expected}`);
}

const forbidden = [
  "辞書形 / 普通形",
  "普通形（辞书形）",
  "う段 → お段 + ます",
  "动词ます形词干（お段）",
  "書か<b>ければ</b>",
  "ない形去い + でください",
  "ない形去い + と（",
  "意向形 + つもり",
  "辞书形 + はじめる",
  "食べらされる",
  "いらっしゃる / ござる",
  "意向形 + ませんか",
];
for (const phrase of forbidden) {
  check(!source.includes(phrase), `仍残留错误/易误导表述：${phrase}`);
}

if (failures.length) {
  console.error(`变形规则审计失败（${failures.length} 项）：`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`变形规则审计通过：${cards.length} 张卡片，${categories.length} 个分类，普通形与 ${mustContain.length} 组高风险规则均已核对。`);
