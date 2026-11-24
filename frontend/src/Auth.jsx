
import { useState } from "react";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const API_URL = `${BASE}/api/auth`;
export default function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const endpoint =
        mode === "forgot"
          ? `${API_URL}/forgot-password`
          : `${API_URL}/${mode}`;

      const body =
        mode === "forgot"
          ? { email }
          : { email, password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Something went wrong."
        );
      }

      if (mode === "forgot") {
        setMessage(
          data.message ||
            "If your account exists, password reset instructions will be sent."
        );
        return;
      }

      localStorage.setItem("spendsense_token", data.token);
      localStorage.setItem("spendsense_email", data.email);
      localStorage.setItem("spendsense_role", data.role || "");

      onAuthenticated(data);
    } catch (error) {
      setMessage(error.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    window.location.href =
`${BASE}/oauth2/authorization/google`;  }

  return (
    <div className="auth-card">
      <div className="auth-heading">
        <h2>
          {mode === "forgot"
            ? "Forgot password?"
            : mode === "register"
              ? "Create your account"
              : "Welcome to SpendSense"}
        </h2>

        <p>
          {mode === "forgot"
            ? "Enter your email to request a password reset."
            : mode === "register"
              ? "Create an account to manage your finances."
              : "Sign in to access your personal finances."}
        </p>
      </div>

      {mode !== "forgot" && (
        <>
          <button
            type="button"
            className="google-button"
            onClick={handleGoogleLogin}
          >
            <span className="google-g">G</span>
            Continue with Google
          </button>

          <div className="auth-divider">
            <span>OR CONTINUE WITH EMAIL</span>
          </div>
        </>
      )}

      <form onSubmit={handleSubmit}>
        <label htmlFor="auth-email">Email address</label>
        <input
          id="auth-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        {mode !== "forgot" && (
          <>
            <div className="password-label">
              <label htmlFor="auth-password">Password</label>

              {mode === "login" && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setMode("forgot");
                    setMessage("");
                  }}
                >
                  Forgot password?
                </button>
              )}
            </div>

            <input
              id="auth-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </>
        )}

        {message && (
          <p className="auth-message" role="status">
            {message}
          </p>
        )}

        <button
          type="submit"
          className="auth-submit"
          disabled={loading}
        >
          {loading
            ? "Please wait..."
            : mode === "forgot"
              ? "Send Reset Instructions"
              : mode === "register"
                ? "Create Account"
                : "Sign In"}
        </button>
      </form>

      <div className="auth-footer">
        {mode === "forgot" ? (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setMode("login");
              setMessage("");
            }}
          >
            ← Back to sign in
          </button>
        ) : (
          <>
            {mode === "login"
              ? "Don't have an account? "
              : "Already have an account? "}

            <button
              type="button"
              className="text-button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setMessage("");
              }}
            >
              {mode === "login" ? "Create account" : "Sign in"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
