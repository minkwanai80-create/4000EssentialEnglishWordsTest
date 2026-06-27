const HISTORY_KEY = "essentialWordsTestHistory";

const state = {
  words: [],
  toc: [],
  filtered: [],
  questions: [],
  current: 0,
  correct: 0,
  missed: [],
  selectedChoice: "",
  activeTab: "test",
  activeScope: "전체 WORD LIST 기준",
};

const els = {
  dataSummary: document.querySelector("#dataSummary"),
  lastScore: document.querySelector("#lastScore"),
  pageRange: document.querySelector("#pageRange"),
  questionCount: document.querySelector("#questionCount"),
  quizMode: document.querySelector("#quizMode"),
  startBtn: document.querySelector("#startBtn"),
  totalWords: document.querySelector("#totalWords"),
  selectedWords: document.querySelector("#selectedWords"),
  progressText: document.querySelector("#progressText"),
  scopeSummary: document.querySelector("#scopeSummary"),
  wordListPages: document.querySelector("#wordListPages"),
  quizPanel: document.querySelector("#quizPanel"),
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

function normalizeAnswer(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
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

function makeBlank(example, answer) {
  if (!example) return "";
  const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, "ig");
  return example.replace(pattern, "_____");
}

function maskAnswer(text, answer) {
  if (!text) return "";
  const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`\\b${escaped}\\b`, "ig"), "(답)");
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
      alert("이 브라우저에서 발음 듣기를 재생하지 못했습니다.");
    }
  });
}

function setActiveTab(tabName) {
  state.activeTab = tabName;
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  els.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === `${tabName}Panel`));
  if (tabName === "history") renderHistory();
}

function getQuestionKind(mode, word) {
  const kinds = [];
  if (word.definition) kinds.push("definition");
  if (word.example && makeBlank(word.example, word.word) !== word.example) kinds.push("blank");
  if (word.definition) kinds.push("choice");
  if (mode !== "mixed" && kinds.includes(mode)) return mode;
  return kinds[Math.floor(Math.random() * kinds.length)] || "definition";
}

function buildQuestion(word, mode) {
  const kind = getQuestionKind(mode, word);
  if (kind === "choice") {
    const wrong = shuffle(state.words.filter((item) => item.word !== word.word && item.definition && !item.needsReview))
      .slice(0, 3)
      .map((item) => item.definition);
    return {
      word,
      kind,
      prompt: `"${word.word}"의 뜻으로 가장 가까운 것은?`,
      hint: `교재 ${word.bookPage}페이지`,
      choices: shuffle([word.definition, ...wrong]),
      answer: word.definition,
    };
  }

  if (kind === "blank") {
    return {
      word,
      kind,
      prompt: makeBlank(word.example, word.word),
      hint: `빈칸에 들어갈 영어 단어를 입력하세요. 교재 ${word.bookPage}페이지`,
      answer: word.word,
    };
  }

  return {
    word,
    kind: "definition",
    prompt: "듣고 단어를 입력하세요.",
    hint: maskAnswer(word.definition || `교재 ${word.bookPage}페이지의 단어입니다.`, word.word),
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
  const filtered = state.words.filter((word) => !word.needsReview && inRange(word.bookPage, scope.pageRange));
  return { filtered, source: scope.source, pageRange: scope.pageRange };
}

function syncQuestionCount(availableCount) {
  els.questionCount.max = String(Math.max(availableCount, 1));
  els.questionCount.placeholder = availableCount ? `최대 ${availableCount}개` : "출제 가능 단어 없음";
  els.questionCount.value = availableCount ? String(availableCount) : "";
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

function renderQuestion() {
  const question = state.questions[state.current];
  state.selectedChoice = "";
  els.quizPanel.hidden = false;
  els.resultsPanel.hidden = true;
  els.feedback.textContent = "";
  els.feedback.className = "feedback";
  els.nextBtn.hidden = true;
  els.checkBtn.hidden = false;
  els.progressText.textContent = `${state.current + 1} / ${state.questions.length}`;
  els.questionType.textContent = question.kind === "choice" ? "객관식" : question.kind === "blank" ? "빈칸" : "정의";
  els.unitBadge.textContent = `p.${question.word.bookPage}`;
  els.questionText.textContent = question.prompt;
  els.questionHint.textContent = question.hint;
  els.questionHint.hidden = true;
  els.hintToggleBtn.hidden = question.kind === "choice";
  els.hintToggleBtn.textContent = "힌트: 영어 설명 보기";
  els.speakBtn.textContent = "듣기";
  els.answerArea.innerHTML = "";

  if (question.kind === "choice") {
    question.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.textContent = choice;
      button.addEventListener("click", () => {
        state.selectedChoice = choice;
        els.answerArea.querySelectorAll(".choice").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
      });
      els.answerArea.appendChild(button);
    });
  } else {
    const input = document.createElement("input");
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = "정답 입력";
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") checkAnswer();
    });
    els.answerArea.appendChild(input);
    input.focus();
  }
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
  state.questions = shuffle(result.filtered).slice(0, count).map((word) => buildQuestion(word, els.quizMode.value));
  state.current = 0;
  state.correct = 0;
  state.missed = [];
  state.activeScope = result.source;
  els.selectedWords.textContent = String(result.filtered.length);
  els.scopeSummary.textContent = result.source;
  renderQuestion();
}

