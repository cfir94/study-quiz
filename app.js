(() => {
  'use strict';

  const LETTERS = ['א', 'ב', 'ג', 'ד'];
  const MIXED_SIZE = 25;
  const EXAM_SIZE = 50;
  const EXAM_SHORT_SIZE = 12;
  const EXAM_CHALLENGING_SIZE = 20;
  const STORAGE_KEY = 'tour-guide-christianity-quiz-v3';
  const questions = window.QUESTIONS || [];

  // תשובות קצרות נבדקות מול ניסוחים חלופיים מקובלים. שאר השאלות נשארות רב־ברירה.
  const SHORT_ANSWERS = new Map([
    [9, ['כריסטוס', 'christos', 'משיח', 'התרגום היווני של משיח']],
    [22, ['27', '27 ספרים', 'עשרים ושבעה', 'עשרים ושבעה ספרים']],
    [25, ['מעשי השליחים', 'ספר מעשי השליחים']],
    [50, ['שמעון וחנה', 'חנה ושמעון', 'שמעון הצדיק וחנה הנביאה', 'שמעון וחנה הנביאה']],
    [63, ['דיאקון כומר ובישוף', 'דיאקון פרסביטר ובישוף', 'דיאקון כומר אפיסקופוס']],
    [76, ['כללי', 'אוניברסלי', 'עולמי', 'כוללני', 'עולמי כוללני', 'כללי אוניברסלי', 'אוניברסלי כללי']],
    [83, ['כנסיית הבשורה', 'בזיליקת הבשורה', 'כנסיית הבשורה בנצרת']],
    [88, ['קצר אל יהוד', 'קאסר אל יהוד', 'קאסר אל־יהוד', 'קאסר אל יהוד ליד יריחו']],
    [91, ['כפר כנא', 'קנה', 'כפר קנה', 'קנה שבגליל']],
    [93, ['קיסריה פיליפי', 'בניאס', 'קיסריה פיליפי בניאס']],
    [101, ['עין כרם', 'כנסיית הביקור', 'כנסיית הביקור בעין כרם']],
    [103, ['בית פגי', 'ביתפגי', 'bethphage']],
    [106, ['פטרוס אין גליקנטו', 'כנסיית פטרוס אין גליקנטו', 'גליקנטו']],
    [119, ['50 ימים', 'חמישים ימים', 'ביום החמישים', '50 יום', 'חמישים יום']],
    [120, ['לשונות אש', 'לשונות של אש']],
    [122, ['טרסוס', 'תרסוס', 'tarsus']],
    [128, ['עין כרם', 'כנסיית הביקור', 'כנסיית הביקור בעין כרם']],
    [133, ['מפתחות', 'מפתחות מלכות השמיים', 'מפתח', 'מפתח מלכות השמיים']],
    [137, ['איקונוסטזיס', 'איקונוסטזיון', 'iconostasis']],
    [143, ['חדר הסעודה האחרונה', 'הקנקולום', 'הסנקולום', 'הר ציון']]
  ]);

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const screenHome = $('#screen-home');
  const screenQuiz = $('#screen-quiz');
  const screenResult = $('#screen-result');
  const unitList = $('#unit-list');
  const answerGrid = $('#answer-grid');
  const shortAnswerForm = $('#short-answer-form');
  const shortAnswerInput = $('#short-answer-input');
  const shortAnswerSubmit = $('#short-answer-submit');
  const feedbackCard = $('#feedback-card');
  const questionSource = $('#question-source');

  let run = null;
  let progress = loadProgress();

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.answeredIds) && Array.isArray(saved.correctIds) && Array.isArray(saved.mistakeIds)) return saved;
    } catch (_) { /* Start a fresh local progress record. */ }
    return { answeredIds: [], correctIds: [], mistakeIds: [] };
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    updateHomeStats();
  }

  function unique(list) { return [...new Set(list)]; }

  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function isShortQuestion(question) {
    return SHORT_ANSWERS.has(question.id);
  }

  function normalizeAnswer(value) {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0591-\u05c7]/g, '')
      .replace(/["'׳״`´]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .toLowerCase();
  }

  function answerIsCorrect(question, choice) {
    if (!isShortQuestion(question)) return choice === question.answer;
    const normalizedChoice = normalizeAnswer(choice);
    return [question.answer, ...SHORT_ANSWERS.get(question.id)]
      .some((answer) => normalizeAnswer(answer) === normalizedChoice);
  }

  function groupByUnit(list) {
    return list.reduce((groups, question) => {
      if (!groups.has(question.unit)) groups.set(question.unit, []);
      groups.get(question.unit).push(question);
      return groups;
    }, new Map());
  }

  function interleaveByUnit(list, randomizeWithinUnits = false) {
    let groups = [...groupByUnit(list).entries()].map(([unit, unitQuestions]) => ({
      unit,
      questions: randomizeWithinUnits ? shuffle(unitQuestions) : [...unitQuestions]
    }));
    if (randomizeWithinUnits) groups = shuffle(groups);
    const result = [];
    let cursor = 0;

    while (groups.length) {
      const group = groups[cursor];
      result.push(group.questions.shift());
      if (!group.questions.length) {
        groups.splice(cursor, 1);
        if (groups.length) cursor %= groups.length;
      } else {
        cursor = (cursor + 1) % groups.length;
      }
    }
    return result;
  }

  function balancedSample(list, size) {
    return interleaveByUnit(shuffle(list), true).slice(0, Math.min(size, list.length));
  }

  function buildExam() {
    const shortQuestions = balancedSample(questions.filter(isShortQuestion), EXAM_SHORT_SIZE);
    const shortIds = new Set(shortQuestions.map((question) => question.id));
    const multipleChoicePool = questions.filter((question) => !shortIds.has(question.id) && !isShortQuestion(question));
    const shortChallengeCount = shortQuestions.filter((question) => question.difficulty === 'מאתגרת').length;
    const challengingNeeded = Math.max(0, EXAM_CHALLENGING_SIZE - shortChallengeCount);
    const multipleChoiceSize = EXAM_SIZE - shortQuestions.length;
    const challenging = balancedSample(
      multipleChoicePool.filter((question) => question.difficulty === 'מאתגרת'),
      challengingNeeded
    );
    const medium = balancedSample(
      multipleChoicePool.filter((question) => question.difficulty !== 'מאתגרת'),
      multipleChoiceSize - challenging.length
    );
    const multipleChoice = [...challenging, ...medium];
    return interleaveByUnit([...shortQuestions, ...multipleChoice], true);
  }

  function switchScreen(target) {
    [screenHome, screenQuiz, screenResult].forEach((screen) => screen.classList.remove('active'));
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateHomeStats() {
    const answered = unique(progress.answeredIds);
    const correct = unique(progress.correctIds);
    const percent = answered.length ? Math.round((correct.length / answered.length) * 100) : 0;
    $('#question-total').textContent = questions.length;
    $('#done-total').textContent = answered.length;
    $('#mastery-total').textContent = `${percent}%`;
    $('#mistakes-subtitle').textContent = progress.mistakeIds.length
      ? `${progress.mistakeIds.length} שאלות מחכות לחזרה`
      : 'אין טעויות שמורות עדיין';
    $('#mistakes-mode').disabled = progress.mistakeIds.length === 0;
    $('#mistakes-mode').setAttribute('aria-disabled', String(progress.mistakeIds.length === 0));
  }

  function renderUnits() {
    const units = [...new Set(questions.map((question) => question.unit))];
    unitList.innerHTML = '';
    units.forEach((unit, index) => {
      const count = questions.filter((question) => question.unit === unit).length;
      const button = document.createElement('button');
      button.className = 'unit-button';
      button.type = 'button';
      button.innerHTML = `<span class="unit-number">${String(index + 1).padStart(2, '0')}</span><span><strong>${unit}</strong><small>${count} שאלות</small></span>`;
      button.addEventListener('click', () => startRun(questions.filter((question) => question.unit === unit), unit));
      unitList.append(button);
    });
  }

  function buildOptions(question) {
    // Each question now carries four course-grounded options that were reviewed together.
    // We shuffle only their order, never substitute unrelated answers from other questions.
    return isShortQuestion(question) ? [...question.options] : shuffle([...question.options]);
  }

  function startRun(selectedQuestions, title) {
    if (!selectedQuestions.length) return;
    run = {
      title,
      queue: selectedQuestions.map((question) => ({ ...question, options: buildOptions(question) })),
      index: 0,
      correct: 0,
      incorrect: []
    };
    $('#quiz-mode-title').textContent = title;
    $('#correct-count').textContent = '0';
    switchScreen(screenQuiz);
    renderQuestion();
  }

  function renderQuestion() {
    const question = run.queue[run.index];
    const total = run.queue.length;
    const current = run.index + 1;
    const percentage = Math.round(((current - 1) / total) * 100);

    $('#quiz-unit').textContent = question.unit;
    $('#question-number').textContent = String(current).padStart(2, '0');
    $('#question-text').textContent = question.prompt;
    $('#question-kicker').textContent = isShortQuestion(question)
      ? 'כתבו תשובה קצרה ומדויקת'
      : 'בחרו את התשובה המדויקת ביותר';
    $('#progress-label').textContent = `שאלה ${current} מתוך ${total}`;
    $('#progress-percent').textContent = `${percentage}%`;
    $('#progress-fill').style.width = `${percentage}%`;
    questionSource.hidden = true;
    questionSource.textContent = `מבוסס על: ${question.source}`;
    feedbackCard.hidden = true;
    feedbackCard.classList.remove('incorrect');
    answerGrid.innerHTML = '';
    answerGrid.hidden = isShortQuestion(question);
    shortAnswerForm.hidden = !isShortQuestion(question);
    shortAnswerInput.value = '';
    shortAnswerInput.disabled = false;
    shortAnswerSubmit.disabled = false;
    shortAnswerForm.classList.remove('correct', 'wrong');

    if (isShortQuestion(question)) {
      window.setTimeout(() => shortAnswerInput.focus(), 0);
      return;
    }

    question.options.forEach((option, index) => {
      const button = document.createElement('button');
      button.className = 'answer-button';
      button.type = 'button';
      button.dataset.answer = option;
      button.innerHTML = `<span class="answer-letter">${LETTERS[index]}</span><span>${option}</span>`;
      button.addEventListener('click', () => chooseAnswer(option));
      answerGrid.append(button);
    });
  }

  function chooseAnswer(choice) {
    const question = run.queue[run.index];
    const isCorrect = answerIsCorrect(question, choice);
    const answerButtons = $$('.answer-button');
    answerButtons.forEach((button) => {
      button.disabled = true;
      if (button.dataset.answer === question.answer) button.classList.add('correct');
      if (!isCorrect && button.dataset.answer === choice) button.classList.add('wrong');
    });
    if (isShortQuestion(question)) {
      shortAnswerInput.disabled = true;
      shortAnswerSubmit.disabled = true;
      shortAnswerForm.classList.toggle('correct', isCorrect);
      shortAnswerForm.classList.toggle('wrong', !isCorrect);
    }

    progress.answeredIds = unique([...progress.answeredIds, question.id]);
    if (isCorrect) {
      run.correct += 1;
      progress.correctIds = unique([...progress.correctIds, question.id]);
      progress.mistakeIds = progress.mistakeIds.filter((id) => id !== question.id);
    } else {
      run.incorrect.push(question);
      progress.correctIds = progress.correctIds.filter((id) => id !== question.id);
      progress.mistakeIds = unique([...progress.mistakeIds, question.id]);
    }
    saveProgress();

    $('#correct-count').textContent = run.correct;
    $('#feedback-symbol').textContent = isCorrect ? '✓' : '×';
    $('#feedback-title').textContent = isCorrect ? 'תשובה נכונה' : 'כדאי לזכור';
    $('#feedback-answer').textContent = isCorrect ? 'יפה מאוד — ממשיכים הלאה.' : `התשובה המדויקת: ${question.answer}`;
    $('#feedback-explanation').textContent = question.explanation;
    $('#feedback-source').textContent = question.source;
    feedbackCard.classList.toggle('incorrect', !isCorrect);
    feedbackCard.hidden = false;
    $('#next-question').focus();
  }

  function nextQuestion() {
    if (run.index + 1 < run.queue.length) {
      run.index += 1;
      renderQuestion();
      return;
    }
    renderResult();
  }

  function renderResult() {
    const total = run.queue.length;
    const score = Math.round((run.correct / total) * 100);
    const resultSymbol = $('#result-symbol');
    resultSymbol.textContent = score >= 70 ? '✓' : '↺';
    resultSymbol.style.background = score >= 70 ? 'var(--gold)' : 'var(--coral)';
    $('#result-title').textContent = score >= 90 ? 'שליטה מרשימה' : score >= 70 ? 'התקדמות מצוינת' : 'ממשיכים לחזק';
    $('#result-summary').textContent = score >= 70
      ? 'השלמתם את המסלול. ההסברים והמקורות נשמרו לאורך הדרך, ואפשר להמשיך לתרגול מעורב או לחזור על טעויות.'
      : 'השלמתם את המסלול. ריכזנו למטה את השאלות שכדאי לפתוח שוב ולחזק בעזרת חומר הקורס.';
    $('#result-score').textContent = `${score}%`;
    $('#result-correct').textContent = `${run.correct}/${total}`;
    $('#result-mistakes').textContent = run.incorrect.length;

    const reviewWrap = $('#review-wrap');
    const reviewList = $('#review-list');
    reviewList.innerHTML = '';
    run.incorrect.forEach((question) => {
      const item = document.createElement('li');
      item.textContent = `${question.prompt} — ${question.answer}`;
      reviewList.append(item);
    });
    reviewWrap.hidden = run.incorrect.length === 0;
    switchScreen(screenResult);
  }

  function modeClick(mode) {
    if (mode === 'full') startRun(interleaveByUnit(questions), 'מסע מלא ומאוזן');
    if (mode === 'exam') startRun(buildExam(), 'סימולציית מבחן');
    if (mode === 'mixed') startRun(balancedSample(questions, MIXED_SIZE), 'תרגול מעורב');
    if (mode === 'mistakes') {
      const selected = questions.filter((question) => progress.mistakeIds.includes(question.id));
      startRun(selected, 'חזרה על טעויות');
    }
  }

  $$('[data-mode]').forEach((button) => button.addEventListener('click', () => modeClick(button.dataset.mode)));
  shortAnswerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const answer = shortAnswerInput.value.trim();
    if (answer) chooseAnswer(answer);
  });
  $('#next-question').addEventListener('click', nextQuestion);
  $('#quit-quiz').addEventListener('click', () => switchScreen(screenHome));
  $('#home-button').addEventListener('click', () => switchScreen(screenHome));
  $('#again-button').addEventListener('click', () => startRun(balancedSample(questions, MIXED_SIZE), 'תרגול מעורב'));
  $('#show-source').addEventListener('click', () => { questionSource.hidden = !questionSource.hidden; });
  $('#reset-progress').addEventListener('click', () => {
    if (window.confirm('לאפס את ההתקדמות ואת רשימת הטעויות השמורה במכשיר זה?')) {
      progress = { answeredIds: [], correctIds: [], mistakeIds: [] };
      saveProgress();
    }
  });

  renderUnits();
  updateHomeStats();
})();
