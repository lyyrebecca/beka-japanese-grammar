/* ═══════════════════════════════════════════
   conjugation-app.js — 变形规则页交互逻辑
   主题同步、分类导航、卡片渲染、搜索
   ═══════════════════════════════════════════ */

const THEME_KEY = "jp-grammar-quest-theme-v1";

const state = {
  categoryId: "",
  subcategoryId: "",
  query: "",
  theme: loadTheme()
};

const $ = (id) => document.getElementById(id);

/* ── 工具函数（与主站 app.js 保持一致） ── */

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(text) {
  return escapeHtml(text);
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ── 注音系统（精简版，覆盖变形规则页常见汉字） ── */

const FURIGANA_MAP = {
  "日本語": "にほんご", "文法": "ぶんぽう", "翻訳": "ほんやく", "練習": "れんしゅう",
  "復習": "ふくしゅう", "勉強": "べんきょう", "問題": "もんだい", "説明": "せつめい",
  "資料": "しりょう", "試験": "しけん", "合格": "ごうかく", "先生": "せんせい",
  "学生": "がくせい", "経験": "けいけん", "理由": "りゆう", "結果": "けっか",
  "確認": "かくにん", "時間": "じかん", "図書館": "としょかん", "電車": "でんしゃ",
  "昨日": "きのう", "失敗": "しっぱい", "返事": "へんじ", "方法": "ほうほう",
  "意見": "いけん", "大切": "たいせつ", "台風": "たいふう", "飛行機": "ひこうき",
  "事故": "じこ", "会議": "かいぎ", "中止": "ちゅうし", "延期": "えんき",
  "天気": "てんき", "予報": "よほう", "家族": "かぞく", "単語": "たんご",
  "京都": "きょうと", "宿題": "しゅくだい", "約束": "やくそく", "危険": "きけん",
  "会社": "かいしゃ", "名前": "なまえ", "成績": "せいせき", "調査": "ちょうさ",
  "努力": "どりょく", "事実": "じじつ", "自分": "じぶん", "友達": "ともだち",
  "学校": "がっこう", "授業": "じゅぎょう", "教科書": "きょうかしょ", "辞書": "じしょ",
  "作文": "さくぶん", "発表": "はっぴょう", "質問": "しつもん", "答え": "こたえ",
  "正しい": "ただしい", "間違い": "まちがい", "覚える": "おぼえる", "忘れる": "わすれる",
  "読む": "よむ", "書く": "かく", "聞く": "きく", "話す": "はなす", "言う": "いう",
  "使う": "つかう", "選ぶ": "えらぶ", "入る": "はいる", "出る": "でる",
  "来る": "くる", "行く": "いく", "帰る": "かえる", "戻る": "もどる",
  "始める": "はじめる", "終わる": "おわる", "続ける": "つづける", "続く": "つづく",
  "決める": "きめる", "変わる": "かわる", "変える": "かえる", "高い": "たかい",
  "低い": "ひくい", "多い": "おおい", "少ない": "すくない", "長い": "ながい",
  "短い": "みじかい", "早い": "はやい", "遅い": "おそい", "難しい": "むずかしい",
  "易しい": "やさしい", "厳しい": "きびしい", "忙しい": "いそがしい", "楽しい": "たのしい",
  "新しい": "あたらしい", "古い": "ふるい", "強い": "つよい", "弱い": "よわい",
  "良い": "よい", "悪い": "わるい", "有名": "ゆうめい", "安心": "あんしん",
  "心配": "しんぱい", "希望": "きぼう", "残念": "ざんねん", "感謝": "かんしゃ",
  "想像": "そうぞう", "理解": "りかい", "信頼": "しんらい", "関係": "かんけい",
  "影響": "えいきょう", "状況": "じょうきょう", "制度": "せいど", "計画": "けいかく",
  "予定": "よてい", "準備": "じゅんび", "用意": "ようい", "内容": "ないよう",
  "本当": "ほんとう", "事態": "じたい", "事件": "じけん", "社会": "しゃかい",
  "全体": "ぜんたい", "個人": "こじん", "店": "みせ", "駅": "えき",
  "銀行": "ぎんこう", "病院": "びょういん", "部屋": "へや", "家": "いえ",
  "雨": "あめ", "雪": "ゆき", "風": "かぜ", "春": "はる", "夏": "なつ",
  "秋": "あき", "冬": "ふゆ", "朝": "あさ", "晩": "ばん", "今日": "きょう",
  "明日": "あした", "来月": "らいげつ", "去年": "きょねん", "今年": "ことし",
  "来年": "らいねん", "毎日": "まいにち", "前回": "ぜんかい", "今回": "こんかい",
  "以前": "いぜん", "以後": "いご", "以上": "いじょう", "以下": "いか",
  "以内": "いない", "前": "まえ", "後": "あと", "中": "なか", "間": "あいだ",
  "際": "さい", "途中": "とちゅう", "子供": "こども", "大人": "おとな",
  "人": "ひと", "彼": "かれ", "彼女": "かのじょ", "私": "わたし",
  "皆": "みな", "専門": "せんもん", "研究": "けんきゅう", "調べる": "しらべる",
  "報告": "ほうこく", "連絡": "れんらく", "相談": "そうだん", "参加": "さんか",
  "出席": "しゅっせき", "欠席": "けっせき", "変更": "へんこう", "解決": "かいけつ",
  "成功": "せいこう", "成長": "せいちょう", "上達": "じょうたつ", "無理": "むり",
  "不足": "ふそく", "十分": "じゅうぶん", "全部": "ぜんぶ", "一部": "いちぶ",
  "一度": "いちど", "一緒": "いっしょ", "一方": "いっぽう", "観点": "かんてん",
  "視点": "してん", "場合": "ばあい", "条件": "じょうけん", "目的": "もくてき",
  "原因": "げんいん", "根拠": "こんきょ", "判断": "はんだん", "推量": "すいりょう",
  "比較": "ひかく", "対比": "たいひ", "逆接": "ぎゃくせつ", "譲歩": "じょうほ",
  "限定": "げんてい", "例示": "れいじ", "引用": "いんよう", "敬語": "けいご",
  "尊敬": "そんけい", "自謙": "じけん", "義務": "ぎむ", "許可": "きょか",
  "禁止": "きんし", "必要": "ひつよう", "不可能": "ふかのう", "可能": "かのう",
  "困難": "こんなん", "評価": "ひょうか", "立場": "たちば", "役割": "やくわり",
  "書面": "しょめん", "正式": "せいしき", "日常": "にちじょう", "口語": "こうご",
  "文章": "ぶんしょう", "報告書": "ほうこくしょ", "野菜": "やさい", "料理": "りょうり",
  "音楽": "おんがく", "映画": "えいが", "本": "ほん", "写真": "しゃしん",
  "傘": "かさ", "病院": "びょういん", "環境": "かんきょう", "町": "まち",
  "静か": "しずか", "綺麗": "きれい", "元気": "げんき", "大学": "だいがく",
  "大学院生": "だいがくいせい", "母": "はは", "子": "こ", "週末": "しゅうまつ",
  "毎週": "まいしゅう", "来週": "らいしゅう", "先週": "せんしゅう",
  "花見": "はなみ", "桜": "さくら", "富士山": "ふじさん", "寿司": "すし",
  "散歩": "さんぽ", "運動": "うんどう", "結婚": "けっこん", "卒業": "そつぎょう",
  "留学": "りゅうがく", "就職": "しゅうしょく", "就職": "しゅうしょく",
  "買い物": "かいもの", "朝ご飯": "あさごはん", "昼ご飯": "ひるごはん",
  "晩ご飯": "ばんごはん", "字": "じ", "花粉症": "かふんしょう",
  "妊娠": "にんしん", "出産": "しゅっさん", "育児": "いくじ",
  "丁寧語": "ていねいご", "尊敬語": "そんけいご", "謙譲語": "けんじょうご",
  "拝見": "はいけん", "申す": "もうす", "申し上げる": "もうしあげる",
  "存じる": "ぞんじる", "存ずる": "ぞんずる", "参る": "まいる", "伺う": "うかがう",
  "いただく": "いただく", "いたす": "いたす", "おる": "おる",
  "いらっしゃる": "いらっしゃる", "おっしゃる": "おっしゃる",
  "ご覧になる": "ごらんになる", "召し上がる": "めしあがる",
  "お書きになる": "おかきになる", "ご存じ": "ごぞんじ",
  "言葉": "ことば", "意味": "いみ", "語": "ご", "形": "けい",
  "状態": "じょうたい", "動作": "どうさ", "対象": "たいしょう",
  "相手": "あいて", "程度": "ていど", "範囲": "はんい",
  "伝聞": "でんぶん", "感情": "かんじょう", "感想": "かんそう",
  "願望": "がんぼう", "信用": "しんよう", "関心": "かんしん",
  "関わる": "かかわる", "最初": "さいしょ", "最後": "さいご",
  "途中": "とちゅう", "途中": "とちゅう", "現在": "げんざい",
  "過去": "かこ", "未来": "みらい", "現時": "げんじ",
  "完了": "かんりょう", "経験": "けいけん", "過去": "かこ",
  "語尾": "ごび", "活用": "かつよう", "語幹": "ごかん",
  "仮名": "かな", "漢字": "かんじ", "文": "ぶん", "句": "く",
  "節": "せつ", "単語": "たんご", "助詞": "じょし", "助動詞": "じょどうし",
  "接尾辞": "せつびじ", "接頭辞": "せとうじ",
  "五段": "ごだん", "一段": "いちだん", "不規則": "ふきそく",
  "一类": "いちるい", "二类": "にるい", "三类": "さんるい",
  "音便": "おんびん", "特殊": "とくしゅ", "例外": "れいがい",
  "肯定": "こうてい", "否定": "ひてい", "過去": "かこ",
  "意志": "いし", "提议": "ていあん", "命令": "めいれい",
  "禁止": "きんし", "受身": "うけみ", "使役": "しえき",
  "可能": "かのう", "条件": "じょうけん", "仮定": "かてい",
  "義務": "ぎむ", "許可": "きょか", "禁止": "きんし",
  "副詞": "ふくし", "連体詞": "れんたいし", "接続詞": "せつぞくし",
  "感動詞": "かんどうし", "名詞": "めいし", "動詞": "どうし",
  "形容詞": "けいようし", "形容動詞": "けいようどうし"
};

function annotateJapanese(text) {
  const source = String(text || "");
  const entries = Object.entries(FURIGANA_MAP).sort((a, b) => b[0].length - a[0].length);
  const pattern = new RegExp(entries.map(([kanji]) => escapeRegExp(kanji)).join("|"), "g");
  return escapeHtml(source).replace(pattern, (kanji) => {
    return `<ruby>${kanji}<rt>${FURIGANA_MAP[kanji]}</rt></ruby>`;
  });
}

function renderJapaneseText(text) {
  const source = String(text || "");
  // Protect <b> and </b> tags from escapeHtml
  const boldOpen = "\x00BOLD_OPEN\x00";
  const boldClose = "\x00BOLD_CLOSE\x00";
  let protectedText = source.replace(/<b>/g, boldOpen).replace(/<\/b>/g, boldClose);
  if (!protectedText.includes("<ruby")) {
    protectedText = annotateJapanese(protectedText);
  } else {
    const rubyPlaceholders = [];
    protectedText = protectedText.replace(/<ruby>.*?<\/ruby>/g, (match) => {
      const token = `__RUBY_${rubyPlaceholders.length}__`;
      rubyPlaceholders.push(match);
      return token;
    });
    protectedText = annotateJapanese(protectedText);
    rubyPlaceholders.forEach((ruby, index) => {
      protectedText = protectedText.replace(`__RUBY_${index}__`, ruby);
    });
  }
  // Restore <b> tags
  protectedText = protectedText.replace(new RegExp(boldOpen, "g"), "<b>").replace(new RegExp(boldClose, "g"), "</b>");
  return protectedText;
}

/* ── 主题管理（与主站同步） ── */

function loadTheme() {
  const param = new URLSearchParams(window.location.search).get("theme");
  if (param === "day" || param === "night") {
    localStorage.setItem(THEME_KEY, param);
    return param;
  }
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "day" || saved === "night") return saved;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
}

