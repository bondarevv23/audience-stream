const { requestJson } = require("./api");

async function askGemini(question) {
  if (!question || !question.trim()) {
    throw new Error("Question is required");
  }

  return requestJson("/admin/gemini-query", {
    method: "POST",
    body: JSON.stringify({
      question: question.trim()
    })
  });
}

module.exports = {
  askGemini
};
