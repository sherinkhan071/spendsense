
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const email = params.get("email");
    const role = params.get("role");

    if (!token || !email) {
      setError("Google sign-in failed. Please try again.");
      return;
    }

    localStorage.setItem("spendsense_token", token);
    localStorage.setItem("spendsense_email", email);
    localStorage.setItem("spendsense_role", role || "");

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    navigate("/", { replace: true });
  }, [navigate]);

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <h2>Sign-in failed</h2>
        <p>{error}</p>
        <button onClick={() => navigate("/", { replace: true })}>
          Return to SpendSense
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      Completing Google sign-in...
    </div>
  );
}