function saveTheme() {
  localStorage.setItem(THEME_KEY, state.theme);
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const button = $("themeToggleBtn");
  if (!button) return;
  const isNight = state.theme === "night";
  button.setAttribute("aria-pressed", String(isNight));
  button.innerHTML = `<span aria-hidden="true">${isNight ? "☼" : "☾"}</span>${isNight ? "白天" : "夜间"}`;
}

/* ── 初始化 ── */

function init() {
  state.categoryId = CONJUGATION_CATEGORIES[0]?.id || "";
  state.subcategoryId = "";
  applyTheme();
  bindEvents();
  render();
}

function bindEvents() {
  $("themeToggleBtn").addEventListener("click", () => {
    state.theme = state.theme === "night" ? "day" : "night";
    saveTheme();
    applyTheme();
  });
  $("conjSearch").addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });
}

/* ── 过滤 ── */

function filteredCards() {
  return CONJUGATION_CARDS.filter((card) => {
    const matchesCategory = !state.categoryId || card.category === state.categoryId;
    const matchesSubcategory = !state.subcategoryId || card.subcategory === state.subcategoryId;
    const matchesQuery = !state.query || cardMatchesQuery(card);
    return matchesCategory && matchesSubcategory && matchesQuery;
  });
}

function cardMatchesQuery(card) {
  const searchable = [
    card.title,
    card.category,
    card.subcategory,
    card.level,
    card.formation,
    card.example,
    card.exampleTranslation,
    ...(card.notes || []),
    ...flatTableText(card.table)
  ].join(" ").toLowerCase();
  const compactHaystack = searchable.replace(/[\s ・〜…]+/g, "");
  const compactQuery = state.query.replace(/[\s ・〜…]+/g, "");
  if (compactHaystack.includes(compactQuery)) return true;
  const tokens = state.query
    .toLowerCase()
    .split(/[\s 、，。．,.:：;；/／|｜]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return tokens.some((token) => compactHaystack.includes(token.replace(/[\s ・〜…]+/g, "")));
}

function flatTableText(table) {
  if (!table) return [];
  const texts = [...(table.headers || [])];
  for (const row of table.rows || []) {
    for (const cell of row) {
      texts.push(String(cell).replace(/<[^>]*>/g, ""));
    }
  }
  return texts;
}

/* ── 渲染 ── */

function render() {
  renderCategoryList();
  renderCards();
}

function renderCategoryList() {
  const list = $("conjCategoryList");
  list.innerHTML = CONJUGATION_CATEGORIES.map((cat) => {
    const count = CONJUGATION_CARDS.filter((c) => c.category === cat.id).length;
    const active = cat.id === state.categoryId ? " active" : "";
    const subButtons = cat.subcategories.map((sub) => {
      const subActive = sub.id === state.subcategoryId && cat.id === state.categoryId ? " active" : "";
      return `<button class="conj-sub-btn${subActive}" type="button" data-cat="${escapeAttr(cat.id)}" data-sub="${escapeAttr(sub.id)}">${escapeHtml(sub.label)}</button>`;
    }).join("");
    return `
      <div class="conj-cat-group">
        <button class="conj-cat-btn${active}" type="button" data-cat="${escapeAttr(cat.id)}">
          <span class="cat-icon">${escapeHtml(cat.icon)}</span>
          <span class="cat-label">
            <strong>${escapeHtml(cat.label)}</strong>
            <small>${cat.subcategories.map((s) => s.label).join(" · ")}</small>
          </span>
          <em class="cat-count">${count}</em>
        </button>
        <div class="conj-sub-list">${subButtons}</div>
      </div>`;
  }).join("");

  list.querySelectorAll(".conj-cat-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.categoryId = btn.dataset.cat;
      state.subcategoryId = "";
      render();
    });
  });
  list.querySelectorAll(".conj-sub-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.categoryId = btn.dataset.cat;
      state.subcategoryId = state.subcategoryId === btn.dataset.sub ? "" : btn.dataset.sub;
      render();
    });
  });
}

