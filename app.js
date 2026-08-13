const STORAGE_KEY = "jp-grammar-quest-progress-v1";
const THEME_KEY = "jp-grammar-quest-theme-v1";
const CUSTOM_CONTENT_KEY = "jp-grammar-custom-content-v1";

const EMPTY_PROGRESS = { completed: {}, hard: {}, answers: {}, lastGroup: "" };
const EMPTY_CUSTOM = { edits: {}, notes: {}, additions: {}, deleted: {}, preferences: {}, comparison: { sections: {}, profiles: {}, memberships: {} }, schemaVersion: 3 };

const state = {
  groupId: "",
  challengeIndex: 0,
  query: loadInitialSearchQuery(),
  searchResultKey: "",
  level: "all",
  expandedGroups: {},
  comparisonSectionId: "",
  theme: loadTheme(),
  progress: loadProgress(),
  custom: loadCustomContent()
};

const $ = (id) => document.getElementById(id);

function init() {
  ensureEditorShell();
  state.groupId = state.progress.lastGroup || GRAMMAR_GROUPS[0].id;
  $("searchInput").value = state.query;
  applyTheme();
  bindEvents();
  render();
}

function loadInitialSearchQuery() {
  return (new URLSearchParams(window.location.search).get("q") || "").trim().toLowerCase();
}

function bindEvents() {
  $("themeToggleBtn").addEventListener("click", () => {
    state.theme = state.theme === "night" ? "day" : "night";
    saveTheme();
    applyTheme();
  });
  $("searchInput").addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    state.searchResultKey = "";
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
  $("addComparisonExpressionBtn").addEventListener("click", () => openExpressionEditor("add", null, { comparisonSectionId: state.comparisonSectionId }));
  $("editComparisonSectionBtn").addEventListener("click", openComparisonSectionEditor);
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
    return migrateCustomContent(JSON.parse(localStorage.getItem(CUSTOM_CONTENT_KEY)) || {});
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
    version: 3,
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
      if (backup.app !== "beka-japanese-grammar" || ![1, 2, 3].includes(backup.version)) {
        throw new Error("invalid backup");
      }
      if (!confirm("导入会覆盖当前浏览器中的学习记录、笔记和自定义条目，确定继续吗？")) return;
      state.progress = { ...EMPTY_PROGRESS, ...(backup.progress || {}) };
      state.custom = migrateCustomContent(backup.custom || {});
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
  const preference = state.custom.preferences[item.id] || {};
  const note = state.custom.notes[item.id] ?? edit.userNote ?? item.userNote ?? "";
  return {
    ...item,
    ...edit,
    usageFlags: preference.usageFlags || edit.usageFlags || item.usageFlags,
    userNote: note,
    _userAdded: userAdded,
    _customized: Boolean(userAdded || Object.keys(edit).length || note)
  };
}

function migrateCustomContent(raw = {}) {
  const custom = { ...structuredClone(EMPTY_CUSTOM), ...(raw || {}) };
  custom.edits ||= {};
  custom.notes ||= {};
  custom.additions ||= {};
  custom.deleted ||= {};
  custom.preferences ||= {};
  custom.comparison ||= {};
  custom.comparison.sections ||= {};
  custom.comparison.profiles ||= {};
  custom.comparison.memberships ||= {};
  const migrations = globalThis.GRAMMAR_CARD_ID_MIGRATIONS || {};
  const reports = globalThis.GRAMMAR_CARD_MERGE_REPORT || [];
  const appendNote = (id, text) => {
    if (!text) return;
    custom.notes[id] = [custom.notes[id], text].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join("\n\n");
  };
  const supplement = (item, label) => {
    const fields = [
      ["文型", item.pattern], ["意思", item.meaning], ["接续", item.connection], ["固定搭配", item.collocation],
      ["语感", item.nuance], ["例句", item.example], ["译文", item.translation], ["来源", [item.sourceBook, item.sourceLesson].filter(Boolean).join(" · ")]
    ].filter(([, value]) => value);
    return fields.length ? `【原自定义补充${label ? `：${label}` : ""}】\n${fields.map(([name, value]) => `${name}：${value}`).join("\n")}` : "";
  };
  const movePreference = (fromId, toId, edit = {}) => {
    if (!edit.usageFlags) return;
    custom.preferences[toId] = {
      ...(custom.preferences[toId] || {}),
      usageFlags: { ...(custom.preferences[toId]?.usageFlags || {}), ...edit.usageFlags }
    };
  };

  for (const [fromId, toId] of Object.entries(migrations)) {
    if (custom.notes[fromId]) appendNote(toId, custom.notes[fromId]);
    if (custom.edits[fromId]) {
      appendNote(toId, supplement(custom.edits[fromId], `已合并卡片 ${fromId}`));
      movePreference(fromId, toId, custom.edits[fromId]);
      delete custom.edits[fromId];
    }
    delete custom.notes[fromId];
  }

  // Respect a deletion only when the user had hidden every card in a merge
  // cluster; deleting one historical duplicate must not hide the new main card.
  for (const report of reports) {
    const oldIds = [report.primaryId, ...(report.mergedFromIds || [])];
    if (oldIds.every((id) => custom.deleted[id])) custom.deleted[report.primaryId] = true;
    for (const id of report.mergedFromIds || []) delete custom.deleted[id];
  }

  const builtIns = GRAMMAR_GROUPS.flatMap((group) => group.expressions.map((item) => ({ group, item })));
  const compact = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const exactBuiltInMatch = (addition, groupId) => {
    const key = compact(addition.pattern);
    if (!key) return null;
    const matches = builtIns.filter(({ group, item }) => {
      if (!(item.relatedGroups || [group.id]).includes(groupId)) return false;
      return [item.pattern, ...(item.variants || [])].some((value) => compact(value) === key);
    });
    return matches.length === 1 ? matches[0].item : null;
  };
  for (const [groupId, additions] of Object.entries(custom.additions)) {
    const kept = [];
    for (const addition of additions || []) {
      const target = exactBuiltInMatch(addition, groupId);
      if (!target) {
        kept.push(addition);
        continue;
      }
      appendNote(target.id, supplement(addition, `自定义条目 ${addition.pattern || addition.id}`));
      movePreference(addition.id, target.id, addition);
      if (custom.notes[addition.id]) appendNote(target.id, custom.notes[addition.id]);
      delete custom.notes[addition.id];
      delete custom.edits[addition.id];
      delete custom.deleted[addition.id];
    }
    custom.additions[groupId] = kept;
  }
  custom.schemaVersion = 3;
  return custom;
}

