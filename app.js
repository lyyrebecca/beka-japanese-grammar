const STORAGE_KEY = "jp-grammar-quest-progress-v1";
const THEME_KEY = "jp-grammar-quest-theme-v1";
const CUSTOM_CONTENT_KEY = "jp-grammar-custom-content-v1";

const EMPTY_PROGRESS = { completed: {}, hard: {}, answers: {}, lastGroup: "" };
const EMPTY_CUSTOM = { edits: {}, notes: {}, additions: {}, deleted: {} };

const state = {
  groupId: "",
  challengeIndex: 0,
  query: "",
  level: "all",
  theme: loadTheme(),
  progress: loadProgress(),
  custom: loadCustomContent()
};

const $ = (id) => document.getElementById(id);

function init() {
  ensureEditorShell();
  state.groupId = state.progress.lastGroup || GRAMMAR_GROUPS[0].id;
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
  $("searchInput").addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });
  $("levelFilter").addEventListener("change", (event) => {
    state.level = event.target.value;
    state.challengeIndex = 0;
    render();
  });
  $("prevChallengeBtn").addEventListener("click", () => moveChallenge(-1));
  $("nextChallengeBtn").addEventListener("click", () => moveChallenge(1));
  $("checkBtn").addEventListener("click", checkAnswer);
  $("showAnswerBtn").addEventListener("click", () => showFeedback(true));
  $("markHardBtn").addEventListener("click", markHard);
  $("answerInput").addEventListener("input", (event) => {
    const key = answerKey();
    state.progress.answers[key] = event.target.value;
    saveProgress();
  });
  $("addExpressionBtn").addEventListener("click", () => openExpressionEditor("add"));
  $("exportBackupBtn").addEventListener("click", exportBackup);
  $("importBackupBtn").addEventListener("click", importBackup);
  $("resetProgressBtn").addEventListener("click", () => {
    if (!confirm("确定清空本机练习记录吗？新增条目、修改和笔记不会被删除。")) return;
    state.progress = { ...EMPTY_PROGRESS, lastGroup: state.groupId };
    saveProgress();
    render();
  });
  $("resetCustomBtn").addEventListener("click", () => {
    if (!confirm("确定清空本机新增条目、卡片修改和笔记吗？练习进度不会被删除。")) return;
    state.custom = structuredClone(EMPTY_CUSTOM);
    saveCustomContent();
    render();
  });
}

