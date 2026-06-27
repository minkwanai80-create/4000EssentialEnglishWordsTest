const HISTORY_KEY = "essentialWordsTestHistory";
const QUIZ_MODE_LABEL = "단어 입력";

const state = {
  words: [],
  toc: [],
  filtered: [],
  questions: [],
  current: 0,
  correct: 0,
  missed: [],
  activeTab: "setup",
  activeScope: "전체 WORD LIST 기준",
  hasActiveQuiz: false,
};

const els = {
  dataSummary: document.querySelector("#dataSummary"),
  lastScore: document.querySelector("#lastScore"),
  pageRange: document.querySelector("#pageRange"),
  questionCount: document.querySelector("#questionCount"),
  startBtn: document.querySelector("#startBtn"),
  totalWords: document.querySelector("#totalWords"),
  selectedWords: document.querySelector("#selectedWords"),
  plannedQuestions: document.querySelector("#plannedQuestions"),
  scopeSummary: document.querySelector("#scopeSummary"),
  wordListPages: document.querySelector("#wordListPages"),
  quizEmptyState: document.querySelector("#quizEmptyState"),
  quizActiveState: document.querySelector("#quizActiveState"),
  activeScopeText: document.querySelector("#activeScopeText"),
  progressText: document.querySelector("#progressText"),
  questionType: document.querySelector("#questionType"),
  unitBadge: document.querySelector("#unitBadge"),
  questionText: document.querySelector("#questionText"),
  questionHint: document.querySelector("#questionHint"),
  hintToggleBtn: document.querySelector("#hintToggleBtn"),
  answerArea: document.querySelector("#answerArea"),
  checkBtn: document.querySelector("#checkBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  speakBtn: document.querySelector("#speakBtn"),
  feedback: document.querySelector("#feedback"),
  resultsPanel: document.querySelector("#resultsPanel"),
  resultScore: document.querySelector("#resultScore"),
  missedList: document.querySelector("#missedList"),
  retryBtn: document.querySelector("#retryBtn"),
  clearHistoryBtn: document.querySelector("#clearHistoryBtn"),
  historyAttempts: document.querySelector("#historyAttempts"),
  historyAverage: document.querySelector("#historyAverage"),
  historyBest: document.querySelector("#historyBest"),
  historyQuestions: document.querySelector("#historyQuestions"),
  historyWeakWords: document.querySelector("#historyWeakWords"),
  historyList: document.querySelector("#historyList"),
  tabs: document.querySelectorAll(".tab"),
  tabPanels: document.querySelectorAll(".tab-panel"),
};

const pronunciationAudio = new Audio();

function normalizeEnglish(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeKorean(value) {
  return String(value || "").trim();
}

function getKoreanMeanings(word) {
  return Array.isArray(word.koreanMeanings) && word.koreanMeanings.length ? word.koreanMeanings : [];
}

function getAcceptedKoreanAnswers(word) {
  const answers = Array.isArray(word.acceptedKoreanAnswers) && word.acceptedKoreanAnswers.length
    ? word.acceptedKoreanAnswers
    : getKoreanMeanings(word);
  return answers.map(normalizeKorean).filter(Boolean);
}

function koreanMeaningText(word) {
  const meanings = getKoreanMeanings(word);
  return meanings.length ? meanings.join(", ") : "-";
}

function parseRange(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/페이지|pages|page/g, "")
    .replace(/\bp\.?/g, "")
    .trim();
  if (!raw) return null;
  const match = raw.match(/^(\d+)(?:\s*[-~]\s*(\d+))?$/);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2] || match[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  return [Math.min(first, second), Math.max(first, second)];
}

function inRange(value, range) {
  return !range || (value >= range[0] && value <= range[1]);
}

function rangeText(range) {
  if (!range) return "";
  return range[0] === range[1] ? `${range[0]}` : `${range[0]}-${range[1]}`;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function maskAnswer(text, answer) {
  if (!text) return "";
  const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`\\b${escaped}\\b`, "ig"), "____");
}

function isGarbledEnglish(text) {
  if (!text || text.length < 15) return true;
  if (/[가-힣]/.test(text)) return true;
  if (/[\u4e00-\u9fff]/.test(text)) return true;
  return false;
}