function currentGroup() {
  return mergedGroups().find((group) => group.id === state.groupId) || mergedGroups()[0];
}

function currentChallenge() {
  return filteredChallenges(currentGroup())[state.challengeIndex] || null;
}

function render() {
  if (state.query) {
    const results = GrammarSearch.rank(mergedGroups(), state.query, { level: state.level });
    setSearchMode(true);
    renderSearchResults(results);
    renderSearchGroupList(results);
    return;
  }
  setSearchMode(false);
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

function setSearchMode(active) {
  $("searchResultsPanel").classList.toggle("hidden", !active);
  $("learningWorkspace").classList.toggle("hidden", active);
}

function renderGroupList() {
  const list = $("groupList");
  const groups = mergedGroups().filter(groupMatches);
  list.innerHTML = groups.length ? groups.map((group) => {
    const done = Object.keys(state.progress.completed).filter((key) => key.startsWith(`${group.id}:`)).length;
    const total = filteredChallenges(group).length;
    const active = group.id === state.groupId ? " active" : "";
    const expanded = isGroupExpanded(group.id);
    const customCount = group.expressions.filter((item) => item._customized).length;
    return `<div class="group-block${expanded ? " expanded" : ""}">
      <button class="group-btn${active}" type="button" data-group="${escapeAttr(group.id)}" aria-expanded="${expanded}">
        <span>
          <strong>${escapeHtml(group.title)}</strong>
          <small>${escapeHtml(levelSummary(group))} · ${escapeHtml(group.axis || "功能辨析")}${customCount ? ` · 自定义 ${customCount}` : ""}</small>
        </span>
        <span class="group-meter">
          <em>${done}/${total}</em>
          <i aria-hidden="true">${expanded ? "⌃" : "⌄"}</i>
        </span>
      </button>
      ${expanded ? renderGroupSubItems(group) : ""}
    </div>`;
  }).join("") : `<p class="empty-state">没有找到匹配的分类。</p>`;
  list.querySelectorAll(".group-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const nextGroupId = button.dataset.group;
      const alreadyCurrent = state.groupId === nextGroupId;
      const currentlyExpanded = isGroupExpanded(nextGroupId);
      state.groupId = nextGroupId;
      state.expandedGroups[nextGroupId] = alreadyCurrent ? !currentlyExpanded : true;
      state.challengeIndex = 0;
      state.progress.lastGroup = nextGroupId;
      saveProgress();
      renderGroup();
      renderGroupList();
    });
  });
  list.querySelectorAll(".group-subitem").forEach((button) => {
    button.addEventListener("click", () => {
      state.groupId = button.dataset.group;
      state.expandedGroups[state.groupId] = true;
      state.challengeIndex = 0;
      state.progress.lastGroup = state.groupId;
      saveProgress();
      renderGroup();
      renderGroupList();
      focusExpression(button.dataset.expression);
      setTimeout(() => focusExpression(button.dataset.expression), 120);
    });
  });
  return groups;
}

function renderSearchGroupList(results) {
  const list = $("groupList");
  const tiers = [
    ["exact", "完全一致"],
    ["strong", "强相关"],
    ["semantic", "相近意思"],
    ["structural", "相近构造"]
  ];
  const hasDirect = results.counts.exact + results.counts.strong > 0;
  list.innerHTML = `
    <section class="search-nav" aria-label="检索结果导航">
      <div class="search-nav-head">
        <span>检索结果</span>
        <button class="text-btn" type="button" data-search-action="clear">清空</button>
      </div>
      <p>“${escapeHtml(results.query)}”</p>
      ${tiers.map(([tier, title]) => {
        const open = (tier === "exact" || tier === "strong") || !hasDirect;
        const items = results[tier];
        return `<details class="search-nav-tier" ${open ? "open" : ""}>
          <summary>${escapeHtml(title)} <em>${formatSearchCount(results.counts[tier])}</em></summary>
          ${items.length ? `<div>${items.map((result) => `<button class="search-nav-result${state.searchResultKey === result.key ? " is-current" : ""}" type="button" data-search-action="focus" data-result-key="${escapeAttr(result.key)}"${state.searchResultKey === result.key ? " aria-current=\"true\"" : ""}><span lang="ja">${renderJapaneseText(searchResultPattern(result))}</span><small>${escapeHtml(result.item.meaning)}</small></button>`).join("")}</div>` : ""}
        </details>`;
      }).join("")}
    </section>`;
  bindSearchResultActions(list);
}

