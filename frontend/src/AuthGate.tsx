
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import App from "./App";
import {
  clearDemoToken,
  getCases,
  hasDemoToken,
  setDemoToken,
} from "./api";

function AuthGate() {
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function validateExistingSession() {
      if (!hasDemoToken()) {
        setChecking(false);
        return;
      }

      try {
        await getCases();
        setAuthenticated(true);
      } catch {
        clearDemoToken();
      } finally {
        setChecking(false);
      }
    }

    void validateExistingSession();
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token.trim()) {
      setError("Please enter your access token.");
      return;
    }

    setError("");
    setChecking(true);
    setDemoToken(token);

    try {
      await getCases();
      setAuthenticated(true);
      setToken("");
    } catch {
      clearDemoToken();
      setError("Invalid access token. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  if (checking) {
    return (
      <div style={styles.page}>
        <p style={styles.subtitle}>Verifying access...</p>
      </div>
    );
  }

  if (authenticated) {
    return <App />;
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>A</div>

        <h1 style={styles.heading}>ANVĪKṢĀ INTEL</h1>

        <p style={styles.subtitle}>
          Intelligence & Digital Investigation Platform
        </p>

        <form onSubmit={handleLogin} style={styles.form}>
          <label htmlFor="demo-token" style={styles.label}>
            DEMO ACCESS TOKEN
          </label>

          <input
            id="demo-token"
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Enter your access token"
            autoComplete="current-password"
            style={styles.input}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            disabled={checking}
            style={styles.button}
          >
            {checking ? "VERIFYING..." : "ACCESS PLATFORM"}
          </button>
        </form>

        <p style={styles.footer}>
          Authorized demo access only
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#080d18",
    padding: "20px",
    boxSizing: "border-box" as const,
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    padding: "40px 32px",
    background: "#111a2b",
    border: "1px solid #263650",
    borderRadius: "14px",
    textAlign: "center" as const,
    boxSizing: "border-box" as const,
  },
  logo: {
    width: "58px",
    height: "58px",
    margin: "0 auto 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#193b60",
    color: "#70c5ff",
    borderRadius: "12px",
    fontSize: "30px",
    fontWeight: "bold",
  },
  heading: {
    color: "#f1f5f9",
    fontSize: "25px",
    letterSpacing: "2px",
    marginBottom: "10px",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  form: {
    marginTop: "35px",
    textAlign: "left" as const,
  },
  label: {
    display: "block",
    color: "#a9bad0",
    fontSize: "11px",
    fontWeight: "bold",
    letterSpacing: "1.5px",
    marginBottom: "10px",
  },
  input: {
    width: "100%",
    padding: "14px",
    boxSizing: "border-box" as const,
    borderRadius: "7px",
    border: "1px solid #344963",
    background: "#0b1423",
    color: "#ffffff",
    fontSize: "14px",
    outline: "none",
  },
  button: {
    width: "100%",
    marginTop: "20px",
    padding: "14px",
    border: "none",
    borderRadius: "7px",
    background: "#1769aa",
    color: "#ffffff",
    fontWeight: "bold",
    letterSpacing: "1px",
    cursor: "pointer",
  },
  error: {
    color: "#ff7777",
    fontSize: "13px",
    marginTop: "12px",
  },
  footer: {
    color: "#64748b",
    fontSize: "11px",
    marginTop: "30px",
  },
};

export default AuthGate;