function renderCards() {
  const cards = filteredCards();
  const category = CONJUGATION_CATEGORIES.find((c) => c.id === state.categoryId);
  const subcategory = category?.subcategories.find((s) => s.id === state.subcategoryId);

  $("conjBreadcrumb").textContent = category ? category.label : "全部";
  $("conjSectionTitle").textContent = subcategory
    ? `${category.label} › ${subcategory.label}`
    : (category ? `${category.label} · 全部` : "全部变形规则");
  $("conjSectionSummary").textContent = category?.description || "";
  $("conjCountPill").textContent = `${cards.length} 张卡片`;

  const grid = $("conjCardGrid");
  if (!cards.length) {
    grid.innerHTML = `<p class="conj-empty">没有找到匹配的变形规则卡片。<br>试试换个关键词？</p>`;
    return;
  }

  grid.innerHTML = cards.map((card) => renderCard(card)).join("");
}

function renderCard(card) {
  const table = renderTable(card.table);
  const notes = (card.notes || []).map((note) => `<p>${escapeHtml(note)}</p>`).join("");
  const exampleHtml = card.example
    ? `<div class="conj-example">
        <p lang="ja">${renderJapaneseText(card.example)}</p>
        <small>${escapeHtml(card.exampleTranslation || "")}</small>
       </div>`
    : "";

  return `
    <article class="conj-card" data-id="${escapeAttr(card.id)}">
      <div class="conj-card-top">
        <span class="conj-level">${escapeHtml(card.level)}</span>
        <span class="conj-cat-tag">${escapeHtml(card.subcategory)}</span>
        <h3>${escapeHtml(card.title)}</h3>
      </div>
      <div class="conj-formation"><strong>规则：</strong>${escapeHtml(card.formation)}</div>
      ${table}
      ${exampleHtml}
      ${notes ? `<div class="conj-notes">${notes}</div>` : ""}
    </article>`;
}

function renderTable(table) {
  if (!table) return "";
  const headerCells = table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const bodyRows = table.rows.map((row) => {
    const cells = row.map((cell, i) => {
      if (i === 0) return `<td>${escapeHtml(cell)}</td>`;
      return `<td lang="ja">${renderJapaneseText(cell)}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  return `
    <div class="conj-table-wrap">
      <table class="conj-table">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;
}

/* ── 启动 ── */
init();
