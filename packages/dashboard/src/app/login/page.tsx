"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Mode = "login" | "register" | "agent";

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] px-4 py-3 text-sm",
        "text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
        props.className
      )}
    />
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState("");
  const [regTelegram, setRegTelegram] = useState("");

  // Agent state
  const [apiKey, setApiKey] = useState("");

  // Shared state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{
        token: string;
        employee: { id: string; name: string; email: string; role: string; status: string };
      }>("/api/employees/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("employee_token", result.token);
      localStorage.setItem("employee_info", JSON.stringify(result.employee));

      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await apiFetch<{
        id: string;
        name: string;
        status: string;
        message: string;
      }>("/api/employees/register", {
        method: "POST",
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          role: regRole || "employee",
          telegramUsername: regTelegram || null,
        }),
      });
      setSuccess(result.message);
      setRegName("");
      setRegEmail("");
      setRegPassword("");
      setRegRole("");
      setRegTelegram("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleAgentLogin() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/agents/validate-key", {
        method: "POST",
        body: JSON.stringify({ api_key: apiKey }),
      });
      localStorage.setItem("agent_api_key", apiKey);
      window.location.href = "/coordination";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid API key");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(newMode: Mode) {
    setMode(newMode);
    setError(null);
    setSuccess(null);
  }

  const modeLabels: Record<Mode, string> = {
    login: "Sign In",
    register: "Register",
    agent: "Agent Key",
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          Access
        </p>
        <h1 className="text-2xl font-semibold mt-2">
          {mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Agent Access"}
        </h1>
        <p className="text-sm text-[var(--muted)] mt-2">
          {mode === "register"
            ? "Register a new account. CEO will approve your access."
            : "Sign in to access the dashboard."}
        </p>

        {/* Mode tabs */}
        <div className="mt-6 flex gap-2">
          {(["login", "register", "agent"] as Mode[]).map((item) => (
            <button
              key={item}
              onClick={() => switchMode(item)}
              className={cn(
                "flex-1 rounded-full border px-3 py-2 text-sm transition",
                mode === item
                  ? "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              {modeLabels[item]}
            </button>
          ))}
        </div>

        {/* Login form */}
        {mode === "login" && (
          <div className="mt-6 space-y-3">
            {/* GitHub OAuth */}
            <button
              onClick={() => {
                const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
                if (!clientId) {
                  setError("GitHub OAuth not configured. Use email/password login.");
                  return;
                }
                const redirectUri = `${window.location.origin}/login/callback`;
                window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user,user:email`;
              }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[#24292e] px-4 py-3 text-sm text-white font-medium hover:bg-[#2f363d] transition"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Sign in with GitHub
            </button>

            <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
              <div className="flex-1 border-t border-[var(--card-border)]" />
              <span>or use email</span>
              <div className="flex-1 border-t border-[var(--card-border)]" />
            </div>

            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={handleLogin}
              disabled={loading || !email || !password}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </div>
        )}

        {/* Register form */}
        {mode === "register" && (
          <div className="mt-6 space-y-3">
            <Input
              placeholder="Full name *"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
            />
            <Input
              type="email"
              placeholder="Email *"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password *"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Role (optional)"
                value={regRole}
                onChange={(e) => setRegRole(e.target.value)}
              />
              <Input
                placeholder="Telegram (optional)"
                value={regTelegram}
                onChange={(e) => setRegTelegram(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleRegister}
              disabled={loading || !regName || !regEmail || !regPassword}
            >
              {loading ? "Registering..." : "Submit Registration"}
            </Button>
            <p className="text-[10px] text-[var(--muted)] text-center">
              After registration, CEO must approve your account before you can log in.
            </p>
          </div>
        )}

        {/* Agent API key form */}
        {mode === "agent" && (
          <div className="mt-6 space-y-3">
            <Input
              placeholder="API key (ak_agent_...)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={handleAgentLogin}
              disabled={loading || !apiKey}
            >
              {loading ? "Verifying..." : "Use API key"}
            </Button>
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <p className="text-sm text-emerald-400 text-center">{success}</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
        )}

        <p className="mt-6 text-xs text-[var(--muted)] text-center">
          Tokens are stored locally in this browser.
        </p>
      </div>
    </div>
  );
}