function renderSearchResults(results) {
  const panel = $("searchResultsPanel");
  const directCount = results.counts.exact + results.counts.strong;
  const totalRelated = results.counts.semantic + results.counts.structural;
  panel.innerHTML = `
    <section class="panel search-results-shell" aria-label="分层检索结果">
      <div class="section-head search-results-head">
        <div>
          <p class="eyebrow">精准检索</p>
          <h2>“${escapeHtml(results.query)}”</h2>
          <p class="summary">${results.counts.exact ? `找到完全一致的词条 ${results.counts.exact} 条。` : `词库中暂未找到完全一致的「${escapeHtml(results.query)}」。`}</p>
        </div>
        <button class="ghost-btn compact-action" type="button" data-search-action="clear"><span aria-hidden="true">×</span>清空检索</button>
      </div>
      <div class="search-counts" aria-label="各类结果数量">
        <span class="search-count search-count--exact">完全一致 ${formatSearchCount(results.counts.exact)}</span>
        <span class="search-count search-count--strong">强相关 ${formatSearchCount(results.counts.strong)}</span>
        <span>相近意思 ${formatSearchCount(results.counts.semantic)}</span>
        <span>相近构造 ${formatSearchCount(results.counts.structural)}</span>
      </div>
      ${results.best ? `<p class="best-match">最佳匹配：<strong lang="ja">${renderJapaneseText(searchResultPattern(results.best))}</strong><span>${escapeHtml(results.best.reasons[0])}</span></p>` : `<p class="search-no-related">没有找到足够相关的词条；可以换用中文意思、假名、汉字或罗马音再次检索。</p>`}
      ${renderSearchTier("exact", "完全一致", "主句式、表达变体或对应罗马音与输入相同。", results, true)}
      ${renderSearchTier("strong", "强相关", "检索别名、意思、接续或搭配直接命中。", results, true)}
      ${renderSearchTier("semantic", "相近意思", "可用来比较相同功能下的语感差异。", results, !directCount)}
      ${renderSearchTier("structural", "相近构造", "共享关键构造，但意思未必可以直接互换。", results, !directCount)}
      ${totalRelated > 24 ? `<p class="search-limit-note">每类优先展示前 ${GrammarSearch.MAX_RESULTS_PER_TIER} 条；请用更具体的关键词继续缩小范围。</p>` : ""}
    </section>`;
  bindSearchResultActions(panel);
}

function renderSearchTier(tier, title, description, results, open) {
  const items = results[tier];
  const total = results.counts[tier];
  if (!total && tier !== "exact") return "";
  if (!total) return `<section class="search-tier search-tier--empty"><h3>${escapeHtml(title)} <span>0</span></h3><p>没有。</p></section>`;
  return `
    <details class="search-tier search-tier--${tier}" ${open ? "open" : ""}>
      <summary>
        <span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span>
        <em>${formatSearchCount(total)}</em>
      </summary>
      <div class="search-result-list">
        ${items.map((result, index) => renderSearchResultCard(result, index === 0 && (tier === "exact" || tier === "strong"))).join("")}
        ${total > items.length ? `<p class="search-limit-note">结果较多，已优先显示最相关的 ${items.length} 条。</p>` : ""}
      </div>
    </details>`;
}

function formatSearchCount(count) {
  return count > GrammarSearch.MAX_RESULTS_PER_TIER ? `${GrammarSearch.MAX_RESULTS_PER_TIER}+` : String(count);
}

function renderSearchResultCard(result, open) {
  const item = result.item;
  const profile = usageProfile(item);
  const variants = renderCardVariants(item);
  const homographs = renderHomographHint(item);
  const matchedPattern = searchResultPattern(result);
  const canonicalPattern = matchedPattern !== item.pattern
    ? `<small class="search-result-canonical" lang="ja">主卡：${renderJapaneseText(item.pattern)}</small>`
    : "";
  return `
    <details class="search-result-card" data-search-result="${escapeAttr(result.key)}" ${open ? "open" : ""}>
      <summary>
        <span class="search-result-main">
          <span class="search-result-meta"><span class="level">${escapeHtml(item.level)}</span>${renderUsageBadges(item.usageFlags)}<small>${escapeHtml(result.groupTitle)}</small></span>
          <strong lang="ja">${renderJapaneseText(matchedPattern)}</strong>
          ${canonicalPattern}
          <span>${escapeHtml(item.meaning)}</span>
        </span>
        <span class="match-reasons">${result.reasons.map((reason) => `<i>${escapeHtml(reason)}</i>`).join("")}</span>
      </summary>
      <div class="search-result-detail">
        <dl>
          ${renderConnectionField(item.connection)}
          <dt>搭配</dt><dd lang="ja">${renderJapaneseText(item.collocation || "—")}</dd>
          <dt>语感</dt><dd>${escapeHtml(item.nuance || "—")}</dd>
          <dt>正式</dt><dd>${escapeHtml(profile.formality)}</dd>
          <dt>表记</dt><dd lang="ja">${renderJapaneseText(profile.notation)}</dd>
          ${variants}
          ${homographs}
          ${item.relatedGroups?.length > 1 ? `<dt>相关分类</dt><dd>${escapeHtml(item.relatedGroups.map(groupTitleForId).join(" · "))}</dd>` : ""}
          <dt>来源</dt><dd>${escapeHtml([item.sourceBook, item.sourceLesson].filter(Boolean).join(" · ") || "—")}</dd>
        </dl>
        ${item.example ? `<div class="example"><p lang="ja">${renderExample(item)}</p><small>${escapeHtml(item.translation || "")}</small></div>` : ""}
        <div class="button-row"><button class="secondary-btn compact-action" type="button" data-search-action="enter" data-group-id="${escapeAttr(result.groupId)}" data-expression-id="${escapeAttr(item.id)}">进入所属分类</button></div>
      </div>
  </details>`;
}

function searchResultPattern(result) {
  return result.matchedBy?.startsWith("variant") && result.matchedValue
    ? result.matchedValue
    : result.item.pattern;
}

