const USAGE_BADGES_V2 = {
  negative: { character: "消", label: "消极 / 负面倾向" },
  positive: { character: "积", label: "积极 / 正面倾向" },
  spoken: { character: "口", label: "口语 / 日常会话" },
  written: { character: "书", label: "书面 / 正式表达" }
};

function normalizeUsageFlagsV2(item = {}) {
  const current = item.usageFlags || {};
  return {
    ...deriveUsageFlagsV2(item),
    ...Object.fromEntries(Object.keys(USAGE_BADGES_V2).map((key) => [key, Boolean(current[key])]))
  };
}

function deriveUsageFlagsV2(item = {}) {
  const text = [
    item.pattern,
    item.meaning,
    item.nuance,
    item.sourceBook,
    item.sourceLesson,
    ...(item.tags || [])
  ].join(" ");
  return {
    negative: /消极|负面|不满|遗憾|责备|批评|言い訳|不良过程|坏结果|失误|常负面|多负面|负担|痛苦/.test(text),
    positive: /积极|正面|多亏|感谢|祝福|庆幸|好结果/.test(text),
    spoken: /口语|日常会话|日常用语|聊天|随意说法|较口语/.test(text),
    written: /书面|正式|文章|论文|公文|通知|新闻|制度性|书写语言|硬朗|文语|商务/.test(text)
  };
}

function renderUsageBadgesV2(flags = {}) {
  return `<span class="usage-badges">${Object.entries(USAGE_BADGES_V2).filter(([key]) => flags[key]).map(([key, badge]) => `
    <span class="usage-badge usage-badge--${key}" title="${badge.label}" aria-label="${badge.label}">${badge.character}</span>
  `).join("")}</span>`;
}

function usageFlagLabelsV2(flags = {}) {
  return Object.entries(USAGE_BADGES_V2).filter(([key]) => flags[key]).map(([, badge]) => badge.label);
}

mergeExpression = function(item, userAdded) {
  const edit = state.custom.edits[item.id] || {};
  const note = state.custom.notes[item.id] ?? edit.userNote ?? item.userNote ?? "";
  const merged = {
    ...item,
    ...edit
  };
  return {
    ...merged,
    usageFlags: normalizeUsageFlagsV2(merged),
    userNote: note,
    _userAdded: userAdded,
    _customized: Boolean(userAdded || Object.keys(edit).length || note)
  };
};

searchableExpressionText = function(item) {
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
    ...usageFlagLabelsV2(item.usageFlags),
    ...(item.tags || [])
  ].join(" ").toLowerCase();
};

renderExpressions = function(group, expressions) {
  $("expressionLadder").innerHTML = expressions.length ? expressions.map((item) => {
    const profile = usageProfile(item);
    const usageBadges = renderUsageBadgesV2(item.usageFlags);
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
};

openExpressionEditor = function(mode, item = null) {
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
      ${usageFlagFieldsV2(data.usageFlags)}
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
};

expressionPayloadFromForm = function(form) {
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
    usageFlags: Object.fromEntries(Object.keys(USAGE_BADGES_V2).map((key) => [key, form.get(`usage-${key}`) === "on"])),
    userNote: String(form.get("userNote") || "").trim()
  };
};

function usageFlagFieldsV2(flags = {}) {
  return `<fieldset class="usage-flag-fields">
    <legend>语气 / 文体徽章（勾选后显示在卡片顶部）</legend>
    ${Object.entries(USAGE_BADGES_V2).map(([key, badge]) => `<label class="usage-flag-option usage-flag-option--${key}">
      <input type="checkbox" name="usage-${key}"${flags[key] ? " checked" : ""}>
      <span class="usage-badge usage-badge--${key}" aria-hidden="true">${badge.character}</span>
      <span>${badge.label}</span>
    </label>`).join("")}
  </fieldset>`;
}

render();
