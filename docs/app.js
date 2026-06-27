const state = {
  words: [],
  toc: [],
  filtered: [],
  questions: [],
  current: 0,
  correct: 0,
  missed: [],
  selectedChoice: "",
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
  scopeSummary: document.querySelector("#scopeSummary"),
  tocList: document.querySelector("#tocList"),
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
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/페이지|page|pages|p\.?/g, "")
    .replace(/단원|unit|유닛/g, "")
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
      hint: `교재 ${word.bookPage}페이지 · Unit ${word.unit}`,
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

function pageRangeFromUnits(unitRange) {
  if (!unitRange) return null;
  const selected = state.toc.filter((unit) => inRange(unit.unit, unitRange));
  if (!selected.length) return null;
  const starts = selected.map((unit) => unit.wordListPages[0]);
  const ends = selected.map((unit) => unit.wordListPages[1]);
  return [Math.min(...starts), Math.max(...ends)];
}

function resolveScope() {
  const pageRange = parseRange(els.pageRange.value);
  const unitRange = parseRange(els.unitRange.value);
  const hasPageInput = Boolean(els.pageRange.value.trim());
  const hasUnitInput = Boolean(els.unitRange.value.trim());

  if (hasPageInput && !pageRange) {
    return { error: "페이지 범위는 8 또는 8-15 형식으로 입력하세요." };
  }
  if (hasUnitInput && !unitRange) {
    return { error: "단원 범위는 1 또는 1-3 형식으로 입력하세요." };
  }

  if (pageRange) {
    return { pageRange, source: `교재 ${rangeText(pageRange)}페이지 기준` };
  }
  if (unitRange) {
    const converted = pageRangeFromUnits(unitRange);
    if (!converted) return { error: "해당 단원 범위를 찾을 수 없습니다." };
    return {
      pageRange: converted,
      source: `Unit ${rangeText(unitRange)}의 단어 목록 페이지(${rangeText(converted)}) 기준`,
    };
  }
  return { pageRange: null, source: "전체 단어 목록 페이지 기준" };
}

function filterWords() {
  const scope = resolveScope();
  if (scope.error) return scope;
  const filtered = state.words.filter(
    (word) => !word.needsReview && inRange(word.bookPage, scope.pageRange)
  );
  return { filtered, source: scope.source, pageRange: scope.pageRange };
}

function updateSelectedCount() {
  const result = filterWords();
  els.selectedWords.textContent = result.error ? "-" : String(result.filtered.length);
  els.scopeSummary.textContent = result.error || result.source;
}

function renderToc() {
  els.tocList.innerHTML = "";
  state.toc.forEach((unit) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toc-card";
    button.innerHTML = `
      <strong>Unit ${unit.unit}. ${unit.title}</strong>
      <span>단어 목록: ${rangeText(unit.wordListPages)}페이지 · 전체: ${rangeText(unit.allPages)}페이지</span>
    `;
    button.addEventListener("click", () => {
      els.pageRange.value = rangeText(unit.wordListPages);
      els.unitRange.value = "";
      updateSelectedCount();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    els.tocList.appendChild(button);
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
  els.unitBadge.textContent = `Unit ${question.word.unit} · p.${question.word.bookPage}`;
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
    alert("선택한 페이지 범위에 출제 가능한 단어가 없습니다.");
    return;
  }

  const count = Math.min(Number(els.questionCount.value) || 10, result.filtered.length);
  state.filtered = result.filtered;
  state.questions = shuffle(result.filtered).slice(0, count).map((word) => buildQuestion(word, els.quizMode.value));
  state.current = 0;
  state.correct = 0;
  state.missed = [];
  els.selectedWords.textContent = String(result.filtered.length);
  els.scopeSummary.textContent = result.source;
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
    item.innerHTML = `<strong>${question.word.word}</strong><span>내 답: ${answer || "-"} · Unit ${question.word.unit} · p.${question.word.bookPage}</span>`;
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
    els.dataSummary.textContent = `출제 가능한 단어 ${usable}개를 페이지 기준으로 사용할 수 있습니다.`;
    renderToc();
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