function loadProgress() {
  try {
    return { ...EMPTY_PROGRESS, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) };
  } catch {
    return structuredClone(EMPTY_PROGRESS);
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function loadCustomContent() {
  try {
    return { ...structuredClone(EMPTY_CUSTOM), ...(JSON.parse(localStorage.getItem(CUSTOM_CONTENT_KEY)) || {}) };
  } catch {
    return structuredClone(EMPTY_CUSTOM);
  }
}

function saveCustomContent() {
  localStorage.setItem(CUSTOM_CONTENT_KEY, JSON.stringify(state.custom));
}

function exportBackup() {
  const backup = {
    app: "beka-japanese-grammar",
    version: 2,
    exportedAt: new Date().toISOString(),
    progress: state.progress,
    custom: state.custom,
    theme: state.theme
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `beka-japanese-grammar-backup-${backup.exportedAt.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importBackup() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (backup.app !== "beka-japanese-grammar" || ![1, 2].includes(backup.version)) {
        throw new Error("invalid backup");
      }
      if (!confirm("导入会覆盖当前浏览器中的学习记录、笔记和自定义条目，确定继续吗？")) return;
      state.progress = { ...EMPTY_PROGRESS, ...(backup.progress || {}) };
      state.custom = { ...structuredClone(EMPTY_CUSTOM), ...(backup.custom || {}) };
      if (backup.theme === "day" || backup.theme === "night") state.theme = backup.theme;
      saveProgress();
      saveCustomContent();
      saveTheme();
      state.groupId = state.progress.lastGroup || GRAMMAR_GROUPS[0].id;
      state.challengeIndex = 0;
      applyTheme();
      render();
      alert("备份已恢复。");
    } catch {
      alert("这不是可用的学习备份文件。请导入由本网站“备份”按钮导出的 JSON 文件。");
    }
  });
  input.click();
}

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

function mergedGroups() {
  return GRAMMAR_GROUPS.map((group) => {
    const additions = state.custom.additions[group.id] || [];
    const expressions = group.expressions
      .filter((item) => !state.custom.deleted[item.id])
      .map((item) => mergeExpression(item, false))
      .concat(additions.filter((item) => !state.custom.deleted[item.id]).map((item) => mergeExpression(item, true)));
    return { ...group, expressions };
  });
}

function mergeExpression(item, userAdded) {
  const edit = state.custom.edits[item.id] || {};
  const note = state.custom.notes[item.id] ?? edit.userNote ?? item.userNote ?? "";
  return {
    ...item,
    ...edit,
    userNote: note,
    _userAdded: userAdded,
    _customized: Boolean(userAdded || Object.keys(edit).length || note)
  };
}

function currentGroup() {
  return mergedGroups().find((group) => group.id === state.groupId) || mergedGroups()[0];
}

function currentChallenge() {
  return filteredChallenges(currentGroup())[state.challengeIndex] || null;
}

function render() {
  const visibleGroups = renderGroupList();
  if (!visibleGroups.some((group) => group.id === state.groupId) && visibleGroups.length) {
    state.groupId = visibleGroups[0].id;
    state.challengeIndex = 0;
    state.progress.lastGroup = state.groupId;
    saveProgress();
  }
  renderGroup();
  renderGroupList();
}

function renderGroupList() {
  const list = $("groupList");
  const groups = mergedGroups().filter(groupMatches);
  list.innerHTML = groups.length ? groups.map((group) => {
    const done = Object.keys(state.progress.completed).filter((key) => key.startsWith(`${group.id}:`)).length;
    const total = filteredChallenges(group).length;
    const active = group.id === state.groupId ? " active" : "";
    const customCount = group.expressions.filter((item) => item._customized).length;
    return `<button class="group-btn${active}" type="button" data-group="${escapeAttr(group.id)}">
      <span>
        <strong>${escapeHtml(group.title)}</strong>
        <small>${escapeHtml(levelSummary(group))} · ${escapeHtml(group.axis || "功能辨析")}${customCount ? ` · 自定义 ${customCount}` : ""}</small>
      </span>
      <em>${done}/${total}</em>
    </button>`;
  }).join("") : `<p class="empty-state">没有找到匹配的分类。</p>`;
  list.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.groupId = button.dataset.group;
      state.challengeIndex = 0;
      state.progress.lastGroup = state.groupId;
      saveProgress();
      renderGroup();
      renderGroupList();
    });
  });
  return groups;
}

function groupMatches(group) {
  const expressions = group.expressions;
  const matchesLevel = state.level === "all" || expressions.some((item) => levelMatches(item.level));
  const matchesQuery = !state.query || queryMatchesText(searchableGroupText(group));
  return matchesLevel && matchesQuery;
}

function expressionMatches(item) {
  const matchesLevel = state.level === "all" || levelMatches(item.level);
  const matchesQuery = !state.query || queryMatchesText(searchableExpressionText(item));
  return matchesLevel && matchesQuery;
}

function levelMatches(level = "") {
  return String(level).split(/[^N0-9]+/).some((part) => part === state.level) || String(level).includes(state.level);
}

function searchableGroupText(group) {
  return [
    group.title,
    group.summary,
    group.theme,
    group.axis,
    group.bookPath,
    group.focus,
    ...(group.notes || []),
    ...group.expressions.map(searchableExpressionText)
  ].join(" ").toLowerCase();
}

function searchableExpressionText(item) {
  return [
    item.id,
    item.level,
    item.pattern,
    item.meaning,
    item.connection,
    item.nuance,
    item.example,
    item.translation,
    item.source,
    item.sourceBook,
    item.sourceLesson,
    item.userNote,
    ...usageFlagLabels(item.usageFlags),
    ...(item.tags || [])
  ].join(" ").toLowerCase();
}

function queryMatchesText(text) {
  const haystack = String(text || "").toLowerCase();
  const compactHaystack = compactSearchText(haystack);
  const compactQuery = compactSearchText(state.query);
  if (!compactQuery) return true;
  if (compactHaystack.includes(compactQuery)) return true;
  return searchTokens(state.query).some((token) => compactHaystack.includes(compactSearchText(token)));
}

function searchTokens(query) {
  return String(query || "")
    .toLowerCase()
    .split(/[\s　、，。．,.。:：;；/／|｜「」『』（）()【】\[\]{}<>《》]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function compactSearchText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\s　、，。．,.。:：;；/／|｜「」『』（）()【】\[\]{}<>《》・~〜…]+/g, "");
}

function renderGroup() {
  const group = currentGroup();
  const shownExpressions = group.expressions.filter(expressionMatches);
  const shownChallenges = filteredChallenges(group);
  if (state.challengeIndex >= shownChallenges.length) state.challengeIndex = 0;
  $("groupTitle").textContent = group.title;
  $("groupSummary").textContent = group.summary;
  $("kanzenMeta").innerHTML = `
    <span>${escapeHtml(group.bookPath || "N4基礎 → N3整理 → N2/N1上位表現")}</span>
    <span>${escapeHtml(group.axis || "意味機能")}</span>
    <span>${escapeHtml(group.focus || "接続・意味・場面")}</span>
  `;
  renderRouteCards(group);
  const done = Object.keys(state.progress.completed).filter((key) => key.startsWith(`${group.id}:`)).length;
  $("progressPill").textContent = `${shownExpressions.length} 条 / ${group.expressions.length} 条`;
  renderExpressions(group, shownExpressions);
  $("notesList").innerHTML = group.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("");
  $("rewriteList").innerHTML = group.rewrites.length ? group.rewrites.map((item, index) => `
    <details class="rewrite-item">
      <summary>${index + 1}. ${escapeHtml(item[0])}</summary>
      <p><strong>要求：</strong>${escapeHtml(item[1])}</p>
      <p><strong>参考：</strong><span lang="ja" class="answer-ja">${annotateJapanese(item[2])}</span></p>
    </details>
  `).join("") : `<p class="empty-state">这个分类暂时没有改写题，先用知识卡片做整理。</p>`;
  $("progressPill").title = `练习完成 ${done} / ${shownChallenges.length}`;
  renderChallenge();
}

function renderExpressions(group, expressions) {
  $("expressionLadder").innerHTML = expressions.length ? expressions.map((item) => {
    const profile = usageProfile(item);
    const usageBadges = renderUsageBadges(item.usageFlags);
    const note = item.userNote ? `<div class="user-note"><strong>我的笔记</strong><p>${escapeHtml(item.userNote)}</p></div>` : "";
    const deleteButton = item._userAdded ? `<button class="icon-btn danger" type="button" data-action="delete" data-id="${escapeAttr(item.id)}" title="删除自定义条目" aria-label="删除自定义条目">×</button>` : "";
    const restoreButton = item._customized && !item._userAdded ? `<button class="icon-btn" type="button" data-action="restore" data-id="${escapeAttr(item.id)}" title="恢复内置内容" aria-label="恢复内置内容">↺</button>` : "";
    return `
    <article class="expression-card" data-expression="${escapeAttr(item.id)}">
      <div class="card-actions">
        <button class="icon-btn" type="button" data-action="edit" data-id="${escapeAttr(item.id)}" title="修改知识卡片" aria-label="修改知识卡片">✎</button>
        <button class="icon-btn" type="button" data-action="note" data-id="${escapeAttr(item.id)}" title="添加或修改笔记" aria-label="添加或修改笔记">□</button>
        ${restoreButton}
        ${deleteButton}
      </div>
      <div class="expression-top">
        <span class="level">${escapeHtml(item.level)}</span>
        ${item.source ? `<span class="source-tag">${escapeHtml(item.source)}</span>` : ""}
        ${item._userAdded ? `<span class="source-tag">我添加的</span>` : ""}
        ${usageBadges}
        <strong lang="ja">${renderJapaneseText(item.pattern)}</strong>
      </div>
      <p>${escapeHtml(item.meaning)}</p>
      <dl>
        <dt>接续</dt><dd lang="ja">${renderJapaneseText(item.connection)}</dd>
        <dt>语感</dt><dd>${escapeHtml(item.nuance)}</dd>
        <dt>正式</dt><dd>${escapeHtml(profile.formality)}</dd>
        <dt>表记</dt><dd lang="ja">${renderJapaneseText(profile.notation)}</dd>
        <dt>来源</dt><dd>${escapeHtml([item.sourceBook, item.sourceLesson].filter(Boolean).join(" · "))}</dd>
      </dl>
      <div class="tag-row">${(item.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      <div class="example">
        <p lang="ja">${renderExample(item)}</p>
        <small>${escapeHtml(item.translation)}</small>
      </div>
      ${note}
    </article>`;
  }).join("") : `<p class="empty-state">当前筛选条件下没有知识点。可以换个关键词，或者点“添加条目”补进去。</p>`;

  $("expressionLadder").querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleCardAction(group, button.dataset.action, button.dataset.id));
  });
}

const USAGE_BADGES = {
  negative: { character: "消", label: "消极 / 负面倾向" },
  positive: { character: "积", label: "积极 / 正面倾向" },
  spoken: { character: "口", label: "口语 / 日常会话" },
  written: { character: "书", label: "书面 / 正式表达" }
};

function renderUsageBadges(flags = {}) {
  return `<span class="usage-badges">${Object.entries(USAGE_BADGES).filter(([key]) => flags[key]).map(([key, badge]) => `
    <span class="usage-badge usage-badge--${key}" title="${badge.label}" aria-label="${badge.label}">${badge.character}</span>
  `).join("")}</span>`;
}

function usageFlagLabels(flags = {}) {
  return Object.entries(USAGE_BADGES).filter(([key]) => flags[key]).map(([, badge]) => badge.label);
}

function handleCardAction(group, action, id) {
  const item = group.expressions.find((expr) => expr.id === id);
  if (!item) return;
  if (action === "edit") openExpressionEditor("edit", item);
  if (action === "note") openNoteEditor(item);
  if (action === "restore") restoreBuiltInExpression(id);
  if (action === "delete") deleteUserExpression(group.id, id);
}

function renderRouteCards(group) {
  const cards = [
    ["1", "接续確認", group.route?.[0] || "先把普通形、名词の、な形だ/な 等入口分清。"],
    ["2", "意味分類", group.route?.[1] || "把同一中文意思拆成原因、契机、评价、让步等日语功能。"],
    ["3", "文脈選択", group.route?.[2] || "最后按口语、书面、通知、论文、辩解等场景选择。"]
  ];
  $("routeCards").innerHTML = cards.map(([num, title, body]) => `
    <article class="route-card">
      <span>${escapeHtml(num)}</span>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
    </article>
  `).join("");
}

function renderChallenge() {
  const group = currentGroup();
  const challenges = filteredChallenges(group);
  const challenge = currentChallenge();
  const hasChallenge = Boolean(challenge);
  $("prevChallengeBtn").disabled = !hasChallenge;
  $("nextChallengeBtn").disabled = !hasChallenge;
  $("checkBtn").disabled = !hasChallenge;
  $("showAnswerBtn").disabled = !hasChallenge;
  $("markHardBtn").disabled = !hasChallenge;
  $("answerInput").disabled = !hasChallenge;
  if (!hasChallenge) {
    $("challengeTitle").textContent = "暂无翻译题";
    $("challengeBox").innerHTML = `<p class="prompt">当前等级下暂无翻译题。可以切回“全部 N5-N1”继续练。</p>`;
    $("answerInput").value = "";
    $("feedbackBox").classList.add("hidden");
    return;
  }
  const [prompt, target, keywords] = challenge;
  const level = challengeLevel(challenge, group);
  $("challengeTitle").textContent = `${level} · 第 ${state.challengeIndex + 1} 题 / ${challenges.length}`;
  $("challengeBox").innerHTML = `
    <div class="challenge-meta">
      <span>${escapeHtml(level)}</span>
      <span>${escapeHtml(group.title)}</span>
      <span>${escapeHtml(challenge.sourceType || "翻译练习")}</span>
      <span>${escapeHtml([challenge.sourceBook, challenge.sourceLesson].filter(Boolean).join(" · "))}</span>
    </div>
    <p class="prompt">${escapeHtml(prompt)}</p>
    <div class="target-row">
      <span>目标句式</span>
      <strong lang="ja">${renderJapaneseText(target)}</strong>
    </div>
    <div class="keyword-row">${keywords.map((word) => `<span lang="ja">${renderJapaneseText(keywordLabel(word))}</span>`).join("")}</div>
  `;
  $("answerInput").value = state.progress.answers[answerKey()] || "";
  $("feedbackBox").classList.add("hidden");
  $("feedbackBox").innerHTML = "";
}

function moveChallenge(delta) {
  const total = filteredChallenges(currentGroup()).length;
  if (!total) return;
  state.challengeIndex = (state.challengeIndex + delta + total) % total;
  renderChallenge();
}

function answerKey() {
  const challenge = currentChallenge();
  return `${state.groupId}:${challenge?.id || state.challengeIndex}`;
}

function checkAnswer() {
  const challenge = currentChallenge();
  if (!challenge) return;
  const answer = normalizeText($("answerInput").value);
  const [, , keywords] = challenge;
  const results = keywords.map((keyword) => ({ keyword, hit: keywordHit(answer, keyword) }));
  const score = results.filter((item) => item.hit).length;
  state.progress.completed[answerKey()] = { score, total: keywords.length, at: new Date().toISOString() };
  saveProgress();
  showFeedback(false, results);
  renderGroupList();
}

function showFeedback(forceAnswer, results = null) {
  const challenge = currentChallenge();
  if (!challenge) return;
  const [, target, keywords, sample, note] = challenge;
  const checked = results || keywords.map((keyword) => ({
    keyword,
    hit: keywordHit(normalizeText($("answerInput").value), keyword)
  }));
  $("feedbackBox").classList.remove("hidden");
  $("feedbackBox").innerHTML = `
    <div class="check-list">
      ${checked.map((item) => `<span class="${item.hit ? "ok" : "miss"}">${item.hit ? "✓" : "×"} ${renderJapaneseText(keywordLabel(item.keyword))}</span>`).join("")}
    </div>
    <p><strong>目标：</strong><span lang="ja">${renderJapaneseText(target)}</span></p>
    <p><strong>难度：</strong>${escapeHtml(challengeLevel(challenge, currentGroup()))}</p>
    <p><strong>参考译文：</strong><span lang="ja" class="answer-ja">${annotateJapanese(sample)}</span></p>
    <p><strong>辨析：</strong>${escapeHtml(note)}</p>
    ${forceAnswer ? "<p class=\"tip\">先比较目标句式和接续，再自己给这题打分：句式 40%，自然度 40%，助词和时态 20%。</p>" : ""}
  `;
}

function markHard() {
  const challenge = currentChallenge();
  if (!challenge) return;
  state.progress.hard[answerKey()] = {
    group: currentGroup().title,
    level: challengeLevel(challenge, currentGroup()),
    prompt: challenge[0],
    at: new Date().toISOString()
  };
  saveProgress();
  showFeedback(true);
}

function openExpressionEditor(mode, item = null) {
  const group = currentGroup();
  const data = item || {
    level: "N3",
    pattern: "",
    meaning: "",
    connection: "",
    nuance: "",
    example: "",
    translation: "",
    sourceBook: "我添加的语法",
    sourceLesson: group.title,
    tags: [group.theme].filter(Boolean),
    usageFlags: {},
    userNote: ""
  };
  openDialog(`
    <form id="expressionForm" class="editor-form">
      <header>
        <h3>${mode === "add" ? "添加语法条目" : "修改知识卡片"}</h3>
        <button class="icon-btn" type="button" data-close-dialog title="关闭" aria-label="关闭">×</button>
      </header>
      <div class="form-grid">
        ${inputField("level", "等级", data.level)}
        ${inputField("pattern", "文型", data.pattern)}
        ${inputField("meaning", "意思", data.meaning)}
        ${inputField("connection", "接续", data.connection)}
      </div>
      ${textareaField("nuance", "语感 / 使用限制", data.nuance)}
      ${textareaField("example", "例句", data.example)}
      ${textareaField("translation", "译文", data.translation)}
      <div class="form-grid">
        ${inputField("sourceBook", "来源书", data.sourceBook)}
        ${inputField("sourceLesson", "来源课次", data.sourceLesson)}
      </div>
      ${inputField("tags", "标签（用逗号分隔）", (data.tags || []).join("，"))}
      ${usageFlagFields(data.usageFlags)}
      ${textareaField("userNote", "我的笔记", data.userNote || "")}
      <footer>
        <button class="secondary-btn" type="button" data-close-dialog>取消</button>
        <button class="primary-btn" type="submit">保存</button>
      </footer>
    </form>
  `);
  $("expressionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = expressionPayloadFromForm(form);
    if (!payload.pattern || !payload.meaning) {
      alert("请至少填写文型和意思。");
      return;
    }
    if (mode === "add") {
      const id = `user-${Date.now()}`;
      const addition = { id, ...payload, source: "我添加的", _userAdded: true };
      state.custom.additions[group.id] ||= [];
      state.custom.additions[group.id].push(addition);
      if (payload.userNote) state.custom.notes[id] = payload.userNote;
    } else {
      state.custom.edits[item.id] = payload;
      if (payload.userNote) state.custom.notes[item.id] = payload.userNote;
      else delete state.custom.notes[item.id];
    }
    saveCustomContent();
    closeDialog();
    render();
  });
}

function openNoteEditor(item) {
  openDialog(`
    <form id="noteForm" class="editor-form note-form">
      <header>
        <h3>添加 / 修改笔记</h3>
        <button class="icon-btn" type="button" data-close-dialog title="关闭" aria-label="关闭">×</button>
      </header>
      <p class="modal-kicker">${escapeHtml(item.level)} · ${escapeHtml(item.pattern)}</p>
      ${textareaField("userNote", "我的笔记", item.userNote || "")}
      <footer>
        <button class="ghost-btn" type="button" id="clearNoteBtn">清空笔记</button>
        <button class="secondary-btn" type="button" data-close-dialog>取消</button>
        <button class="primary-btn" type="submit">保存</button>
      </footer>
    </form>
  `);
  $("noteForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const note = new FormData(event.currentTarget).get("userNote").trim();
    if (note) state.custom.notes[item.id] = note;
    else delete state.custom.notes[item.id];
    saveCustomContent();
    closeDialog();
    render();
  });
  $("clearNoteBtn").addEventListener("click", () => {
    delete state.custom.notes[item.id];
    saveCustomContent();
    closeDialog();
    render();
  });
}

function expressionPayloadFromForm(form) {
  const tags = String(form.get("tags") || "").split(/[，,]/).map((tag) => tag.trim()).filter(Boolean);
  return {
    level: String(form.get("level") || "").trim(),
    pattern: String(form.get("pattern") || "").trim(),
    meaning: String(form.get("meaning") || "").trim(),
    connection: String(form.get("connection") || "").trim(),
    nuance: String(form.get("nuance") || "").trim(),
    example: String(form.get("example") || "").trim(),
    translation: String(form.get("translation") || "").trim(),
    sourceBook: String(form.get("sourceBook") || "").trim(),
    sourceLesson: String(form.get("sourceLesson") || "").trim(),
    tags,
    usageFlags: Object.fromEntries(Object.keys(USAGE_BADGES).map((key) => [key, form.get(`usage-${key}`) === "on"])),
    userNote: String(form.get("userNote") || "").trim()
  };
}

function usageFlagFields(flags = {}) {
  return `<fieldset class="usage-flag-fields">
    <legend>语气 / 文体徽章（勾选后显示在卡片顶部）</legend>
    ${Object.entries(USAGE_BADGES).map(([key, badge]) => `<label class="usage-flag-option usage-flag-option--${key}">
      <input type="checkbox" name="usage-${key}"${flags[key] ? " checked" : ""}>
      <span class="usage-badge usage-badge--${key}" aria-hidden="true">${badge.character}</span>
      <span>${badge.label}</span>
    </label>`).join("")}
  </fieldset>`;
}

function restoreBuiltInExpression(id) {
  if (!confirm("恢复这张内置卡片的原始内容，并清空它的本机笔记吗？")) return;
  delete state.custom.edits[id];
  delete state.custom.notes[id];
  saveCustomContent();
  render();
}

function deleteUserExpression(groupId, id) {
  if (!confirm("删除这个自定义条目吗？")) return;
  state.custom.additions[groupId] = (state.custom.additions[groupId] || []).filter((item) => item.id !== id);
  delete state.custom.notes[id];
  delete state.custom.edits[id];
  saveCustomContent();
  render();
}

function ensureEditorShell() {
  if (document.getElementById("editorOverlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "editorOverlay";
  overlay.className = "editor-overlay hidden";
  overlay.innerHTML = `<div id="editorDialog" class="editor-dialog" role="dialog" aria-modal="true"></div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeDialog();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDialog();
  });
}

function openDialog(html) {
  $("editorDialog").innerHTML = html;
  $("editorOverlay").classList.remove("hidden");
  $("editorDialog").querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", closeDialog);
  });
  const first = $("editorDialog").querySelector("input, textarea, button");
  if (first) first.focus();
}

