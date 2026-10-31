"use client";
import { useEffect, useState } from "react";
import { authClient } from "../../lib/auth-client";
import { providerLabels, type LoginProvider } from "../../lib/security/oauth-feedback";
import { Button, StatusMessage } from "../ui/primitives";

export default function ConnectedMethod({ userId, provider, pending, onConnect }: {
  userId: string; provider: LoginProvider; pending: boolean; onConnect: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ owner: string; providers: string[] } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await authClient.listAccounts();
        if (response.error || !Array.isArray(response.data)) throw new Error("Unavailable");
        if (active) { setResult({ owner: userId, providers: response.data.map(account => account.providerId) }); setError(false); }
      } catch { if (active) setError(true); }
    })();
    return () => { active = false; };
  }, [userId, attempt]);
  if (error) return <div className="space-y-3"><StatusMessage tone="error">Could not check connected methods. Retry before connecting an account.</StatusMessage><Button type="button" onClick={() => { setError(false); setResult(null); setAttempt(value => value + 1); }}>Retry connected methods</Button></div>;
  if (!result || result.owner !== userId) return <p role="status" className="text-sm text-muted-foreground">Checking connected methods...</p>;
  if (result.providers.includes(provider)) return <StatusMessage tone="success">{providerLabels[provider]} is connected to this account. You can use either connected provider on your next sign-in.</StatusMessage>;
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Step 2: Connect {providerLabels[provider]} using the same verified email. Your existing account and projects stay together.</p>
    <Button type="button" className="w-full" pending={pending} disabled={pending} onClick={onConnect}>Connect {providerLabels[provider]}</Button>
  </div>;
}
