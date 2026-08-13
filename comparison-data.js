/*
 * 辨析矩阵的人工分类与校订档案。
 * 本文件只整理学习说明；卡片正文仍由 content-data.js 和本机自定义内容驱动。
 */
(function () {
  const section = (id, title, summary, test) => ({ id, title, summary, test });
  const has = (pattern) => (item) => pattern.test(String(item.pattern || ""));

  const definitions = {
    reason: [
      section("neutral", "普通原因说明", "先分“直接说明”与“较柔和说明”；日常解释优先从这里选。", has(/^(から|ので|て\s*\/|なくて)/)),
      section("formal", "客观・正式归因", "报告、通知、分析中，把原因客观化、制度化地表述。", has(/ため|によって|につき|ゆえに/)),
      section("explain", "解释・辩解与背景", "说明不得已、补充背景或强调“既然如此”的理由。", has(/ものだから|ことだし|ことだから|のだから/)),
      section("evaluation", "结果评价与强调原因", "先看结果的正负倾向，再决定是否强调“正因为”。", has(/せい|おかげ|ばかりに|あまり|だけに|からこそ|ばこそ/)),
      section("basis", "由事实推断・责任", "由线索推论、提出依据，或把前项作为必须承担的前提。", has(/ことから|から\s*\/\s*ことから|からには|以上は|上は/))
    ],
    purpose: [
      section("movement", "移动目的", "去某处是为了做什么。", has(/に行く|^に$|先|に向かって/)),
      section("intentional", "有意志的目的", "主体主动为目标采取行动。", has(/ために|べく/)),
      section("state", "达成状态・避免状态", "重点是某状态能否实现，不是单纯意志动作。", has(/ように|には/))
    ],
    condition: [
      section("basic", "基础假定：たら・と・ば・なら", "先判断是一般条件、自然结果，还是承接话题给建议。", has(/^(たら|と（条件）|と$|ば$|なら$|のなら)/)),
      section("supposition", "假设推论与话题条件", "把尚不确定的情况作为前提，再作判断或评价。", has(/としたら|とすれば|となったら|となれば|となると|とあれば|ものなら|くらいなら/)),
      section("requirements", "必要・最低条件与依赖", "强调“满足这个条件才行”或“结果取决于什么”。", has(/さえ|限りは|次第|いかん|なしに|なくしては|以上$/)),
      section("risk", "消极后果・极端条件", "常预告坏结果、批评或不可逆后果。", has(/ては|ようものなら|たら最後|ようでは/)),
      section("special", "全面让步・特殊发现", "表示无论哪种条件都成立，或叙述发现、并列状态。", has(/うと|うが|と\.\.\.た|たら\.\.\.た|も\.\.\.ば|ば\.\.\.で|なら\.\.\.で/))
    ],
    concession: [
      section("basic", "普通转折", "日常对话中连接前后相反的信息。", has(/^(でも|けれども|けど)/)),
      section("emotion", "意外・不满的逆接", "说话人对结果感到意外、遗憾或不满。", has(/のに|と思いきや/)),
      section("formal", "客观・书面让步", "文章、报告中承认前项而突出后项。", has(/にもかかわらず|ものの|とはいえ|ながらも/)),
      section("hypothetical", "假定让步", "即使把条件推到极端，结论仍不变。", has(/たとえ|としても|といえども|にしたって/)),
      section("limit", "否定当然结论・例外", "限制从前项直接推出后项，或退一步说明。", has(/といっても|からといって|ないまでも|いざしらず/))
    ],
    guess: [
      section("likelihood", "可能性与一般推测", "按把握程度选择“也许”“大概”“按理”。", has(/でしょう|かもしれない|はずだ|のではないか|ともなく/)),
      section("certainty", "强判断・否定判断", "依据较强时断言；否定时注意不要把“不一定”说成“不可能”。", has(/に違いない|に相違ない|に決まっている|はずがない|とは限らない/)),
      section("risk", "风险与书面判断", "公告、新闻、分析里提示不良可能性。", has(/恐れ|おそれ|まい/)),
      section("appearance", "样态・比况与姿态", "从眼前样子、比喻或动作姿态判断。", has(/様態|んばかり|とばかりに/))
    ],
    hearsay: [
      section("hearsay", "传闻与转述", "信息来源是别人说的、通知或普遍说法。", has(/伝聞|とのこと|と言って|ということ|と言われ|とか/)),
      section("inference", "根据迹象判断", "不是转述：根据看见、感觉或线索作推测。", has(/ようだ|らしい|みたいだ/))
    ],
    obligation: [
      section("duty", "规则・一般义务", "从规则、常识或道理说“应该／必须”。", has(/なければならない|べきだ|たるもの/)),
      section("situation", "具体场景的必须", "眼前要求或责任使人不得不做。", has(/なくてはいけない|ないといけない|ないわけにはいかない|ないではすまない|ずにはすまない/)),
      section("forced", "无选择的被迫结果", "不是主动想做，而是客观上只能如此。", has(/ざるを得ない|余儀なく/))
    ],
    permission: [
      section("permission", "许可与不介意", "问或给许可时，区别“可以”和“不介意”。", has(/てもいい|てもかまわない|なくてもいい/)),
      section("ability", "能力・条件上的可能", "强调能不能做到、制度是否允许，而非他人许可。", has(/できる|可能形|見え|聞こえ/)),
      section("reserved", "保留余地与无从实现", "肯定空间很小，或方法本身不存在。", has(/ないことはない|ようもない/))
    ],
    prohibition: [
      section("direct", "直接禁止与礼貌劝阻", "明确规定不能做，或礼貌请对方不要做。", has(/てはいけない|ないでください/)),
      section("norm", "道理上的不该", "是评价或规范建议，不等于现场命令。", has(/べきではない|ものではない/)),
      section("written", "公告式禁止・书面否定", "标语、规章或书面否定，不用于普通闲聊。", has(/べからず|ず\s*\/\s*ぬ/))
    ],
    change: [
      section("state", "状态变化与人为改变", "分清自己变化、有人使其变化、能力／习惯变化。", has(/くなる|になる|くします|にします|ようになる|する\s*\/\s*なる/)),
      section("decision", "决定・规定与机制", "谁作决定、是否是规定、是否是事物本来的设计。", has(/ことになる|ことになっている|ことになった|ようになっている/)),
      section("progress", "渐进变化与趋势", "变化正在发展、随某事推进，或从过去延伸到现在。", has(/つつある|ばかりだ|一方だ|につれて|にしたがって|に伴って|とともに|ていく|てくる|に従/)),
      section("start", "动作开始与时间方向", "动作刚开始、突然开始，或向未来／现在靠近。", has(/始める|出す|ていく\s*\/\s*てくる/))
    ],
    comparison: [
      section("basic", "基础比较", "用基准比较高低、强弱与选择。", has(/より|ほど|どちら/)),
      section("contrast", "对比・重新定位", "拿两项对照，强调真正更贴切的一项。", has(/に比べて|にもまして|というより|よりむしろ/))
    ],
    degree: [
      section("amount", "程度・数量的基准", "表达大概程度、数量或分配。", has(/とても|くらい|ぐらい|ほど|ずつ|からある|からする|からの/)),
      section("limit", "极端程度与界限", "强调没有更…、超过限度，或程度随条件变化。", has(/ば\.\.\.ほど|すぎ|はない/)),
      section("interval", "间隔与重复单位", "按固定间隔、每隔若干单位发生。", has(/おきに|ごとに/))
    ],
    limitation: [
      section("basic", "数量・范围限定", "只、仅、到此为止等基本限制。", has(/だけ$|しか|にすぎない|きり|にもならない/)),
      section("exception", "例外与特殊限定", "限定某种条件、特例或只有它才有的价值。", has(/に限る|に限り|に限って|ならでは|をおいて/)),
      section("not-only", "不限于与递进扩展", "从“不只如此”扩展到更广范围。", has(/に限らず|にかぎらない|にとどまらず|はおろか|もさることながら|だけ\s*\/\s*でも/))
    ],
    intention: [
      section("plan", "计划・个人决定", "本人打算、已经决定，或有明确日程。", has(/つもり|予定|ことにする|ことにした|にします|ことにします/)),
      section("attempt", "正要做・尝试做", "动作即将开始、正在尝试，或迟迟不发生。", has(/ようと思|ようとする|ようとして|としない/)),
      section("mindset", "以…心态行动", "把某种想法当作行动方式。", has(/つもりで/))
    ],
    desire: [
      section("basic", "基础愿望与希望", "自己想要、想做，或希望别人做。", has(/ほしい|たい|てほしい|がほしい|たがる|がります/)),
      section("wish", "祝愿・委婉愿望", "祝福、建议、希望实现，语气较柔和。", has(/といい|ばいい|たらいい|たいものだ|てほしいものだ|ないものだろうか|てやまない/)),
      section("strong", "强烈感情与不可抑制", "感情强到难以控制，不要当作普通“想做”。", has(/てしかた|てしょうが|てならない|いられない|に堪えない|禁じ得ない|限りだ|ことに|ことか|仕様がない|しようがない/))
    ],
    request: [
      section("basic", "基础请求与邀请", "直接请对方做事，或提出一起做的邀请。", has(/てください|ませんか|ましょうか/)),
      section("polite", "礼貌请求", "向不熟的人、上级或正式对象提出请求。", has(/てもらえませんか|ていただけませんか|願えません/)),
      section("humble", "谦逊的许可请求", "请求允许自己做某事；避免无必要地过度自谦。", has(/させていただきたい|てもらいたい|ていただきたい|させてもらいたい|させてほしい/))
    ],
    advice: [
      section("soft", "柔和建议", "给对方保留选择空间的建议。", has(/ほうがいい|たらどう/)),
      section("strong", "义务式建议与命令", "语气更强，注意关系和场合。", has(/ことだ|なさい|ないと|命令形|禁止形|べき/)),
      section("formal", "正式提案与最优选择", "书面倡议或强调“这样最好”。", has(/越した|ようではないか/))
    ],
    experience: [
      section("experience", "经历与尝试", "说过去有无经验，或建议先试试看。", has(/たことがある|てみる|たことがあります|てみます/)),
      section("process", "回忆习惯・动作未完／重做", "动作进行到一半、重新做，或回忆过去常态。", has(/ものだ|かける|直す/))
    ],
    sequence: [
      section("order", "先后顺序", "先完成前项，再做后项；区分前后与条件。", has(/てから|前に|てからでないと|上で/)),
      section("simultaneous", "同时・时间窗口", "两事并行，或在状态改变前抓住时机。", has(/ながら|うちに|間|つつ|かたわら/)),
      section("repeated", "刚做完又…／每次都…", "强调重复、紧接发生或顺便完成。", has(/そばから|たびに|てはじめて|がてら|かたがた/)),
      section("contrast", "做与不做的并列", "区分做了再做、没做就做，以及地点／阶段。", has(/て\.\.\.\s*\/\s*ないで|ところ/))
    ],
    result: [
      section("link", "结果连接与结论", "用连接词或结论词串起前因后果。", has(/それで|だから|その結果|結局/)),
      section("completion", "完成・遗憾结果", "事情完成、终于结束，或带后悔和未竟感。", has(/てしま|末に|ずじまい|終わる|切る|切れる|切れない|なくて済む|きれない/)),
      section("state", "导致的状态与极端结果", "后项是不可避免的状态、批评性的结果或强制效果。", has(/ことになります|になります|に至|始末|っぱなし|ないではおかない|ずにはおかない|てみせる/)),
      section("time", "终于・最终的时间副词", "区别终于达成、最终发生和即将进入。", has(/やっと|ようやく|とうとう|ついに|いよいよ/))
    ],
    emphasis: [
      section("focus", "焦点强调", "把某一项凸显为重点、唯一或真正原因。", has(/も$|こそ|にほかならない|にして/)),
      section("minimum", "极端数量与最低单位", "连…都、哪怕…也不，强调范围极端。", has(/さえ|まで|として|たりとも|すら|だに/)),
      section("colloquial", "口语化举例与强调", "日常会话中带评价、轻视或随意举例。", has(/など|なんか|なんて|だって|も\s*\/\s*しか/))
    ],
    explanation: [
      section("reason", "说明与纳得", "说明背景、归纳结论或指出理所当然。", has(/んです|ということだ|わけだ|というものだ/)),
      section("negation", "部分否定与不可能", "不是完全否定；区分“不一定”“不可能”“不能做”。", has(/わけではない|わけがない|わけにはいかない|ものか|というものではない/)),
      section("rephrase", "换句话说与强转折", "修正说法、补充限定或否定前项到更强程度。", has(/の\s*\/\s*こと|ことは|というか|どころ/))
    ],
    basis: [
      section("source", "信息来源与依据", "说明消息来自哪里、判断基于什么。", has(/によると|によれば|から見る|をもとに|に基づいて|に沿って/)),
      section("condition", "取决于与对应", "结果随条件、对象或标准而变化。", has(/によって|いかん|に応じて|限りでは/)),
      section("evaluation", "从一点即可判断", "从一个例子或前提出发评价整体。", has(/からして|とおり|あっての/))
    ],
    time: [
      section("stage", "动作阶段与时点", "正要、正在、刚完成、在某一时点。", has(/ところだ|ばかりだ|最中|際に|に際して|にあたって|にあって/)),
      section("immediate", "紧接发生", "两个动作几乎没有间隔；多用于叙述。", has(/たとたん|が早いか|かないか|や否や|なり/)),
      section("change", "反复・长期变化", "每逢某事、从某时起，或随着接触而产生变化。", has(/たびに|かと思|からというもの|につけて|ぶり/))
    ],
    contrast: [
      section("comparison", "对照两方", "把两方按同一标准对照说明。", has(/一方で|反面|に対して|にひきかえ|に対する/)),
      section("replacement", "替代・排除与例外", "用一个替代另一个，或先排除一个话题。", has(/かわりに|にかわって|にかわり|は別として/)),
      section("basic", "基础转折", "最基本的句内对比连接。", has(/^が$/))
    ],
    topic: [
      section("topic", "提出话题与范围", "把对象作为谈论主题或讨论范围。", has(/^は$|について|に関して|とは$/)),
      section("viewpoint", "从立场・对象看", "从某个角度、对象或需求出发。", has(/からいうと|にこたえて|向け|にかかっては/)),
      section("shift", "转换话题与暂不讨论", "先把某点搁置、转到新话题或突出一个对象。", has(/ともかく|さておき|というと|といえば|といったら|となると|ときたら|ともなると|ともなれば/)),
      section("reference", "指示词与疑问范围", "指代信息、区分主题与主语，或扩大疑问范围。", has(/は\s*\/\s*が|こ・そ・あ|こ・そ・あ・ど|疑问词/))
    ],
    example: [
      section("simple", "普通举例", "列举代表项，不表示穷尽。", has(/など|ような|といった|というような|たり/)),
      section("representative", "以…为代表", "从代表项扩展到同类整体。", has(/をはじめ/)),
      section("multiple", "并列举例与让步", "列多个项目、给任选项，或列出不同立场。", has(/といい|やら|にしても|にしろ|にせよ|なり|といわず/))
    ],
    means: [
      section("method", "方法・手段", "用什么方法、媒介或渠道完成动作。", has(/^で$|によって|を通して|方|ことで/)),
      section("formal", "正式手段与条件", "书面中说明依据、环境或郑重方式。", has(/をもって|のもとで|のもとに/)),
      section("feeling", "回应与投入感情", "回应期待，或把感情注入动作。", has(/をこめて|に答えて|に応えて/))
    ],
    causeeffect: [
      section("starting", "起点与契机", "从某事开始、以某事为转机发生改变。", has(/から（起点）|きっかけ|を機に|契機/)),
      section("forced", "迫使发生的后果", "外部因素使人不得不进入某种状态。", has(/余儀なく/))
    ],
    respect: [
      section("respect", "尊敬语：抬高对方", "对方或第三方的动作，用尊敬表达。", has(/お\/ご\.\.\.になる|尊敬语|いらっしゃる|おっしゃる|なさる|お\/ご〜です|ご\s*\/\s*お〜ください/)),
      section("humble", "自谦语：降低自己一方", "自己或己方动作面向对方时使用。", has(/お\/ご\.\.\.する|させていただく|いたす|参る|拝見|存じる|伺う|お目にかける|ご覧に入れる/)),
      section("giving", "授受关系", "先判断动作方向：谁给谁、谁受益。", has(/あげ|くれ|もら|さしあげ|くださ|いただ|やる/)),
      section("voice", "受身・使役与形式", "语态变化不等同于敬语；先确定施事和受事。", has(/受身|使役|られる|ございます|ござる/))
    ],
    counterfactual: [
      section("regret", "反事实・后悔", "事实已不同于假设，表达后悔或差点发生。", has(/ばよかった|ところだった/)),
      section("emphasis", "正因为过去条件", "强调过去条件是现在结果成立的关键。", has(/ていればこそ/))
    ],
    irrelevance: [
      section("concession", "即使…也不变", "无论程度多高，后项结论仍然成立。", has(/^ても$|いくら/)),
      section("formal", "不问条件的正式表达", "通知、规则、说明中强调不受条件影响。", has(/を問わず|いかん|にかかわり/)),
      section("regardless", "不顾…／排除外界", "不理会条件、困难或周围反应而行动。", has(/もかまわず|であれ|であろうと|ものともせず|をよそに/))
    ],
    difficulty: [
      section("ease", "客观难易与心理困难", "事情本身难不难，还是说话人心理上难以做。", has(/にくい|やすい|づらい|がたい/)),
      section("polite", "正式婉拒与可能性", "商务中委婉说难以答应，或理论上能否发生。", has(/かねる|得る|得ない|べくもない/)),
      section("unable", "无法继续・无法做到", "客观条件使动作做不了、不能拖下去或难以完成。", has(/どころではない|ようにもない|てはいられない|抜く|てたまらない|にかたくない/))
    ],
    evaluation: [
      section("position", "立场与身份", "作为谁、对谁而言、从谁的角度评价。", has(/^として$|にとって|からすれば|にしたら|にすれば|にしてみれば|にしても/)),
      section("expectation", "预期与实际的落差", "按某标准看，结果出乎预期。", has(/にしては|わりに|だけのことはある|ともあろう|なりに/)),
      section("value", "价值、倾向与强烈评价", "评价是否值得、常有的倾向或感情强度。", has(/きらいがある|に足る|に堪える|に堪えない|といったらない|極まる|極まりない|には当たらない|ところを見ると/))
    ],
    sentence_end: [
      section("judgement", "一般论与评价判断", "感慨、常识、批评或“又不是…”的判断。", has(/ものだ|ものではない|ではあるまいし|でなくてなんだろうか/)),
      section("resolve", "最后手段与不可逆结果", "表示只能如此，或一发生就无可挽回。", has(/までだ|ばそれまでだ/)),
      section("tone", "文末语气", "语气、性别感和亲疏关系优先于字面翻译。", has(/ね|かな|かしら|な|わよ|わね|のね|のよ|ぞ|ぜ/))
    ],
    range: [
      section("deadline", "期限与终点", "持续到何时，还是必须在何时前完成。", has(/まで|限りに/)),
      section("span", "范围延展与覆盖", "时间、空间、对象扩展到何种程度。", has(/にわたって|に至るまで|にかけて|における|において/)),
      section("start", "以…为开端与大致范围", "从一个起点展开，或保守估计范围。", has(/皮切り|といったところ/))
    ],
    article_flow: [
      section("reason", "解释原因与结论", "文章中提出理由、归纳结论并使逻辑闭合。", has(/というのは|なぜなら|なぜかというと|したがって|そこで|つまり|すなわち/)),
      section("contrast", "对比与转折连接", "对照前后信息，避免把所有转折都当成同一种语气。", has(/それに対して|一方|しかし|だが|ところが/)),
      section("addition", "补充、选择与话题转移", "添加信息、给出选择、附加条件或换话题。", has(/しかも|そのうえ|それに|または|あるいは|ただ|ただし|なお|ところで/))
    ],
    state: [
      section("keep", "状态保持与准备结果", "状态自然持续，还是人为做完后留下的结果。", has(/まま|ています|てあります|てある/)),
      section("formal", "保持原状的书面表达", "用较书面的方式强调“不改变状态”。", has(/ながらにして/))
    ],
    addition: [
      section("listing", "并列列举与相互动作", "列出理由、性质或彼此共同做的动作。", has(/し\.\.\.し|合う/)),
      section("increment", "递进添加", "在前项基础上再增加一层信息。", has(/ばかりでなく|だけではなく|うえに|はもちろん|に加えて/))
    ],
    quote: [
      section("content", "疑问内容与引用", "把问题或他说的话嵌入一个大句。", has(/か\s*\/\s*かどうか|を\s*\/\s*と|って/)),
      section("definition", "名称、内容与转述要求", "说明“所谓…”或转述命令、要求。", has(/という|引用内容/))
    ],
    preparation: [section("prepare", "事先准备与保持", "为之后预先做，或有意把状态放着。", has(/ておき|ておく/))],
    habit: [
      section("habit", "努力形成习惯", "有意识坚持、让自己做到。", has(/ようにする/)),
      section("tendency", "反复与不良倾向", "经常发生且常含批评或不理想评价。", has(/てばかりいる|がちだ/)),
      section("continue", "持续动作", "动作继续进行，不等于状态自己持续。", has(/続ける/))
    ],
    necessity: [section("only", "别无选择", "没有替代方案，只能采取前项。", has(/しかない|よりほかない|よりしかたがない/))]
  };

  const manualProfiles = {
    "reason-0-から": { coreDifference: "说话人直接给出自己的理由；比「ので」更主观、直接。", usageScene: "日常说明个人判断、一般理由。", avoidScene: "对上级解释过失时语气可能偏硬，慎用。", register: "日常口语常用", polarity: "中性" },
    "reason-1-ので": { coreDifference: "把理由说得更客观、柔和；常用于礼貌说明。", usageScene: "礼貌解释、较客观的理由说明。", avoidScene: "无语法禁用；强烈断言、强硬辩解时不如「から」直接。", register: "普通・礼貌", polarity: "中性" },
    "reason-2-ために": { coreDifference: "将原因客观化，常写进说明、报告，负面结果尤常见。", usageScene: "通知、报告、分析原因。", avoidScene: "轻松闲聊或主观辩解不自然；正面结果不宜机械套用。", register: "书面・正式", polarity: "多见负面结果" },
    "reason-4-せいで": { coreDifference: "带归责感：把不良结果归到前项。", usageScene: "说明坏结果、抱怨或归因。", avoidScene: "正面结果不可用；中性客观报告慎用。", register: "普通", polarity: "消极" },
    "reason-5-ばかりに": { coreDifference: "“只因为这一点”竟导致坏结果，后悔感强。", usageScene: "叙述小原因引发的不幸结果。", avoidScene: "正面或无关痛痒的结果不可用。", register: "普通・叙述", polarity: "消极" },
    "reason-12-おかげだ-せいだ": { coreDifference: "「おかげ」感谢／正面；「せい」归责／负面。", usageScene: "明确评价结果好坏时使用。", avoidScene: "把两者与相反结果搭配不可。", register: "普通", polarity: "按词条内正负区分" },
    "reason-23-からこそ": { coreDifference: "正因为前项成立，后项才格外成立；强调原因。", usageScene: "感谢、主张、肯定评价的强调理由。", avoidScene: "平铺直叙的普通因果无需使用；不宜误当普通「から」。", register: "普通・强调", polarity: "多用于正面强调" },
    "reason-24-なくて": { coreDifference: "原因后项多是自然结果、感情或可能状态。", usageScene: "说明做不到、感到困扰等自然结果。", avoidScene: "后项不可接强意志命令、请求。", register: "日常", polarity: "中性" },
    "condition-1-と": { coreDifference: "表示一发生就自然如此的规律、操作或习惯。", usageScene: "自然结果、机器操作、反复规律。", avoidScene: "后项不可接说话人的意志、命令、请求。", register: "普通", polarity: "中性" },
    "condition-0-たら": { coreDifference: "最通用：假定，也可表示前项完成后再做后项。", usageScene: "日常假设、顺序、建议。", avoidScene: "规律性自然结果的说明不如「と」典型。", register: "日常・普通", polarity: "中性" },
    "condition-3-なら": { coreDifference: "承接对方提到的话题，再给建议或判断。", usageScene: "“如果说的是…的话”这一话题条件。", avoidScene: "单纯时间先后不可用。", register: "日常・会话", polarity: "中性" },
    "concession-2-のに": { coreDifference: "前后反差带说话人的意外、遗憾或不满。", usageScene: "表达感情化的反常结果。", avoidScene: "客观报告、正式公文慎用；不能只当中性“但是”。", register: "普通・感情性", polarity: "常含负面情绪" },
    "concession-3-にもかかわらず": { coreDifference: "正式、客观地承认前项事实，仍突出后项。", usageScene: "报告、新闻、书面说明。", avoidScene: "随意闲聊显得过正式；不突出情绪。", register: "书面・正式", polarity: "中性" },
    "purpose-1-ために": { coreDifference: "为了主动实现目标；前后主体通常一致。", usageScene: "本人有意志地为目标行动。", avoidScene: "前项为无意志状态或主体不同，通常不可用，应考虑「ように」。", register: "普通", polarity: "中性" },
    "purpose-2-ように": { coreDifference: "为使某状态实现或避免发生；主体可不同。", usageScene: "能力、状态、避免、委托类目的。", avoidScene: "主动明确目标的场合不必硬换成「ように」。", register: "普通", polarity: "中性" }
  };

  const fallbackProfile = (item) => {
    const flags = item.usageFlags || {};
    const nuance = String(item.nuance || "").replace(/；/g, "；");
    const written = flags.written || /书面|正式|论文|通知|公文|硬/.test(nuance);
    const spoken = flags.spoken || /口语|日常|聊天/.test(nuance);
    const polarity = flags.negative && flags.positive ? "按语境可正可负" : flags.negative ? "消极／不良结果" : flags.positive ? "积极／正面" : "中性（看语境）";
    const register = written ? "书面・正式" : spoken ? "日常・口语" : "普通・中性";
    const avoid = /不可|不能|不接/.test(nuance)
      ? `不可：${nuance.match(/(?:不可|不能|不接)[^；。]*/)?.[0] || nuance}`
      : written ? "慎用：轻松闲聊中可能显得过正式。" : "无特别禁用；按接续和语境使用。";
    return {
      coreDifference: nuance || item.meaning || "根据前后句的意义与接续选择。",
      usageScene: written ? "说明、报告、书面叙述。" : spoken ? "日常会话和一般说明。" : "一般会话与写作；结合前后语境。",
      avoidScene: avoid,
      register,
      polarity
    };
  };

  const sourceGroups = typeof GRAMMAR_GROUPS !== "undefined" ? GRAMMAR_GROUPS : [];
  const groups = sourceGroups.map((group) => {
    const defs = definitions[group.id] || [];
    const used = new Set();
    const sections = defs.map((definition) => {
      const ids = group.expressions.filter((item) => !used.has(item.id) && definition.test(item)).map((item) => item.id);
      ids.forEach((id) => used.add(id));
      return { id: definition.id, title: definition.title, summary: definition.summary, expressionIds: ids };
    }).filter((entry) => entry.expressionIds.length);
    const remaining = group.expressions.filter((item) => !used.has(item.id)).map((item) => item.id);
    if (remaining.length) sections.push({ id: "supplement", title: "补充・易混表达", summary: "放入当前分类中不属于前述核心小组的表达；先查看知识卡的完整语境。", expressionIds: remaining });
    return { groupId: group.id, sections };
  });

  globalThis.GRAMMAR_COMPARISON_DATA = {
    groups: Object.fromEntries(groups.map((group) => [group.groupId, group.sections])),
    profiles: manualProfiles,
    fallbackProfile
  };
})();