function closeDialog() {
  const overlay = $("editorOverlay");
  if (!overlay) return;
  overlay.classList.add("hidden");
  $("editorDialog").innerHTML = "";
}

function inputField(name, label, value) {
  return `<label>${escapeHtml(label)}<input name="${escapeAttr(name)}" value="${escapeAttr(value || "")}"></label>`;
}

function textareaField(name, label, value) {
  return `<label>${escapeHtml(label)}<textarea name="${escapeAttr(name)}" rows="3">${escapeHtml(value || "")}</textarea></label>`;
}

function normalizeText(text) {
  return String(text).replace(/\s+/g, "").replace(/[。．、，,]/g, "").toLowerCase();
}

function filteredChallenges(group) {
  return (group.challenges || []).filter((challenge) => {
    return state.level === "all" || levelMatches(challengeLevel(challenge, group));
  });
}

function challengeLevel(challenge, group) {
  if (!challenge) return "综合";
  if (challenge.level) return challenge.level;
  const target = normalizePatternForLookup(challenge[1]);
  const expression = group.expressions.find((item) => {
    const pattern = normalizePatternForLookup(item.pattern);
    return pattern === target || pattern.includes(target) || target.includes(pattern);
  });
  return expression?.level || "综合";
}

function normalizePatternForLookup(text) {
  return String(text || "")
    .replace(/[「」『』（）()【】\[\]\s　・~〜…]/g, "")
    .toLowerCase();
}