function cleanDefinitionRaw(word) {
  let text = String(word.definition || "").trim();
  if (!text) return "";

  text = text.replace(/\[[^\]]*\]/g, " ");
  text = text.replace(/[□■]/g, "");
  text = text.replace(/[가-힣\u4e00-\u9fff]/g, " ");
  text = text.replace(/\s+/g, " ").trim();

  const escaped = word.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  text = text.replace(
    new RegExp(`^${escaped}\\s+(?:n\\.|v\\.|adj\\.|adv\\.|conj\\.)\\s+[A-Za-z]\\s+`, "i"),
    `${word.word} `,
  );
  text = text.replace(
    new RegExp(`^${escaped}\\s+(?:n\\.|v\\.|adj\\.|adv\\.|conj\\.)\\s*`, "i"),
    `${word.word} `,
  );

  return text.replace(/\s+/g, " ").trim();
}

function cleanEnglishHint(word) {
  let definition = cleanDefinitionRaw(word);
  if (isGarbledEnglish(definition)) {
    definition = `Study the word from page ${word.bookPage}.`;
  }
  const masked = maskAnswer(definition, word.word);
  return word.partOfSpeech ? `${word.partOfSpeech} ${masked}` : masked;
}

function speakWithBrowser(text) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  const voices = window.speechSynthesis.getVoices();
  const englishVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));
  if (englishVoice) utterance.voice = englishVoice;
  window.speechSynthesis.speak(utterance);
  return true;
}

