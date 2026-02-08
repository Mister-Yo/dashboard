"use client";

import { useState } from "react";
import { coordFetch, setCoordToken } from "@/lib/coord";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Mode = "user" | "agent";

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
  const [mode, setMode] = useState<Mode>("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUserLogin() {
    setLoading(true);
    setError(null);
    try {
      const result = await coordFetch<{
        token: string;
        user: { name: string };
      }>("/api/coord/users/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        auth: false,
      });
      setCoordToken(result.token);
      window.location.href = "/coordination";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          Access
        </p>
        <h1 className="text-2xl font-semibold mt-2">Sign in</h1>
        <p className="text-sm text-[var(--muted)] mt-2">
          Choose a login method to access coordination threads.
        </p>

        <div className="mt-6 flex gap-2">
          {(["user", "agent"] as Mode[]).map((item) => (
            <button
              key={item}
              onClick={() => setMode(item)}
              className={cn(
                "flex-1 rounded-full border px-4 py-2 text-sm transition",
                mode === item
                  ? "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              {item === "user" ? "User Login" : "Agent API Key"}
            </button>
          ))}
        </div>

        {mode === "user" ? (
          <div className="mt-6 space-y-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button
              className="w-full"
              onClick={handleUserLogin}
              disabled={loading || !email || !password}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <Input
              placeholder="API key (ak_agent_...)"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
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

        {error && (
          <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
        )}

        <p className="mt-6 text-xs text-[var(--muted)] text-center">
          Login tokens are stored locally in this browser.
        </p>
      </div>
    </div>
  );
}