function keywordHit(normalizedAnswer, keyword) {
  return keywordOptions(keyword).some((option) => normalizedAnswer.includes(normalizeText(option)));
}

function keywordOptions(keyword) {
  return Array.isArray(keyword) ? keyword : [keyword];
}

function keywordLabel(keyword) {
  return keywordOptions(keyword).join(" / ");
}

function levelSummary(group) {
  return [...new Set(group.expressions.map((item) => item.level))].join(" / ");
}

function usageProfile(item) {
  const pattern = item.pattern;
  const nuance = item.nuance || "";
  const explicit = USAGE_PROFILE[pattern] || USAGE_PROFILE[pattern.replace(/（.*?）/g, "")];
  if (explicit) return explicit;
  const isFormal = item.level === "N1" || item.level === "N2" || /书面|正式|硬|商务|论文|通知|制度|公文/.test(nuance);
  const isCasual = /口语|日常|聊天|普通/.test(nuance) || item.level === "N5";
  return {
    formality: isFormal ? "正式・书面寄り" : isCasual ? "日常・口语寄り" : "普通・中性",
    notation: pattern.includes("...") || pattern.includes("〜") || pattern.includes("~") ? "按文型书写，实际作文中替换前后项" : pattern
  };
}

function renderExample(item) {
  return renderJapaneseText(item.example || "");
}

