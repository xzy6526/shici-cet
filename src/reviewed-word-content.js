const example = (sentence, translation) => ({
  sentence,
  translation,
  source: '项目自有示例',
  sourceType: 'editorial_example',
  sourceVerified: false,
});

export const reviewedWordContent = {
  maintain: {
    phoneticUK: '/meɪnˈteɪn/', phoneticUS: '/meɪnˈteɪn/',
    partsOfSpeech: [{ pos: 'verb', meanings: [
      { meaning: '维持；保持', explanation: '让一种状态继续保持下去。', priority: 'cet_high' },
      { meaning: '维修；保养', priority: 'secondary' },
      { meaning: '坚称；主张', priority: 'rare' },
    ] }],
    plainExplanation: '让一种状态继续保持下去。',
    exampleSentences: [example('The team worked to maintain a steady pace.', '团队努力保持稳定的节奏。')],
    collocations: [{ phrase: 'maintain balance', meaning: '保持平衡' }, { phrase: 'maintain contact', meaning: '保持联系' }, { phrase: 'maintain stability', meaning: '维持稳定' }],
    memoryTip: '和 balance、contact、stability 一起记：核心都是“让状态继续”。',
    wordFamily: [{ word: 'maintenance', meaning: '维护；保养' }],
    synonyms: ['preserve', 'sustain'], tags: ['CET-4'], examExamples: [],
  },
  issue: {
    phoneticUK: '/ˈɪʃuː/', phoneticUS: '/ˈɪʃuː/',
    partsOfSpeech: [
      { pos: 'noun', meanings: [{ meaning: '问题；议题', explanation: '需要讨论或解决的一件事情。', priority: 'cet_high' }, { meaning: '一期刊物', priority: 'secondary' }] },
      { pos: 'verb', meanings: [{ meaning: '发布；发行', priority: 'secondary' }] },
    ],
    plainExplanation: '需要讨论或解决的一件事情。',
    exampleSentences: [example('Cost remains a major issue for many students.', '费用仍是许多学生面临的一个主要问题。')],
    collocations: [{ phrase: 'address an issue', meaning: '处理问题' }, { phrase: 'raise an issue', meaning: '提出问题' }],
    memoryTip: '先记名词“问题”，再把 issue a notice 作为动词“发布”一起区分。',
    wordFamily: [{ word: 'reissue', meaning: '重新发行' }],
    confusableWords: [{ word: 'problem', meaning: '更强调需要解决的困难' }], tags: ['CET-4'], examExamples: [],
  },
  address: {
    phoneticUK: '/əˈdres/', phoneticUS: '/əˈdres/',
    partsOfSpeech: [
      { pos: 'verb', meanings: [{ meaning: '处理；应对', explanation: '把注意力放到一个问题上并着手解决。', priority: 'cet_high' }, { meaning: '向……讲话', priority: 'secondary' }] },
      { pos: 'noun', meanings: [{ meaning: '地址', priority: 'core' }, { meaning: '演说', priority: 'secondary' }] },
    ],
    plainExplanation: '在阅读中常表示“着手处理某个问题”。',
    exampleSentences: [example('The report addresses the causes of the change.', '这份报告讨论并处理了这一变化的原因。')],
    collocations: [{ phrase: 'address a problem', meaning: '处理问题' }, { phrase: 'address the issue', meaning: '应对该问题' }],
    rareMeanings: [{ pos: 'verb', meaning: '称呼；向……致辞', priority: 'rare' }],
    memoryTip: '看到 address 后面接 problem 或 issue 时，优先想到“处理”。', tags: ['CET-4', '熟词僻义'], examExamples: [],
  },
  schedule: {
    phoneticUK: '/ˈʃedjuːl/', phoneticUS: '/ˈskedʒuːl/',
    partsOfSpeech: [
      { pos: 'noun', meanings: [{ meaning: '日程；时间表', explanation: '提前安排好的时间计划。', priority: 'cet_high' }] },
      { pos: 'verb', meanings: [{ meaning: '安排；预定', priority: 'core' }] },
    ],
    plainExplanation: '提前安排好的时间计划。',
    exampleSentences: [example('We moved the meeting to fit everyone’s schedule.', '我们调整了会议时间，以配合每个人的日程。')],
    collocations: [{ phrase: 'on schedule', meaning: '按计划；准时' }, { phrase: 'ahead of schedule', meaning: '提前' }],
    memoryTip: '名词是“日程”，动词是“把事情排进日程”。注意英美发音不同。', tags: ['CET-4'], examExamples: [],
  },
  economic: {
    phoneticUK: '/ˌiːkəˈnɒmɪk/', phoneticUS: '/ˌiːkəˈnɑːmɪk/',
    partsOfSpeech: [{ pos: 'adjective', meanings: [{ meaning: '经济的；经济学的', explanation: '与经济、产业或财富有关。', priority: 'cet_high' }] }],
    plainExplanation: '与经济、产业或财富有关。',
    exampleSentences: [example('The policy may support economic growth.', '这项政策可能促进经济增长。')],
    collocations: [{ phrase: 'economic growth', meaning: '经济增长' }, { phrase: 'economic development', meaning: '经济发展' }],
    confusableWords: [{ word: 'economical', meaning: '节约的；实惠的' }],
    memoryTip: 'economic 说“经济相关”，economical 说“省钱省资源”。', tags: ['CET-4', '易混'], examExamples: [],
  },
  economical: {
    phoneticUK: '/ˌiːkəˈnɒmɪkəl/', phoneticUS: '/ˌiːkəˈnɑːmɪkəl/',
    partsOfSpeech: [{ pos: 'adjective', meanings: [{ meaning: '节约的；实惠的', explanation: '使用较少的钱或资源，成本更低。', priority: 'cet_high' }] }],
    plainExplanation: '使用较少的钱或资源，成本更低。',
    exampleSentences: [example('Taking the train is a more economical choice.', '乘火车是一个更实惠的选择。')],
    collocations: [{ phrase: 'an economical car', meaning: '省油经济的汽车' }, { phrase: 'an economical choice', meaning: '实惠的选择' }],
    confusableWords: [{ word: 'economic', meaning: '经济的；经济学的' }],
    memoryTip: 'economical 强调“省”，economic 强调“经济领域”。', tags: ['CET-4', '易混'], examExamples: [],
  },
  significant: {
    phoneticUK: '/sɪɡˈnɪfɪkənt/', phoneticUS: '/sɪɡˈnɪfɪkənt/',
    partsOfSpeech: [{ pos: 'adjective', meanings: [{ meaning: '重要的；显著的', explanation: '影响大，或差异明显到值得注意。', priority: 'cet_high' }, { meaning: '有特殊意义的', priority: 'secondary' }] }],
    plainExplanation: '影响大，或明显到值得注意。',
    exampleSentences: [example('Sleep has a significant effect on memory.', '睡眠对记忆有显著影响。')],
    collocations: [{ phrase: 'a significant effect', meaning: '显著影响' }, { phrase: 'a significant increase', meaning: '显著增长' }],
    wordFamily: [{ word: 'significance', meaning: '重要性；意义' }, { word: 'significantly', meaning: '显著地' }],
    synonyms: ['important', 'considerable'], tags: ['CET-4'], examExamples: [],
  },
  approach: {
    phoneticUK: '/əˈprəʊtʃ/', phoneticUS: '/əˈproʊtʃ/',
    partsOfSpeech: [
      { pos: 'noun', meanings: [{ meaning: '方法；途径', explanation: '处理事情时采用的方式。', priority: 'cet_high' }, { meaning: '接近', priority: 'secondary' }] },
      { pos: 'verb', meanings: [{ meaning: '接近；着手处理', priority: 'core' }] },
    ],
    plainExplanation: '处理事情时采用的方式。',
    exampleSentences: [example('This course uses a practical approach to vocabulary.', '这门课程采用实用的方法学习词汇。')],
    collocations: [{ phrase: 'an approach to', meaning: '……的方法' }, { phrase: 'a practical approach', meaning: '实用的方法' }],
    memoryTip: '名词常见结构是 approach to；动词则表示“靠近或开始处理”。', tags: ['CET-4'], examExamples: [],
  },
  charge: {
    phoneticUK: '/tʃɑːdʒ/', phoneticUS: '/tʃɑːrdʒ/',
    partsOfSpeech: [
      { pos: 'verb', meanings: [{ meaning: '收费；索价', explanation: '要求某人为商品或服务付费。', priority: 'cet_high' }, { meaning: '充电', priority: 'core' }, { meaning: '指控', priority: 'secondary' }] },
      { pos: 'noun', meanings: [{ meaning: '费用；主管', priority: 'core' }] },
    ],
    plainExplanation: '核心语境是“让某人承担费用或责任”。',
    exampleSentences: [example('The library does not charge students for this service.', '图书馆不向学生收取这项服务的费用。')],
    collocations: [{ phrase: 'charge for', meaning: '为……收费' }, { phrase: 'in charge of', meaning: '负责；主管' }, { phrase: 'free of charge', meaning: '免费' }],
    rareMeanings: [{ pos: 'verb', meaning: '猛冲；冲锋', priority: 'rare' }],
    memoryTip: '用三个常见结构区分：charge for、in charge of、free of charge。', tags: ['CET-4', '多义词'], examExamples: [],
  },
  figure: {
    phoneticUK: '/ˈfɪɡə(r)/', phoneticUS: '/ˈfɪɡjər/',
    partsOfSpeech: [
      { pos: 'noun', meanings: [{ meaning: '数字；人物', explanation: '图表中的数值，或具有某种身份的人。', priority: 'cet_high' }, { meaning: '图形；身材', priority: 'secondary' }] },
      { pos: 'verb', meanings: [{ meaning: '认为；估计', priority: 'secondary' }] },
    ],
    plainExplanation: '阅读中常指数据里的“数字”或某个“人物”。',
    exampleSentences: [example('The latest figure shows a small increase.', '最新数字显示有小幅增长。')],
    collocations: [{ phrase: 'sales figures', meaning: '销售数字' }, { phrase: 'figure out', meaning: '弄清楚；想出' }],
    rareMeanings: [{ pos: 'noun', meaning: '身材；体形', priority: 'rare' }],
    memoryTip: '遇到图表先想“数字”，遇到 figure out 再切换成“弄明白”。', tags: ['CET-4', '多义词'], examExamples: [],
  },
};

export function withReviewedContent(word = {}) {
  const reviewed = reviewedWordContent[String(word.word || '').trim().toLowerCase()];
  return reviewed ? { ...word, ...reviewed, contentSource: '项目人工复核样例' } : word;
}