function bindSearchResultActions(root) {
  root.querySelectorAll("[data-search-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.searchAction;
      if (action === "clear") clearSearch();
      if (action === "focus") focusSearchResult(button.dataset.resultKey);
      if (action === "enter") enterSearchResult(button.dataset.groupId, button.dataset.expressionId);
    });
  });
}

function clearSearch() {
  state.query = "";
  state.searchResultKey = "";
  $("searchInput").value = "";
  render();
}

function focusSearchResult(key) {
  const card = document.querySelector(`[data-search-result="${CSS.escape(key)}"]`);
  if (!card) return;
  state.searchResultKey = key;
  let ancestor = card.parentElement;
  while (ancestor) {
    if (ancestor.tagName === "DETAILS") ancestor.open = true;
    ancestor = ancestor.parentElement;
  }
  card.open = true;
  document.querySelectorAll('[data-search-action="focus"]').forEach((button) => {
    const current = button.dataset.resultKey === key;
    button.classList.toggle("is-current", current);
    if (current) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  });
  document.querySelectorAll(".search-result-card.is-current").forEach((item) => item.classList.remove("is-current"));
  card.classList.add("is-current");
  card.classList.add("is-focused");
  requestAnimationFrame(() => {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.querySelector("summary")?.focus({ preventScroll: true });
    setTimeout(() => card.classList.remove("is-focused"), 1600);
  });
}

function enterSearchResult(groupId, expressionId) {
  state.groupId = groupId;
  state.expandedGroups[groupId] = true;
  state.challengeIndex = 0;
  state.progress.lastGroup = groupId;
  saveProgress();
  clearSearch();
  setTimeout(() => focusExpression(expressionId), 100);
}

function isGroupExpanded(groupId) {
  return Object.prototype.hasOwnProperty.call(state.expandedGroups, groupId)
    ? Boolean(state.expandedGroups[groupId])
    : groupId === state.groupId;
}

function renderGroupSubItems(group) {
  const items = group.expressions
    .filter((item) => state.level === "all" || levelMatches(item.level))
    .filter((item) => !state.query || expressionMatches(item))
    .slice(0, 80);
  if (!items.length) return `<div class="group-subitems"><p class="empty-state">当前筛选下没有小条目。</p></div>`;
  return `<div class="group-subitems">${items.map((item) => `
    <button class="group-subitem" type="button" data-group="${escapeAttr(group.id)}" data-expression="${escapeAttr(item.id)}">
      <span lang="ja">${renderJapaneseText(item.pattern)}</span>
      <small>${escapeHtml(item.meaning || "未填写意思")}</small>
    </button>
  `).join("")}</div>`;
}

