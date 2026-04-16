"""
SmartStudy AI - Backend (Flask + Gemini)
Navneet Kaur | Module 204
"""

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import os
import re
import json
import google.generativeai as genai

app = Flask(
    __name__,
    template_folder="../frontend/templates",
    static_folder="../frontend/static"
)
CORS(app)

genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/summarize", methods=["POST"])
def summarize():
    data = request.get_json()
    notes = data.get("notes", "").strip()
    if not notes:
        return jsonify({"error": "No notes provided."}), 400

    prompt = f"""You are SmartStudy AI, an academic assistant for college students.
Summarize the following notes clearly and concisely.
Use bullet points for key ideas. Highlight the most important concepts.
Keep the summary under 300 words.

NOTES:
{notes}"""

    response = model.generate_content(prompt)
    return jsonify({"summary": response.text})


@app.route("/api/generate_questions", methods=["POST"])
def generate_questions():
    data = request.get_json()
    notes = data.get("notes", "").strip()
    num_q = int(data.get("num_questions", 5))
    if not notes:
        return jsonify({"error": "No notes provided."}), 400

    prompt = f"""You are SmartStudy AI. Generate exactly {num_q} multiple-choice practice questions
based on the following notes. Each question must test understanding, not just memorization.

Return ONLY valid JSON in this exact format (no extra text, no markdown):
{{
  "questions": [
    {{
      "question": "Question text here?",
      "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
      "answer": "A) option1",
      "explanation": "Brief explanation of why this is correct."
    }}
  ]
}}

NOTES:
{notes}"""

    response = model.generate_content(prompt)
    raw = response.text.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"```$", "", raw).strip()
    return jsonify(json.loads(raw))


@app.route("/api/feedback", methods=["POST"])
def feedback():
    data = request.get_json()
    questions = data.get("questions", [])
    user_answers = data.get("user_answers", [])
    if not questions or not user_answers:
        return jsonify({"error": "Missing questions or answers."}), 400

    results = []
    score = 0
    for q, ua in zip(questions, user_answers):
        correct = q["answer"].strip()
        is_correct = ua.strip() == correct
        if is_correct:
            score += 1
        results.append({
            "question": q["question"],
            "user_answer": ua,
            "correct_answer": correct,
            "is_correct": is_correct,
            "explanation": q.get("explanation", "")
        })

    percent = round((score / len(questions)) * 100)

    prompt = f"""You are SmartStudy AI. A student just completed a practice quiz.
Score: {score}/{len(questions)} ({percent}%)

Quiz results:
{json.dumps(results, indent=2)}

Write personalized, encouraging academic feedback (3-5 sentences).
Point out missed topics and give one specific study tip. Be friendly and supportive."""

    response = model.generate_content(prompt)
    return jsonify({
        "score": score,
        "total": len(questions),
        "percent": percent,
        "results": results,
        "feedback": response.text
    })


@app.route("/api/ask", methods=["POST"])
def ask():
    data = request.get_json()
    question = data.get("question", "").strip()
    notes = data.get("notes", "").strip()
    if not question:
        return jsonify({"error": "No question provided."}), 400

    context = f"\n\nStudent's notes for context:\n{notes}" if notes else ""
    prompt = f"""You are SmartStudy AI, a helpful academic tutor for college students.
Answer the following student question clearly and concisely.{context}

Student question: {question}"""

    response = model.generate_content(prompt)
    return jsonify({"answer": response.text})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)

