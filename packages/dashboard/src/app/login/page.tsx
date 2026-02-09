"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { coordFetch, setCoordToken } from "@/lib/coord";
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

      // Also try coord login (don't fail if it errors)
      try {
        const coordResult = await coordFetch<{ token: string }>("/api/coord/users/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
          auth: false,
        });
        setCoordToken(coordResult.token);
      } catch {
        // Coord login is optional
      }

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
      await coordFetch("/api/coord/api-keys/validate", {
        method: "POST",
        body: JSON.stringify({ api_key: apiKey }),
        auth: false,
      });
      setCoordToken(apiKey);
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