function renderJapaneseText(text) {
  return annotateJapanesePreservingRuby(text);
}

function annotateJapanesePreservingRuby(text) {
  const source = String(text || "");
  if (!source.includes("<ruby")) return annotateJapanese(source);
  const rubyPlaceholders = [];
  const protectedText = source.replace(/<ruby>.*?<\/ruby>/g, (match) => {
    const token = `__RUBY_${rubyPlaceholders.length}__`;
    rubyPlaceholders.push(match);
    return token;
  });
  let output = annotateJapanese(protectedText);
  rubyPlaceholders.forEach((ruby, index) => {
    output = output.replace(`__RUBY_${index}__`, ruby);
  });
  return output;
}

function annotateJapanese(text) {
  const source = String(text || "");
  const entries = Object.entries(FURIGANA_MAP).sort((a, b) => b[0].length - a[0].length);
  const pattern = new RegExp(entries.map(([kanji]) => escapeRegExp(kanji)).join("|"), "g");
  return escapeHtml(source).replace(pattern, (kanji) => {
    return `<ruby>${kanji}<rt>${FURIGANA_MAP[kanji]}</rt></ruby>`;
  });
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

const USAGE_PROFILE = {
  "から": { formality: "日常・口语・中性", notation: "から" },
  "ので": { formality: "普通・礼貌说明", notation: "ので / なので" },
  "ために": { formality: "普通到正式", notation: "ために / 為に（现代实用多用假名）" },
  "せいで": { formality: "日常到普通・负面", notation: "せいで / 所為で（实用多用假名）" },
  "ばかりに": { formality: "普通・书面也常见", notation: "ばかりに" },
  "ことから": { formality: "正式・书面", notation: "ことから / 事から（实用多用假名）" },
  "ゆえに": { formality: "很正式・论文/评论", notation: "ゆえに / 故に（两者都见，现代多用假名）" },
  "ように": { formality: "普通・中性", notation: "ように / 様に（实用多用假名）" },
  "べく": { formality: "正式・书面硬", notation: "べく" },
  "たとたん": { formality: "普通・叙述", notation: "たとたん / た途端" },
  "が早いか": { formality: "N1 书面・叙述", notation: "が早いか" },
  "からというもの": { formality: "书面・叙述", notation: "からというもの" },
  "にもかかわらず": { formality: "正式・书面", notation: "にもかかわらず / にも関わらず" },
  "とはいえ": { formality: "正式・文章连接", notation: "とはいえ / とは言え" },
  "に違いない": { formality: "普通到正式・强判断", notation: "に違いない" },
  "恐れがある": { formality: "正式・新闻/通知", notation: "恐れがある / おそれがある" },
  "まい": { formality: "书面・古风/硬", notation: "まい" },
  "をめぐって": { formality: "正式・新闻/议论", notation: "をめぐって / を巡って" },
  "いかんによって": { formality: "很正式・制度/公文", notation: "いかんによって / 如何によって" },
  "わけにはいかない": { formality: "普通到正式・责任场景", notation: "わけにはいかない / 訳にはいかない" },
  "ではあるまいし": { formality: "N1・较硬・带责备", notation: "ではあるまいし" },
  "かねる": { formality: "正式・商务拒绝", notation: "かねる / 兼ねる" },
  "得る / 得ない": { formality: "正式・书面可能性", notation: "得る（うる/える） / 得ない（えない）" },
  "づらい": { formality: "日常・心理负担", notation: "づらい / 辛い" },
  "がたい": { formality: "书面・心理判断", notation: "がたい / 難い" },
  "を問わず": { formality: "正式・规则/招募", notation: "を問わず" },
  "いかんにかかわらず": { formality: "很正式・制度/规则", notation: "いかんにかかわらず / 如何にかかわらず" }
};

const FURIGANA_MAP = {
  "使役受身形": "しえきうけみけい",
  "使役形": "しえきけい",
  "受身形": "うけみけい",
  "可能形": "かのうけい",
  "普通形": "ふつうけい",
  "意向形": "いこうけい",
  "命令形": "めいれいけい",
  "禁止形": "きんしけい",
  "辞書形": "じしょけい",
  "否定": "ひてい",
  "肯定": "こうてい",
  "動詞": "どうし",
  "名詞": "めいし",
  "形容詞": "けいようし",
  "文型": "ぶんけい",
  "接続": "せつぞく",
  "表記": "ひょうき",
  "意味": "いみ",
  "場合": "ばあい",
  "状態": "じょうたい",
  "場面": "ばめん",
  "対象": "たいしょう",
  "相手": "あいて",
  "程度": "ていど",
  "範囲": "はんい",
  "条件": "じょうけん",
  "目的": "もくてき",
  "原因": "げんいん",
  "結果": "けっか",
  "根拠": "こんきょ",
  "判断": "はんだん",
  "推量": "すいりょう",
  "伝聞": "でんぶん",
  "比較": "ひかく",
  "対比": "たいひ",
  "逆接": "ぎゃくせつ",
  "譲歩": "じょうほ",
  "限定": "げんてい",
  "例示": "れいじ",
  "引用": "いんよう",
  "敬語": "けいご",
  "尊敬": "そんけい",
  "自謙": "じけん",
  "義務": "ぎむ",
  "許可": "きょか",
  "禁止": "きんし",
  "必要": "ひつよう",
  "不可能": "ふかのう",
  "可能": "かのう",
  "困難": "こんなん",
  "評価": "ひょうか",
  "立場": "たちば",
  "役割": "やくわり",
  "書面": "しょめん",
  "正式": "せいしき",
  "日常": "にちじょう",
  "口語": "こうご",
  "文章": "ぶんしょう",
  "場": "ば",
  "日本語": "にほんご",
  "文法": "ぶんぽう",
  "翻訳": "ほんやく",
  "練習": "れんしゅう",
  "復習": "ふくしゅう",
  "勉強": "べんきょう",
  "問題": "もんだい",
  "説明": "せつめい",
  "資料": "しりょう",
  "試験": "しけん",
  "合格": "ごうかく",
  "先生": "せんせい",
  "学生": "がくせい",
  "学習者": "がくしゅうしゃ",
  "経験": "けいけん",
  "理由": "りゆう",
  "結果": "けっか",
  "確認": "かくにん",
  "時間": "じかん",
  "図書館": "としょかん",
  "電車": "でんしゃ",
  "昨日": "きのう",
  "失敗": "しっぱい",
  "返事": "へんじ",
  "方法": "ほうほう",
  "意見": "いけん",
  "大切": "たいせつ",
  "台風": "たいふう",
  "飛行機": "ひこうき",
  "事故": "じこ",
  "会議": "かいぎ",
  "中止": "ちゅうし",
  "延期": "えんき",
  "天気": "てんき",
  "予報": "よほう",
  "家族": "かぞく",
  "単語": "たんご",
  "京都": "きょうと",
  "宿題": "しゅくだい",
  "約束": "やくそく",
  "危険": "きけん",
  "会社": "かいしゃ",
  "名前": "なまえ",
  "成績": "せいせき",
  "調査": "ちょうさ",
  "努力": "どりょく",
  "事実": "じじつ",
  "自分": "じぶん",
  "友達": "ともだち",
  "専門家": "せんもんか"
};

Object.assign(FURIGANA_MAP, {
  "辞书形": "じしょけい",
  "名词": "めいし",
  "形容词": "けいようし",
  "数量词": "すうりょうし",
  "助词": "じょし",
  "丁寧形": "ていねいけい",
  "条件形": "じょうけんけい",
  "使役て": "しえきて",
  "形去ます": "けいさります",
  "形去ない": "けいさらない",
  "词干": "ごかん",
  "至っても": "いたっても",
  "至っては": "いたっては",
  "至って": "いたって",
  "至るまで": "いたるまで",
  "至る": "いたる",
  "至っ": "いたっ",
  "始末": "しまつ",
  "文型": "ぶんけい",
  "確認": "かくにん",
  "確認します": "かくにんします",
  "最終": "さいしゅう",
  "過程": "かてい",
  "不良": "ふりょう",
  "結末": "けつまつ",
  "普通": "ふつう",
  "動作": "どうさ",
  "動詞": "どうし",
  "名詞": "めいし",
  "学校": "がっこう",
  "教室": "きょうしつ",
  "授業": "じゅぎょう",
  "教科書": "きょうかしょ",
  "辞書": "じしょ",
  "作文": "さくぶん",
  "発表": "はっぴょう",
  "質問": "しつもん",
  "答え": "こたえ",
  "答": "こたえ",
  "正しい": "ただしい",
  "間違い": "まちがい",
  "間違える": "まちがえる",
  "間違った": "まちがった",
  "覚える": "おぼえる",
  "忘れる": "わすれる",
  "読む": "よむ",
  "読ん": "よん",
  "書く": "かく",
  "書い": "かい",
  "聞く": "きく",
  "聞こえる": "きこえる",
  "話す": "はなす",
  "話し": "はなし",
  "言う": "いう",
  "言い": "いい",
  "使う": "つかう",
  "使い": "つかい",
  "使われ": "つかわれ",
  "選ぶ": "えらぶ",
  "選べる": "えらべる",
  "選択": "せんたく",
  "入る": "はいる",
  "入れ": "いれ",
  "出る": "でる",
  "出し": "だし",
  "来る": "くる",
  "来て": "きて",
  "行く": "いく",
  "行き": "いき",
  "帰る": "かえる",
  "帰り": "かえり",
  "戻る": "もどる",
  "戻れる": "もどれる",
  "始める": "はじめる",
  "始め": "はじめ",
  "終わる": "おわる",
  "終わっ": "おわっ",
  "続ける": "つづける",
  "続け": "つづけ",
  "続く": "つづく",
  "残る": "のこる",
  "残し": "のこし",
  "決める": "きめる",
  "決め": "きめ",
  "決定": "けってい",
  "変わる": "かわる",
  "変える": "かえる",
  "増える": "ふえる",
  "減る": "へる",
  "高い": "たかい",
  "低い": "ひくい",
  "多い": "おおい",
  "少ない": "すくない",
  "長い": "ながい",
  "短い": "みじかい",
  "早い": "はやい",
  "速い": "はやい",
  "遅い": "おそい",
  "難しい": "むずかしい",
  "易しい": "やさしい",
  "厳しい": "きびしい",
  "忙しい": "いそがしい",
  "楽しい": "たのしい",
  "新しい": "あたらしい",
  "古い": "ふるい",
  "強い": "つよい",
  "弱い": "よわい",
  "良い": "よい",
  "悪い": "わるい",
  "便利": "べんり",
  "自然": "しぜん",
  "必要": "ひつよう",
  "重要": "じゅうよう",
  "有効": "ゆうこう",
  "有名": "ゆうめい",
  "安心": "あんしん",
  "心配": "しんぱい",
  "希望": "きぼう",
  "願望": "がんぼう",
  "感情": "かんじょう",
  "感想": "かんそう",
  "感謝": "かんしゃ",
  "残念": "ざんねん",
  "想像": "そうぞう",
  "理解": "りかい",
  "信頼": "しんらい",
  "信用": "しんよう",
  "関係": "かんけい",
  "関心": "かんしん",
  "関わる": "かかわる",
  "関わっ": "かかわっ",
  "影響": "えいきょう",
  "状況": "じょうきょう",
  "制度": "せいど",
  "計画": "けいかく",
  "予定": "よてい",
  "準備": "じゅんび",
  "用意": "ようい",
  "申込": "もうしこみ",
  "手続": "てつづき",
  "手段": "しゅだん",
  "方法": "ほうほう",
  "内容": "ないよう",
  "本当": "ほんとう",
  "事態": "じたい",
  "事実": "じじつ",
  "事件": "じけん",
  "社会": "しゃかい",
  "全体": "ぜんたい",
  "個人": "こじん",
  "自分自身": "じぶんじしん",
  "自身": "じしん",
  "会社": "かいしゃ",
  "店": "みせ",
  "駅": "えき",
  "銀行": "ぎんこう",
  "病院": "びょういん",
  "部屋": "へや",
  "家": "いえ",
  "雨": "あめ",
  "大雨": "おおあめ",
  "雪": "ゆき",
  "大雪": "おおゆき",
  "風": "かぜ",
  "春": "はる",
  "夏": "なつ",
  "秋": "あき",
  "冬": "ふゆ",
  "朝": "あさ",
  "晩": "ばん",
  "今日": "きょう",
  "明日": "あした",
  "来月": "らいげつ",
  "去年": "きょねん",
  "今年": "ことし",
  "来年": "らいねん",
  "毎日": "まいにち",
  "今回": "こんかい",
  "以前": "いぜん",
  "以後": "いご",
  "以上": "いじょう",
  "以下": "いか",
  "以内": "いない",
  "前": "まえ",
  "後": "あと",
  "中": "なか",
  "間": "あいだ",
  "際": "さい",
  "最中": "さいちゅう",
  "直後": "ちょくご",
  "途中": "とちゅう",
  "子ども": "こども",
  "子供": "こども",
  "大人": "おとな",
  "人": "ひと",
  "彼": "かれ",
  "彼女": "かのじょ",
  "私": "わたし",
  "皆": "みな",
  "専門": "せんもん",
  "研究": "けんきゅう",
  "調べる": "しらべる",
  "調べ": "しらべ",
  "報告": "ほうこく",
  "連絡": "れんらく",
  "相談": "そうだん",
  "参加": "さんか",
  "出席": "しゅっせき",
  "欠席": "けっせき",
  "中止": "ちゅうし",
  "延期": "えんき",
  "変更": "へんこう",
  "解決": "かいけつ",
  "成功": "せいこう",
  "失敗": "しっぱい",
  "合格": "ごうかく",
  "成長": "せいちょう",
  "上達": "じょうたつ",
  "努力": "どりょく",
  "無理": "むり",
  "不足": "ふそく",
  "十分": "じゅうぶん",
  "全部": "ぜんぶ",
  "一部": "いちぶ",
  "一度": "いちど",
  "一緒": "いっしょ",
  "一方": "いっぽう",
  "一方だ": "いっぽうだ",
  "問題点": "もんだいてん",
  "観点": "かんてん",
  "視点": "してん",
  "理由": "りゆう",
  "結果": "けっか",
  "条件": "じょうけん",
  "場合": "ばあい"
});

init();