function checkAnswer() {
  const question = state.questions[state.current];
  const answer = question.kind === "choice" ? state.selectedChoice : els.answerArea.querySelector("input")?.value || "";
  if (!answer) {
    els.feedback.textContent = "정답을 입력하거나 선택하세요.";
    els.feedback.className = "feedback bad";
    return;
  }

  const isCorrect = normalizeAnswer(answer) === normalizeAnswer(question.answer);
  if (isCorrect) {
    state.correct += 1;
    els.feedback.textContent = "정답입니다.";
    els.feedback.className = "feedback ok";
  } else {
    state.missed.push({ question, answer });
    els.feedback.textContent = `오답입니다. 정답: ${question.answer}`;
    els.feedback.className = "feedback bad";
  }

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
    mode: els.quizMode.options[els.quizMode.selectedIndex].textContent,
    total: state.questions.length,
    correct: state.correct,
    score,
    missed: state.missed.map(({ question, answer }) => ({
      word: question.word.word,
      page: question.word.bookPage,
      answer: answer || "",
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
  els.historyAverage.textContent = average === null ? "-" : `${average}점`;
  els.historyBest.textContent = best === null ? "-" : `${best}점`;
  els.historyQuestions.textContent = String(totalQuestions);
  els.lastScore.textContent = attempts ? `${history[0].score}점` : "-";
  els.historyList.innerHTML = "";
  els.historyWeakWords.innerHTML = "";

  if (!attempts) {
    els.historyList.innerHTML = `<p class="empty-history">아직 저장된 시험 결과가 없습니다.</p>`;
    return;
  }

  const missedCounts = new Map();
  history.forEach((item) => {
    item.missed.forEach((miss) => {
      missedCounts.set(miss.word, (missedCounts.get(miss.word) || 0) + 1);
    });
  });
  const weakWords = [...missedCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (weakWords.length) {
    els.historyWeakWords.innerHTML = `
      <strong>자주 틀린 단어</strong>
      <div>${weakWords.map(([word, count]) => `<span>${word} ${count}회</span>`).join("")}</div>
    `;
  }

  history.slice(0, 20).forEach((item) => {
    const row = document.createElement("div");
    row.className = "history-item";
    const missedWords = item.missed.map((miss) => miss.word).slice(0, 8).join(", ");
    row.innerHTML = `
      <div>
        <strong>${item.score}점 · ${item.correct}/${item.total}</strong>
        <span>${formatDate(item.date)} · ${item.scope} · ${item.mode}</span>
        <small>${missedWords ? `틀린 단어: ${missedWords}` : "틀린 단어 없음"}</small>
      </div>
    `;
    els.historyList.appendChild(row);
  });
}

function showResults() {
  els.quizPanel.hidden = true;
  els.resultsPanel.hidden = false;
  els.progressText.textContent = `${state.questions.length} / ${state.questions.length}`;
  const score = Math.round((state.correct / state.questions.length) * 100);
  els.resultScore.textContent = `${state.correct} / ${state.questions.length} (${score}점)`;
  els.lastScore.textContent = `${score}점`;
  els.missedList.innerHTML = "";
  saveHistory(makeHistoryRecord(score));

  if (!state.missed.length) {
    els.missedList.textContent = "틀린 단어가 없습니다.";
    return;
  }

  state.missed.forEach(({ question, answer }) => {
    const item = document.createElement("div");
    item.className = "missed-item";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mini-listen";
    button.textContent = "듣기";
    button.addEventListener("click", () => speak(question.word.word));
    const text = document.createElement("div");
    text.innerHTML = `<strong>${question.word.word}</strong><span>내 답: ${answer || "-"} · p.${question.word.bookPage}</span>`;
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
    const usable = state.words.filter((word) => !word.needsReview).length;
    els.totalWords.textContent = String(usable);
    els.dataSummary.textContent = `출제 가능한 단어 ${usable}개를 사용할 수 있습니다.`;
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
    renderWordListPages();
    renderHistory();
    updateSelectedCount();
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
