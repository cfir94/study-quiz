(() => {
  'use strict';

  const LETTERS = ['א', 'ב', 'ג', 'ד'];
  const MIXED_SIZE = 25;
  const STORAGE_KEY = 'tour-guide-christianity-quiz-v2';
  const questions = window.QUESTIONS || [];

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const screenHome = $('#screen-home');
  const screenQuiz = $('#screen-quiz');
  const screenResult = $('#screen-result');
  const unitList = $('#unit-list');
  const answerGrid = $('#answer-grid');
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
    return shuffle([...question.options]);
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
    $('#question-number').textContent = String(question.id).padStart(2, '0');
    $('#question-text').textContent = question.prompt;
    $('#progress-label').textContent = `שאלה ${current} מתוך ${total}`;
    $('#progress-percent').textContent = `${percentage}%`;
    $('#progress-fill').style.width = `${percentage}%`;
    questionSource.hidden = true;
    questionSource.textContent = `מבוסס על: ${question.source}`;
    feedbackCard.hidden = true;
    feedbackCard.classList.remove('incorrect');
    answerGrid.innerHTML = '';

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
    const isCorrect = choice === question.answer;
    const answerButtons = $$('.answer-button');
    answerButtons.forEach((button) => {
      button.disabled = true;
      if (button.dataset.answer === question.answer) button.classList.add('correct');
      if (!isCorrect && button.dataset.answer === choice) button.classList.add('wrong');
    });

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
    if (mode === 'full') startRun(questions, 'מסע מלא');
    if (mode === 'mixed') startRun(shuffle(questions).slice(0, MIXED_SIZE), 'תרגול מעורב');
    if (mode === 'mistakes') {
      const selected = questions.filter((question) => progress.mistakeIds.includes(question.id));
      startRun(selected, 'חזרה על טעויות');
    }
  }

  $$('[data-mode]').forEach((button) => button.addEventListener('click', () => modeClick(button.dataset.mode)));
  $('#next-question').addEventListener('click', nextQuestion);
  $('#quit-quiz').addEventListener('click', () => switchScreen(screenHome));
  $('#home-button').addEventListener('click', () => switchScreen(screenHome));
  $('#again-button').addEventListener('click', () => startRun(shuffle(questions).slice(0, MIXED_SIZE), 'תרגול מעורב'));
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
