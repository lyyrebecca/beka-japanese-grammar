# 贝卡的紫藤日语语法翻译训练天地

**Beka's Wisteria Japanese Grammar & Translation Practice**

[打开在线网站 / Open the live site](https://lyyrebecca.github.io/beka-japanese-grammar/)

一个面向日语学习者的免费静态学习网页，用来把 JLPT N5-N1 常见语法按“意义功能”整理起来，并配套中文到日语的翻译练习、语法辨析、例句、错题标记和动词/形容词变形速查。

A free static web app for Japanese learners. It organizes JLPT N5-N1 grammar by meaning and function, then connects each grammar point with Chinese-to-Japanese translation drills, usage notes, example sentences, review markings, and a conjugation reference.

## 这个网站是做什么的？

很多日语语法书按等级或课文顺序排列，但真正写句子、翻译句子时，学习者更常遇到的问题是：

- “我想表达原因，应该用 `から`、`ので`、`ために`、`ものだから` 还是 `ことから`？”
- “同样是推量、转折、条件、目的，哪些表达更口语，哪些更书面？”
- “这个中文句子翻成日语时，应该优先选哪个句型？”
- “动词接续、た形、ない形、て形、使役、受身、可能形到底怎么变？”

这个项目把语法点放回这些真实使用场景中，帮助学习者从“背条目”转向“按意思选择表达”。

## What is this website for?

Many Japanese grammar resources are arranged by textbook lesson or JLPT level. In actual writing and translation, learners often need a different path:

- choosing among similar expressions for cause, purpose, contrast, condition, inference, explanation, limitation, and emphasis;
- understanding which pattern sounds casual, written, formal, subjective, objective, or explanatory;
- practicing Chinese-to-Japanese sentence translation with the target grammar;
- checking verb, adjective, noun, passive, causative, potential, `te`, `ta`, and `nai` forms quickly.

This project is designed to help learners choose grammar by meaning, not only memorize grammar by list.

## 主要功能 / Features

- **意义功能分类**：按原因、目的、条件、逆接、推量、传闻、义务、许可、比较、限定、结果、强调等功能组织语法。
- **JLPT N5-N1 覆盖**：适合从初级到高级的系统复习，也适合考前查漏补缺。
- **翻译闯关**：用中文句子触发日语输出练习，帮助学习者主动调用句型。
- **易混辨析**：把相近语法放在同一语义场里比较，减少“会背但不会选”的问题。
- **本地进度与自定义内容**：学习进度、错题、自定义条目和笔记保存在浏览器本机，不需要登录。
- **变形规则速查**：提供基本形、礼貌形、否定形、过去形、て形、条件形、可能/受身/使役等规则参考。
- **纯静态网页**：HTML/CSS/JavaScript 实现，可直接通过 GitHub Pages 访问。

## v2 更新：语气与文体徽章 / Usage Badges

- 卡片顶部新增四种圆形徽章：红圈「消」表示消极/负面倾向，绿圈「积」表示积极/正面倾向，黄圈「口」表示口语/日常会话，蓝圈「书」表示书面/正式表达。
- 内置知识点只在已有语感、标签或来源信息给出明确线索时才预标注；证据不足的卡片保持空白，避免把普通表达误读成褒贬或固定文体。
- 新增语法条目或修改知识卡片时，可独立勾选四类徽章。设置会保存在浏览器本机的 `jp-grammar-custom-content-v1` 中。
- 页面“备份 / 恢复”会携带学习进度、笔记、自定义条目及徽章设置；v2 仍可导入 v1 备份 JSON。

The v2 release adds four optional badges to make usage cues visible at a glance: negative, positive, spoken, and written/formal. Built-in cards are labelled conservatively, and custom cards can choose each badge independently. Everything remains browser-local and travels with Backup / Restore files.

## 数据规模 / Content Scale

当前版本包含：

- **43 个意义功能分类**
- **400+ 个语法表达**
- 覆盖 **JLPT N5、N4、N3、N2、N1**
- 语法接续、语感说明、例句、翻译练习、同义/近义辨析

Current version includes:

- **43 meaning-based grammar groups**
- **400+ grammar expressions**
- coverage across **JLPT N5, N4, N3, N2, and N1**
- connection patterns, usage notes, examples, translation prompts, and comparison notes

## 适合谁使用？

这个网站适合：

- 正在准备 JLPT N5-N1 的学习者；
- 学完语法但写句子时不知道选哪个表达的人；
- 做中译日、日语翻译练习、作文练习的人；
- 想按“意思功能”复习日语语法的人；
- 想快速查日语动词和形容词变形规则的人；
- 教日语、整理语法讲义或制作练习材料的人。

This website is useful for:

- JLPT N5-N1 learners;
- learners who know grammar patterns but struggle to choose the right one in writing;
- Chinese-to-Japanese translation practice;
- Japanese composition and sentence-building practice;
- meaning-based Japanese grammar review;
- quick Japanese conjugation lookup;
- teachers or self-learners organizing grammar notes and practice materials.

## 如何使用 / How to Use

1. 打开网站：[https://lyyrebecca.github.io/beka-japanese-grammar/](https://lyyrebecca.github.io/beka-japanese-grammar/)
2. 从左侧选择一个意义分类，比如“原因・理由”“条件・仮定”“逆接・譲歩”。
3. 阅读表达梯度、接续规则、例句和辨析。
4. 在翻译闯关中输入自己的日语译文。
5. 用“变形规则速查”页面检查动词、形容词和名词的变形。

1. Open the site: [https://lyyrebecca.github.io/beka-japanese-grammar/](https://lyyrebecca.github.io/beka-japanese-grammar/)
2. Choose a meaning group from the sidebar, such as cause, condition, contrast, purpose, or inference.
3. Read the grammar ladder, connection rules, examples, and comparison notes.
4. Practice by translating Chinese prompts into Japanese.
5. Use the conjugation reference page when you need a quick form check.

## 离线使用与备份 / Offline Use and Backup

不想通过在线网站学习，也可以下载完整的网站文件，在本机离线打开和使用：

1. 下载 [完整离线文件 ZIP / Download the complete ZIP](https://github.com/lyyrebecca/beka-japanese-grammar/archive/refs/heads/main.zip)。
2. 解压后双击打开 `index.html`，无需安装软件、无需联网、无需账号。
3. 所有语法数据、页面样式、变形速查和图片资源都已经包含在下载包内；`conjugation.html` 可单独打开。
4. 你的练习记录、笔记和新增条目会保存在当前浏览器和当前网站地址中。定期点击页面右上角的“备份”，保存导出的 JSON 文件；在同一台或另一台电脑打开网站后，点击“恢复”即可找回。

You can also use the whole site offline:

1. [Download the complete ZIP](https://github.com/lyyrebecca/beka-japanese-grammar/archive/refs/heads/main.zip).
2. Unzip it and open `index.html` in a browser. No installation, account, or connection is required.
3. The download contains the grammar data, styles, conjugation reference, and image assets. `conjugation.html` can be opened separately.
4. Progress, notes, and custom entries stay in the current browser and site location. Use the **Backup** button regularly to save a JSON file, then use **Restore** to move it to another computer or recover it later.

## 隐私说明 / Privacy

这个项目是纯静态网页，不需要注册账号，也不会把你的练习内容上传到服务器。学习进度、自定义语法条目、笔记和错题标记保存在你自己的浏览器本机。它们不会自动同步到 GitHub；请用“备份 / 恢复”功能自行保留和迁移。

This is a static website. It does not require an account, and it does not upload your practice answers to a server. Your progress, custom entries, notes, and review markings are stored locally in your own browser. They are not automatically synced to GitHub, so use Backup / Restore when you want to keep or move them.

## 技术栈 / Tech Stack

- HTML
- CSS
- JavaScript
- GitHub Pages
- Browser `localStorage`
- JSON backup and restore for local learning records

## 搜索关键词 / Search Keywords

日语语法, 日语学习, 日语翻译练习, 中译日, JLPT N5, JLPT N4, JLPT N3, JLPT N2, JLPT N1, 日语变形, 动词变形, 语法辨析, 日语作文, Japanese grammar, Japanese learning, JLPT grammar, Japanese translation practice, Chinese to Japanese translation, Japanese conjugation, Japanese sentence practice, meaning-based grammar, grammar comparison.

## Project Links

- Live site: [https://lyyrebecca.github.io/beka-japanese-grammar/](https://lyyrebecca.github.io/beka-japanese-grammar/)
- Conjugation reference: [https://lyyrebecca.github.io/beka-japanese-grammar/conjugation.html](https://lyyrebecca.github.io/beka-japanese-grammar/conjugation.html)
- Offline ZIP: [https://github.com/lyyrebecca/beka-japanese-grammar/archive/refs/heads/main.zip](https://github.com/lyyrebecca/beka-japanese-grammar/archive/refs/heads/main.zip)

## License

This repository is published as a learning and reference project. If you reuse or adapt the materials, please keep attribution and respect the educational purpose of the project.
