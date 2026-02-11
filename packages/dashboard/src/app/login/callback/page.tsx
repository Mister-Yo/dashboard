"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

function CallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");

    if (!code) {
      setStatus("error");
      setError("No authorization code received from GitHub.");
      return;
    }

    async function exchangeCode(code: string) {
      try {
        const result = await apiFetch<{
          token: string;
          employee: { id: string; name: string; email: string; role: string; avatarUrl?: string };
        }>("/api/auth/github", {
          method: "POST",
          body: JSON.stringify({ code }),
        });

        // Store JWT and user info
        localStorage.setItem("employee_token", result.token);
        localStorage.setItem("employee_info", JSON.stringify(result.employee));

        // Redirect to dashboard
        window.location.href = "/";
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Authentication failed");
      }
    }

    exchangeCode(code);
  }, [searchParams]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8 text-center">
        {status === "loading" && (
          <>
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent mb-4" />
            <h2 className="text-lg font-semibold">Signing in with GitHub...</h2>
            <p className="text-sm text-[var(--muted)] mt-2">Please wait while we verify your identity.</p>
          </>
        )}

        {status === "error" && (
          <>
            <p className="text-4xl mb-4">&#x26A0;&#xFE0F;</p>
            <h2 className="text-lg font-semibold text-red-400">Authentication Failed</h2>
            <p className="text-sm text-[var(--muted)] mt-2">{error}</p>
            <a
              href="/login"
              className="inline-block mt-6 rounded-full bg-[var(--accent)] px-6 py-2 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90 transition"
            >
              Back to Login
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