function focusExpression(id) {
  requestAnimationFrame(() => {
    const target = document.querySelector(`.expression-card[data-expression="${CSS.escape(id)}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("is-focused");
    setTimeout(() => target.classList.remove("is-focused"), 1600);
  });
}

function groupMatches(group) {
  const expressions = group.expressions;
  return state.level === "all" || expressions.some((item) => levelMatches(item.level));
}

function expressionMatches(item) {
  return state.level === "all" || levelMatches(item.level);
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
    group.focus
  ].join(" ");
}

function searchableExpressionText(item) {
  return [
    item.id,
    item.level,
    item.pattern,
    ...(item.variants || []),
    item.meaning,
    item.connection,
    item.collocation,
    item.nuance,
    item.source,
    item.sourceBook,
    item.sourceLesson,
    ...(item.searchAliases || []),
    ...usageFlagLabels(item.usageFlags),
    ...(item.tags || [])
  ].join(" ");
}

function queryMatchesSearchDoc(text) {
  const haystack = buildSearchDoc(text);
  return expandedSearchTokens(state.query).some((token) => {
    const compact = compactSearchText(token);
    return compact && haystack.includes(compact);
  });
}

function buildSearchDoc(text) {
  const source = String(text || "");
  const kana = normalizeKana(source);
  return [
    source,
    kana,
    kanaToRomaji(kana),
    ...expandChineseSynonyms(source)
  ].map(compactSearchText).join(" ");
}

function expandedSearchTokens(query) {
  const isRomajiPhrase = /^[a-zA-Z\s-]+$/.test(String(query || "")) && String(query || "").trim().includes(" ");
  const rawTokens = [query, ...(isRomajiPhrase ? [] : searchTokens(query)), ...expandChineseSynonyms(query)];
  const variants = [];
  rawTokens.forEach((token) => {
    const kana = normalizeKana(token);
    variants.push(token, kana, kanaToRomaji(kana));
  });
  return [...new Set(variants.filter(Boolean))];
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
    .normalize("NFKC")
    .replace(/[\s　、，。．,.。:：;；/／|｜「」『』（）()【】\[\]{}<>《》・~〜…-]+/g, "");
}

const CHINESE_SEARCH_SYNONYMS = [
  ["如果", "假如", "倘若", "要是", "若是", "条件", "仮定"],
  ["原因", "理由", "因为", "由于", "所以", "因果", "契機", "根拠", "から", "ので", "ため", "せい", "おかげ"],
  ["目的", "为了", "以便", "目标", "ように", "ために", "べく"],
  ["让步", "逆接", "转折", "虽然", "即使", "但是", "尽管", "のに", "ても", "けれど", "にもかかわらず"],
  ["推测", "推量", "也许", "可能", "应该", "大概", "好像", "でしょう", "かもしれない", "はず", "そう", "よう", "らしい"],
  ["传闻", "听说", "据说", "转述", "そうだ", "とのこと", "らしい"],
  ["必须", "义务", "必要", "不得不", "なければならない", "なくてはいけない", "べき", "ざるを得ない"],
  ["禁止", "不要", "不可以", "てはいけない", "ないでください", "べきではない"],
  ["固定搭配", "惯用", "搭配", "連語", "慣用"]
];

function expandChineseSynonyms(text) {
  const compact = compactSearchText(text);
  if (!compact) return [];
  return CHINESE_SEARCH_SYNONYMS
    .filter((group) => group.some((word) => compact.includes(compactSearchText(word))))
    .flat();
}

function normalizeKana(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

const ROMAJI_DIGRAPHS = {
  きゃ: "kya", きゅ: "kyu", きょ: "kyo", しゃ: "sha", しゅ: "shu", しょ: "sho",
  ちゃ: "cha", ちゅ: "chu", ちょ: "cho", にゃ: "nya", にゅ: "nyu", にょ: "nyo",
  ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo", みゃ: "mya", みゅ: "myu", みょ: "myo",
  りゃ: "rya", りゅ: "ryu", りょ: "ryo", ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
  じゃ: "ja", じゅ: "ju", じょ: "jo", びゃ: "bya", びゅ: "byu", びょ: "byo",
  ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo"
};

const ROMAJI_MONOGRAPHS = {
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", を: "o", ん: "n",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o", ゃ: "ya", ゅ: "yu", ょ: "yo", っ: ""
};

function kanaToRomaji(text) {
  const kana = normalizeKana(text);
  let out = "";
  for (let index = 0; index < kana.length; index += 1) {
    const char = kana[index];
    if (char === "っ") {
      const next = ROMAJI_DIGRAPHS[kana.slice(index + 1, index + 3)] || ROMAJI_MONOGRAPHS[kana[index + 1]] || "";
      out += next.charAt(0);
      continue;
    }
    const pair = kana.slice(index, index + 2);
    if (ROMAJI_DIGRAPHS[pair]) {
      out += ROMAJI_DIGRAPHS[pair];
      index += 1;
      continue;
    }
    if (char === "ー") {
      out += out.match(/[aeiou]$/)?.[0] || "";
      continue;
    }
    out += ROMAJI_MONOGRAPHS[char] || char;
  }
  return out;
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
  $("progressPill").title = `练习完成 ${done} / ${shownChallenges.length}`;
  renderChallenge();
  renderComparisonMatrix({ followTarget: true });
}

function renderExpressions(group, expressions) {
  $("expressionLadder").innerHTML = expressions.length ? expressions.map((item) => {
    const profile = usageProfile(item);
    const usageBadges = renderUsageBadges(item.usageFlags);
    const note = item.userNote ? `<div class="user-note"><strong>我的笔记</strong><p>${escapeHtml(item.userNote)}</p></div>` : "";
    const variants = renderCardVariants(item);
    const homographs = renderHomographHint(item);
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
        ${renderConnectionField(item.connection)}
        <dt>搭配</dt><dd lang="ja">${renderJapaneseText(item.collocation || "—")}</dd>
        <dt>语感</dt><dd>${escapeHtml(item.nuance)}</dd>
        <dt>正式</dt><dd>${escapeHtml(profile.formality)}</dd>
        <dt>表记</dt><dd lang="ja">${renderJapaneseText(profile.notation)}</dd>
        ${variants}
        ${homographs}
        ${item.relatedGroups?.length > 1 ? `<dt>相关分类</dt><dd>${escapeHtml(item.relatedGroups.map(groupTitleForId).join(" · "))}</dd>` : ""}
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

function renderCardVariants(item) {
  const variants = [...new Set((item.variants || []).filter((value) => value && value !== item.pattern))];
  return variants.length ? `<dt>表达变体</dt><dd lang="ja">${variants.map((value) => renderJapaneseText(value)).join(" ／ ")}</dd>` : "";
}

function renderConnectionField(connection) {
  return `<dt>接续</dt><dd class="connection-cell">${renderConnectionTable(connection)}</dd>`;
}

function renderConnectionTable(connection) {
  const rows = parseConnectionRows(connection);
  return `<div class="connection-table-wrap"><table class="connection-table">
    <thead><tr><th scope="col">词类 / 场景</th><th scope="col">接续形式</th><th scope="col">注意</th></tr></thead>
    <tbody>${rows.map((row) => `<tr>
      <th scope="row" data-label="词类 / 场景">${escapeHtml(row.scope)}</th>
      <td data-label="接续形式" lang="ja">${renderJapaneseText(row.form)}</td>
      <td data-label="注意">${row.note ? renderJapaneseText(row.note) : "—"}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function parseConnectionRows(connection) {
  const raw = String(connection || "").trim();
  if (!raw) return [connectionRow("—", "—", "", "")];
  const rows = [];
  for (const clause of raw.split(/[；;]/).map((part) => part.trim()).filter(Boolean)) {
    if (rows.length && isConnectionNote(clause)) {
      const previous = rows[rows.length - 1];
      previous.note = [previous.note, clause].filter(Boolean).join("；");
      previous.raw = `${previous.raw}；${clause}`;
      continue;
    }
    rows.push(parseConnectionClause(clause));
  }
  return rows;
}

function connectionRow(scope, form, note, raw) {
  return { scope, form: String(form || "").replace(/^[／/・、]\s*/, "").replace(/^\+\s*/, "").trim() || "—", note, raw };
}

function isConnectionNote(clause) {
  return /^(尤其|注意|不可|不能|不接|通常|常(?:与|用|接)|多(?:用|为)|前项|后项|前后主语|表示|用于|书面|口语|特殊)/.test(clause)
    && !/[+＋]/.test(clause);
}

function parseConnectionClause(clause) {
  let form = clause;
  let note = "";
  const sentenceEnd = clause.indexOf("。");
  if (sentenceEnd >= 0 && sentenceEnd < clause.length - 1) {
    form = clause.slice(0, sentenceEnd).trim();
    note = clause.slice(sentenceEnd + 1).trim();
  }

  const explicit = form.match(/^(目的|原因|条件|样态|伝聞|传闻|特殊(?:变化)?|口语|书面|句首|句中|副词|固定搭配)\s*[：:]/);
  if (explicit) {
    return connectionRow(explicit[1], form.slice(explicit[0].length).trim() || "—", note, clause);
  }

  const head = form.split(/[+＋]/)[0];
  const scopes = [...new Set(head.match(/动词|い形容词|な形容词|名词|数量词|疑问词|副词|句首|句中/g) || [])];
  if (scopes.length > 1 && /^(动词|い形容词|な形容词|名词|数量词|疑问词|副词|句首|句中)/.test(form)) {
    const remainder = form
      .replace(/动词|い形容词|な形容词|名词|数量词|疑问词|副词|句首|句中/g, "")
      .replace(/^\s*[／/・、]\s*/, "")
      .replace(/^([^+／/]+)[／/]\1(?=\s*[+＋])/, "$1")
      .trim();
    return connectionRow(scopes.join(" / "), remainder || form, note, clause);
  }

  const prefix = form.match(/^(?:(?:动词|い形容词|な形容词|名词|数量词|疑问词|副词|句首|句中)(?:\s*[／/・、]\s*(?:动词|い形容词|な形容词|名词|数量词|疑问词|副词|句首|句中))*)/);
  if (prefix) {
    const scope = prefix[0].replace(/[／/・、]/g, " / ").replace(/\s+/g, " ").trim();
    const remainder = form.slice(prefix[0].length).trim();
    return connectionRow(scope, remainder || form, note, clause);
  }

  const formScope = form.match(/^(辞书形|ない形|た形|て形|ます形|意向形|ば形|可能形|受身形|使役形|普通形|连体形|终止形)/);
  if (formScope) {
    const verbOnly = /^(辞书形|ない形|た形|て形|ます形|意向形|可能形|受身形|使役形)/.test(formScope[1]);
    return connectionRow(verbOnly ? "动词" : formScope[1], form, note, clause);
  }

  return connectionRow("固定形式", form, note, clause);
}

function renderHomographHint(item) {
  if (!item.homographIds?.length) return "";
  const related = item.homographIds
    .map((id) => mergedGroups().flatMap((group) => group.expressions).find((candidate) => candidate.id === id))
    .filter(Boolean)
    .map((candidate) => `${candidate.pattern}：${candidate.meaning}`);
  return `<dt>辨析</dt><dd>${escapeHtml(item.homographLabel || "同形异义")}${related.length ? `（${escapeHtml(related.join("；"))}）` : ""}</dd>`;
}

function groupTitleForId(id) {
  return mergedGroups().find((group) => group.id === id)?.title || id;
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
  renderComparisonMatrix({ followTarget: true });
}

function comparisonSectionsForGroup(group) {
  const data = globalThis.GRAMMAR_COMPARISON_DATA || {};
  const builtIn = (data.groups?.[group.id] || []).map((section) => ({ ...section, expressionIds: [...section.expressionIds] }));
  const customSections = Object.values(state.custom.comparison?.sections?.[group.id] || {}).map((section) => ({ ...section, expressionIds: [...(section.expressionIds || [])] }));
  const configured = [...builtIn, ...customSections];
  const expressionIds = new Set(group.expressions.map((item) => item.id));
  const memberships = state.custom.comparison?.memberships || {};
  for (const [expressionId, sectionId] of Object.entries(memberships)) {
    const section = configured.find((entry) => entry.id === sectionId);
    if (section && expressionIds.has(expressionId) && !section.expressionIds.includes(expressionId)) section.expressionIds.push(expressionId);
  }
  const covered = new Set(configured.flatMap((section) => section.expressionIds));
  const unclassified = group.expressions.filter((item) => !covered.has(item.id)).map((item) => item.id);
  if (unclassified.length) {
    configured.push({
      id: "custom-supplement",
      title: "新增／未归类补充",
      summary: "你新添加或尚未人工归入细分意思的条目。系统不会擅自编造使用限制，请以知识卡与个人笔记为准。",
      expressionIds: unclassified,
      _systemSection: true
    });
  }
  return configured
    .map((section) => ({ ...section, expressionIds: section.expressionIds.filter((id) => expressionIds.has(id)) }))
    .filter((section) => section.expressionIds.length || section._customSection);
}

function comparisonProfileFor(item) {
  const data = globalThis.GRAMMAR_COMPARISON_DATA || {};
  const custom = state.custom.comparison?.profiles?.[item.id] || {};
  const baseline = data.profiles?.[item.id] || data.fallbackProfile?.(item) || {
    coreDifference: item.nuance || item.meaning || "根据前后句的意义与接续选择。",
    usageScene: "一般会话与写作；结合前后语境。",
    avoidScene: "无特别禁用；按接续和语境使用。",
    register: "普通・中性",
    polarity: "中性（看语境）"
  };
  return { ...baseline, ...custom };
}

function comparisonSectionForExpression(group, expressionId) {
  return comparisonSectionsForGroup(group).find((section) => section.expressionIds.includes(expressionId));
}

function activeComparisonSection() {
  return comparisonSectionsForGroup(currentGroup()).find((section) => section.id === state.comparisonSectionId) || null;
}

function comparisonTargetExpression(group) {
  const challenge = currentChallenge();
  if (!challenge) return null;
  const target = normalizePatternForLookup(challenge[1]);
  const forms = (item) => [item.pattern, ...(item.variants || [])].map(normalizePatternForLookup);
  return group.expressions.find((item) => forms(item).includes(target))
    || group.expressions
      .map((item) => ({ item, forms: forms(item) }))
      .filter(({ forms }) => forms.some((form) => form && (form.includes(target) || target.includes(form))))
      .sort((a, b) => Math.min(...b.forms.map((form) => form.length)) - Math.min(...a.forms.map((form) => form.length)))[0]?.item
    || null;
}

function renderComparisonMatrix({ followTarget = false } = {}) {
  const group = currentGroup();
  const sections = comparisonSectionsForGroup(group);
  const target = comparisonTargetExpression(group);
  const targetSection = target && comparisonSectionForExpression(group, target.id);
  if (followTarget && targetSection) state.comparisonSectionId = targetSection.id;
  if (!sections.some((section) => section.id === state.comparisonSectionId)) state.comparisonSectionId = sections[0]?.id || "";
  const active = sections.find((section) => section.id === state.comparisonSectionId);
  const targetLabel = target ? `本题重点：${target.pattern}${targetSection ? ` · ${targetSection.title}` : ""}` : "切换细分意思，比较相近表达的真实使用场景。";
  $("comparisonLead").textContent = targetLabel;
  $("comparisonTabs").innerHTML = sections.map((section) => {
    const selected = section.id === active?.id;
    return `<button class="comparison-tab${selected ? " active" : ""}" type="button" role="tab" aria-selected="${selected}" data-comparison-section="${escapeAttr(section.id)}">${escapeHtml(section.title)}<small>${section.expressionIds.length}</small></button>`;
  }).join("");
  $("comparisonTabs").querySelectorAll("[data-comparison-section]").forEach((button) => {
    button.addEventListener("click", () => {
      state.comparisonSectionId = button.dataset.comparisonSection;
      renderComparisonMatrix();
    });
  });
  $("addComparisonExpressionBtn").disabled = !active;
  $("editComparisonSectionBtn").disabled = Boolean(active?._systemSection);
  $("editComparisonSectionBtn").textContent = active?._customSection ? "✎ 编辑小类" : "✎ 新建小类";
  $("editComparisonSectionBtn").title = active?._systemSection
    ? "“新增／未归类补充”由系统维护；请切换到其他小类后新建。"
    : active?._customSection ? "修改当前自定义辨析小类的标题和说明" : "新建一个自定义辨析小类";
  if (!active) {
    $("comparisonMatrix").innerHTML = `<p class="empty-state">当前分类暂时没有可显示的辨析条目。</p>`;
    return;
  }
  const allItems = new Map(group.expressions.map((item) => [item.id, item]));
  const items = active.expressionIds.map((id) => allItems.get(id)).filter(Boolean)
    .filter((item) => state.level === "all" || levelMatches(item.level));
  const hiddenCount = active.expressionIds.length - items.length;
  $("comparisonMatrix").innerHTML = `
    <div class="comparison-section-summary">
      <strong>${escapeHtml(active.title)}</strong>
      <p>${escapeHtml(active.summary)}</p>
      ${hiddenCount ? `<small>等级筛选暂时隐藏 ${hiddenCount} 条；点击表内词条会自动显示全部等级并定位知识卡。</small>` : ""}
    </div>
    ${items.length ? `<div class="comparison-table-wrap"><table class="comparison-table">
      <thead><tr><th scope="col">表达</th><th scope="col">核心意思／区别</th><th scope="col">接续</th><th scope="col">倾向・文体・正式程度</th><th scope="col">适合场景／不可或慎用</th></tr></thead>
      <tbody>${items.map((item) => renderComparisonRow(item)).join("")}</tbody>
    </table></div>` : `<p class="empty-state">当前等级筛选下没有该板块的条目。切换“全部 N5-N1”可查看完整辨析。</p>`}
  `;
  $("comparisonMatrix").querySelectorAll("[data-comparison-expression]").forEach((button) => {
    button.addEventListener("click", () => focusComparisonExpression(button.dataset.comparisonExpression));
  });
  $("comparisonMatrix").querySelectorAll("[data-comparison-edit]").forEach((button) => {
    button.addEventListener("click", () => openComparisonProfileEditor(button.dataset.comparisonEdit));
  });
}

function renderComparisonRow(item) {
  const profile = comparisonProfileFor(item);
  const formal = usageProfile(item).formality;
  return `<tr>
    <th scope="row" data-label="表达"><div class="comparison-expression-actions"><button class="comparison-expression-btn" type="button" data-comparison-expression="${escapeAttr(item.id)}"><span lang="ja">${renderJapaneseText(item.pattern)}</span><small>${escapeHtml(item.level)}</small></button><button class="comparison-row-edit" type="button" data-comparison-edit="${escapeAttr(item.id)}" title="修改这条辨析说明">✎</button></div></th>
    <td data-label="核心意思／区别"><strong>${escapeHtml(item.meaning || "—")}</strong><p>${escapeHtml(profile.coreDifference)}</p></td>
    <td data-label="接续" class="comparison-connection" lang="ja">${renderComparisonConnection(item.connection)}</td>
    <td data-label="倾向・文体・正式程度"><div class="comparison-tone">${renderUsageBadges(item.usageFlags)}<span>${escapeHtml(profile.polarity)}</span><span>${escapeHtml(profile.register || formal)}</span><small>${escapeHtml(formal)}</small></div></td>
    <td data-label="适合场景／不可或慎用" class="comparison-scenes"><p><b>适合：</b>${escapeHtml(profile.usageScene)}</p><p><b>限制：</b>${escapeHtml(profile.avoidScene)}</p></td>
  </tr>`;
}

function renderComparisonConnection(connection) {
  return parseConnectionRows(connection).map((row) => {
    const note = row.note ? `（${row.note}）` : "";
    return `${row.scope}：${row.form}${note}`;
  }).join("；");
}

function focusComparisonExpression(expressionId) {
  const group = currentGroup();
  const item = group.expressions.find((candidate) => candidate.id === expressionId);
  if (!item) return;
  const wasFiltered = state.level !== "all" && !levelMatches(item.level);
  if (state.level !== "all") {
    state.level = "all";
    $("levelFilter").value = "all";
    renderGroup();
    renderGroupList();
  }
  $("comparisonLead").textContent = `${wasFiltered ? "已暂时切换为全部等级并定位知识卡：" : "已定位知识卡："}${item.pattern}`;
  focusExpression(expressionId);
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

function customComparisonSections(groupId) {
  state.custom.comparison.sections[groupId] ||= {};
  return state.custom.comparison.sections[groupId];
}

function assignExpressionToComparisonSection(groupId, expressionId, sectionId) {
  if (!sectionId || sectionId === "custom-supplement") return;
  const section = comparisonSectionsForGroup(currentGroup()).find((entry) => entry.id === sectionId);
  if (!section) return;
  state.custom.comparison.memberships[expressionId] = sectionId;
  if (section._customSection) {
    const custom = customComparisonSections(groupId);
    custom[sectionId] = { ...custom[sectionId], expressionIds: [...new Set([...(custom[sectionId].expressionIds || []), expressionId])] };
  }
}

function comparisonProfileFields(profile) {
  return `
    ${textareaField("coreDifference", "核心意思／与同类的区别", profile.coreDifference || "")}
    ${textareaField("usageScene", "一般／适合使用场景", profile.usageScene || "")}
    ${textareaField("avoidScene", "不可或慎用场景", profile.avoidScene || "")}
    <div class="form-grid">
      ${inputField("polarity", "积极／消极倾向", profile.polarity || "中性（看语境）")}
      ${inputField("register", "文体／正式程度", profile.register || "普通・中性")}
    </div>`;
}

function openComparisonProfileEditor(expressionId) {
  const group = currentGroup();
  const item = group.expressions.find((candidate) => candidate.id === expressionId);
  if (!item) return;
  const profile = comparisonProfileFor(item);
  openDialog(`
    <form id="comparisonProfileForm" class="editor-form">
      <header><h3>修改辨析说明</h3><button class="icon-btn" type="button" data-close-dialog title="关闭" aria-label="关闭">×</button></header>
      <p class="modal-kicker"><span lang="ja">${renderJapaneseText(item.pattern)}</span> · ${escapeHtml(item.meaning)}</p>
      <p class="editor-help">这里仅修改本机“辨析矩阵”的说明，不会改动知识卡正文、接续或例句。</p>
      ${comparisonProfileFields(profile)}
      <footer><button class="secondary-btn" type="button" data-close-dialog>取消</button><button class="primary-btn" type="submit">保存辨析</button></footer>
    </form>`);
  $("comparisonProfileForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.custom.comparison.profiles[expressionId] = Object.fromEntries(["coreDifference", "usageScene", "avoidScene", "polarity", "register"].map((key) => [key, String(form.get(key) || "").trim()]));
    saveCustomContent();
    closeDialog();
    renderComparisonMatrix();
  });
}

function openComparisonSectionEditor() {
  const group = currentGroup();
  const current = activeComparisonSection();
  const isNew = !current || !current._customSection;
  const data = isNew ? { title: "", summary: "", expressionIds: [] } : current;
  openDialog(`
    <form id="comparisonSectionForm" class="editor-form">
      <header><h3>${isNew ? "新建辨析小类" : "修改辨析小类"}</h3><button class="icon-btn" type="button" data-close-dialog title="关闭" aria-label="关闭">×</button></header>
      <p class="editor-help">新建后，点击“添加表达”即可把新条目直接放进这个小类。内置词条仍保持原有分类，避免误改已校订内容。</p>
      ${inputField("title", "小类标题", data.title)}
      ${textareaField("summary", "这一小类的辨析重点", data.summary)}
      <footer><button class="secondary-btn" type="button" data-close-dialog>取消</button><button class="primary-btn" type="submit">保存小类</button></footer>
    </form>`);
  $("comparisonSectionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const summary = String(form.get("summary") || "").trim();
    if (!title || !summary) { alert("请填写小类标题和辨析重点。\n"); return; }
    const id = isNew ? `custom-section-${Date.now()}` : current.id;
    customComparisonSections(group.id)[id] = { id, title, summary, expressionIds: data.expressionIds || [], _customSection: true };
    state.comparisonSectionId = id;
    saveCustomContent();
    closeDialog();
    renderComparisonMatrix();
  });
}

function openExpressionEditor(mode, item = null, options = {}) {
  const group = currentGroup();
  const data = item || {
    level: "N3",
    pattern: "",
    variants: [],
    meaning: "",
    connection: "",
    collocation: "",
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
        ${inputField("variants", "表达变体（逗号分隔）", (data.variants || []).join("，"))}
        ${inputField("meaning", "意思", data.meaning)}
      </div>
      ${textareaField("connection", "接续（用；分隔多条规则，保存后显示为表格）", data.connection)}
      ${textareaField("collocation", "固定搭配", data.collocation || "")}
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
      assignExpressionToComparisonSection(group.id, id, options.comparisonSectionId);
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
  const variants = String(form.get("variants") || "").split(/[，,]/).map((value) => value.trim()).filter(Boolean);
  return {
    level: String(form.get("level") || "").trim(),
    pattern: String(form.get("pattern") || "").trim(),
    variants,
    meaning: String(form.get("meaning") || "").trim(),
    connection: String(form.get("connection") || "").trim(),
    collocation: String(form.get("collocation") || "").trim(),
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
  // Generated coverage for every Japanese pattern, collocation, and example
  // in the built-in library.  Hand-curated entries below take precedence.
  ...(globalThis.AUTO_FURIGANA_MAP || {}),
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
