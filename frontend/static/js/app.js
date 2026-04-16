// SmartStudy AI – app.js

const API = "";

// State
let currentQuestions = [];

// DOM helpers
const $ = (id) => document.getElementById(id);
const show = (el) => el.classList.remove("hidden");
const hide = (el) => el.classList.add("hidden");

function showLoader(msg = "Thinking...") {
  $("loader-msg").textContent = msg;
  show($("loader"));
}
function hideLoader() { hide($("loader")); }

// Word count
$("notes-input").addEventListener("input", () => {
  const words = $("notes-input").value.trim().split(/\s+/).filter(Boolean).length;
  $("notes-meta").textContent = `${words} word${words !== 1 ? "s" : ""}`;
});

// Tab switching
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab-panel").forEach((p) => hide(p));
    show($(`tab-${tab}`));
  });
});

// API call wrapper
async function callAPI(endpoint, body) {
  const res = await fetch(`${API}/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed." }));
    throw new Error(err.error || "Something went wrong.");
  }
  return res.json();
}

function getNotes() {
  return $("notes-input").value.trim();
}

// SUMMARIZE
$("btn-summarize").addEventListener("click", async () => {
  const notes = getNotes();
  if (!notes) { alert("Please paste your notes first."); return; }
  showLoader("Summarizing your notes...");
  try {
    const data = await callAPI("summarize", { notes });
    $("summary-content").textContent = data.summary;
    show($("summary-result"));
  } catch (e) {
    alert("Error: " + e.message);
  } finally {
    hideLoader();
  }
});

// QUIZ GENERATION
$("btn-generate-quiz").addEventListener("click", async () => {
  const notes = getNotes();
  if (!notes) { alert("Please paste your notes first."); return; }
  const numQ = parseInt($("num-questions").value);
  showLoader("Generating quiz questions...");
  try {
    const data = await callAPI("generate_questions", { notes, num_questions: numQ });
    currentQuestions = data.questions;
    renderQuiz(currentQuestions);
    show($("quiz-area"));
    hide($("quiz-result"));
  } catch (e) {
    alert("Error: " + e.message);
  } finally {
    hideLoader();
  }
});

function renderQuiz(questions) {
  const container = $("questions-container");
  container.innerHTML = "";
  questions.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "question-card";
    card.innerHTML = `
      <div class="question-text">${idx + 1}. ${q.question}</div>
      <div class="options">
        ${q.options.map((opt) => `
          <label class="option-label">
            <input type="radio" name="q${idx}" value="${escapeHtml(opt)}"/>
            ${escapeHtml(opt)}
          </label>
        `).join("")}
      </div>`;
    container.appendChild(card);
  });
}

// QUIZ SUBMISSION
$("btn-submit-quiz").addEventListener("click", async () => {
  const userAnswers = currentQuestions.map((_, idx) => {
    const selected = document.querySelector(`input[name="q${idx}"]:checked`);
    return selected ? selected.value : "";
  });

  if (userAnswers.some((a) => !a)) {
    alert("Please answer all questions before submitting.");
    return;
  }

  showLoader("Grading your quiz...");
  try {
    const data = await callAPI("feedback", {
      questions: currentQuestions,
      user_answers: userAnswers,
    });
    renderQuizResult(data);
    hide($("quiz-area"));
    show($("quiz-result"));
  } catch (e) {
    alert("Error: " + e.message);
  } finally {
    hideLoader();
  }
});

function renderQuizResult(data) {
  const emoji = data.percent >= 80 ? "🎉" : data.percent >= 60 ? "👍" : "📖";
  $("score-display").textContent = `${emoji} ${data.score}/${data.total} (${data.percent}%)`;
  $("feedback-content").textContent = data.feedback;

  const review = $("answer-review");
  review.innerHTML = "<br/><strong>Question Review:</strong><br/>";
  data.results.forEach((r, i) => {
    const div = document.createElement("div");
    div.className = `review-item ${r.is_correct ? "correct" : "wrong"}`;
    div.innerHTML = `
      <strong>${i + 1}. ${r.question}</strong>
      Your answer: ${escapeHtml(r.user_answer)}<br/>
      ${!r.is_correct ? `Correct answer: ${escapeHtml(r.correct_answer)}<br/>` : ""}
      <em>${r.explanation}</em>`;
    review.appendChild(div);
  });
}

// RETAKE
$("btn-retake").addEventListener("click", () => {
  hide($("quiz-result"));
  renderQuiz(currentQuestions);
  show($("quiz-area"));
});

// ASK A QUESTION
$("btn-ask").addEventListener("click", askQuestion);
$("question-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") askQuestion();
});

async function askQuestion() {
  const question = $("question-input").value.trim();
  if (!question) { alert("Please enter a question."); return; }
  showLoader("Finding your answer...");
  try {
    const data = await callAPI("ask", { question, notes: getNotes() });
    $("ask-content").textContent = data.answer;
    show($("ask-result"));
  } catch (e) {
    alert("Error: " + e.message);
  } finally {
    hideLoader();
  }
}

// Utility
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
