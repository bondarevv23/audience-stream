import { useState } from "react";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setError("");
      onLogin();
      return;
    }

    setError("Invalid username or password");
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-brand">
          <div>
            <p className="eyebrow">Analytics workspace</p>
            <h1>Administrator Statistics</h1>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="admin"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="admin"
          />

          {error && <p className="login-error">{error}</p>}

          <button className="primary-button" type="submit">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