function speak(text) {
  const word = String(text || "").trim();
  if (!word) return;
  pronunciationAudio.pause();
  pronunciationAudio.currentTime = 0;
  pronunciationAudio.src = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(word)}`;
  pronunciationAudio.onerror = () => speakWithBrowser(word);
  pronunciationAudio.play().catch(() => {
    if (!speakWithBrowser(word)) {
      alert("이 브라우저에서 듣기를 재생하지 못했습니다.");
    }
  });
}

function setActiveTab(tabName) {
  state.activeTab = tabName;
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  els.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === `${tabName}Panel`));
  if (tabName === "history") renderHistory();
}

function updateQuizVisibility(showResults = false) {
  els.quizEmptyState.hidden = state.hasActiveQuiz;
  els.quizActiveState.hidden = !state.hasActiveQuiz || showResults;
  els.resultsPanel.hidden = !showResults;
}

function buildQuestion(word) {
  return {
    word,
    hint: cleanEnglishHint(word),
    answer: word.word,
  };
}

function resolveScope() {
  const pageRange = parseRange(els.pageRange.value);
  const hasPageInput = Boolean(els.pageRange.value.trim());

  if (hasPageInput && !pageRange) {
    return { error: "페이지 범위는 8 또는 8-15 형식으로 입력하세요." };
  }
  if (pageRange) {
    return { pageRange, source: `교재 ${rangeText(pageRange)}페이지 기준` };
  }
  return { pageRange: null, source: "전체 WORD LIST 기준" };
}

function filterWords() {
  const scope = resolveScope();
  if (scope.error) return scope;
  const filtered = state.words.filter((word) => inRange(word.bookPage, scope.pageRange));
  return { filtered, source: scope.source, pageRange: scope.pageRange };
}

function syncQuestionCount(availableCount) {
  els.questionCount.max = String(Math.max(availableCount, 1));
  els.questionCount.placeholder = availableCount ? `최대 ${availableCount}개` : "출제 가능한 단어 없음";
  els.questionCount.value = availableCount ? String(availableCount) : "";
  els.plannedQuestions.textContent = availableCount ? String(availableCount) : "0";
}

function updateSelectedCount() {
  const result = filterWords();
  els.selectedWords.textContent = result.error ? "-" : String(result.filtered.length);
  els.scopeSummary.textContent = result.error || result.source;
  syncQuestionCount(result.error ? 0 : result.filtered.length);
}

function renderWordListPages() {
  els.wordListPages.innerHTML = "";
  state.toc.forEach((unit) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "word-page-card";
    button.innerHTML = `
      <strong>${rangeText(unit.wordListPages)}페이지</strong>
      <span>${unit.title}</span>
      <small>${unit.wordCount} words</small>
    `;
    button.addEventListener("click", () => {
      els.pageRange.value = rangeText(unit.wordListPages);
      updateSelectedCount();
    });
    els.wordListPages.appendChild(button);
  });
}

function renderSubjectiveInputs() {
  const wrapper = document.createElement("div");
  wrapper.className = "answer-grid";

  const englishInput = document.createElement("input");
  englishInput.type = "text";
  englishInput.autocomplete = "off";
  englishInput.placeholder = "영어 단어";
  englishInput.dataset.answerRole = "english";

  const koreanInput = document.createElement("input");
  koreanInput.type = "text";
  koreanInput.autocomplete = "off";
  koreanInput.placeholder = "한글 뜻";
  koreanInput.dataset.answerRole = "korean";

  [englishInput, koreanInput].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") checkAnswer();
    });
  });

  wrapper.append(englishInput, koreanInput);
  els.answerArea.appendChild(wrapper);
  englishInput.focus();
}

function renderQuestion() {
  const question = state.questions[state.current];
  updateQuizVisibility(false);
  els.feedback.textContent = "";
  els.feedback.className = "feedback";
  els.nextBtn.hidden = true;
  els.checkBtn.hidden = false;
  els.activeScopeText.textContent = `${state.activeScope} · ${QUIZ_MODE_LABEL}`;
  els.progressText.textContent = `${state.current + 1} / ${state.questions.length}`;
  els.questionType.textContent = QUIZ_MODE_LABEL;
  els.unitBadge.textContent = `p.${question.word.bookPage}`;
  els.questionText.textContent = "";
  els.questionHint.textContent = question.hint;
  els.questionHint.hidden = true;
  els.hintToggleBtn.hidden = false;
  els.hintToggleBtn.textContent = "힌트: 영어 설명 보기";
  els.speakBtn.textContent = "듣기";
  els.answerArea.innerHTML = "";
  renderSubjectiveInputs();
}

function startQuiz() {
  const result = filterWords();
  if (result.error) {
    alert(result.error);
    return;
  }
  if (!result.filtered.length) {
    alert("선택한 페이지 범위에 출제 가능한 단어가 없습니다.");
    return;
  }

  const requestedCount = Number(els.questionCount.value) || result.filtered.length;
  const count = Math.max(1, Math.min(requestedCount, result.filtered.length));
  state.filtered = result.filtered;
  state.questions = shuffle(result.filtered).slice(0, count).map((word) => buildQuestion(word));
  state.current = 0;
  state.correct = 0;
  state.missed = [];
  state.activeScope = result.source;
  state.hasActiveQuiz = true;
  els.selectedWords.textContent = String(result.filtered.length);
  els.scopeSummary.textContent = result.source;
  setActiveTab("quiz");
  renderQuestion();
}

function getSubjectiveAnswers() {
  return {
    english: els.answerArea.querySelector('[data-answer-role="english"]')?.value || "",
    korean: els.answerArea.querySelector('[data-answer-role="korean"]')?.value || "",
  };
}

function gradeQuestion(question) {
  const answers = getSubjectiveAnswers();
  const englishCorrect = normalizeEnglish(answers.english) === normalizeEnglish(question.word.word);
  const koreanAnswer = normalizeKorean(answers.korean);
  const accepted = getAcceptedKoreanAnswers(question.word);
  const koreanCorrect = accepted.includes(koreanAnswer);

  return {
    userEnglishAnswer: answers.english,
    userKoreanAnswer: answers.korean,
    correctWord: question.word.word,
    koreanMeanings: getKoreanMeanings(question.word),
    englishCorrect,
    koreanCorrect,
    isCorrect: englishCorrect && koreanCorrect,
  };
}

function createDetailRow(label, value) {
  const row = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  row.append(strong, document.createTextNode(value || "-"));
  return row;
}

function renderDictionaryPanel(question, result) {
  const oldPanel = els.answerArea.querySelector(".answer-detail");
  if (oldPanel) oldPanel.remove();

  const word = question.word;
  const panel = document.createElement("section");
  panel.className = "answer-detail";

  const title = document.createElement("div");
  title.className = "answer-detail-title";
  const heading = document.createElement("strong");
  heading.textContent = `${word.word}${word.phonetic ? ` ${word.phonetic}` : ""}${word.partOfSpeech ? ` ${word.partOfSpeech}` : ""}`;
  const listen = document.createElement("button");
  listen.type = "button";
  listen.className = "mini-listen";
  listen.textContent = "듣기";
  listen.addEventListener("click", () => speak(word.word));
  title.append(heading, listen);

  const summary = document.createElement("div");
  summary.className = "answer-check-summary";
  summary.append(
    createDetailRow("정답", `${result.correctWord} / ${koreanMeaningText(word)}`),
    createDetailRow("사용자 영어 답", result.userEnglishAnswer),
    createDetailRow("사용자 한글 답", result.userKoreanAnswer),
    createDetailRow("영어 단어", result.englishCorrect ? "맞음" : "오답"),
    createDetailRow("한글 뜻", result.koreanCorrect ? "맞음" : "오답"),
  );

  const dictionary = document.createElement("div");
  dictionary.className = "dictionary-lines";
  dictionary.append(
    createDetailRow("뜻", koreanMeaningText(word)),
    createDetailRow("정의", word.definition),
    createDetailRow("예문", word.example),
    createDetailRow("해석", word.exampleKo),
    createDetailRow("설명", word.dictionaryNotes),
    createDetailRow("검수", word.needsReview ? "OCR 검수 필요" : "완료"),
  );

  panel.append(title, summary, dictionary);
  els.answerArea.appendChild(panel);
}

function lockCurrentQuestion() {
  els.answerArea.querySelectorAll("input").forEach((item) => {
    item.disabled = true;
  });
}

function checkAnswer() {
  const question = state.questions[state.current];
  const answers = getSubjectiveAnswers();
  if (!normalizeEnglish(answers.english) || !normalizeKorean(answers.korean)) {
    els.feedback.textContent = "영어 단어와 한글 뜻을 모두 입력하세요.";
    els.feedback.className = "feedback bad";
    return;
  }

  const result = gradeQuestion(question);
  if (result.isCorrect) {
    state.correct += 1;
    els.feedback.textContent = "정답입니다.";
    els.feedback.className = "feedback ok";
  } else {
    state.missed.push({ question, result });
    els.feedback.textContent = `오답입니다. 정답: ${question.word.word} / ${koreanMeaningText(question.word)}`;
    els.feedback.className = "feedback bad";
  }

  renderDictionaryPanel(question, result);
  lockCurrentQuestion();
  speak(question.word.word);
  els.checkBtn.hidden = true;
  els.nextBtn.hidden = false;
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(record) {
  const history = [record, ...getHistory()].slice(0, 100);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

function makeHistoryRecord(score) {
  return {
    id: Date.now(),
    date: new Date().toISOString(),
    scope: state.activeScope,
    mode: QUIZ_MODE_LABEL,
    total: state.questions.length,
    correct: state.correct,
    score,
    missed: state.missed.map(({ question, result }) => ({
      word: question.word.word,
      page: question.word.bookPage,
      userEnglishAnswer: result.userEnglishAnswer || "",
      userKoreanAnswer: result.userKoreanAnswer || "",
      correctWord: result.correctWord,
      koreanMeanings: result.koreanMeanings,
      englishCorrect: result.englishCorrect,
      koreanCorrect: result.koreanCorrect,
      answer: result.userEnglishAnswer || "",
      correctAnswer: question.answer,
    })),
  };
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function renderHistory() {
  const history = getHistory();
  const attempts = history.length;
  const totalQuestions = history.reduce((sum, item) => sum + item.total, 0);
  const average = attempts ? Math.round(history.reduce((sum, item) => sum + item.score, 0) / attempts) : null;
  const best = attempts ? Math.max(...history.map((item) => item.score)) : null;

  els.historyAttempts.textContent = String(attempts);
  els.historyAverage.textContent = average === null ? "-" : `${average}%`;
  els.historyBest.textContent = best === null ? "-" : `${best}%`;
  els.historyQuestions.textContent = String(totalQuestions);
  els.lastScore.textContent = attempts ? `${history[0].score}%` : "-";
  els.historyList.innerHTML = "";
  els.historyWeakWords.innerHTML = "";

  if (!attempts) {
    els.historyList.innerHTML = `<p class="empty-history">아직 저장된 시험 결과가 없습니다.</p>`;
    return;
  }

  const missedCounts = new Map();
  const missedLabels = new Map();
  history.forEach((item) => {
    item.missed.forEach((miss) => {
      const key = miss.correctWord || miss.word;
      const meanings = Array.isArray(miss.koreanMeanings) ? miss.koreanMeanings : [];
      missedCounts.set(key, (missedCounts.get(key) || 0) + 1);
      missedLabels.set(key, meanings[0] ? `${key} (${meanings[0]})` : key);
    });
  });
  const weakWords = [...missedCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (weakWords.length) {
    els.historyWeakWords.innerHTML = `
      <strong>자주 틀린 단어</strong>
      <div>${weakWords.map(([word, count]) => `<span>${missedLabels.get(word) || word} ${count}회</span>`).join("")}</div>
    `;
  }

  history.slice(0, 20).forEach((item) => {
    const row = document.createElement("div");
    row.className = "history-item";
    const missedWords = item.missed
      .map((miss) => {
        const meanings = Array.isArray(miss.koreanMeanings) ? miss.koreanMeanings : [];
        return meanings[0] ? `${miss.correctWord || miss.word} (${meanings[0]})` : miss.correctWord || miss.word;
      })
      .slice(0, 8)
      .join(", ");
    row.innerHTML = `
      <div>
        <strong>${item.score}% · ${item.correct}/${item.total}</strong>
        <span>${formatDate(item.date)} · ${item.scope} · ${item.mode}</span>
        <small>${missedWords ? `틀린 단어: ${missedWords}` : "틀린 단어 없음"}</small>
      </div>
    `;
    els.historyList.appendChild(row);
  });
}

function showResults() {
  updateQuizVisibility(true);
  els.progressText.textContent = `${state.questions.length} / ${state.questions.length}`;
  const score = Math.round((state.correct / state.questions.length) * 100);
  els.resultScore.textContent = `${state.correct} / ${state.questions.length} (${score}%)`;
  els.lastScore.textContent = `${score}%`;
  els.missedList.innerHTML = "";
  saveHistory(makeHistoryRecord(score));

  if (!state.missed.length) {
    els.missedList.textContent = "틀린 단어가 없습니다.";
    return;
  }

  state.missed.forEach(({ question, result }) => {
    const item = document.createElement("div");
    item.className = "missed-item";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mini-listen";
    button.textContent = "듣기";
    button.addEventListener("click", () => speak(question.word.word));
    const text = document.createElement("div");
    text.innerHTML = `
      <strong>${question.word.word} / ${koreanMeaningText(question.word)}</strong>
      <span>영어 답: ${result.userEnglishAnswer || "-"} · 한글 답: ${result.userKoreanAnswer || "-"} · p.${question.word.bookPage}</span>
    `;
    item.append(text, button);
    els.missedList.appendChild(item);
  });
}

function nextQuestion() {
  if (state.current >= state.questions.length - 1) {
    showResults();
    return;
  }
  state.current += 1;
  renderQuestion();
}

async function init() {
  try {
    const [wordResponse, tocResponse] = await Promise.all([
      fetch("./data/words.json", { cache: "no-store" }),
      fetch("./data/toc.json", { cache: "no-store" }),
    ]);
    if (!wordResponse.ok) throw new Error(`words.json HTTP ${wordResponse.status}`);
    if (!tocResponse.ok) throw new Error(`toc.json HTTP ${tocResponse.status}`);
    state.words = await wordResponse.json();
    state.toc = await tocResponse.json();
    const usable = state.words.length;
    els.totalWords.textContent = String(usable);
    els.dataSummary.textContent = `출제 가능한 단어 ${usable}개를 사용할 수 있습니다.`;
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
    renderWordListPages();
    renderHistory();
    updateSelectedCount();
    updateQuizVisibility(false);
  } catch (error) {
    els.dataSummary.textContent = "단어 데이터를 불러오지 못했습니다.";
    console.error(error);
  }
}

els.tabs.forEach((tab) => tab.addEventListener("click", () => setActiveTab(tab.dataset.tab)));
els.startBtn.addEventListener("click", startQuiz);
els.checkBtn.addEventListener("click", checkAnswer);
els.nextBtn.addEventListener("click", nextQuestion);
els.retryBtn.addEventListener("click", startQuiz);
els.speakBtn.addEventListener("click", () => {
  const question = state.questions[state.current];
  if (question) speak(question.word.word);
});
els.hintToggleBtn.addEventListener("click", () => {
  const isHidden = els.questionHint.hidden;
  els.questionHint.hidden = !isHidden;
  els.hintToggleBtn.textContent = isHidden ? "힌트 숨기기" : "힌트: 영어 설명 보기";
});
els.pageRange.addEventListener("input", updateSelectedCount);
els.clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

init();
