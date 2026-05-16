import { useMemo, useState } from "react";
import Notice from "../components/Notice";
import { askGemini, hasElectronBridge } from "../services/adminApiClient";

function getResultSummary(answer) {
  if (!answer) {
    return null;
  }

  if (typeof answer === "string") {
    return answer;
  }

  return answer.summary || answer.answer || answer.message || "Response received from backend.";
}

function getMatchedUsers(answer) {
  if (!answer) {
    return [];
  }

  return answer.matched_users || answer.users || answer.user_ids || [];
}

export default function GeminiQueryDashboard() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [error, setError] = useState("");
  const [isAsking, setIsAsking] = useState(false);

  const resultSummary = useMemo(() => getResultSummary(answer), [answer]);
  const matchedUsers = useMemo(() => getMatchedUsers(answer), [answer]);

  async function handleAskGemini(event) {
    event.preventDefault();

    const cleanQuestion = question.trim();

    if (!cleanQuestion) {
      return;
    }

    if (!hasElectronBridge()) {
      setAnswer({
        mode: "preview",
        question: cleanQuestion,
        summary: "Run Administrator Statistics through Electron to call the backend Gemini endpoint.",
        matched_users: []
      });
      return;
    }

    setIsAsking(true);
    setAnswer(null);
    setError("");

    try {
      const response = await askGemini(cleanQuestion);
      setAnswer(response);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <section className="ask-workspace">
      <form className="ask-card" onSubmit={handleAskGemini}>
        <div className="ask-header">
          <div>
            <p className="eyebrow">Gemini assisted query</p>
            <h3>Ask a database question</h3>
          </div>
          <span className="ask-status">{isAsking ? "Processing" : "Ready"}</span>
        </div>

        <label htmlFor="gemini-question">Question</label>
        <textarea
          id="gemini-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask which users visited a domain, searched for a product, or showed purchase intent."
        />

        <div className="ask-footer">
          <p>Backend filters stored events and sends only relevant context to Gemini.</p>
          <button className="primary-button ask-submit" type="submit" disabled={isAsking || !question.trim()}>
            {isAsking ? "Running query..." : "Run query"}
          </button>
        </div>
      </form>

      <section className="result-card">
        <div className="table-header">
          <h3>Query result</h3>
          <span>{answer ? "Response loaded" : "No response"}</span>
        </div>

        <Notice>{error ? `Gemini request failed: ${error}` : ""}</Notice>

        {!answer ? (
          <div className="answer-empty">
            <h4>No result yet</h4>
            <p>Run a question to view the backend response, matched users, and raw structured output.</p>
          </div>
        ) : (
          <div className="result-content">
            <div className="result-summary">
              <span>Summary</span>
              <p>{resultSummary}</p>
            </div>

            <div className="result-users">
              <div className="table-header compact">
                <h3>Matched user IDs</h3>
                <span>{matchedUsers.length} users</span>
              </div>
              {matchedUsers.length === 0 ? (
                <p className="muted-result">No matched users returned.</p>
              ) : (
                <div className="user-chip-list">
                  {matchedUsers.map((user) => (
                    <span key={typeof user === "string" ? user : user.user_id || user.id}>
                      {typeof user === "string" ? user : user.user_id || user.id}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <details className="raw-result">
              <summary>Raw response</summary>
              <pre>{JSON.stringify(answer, null, 2)}</pre>
            </details>
          </div>
        )}
      </section>
    </section>
  );
}
