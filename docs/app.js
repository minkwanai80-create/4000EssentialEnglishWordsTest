const state = {
  words: [],
  filtered: [],
  questions: [],
  current: 0,
  correct: 0,
  missed: [],
  selectedChoice: "",
  settings: null,
};

const els = {
  dataSummary: document.querySelector("#dataSummary"),
  lastScore: document.querySelector("#lastScore"),
  unitRange: document.querySelector("#unitRange"),
  pageRange: document.querySelector("#pageRange"),
  questionCount: document.querySelector("#questionCount"),
  quizMode: document.querySelector("#quizMode"),
  startBtn: document.querySelector("#startBtn"),
  totalWords: document.querySelector("#totalWords"),
  selectedWords: document.querySelector("#selectedWords"),
  progressText: document.querySelector("#progressText"),
  quizPanel: document.querySelector("#quizPanel"),
  questionType: document.querySelector("#questionType"),
  unitBadge: document.querySelector("#unitBadge"),
  questionText: document.querySelector("#questionText"),
  questionHint: document.querySelector("#questionHint"),
  answerArea: document.querySelector("#answerArea"),
  checkBtn: document.querySelector("#checkBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  feedback: document.querySelector("#feedback"),
  resultsPanel: document.querySelector("#resultsPanel"),
  resultScore: document.querySelector("#resultScore"),
  missedList: document.querySelector("#missedList"),
  retryBtn: document.querySelector("#retryBtn"),
};

function normalizeAnswer(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function parseRange(value) {
  const raw = String(value || "").trim();
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
    const wrong = shuffle(state.words.filter((item) => item.word !== word.word && item.definition))
      .slice(0, 3)
      .map((item) => item.definition);
    return {
      word,
      kind,
      prompt: `"${word.word}"의 뜻으로 가장 가까운 것은?`,
      hint: `Unit ${word.unit} · Page ${word.page}`,
      choices: shuffle([word.definition, ...wrong]),
      answer: word.definition,
    };
  }

  if (kind === "blank") {
    return {
      word,
      kind,
      prompt: makeBlank(word.example, word.word),
      hint: "빈칸에 들어갈 영어 단어를 입력하세요.",
      answer: word.word,
    };
  }

  return {
    word,
    kind: "definition",
    prompt: word.definition || `Unit ${word.unit}의 단어입니다.`,
    hint: "정의에 맞는 영어 단어를 입력하세요.",
    answer: word.word,
  };
}

function filterWords() {
  const unitRange = parseRange(els.unitRange.value);
  const pageRange = parseRange(els.pageRange.value);
  if ((els.unitRange.value.trim() && !unitRange) || (els.pageRange.value.trim() && !pageRange)) {
    return { error: "범위는 1 또는 1-3 형식으로 입력하세요." };
  }
  const filtered = state.words.filter(
    (word) => !word.needsReview && inRange(word.unit, unitRange) && inRange(word.page, pageRange)
  );
  return { filtered };
}

function updateSelectedCount() {
  const result = filterWords();
  els.selectedWords.textContent = result.error ? "-" : String(result.filtered.length);
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
  els.unitBadge.textContent = `Unit ${question.word.unit}`;
  els.questionText.textContent = question.prompt;
  els.questionHint.textContent = question.hint;
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
    alert("선택한 범위에 단어가 없습니다.");
    return;
  }

  const count = Math.min(Number(els.questionCount.value) || 10, result.filtered.length);
  state.filtered = result.filtered;
  state.questions = shuffle(result.filtered).slice(0, count).map((word) => buildQuestion(word, els.quizMode.value));
  state.current = 0;
  state.correct = 0;
  state.missed = [];
  state.settings = {
    unitRange: els.unitRange.value,
    pageRange: els.pageRange.value,
    questionCount: els.questionCount.value,
    quizMode: els.quizMode.value,
  };
  els.selectedWords.textContent = String(result.filtered.length);
  renderQuestion();
}

function checkAnswer() {
  const question = state.questions[state.current];
  const answer =
    question.kind === "choice" ? state.selectedChoice : els.answerArea.querySelector("input")?.value || "";
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

  els.checkBtn.hidden = true;
  els.nextBtn.hidden = false;
}

function showResults() {
  els.quizPanel.hidden = true;
  els.resultsPanel.hidden = false;
  els.progressText.textContent = `${state.questions.length} / ${state.questions.length}`;
  const score = Math.round((state.correct / state.questions.length) * 100);
  els.resultScore.textContent = `${state.correct} / ${state.questions.length} (${score}점)`;
  els.lastScore.textContent = `${score}점`;
  els.missedList.innerHTML = "";

  if (!state.missed.length) {
    els.missedList.textContent = "틀린 단어가 없습니다.";
    return;
  }

  state.missed.forEach(({ question, answer }) => {
    const item = document.createElement("div");
    item.className = "missed-item";
    item.innerHTML = `<strong>${question.word.word}</strong><span>내 답: ${answer || "-"} · Unit ${question.word.unit} · Page ${question.word.page}</span>`;
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
    const response = await fetch("./data/words.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.words = await response.json();
    els.totalWords.textContent = String(state.words.length);
    els.dataSummary.textContent = `총 ${state.words.length}개 단어를 사용할 수 있습니다.`;
    updateSelectedCount();
  } catch (error) {
    els.dataSummary.textContent = "단어 데이터를 불러오지 못했습니다.";
    console.error(error);
  }
}

els.startBtn.addEventListener("click", startQuiz);
els.checkBtn.addEventListener("click", checkAnswer);
els.nextBtn.addEventListener("click", nextQuestion);
els.retryBtn.addEventListener("click", startQuiz);
els.unitRange.addEventListener("input", updateSelectedCount);
els.pageRange.addEventListener("input", updateSelectedCount);

init();
