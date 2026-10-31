"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginDestination } from "../../lib/security/login-destination";
import { authClient } from "../../lib/auth-client";
import ConnectedMethod from "../../components/auth/connected-method";
import { connectionProvider, connectionReturn } from "../../lib/security/oauth-connection";
import SignOutButton from "../../components/auth/sign-out-button";
import PageLoading from "../../components/ui/page-loading";
import ThemeSelector from "../../components/theme/theme-selector";
import { Button, StatusMessage } from "../../components/ui/primitives";
import { oauthErrorCallback, oauthFeedback, providerLabels, type LoginProvider, type OAuthAction } from "../../lib/security/oauth-feedback";
import RowzenBrand from "../../components/brand/rowzen-brand";
import { ArrowLeft, ArrowUpRight, Columns3, FileCheck2, Download } from "lucide-react";


function LoginFrame({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground">
    <a href="#login-main" className="sr-only z-50 rounded-lg bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to sign in</a>
    <header className="mx-auto flex min-h-20 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <RowzenBrand /><ThemeSelector />
    </header>
    <main id="login-main" tabIndex={-1} className="mx-auto grid min-h-[calc(100dvh-10rem)] w-full max-w-7xl items-center px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-2 lg:gap-16 lg:px-8">
      <section aria-labelledby="login-context-title" className="hidden min-w-0 border-r border-border py-8 pr-12 lg:block">
        <p className="mb-5 text-sm font-medium text-muted-foreground">The CSV preflight workspace</p>
        <h2 id="login-context-title" className="max-w-md text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">A little clarity.<br />Before a big import.</h2>
        <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">Bring your CSV files, make the rules explicit, and see what needs attention.</p>
        <ul className="mt-10 max-w-md space-y-6 text-sm">
          <li className="flex gap-3"><Columns3 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="font-medium">Map your schema</p><p className="mt-1 text-muted-foreground">Columns, keys and relationships you configure.</p></div></li>
          <li className="flex gap-3"><FileCheck2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="font-medium">Review before changing</p><p className="mt-1 text-muted-foreground">Check your data, preview changes and undo corrections.</p></div></li>
          <li className="flex gap-3"><Download aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="font-medium">Export on your terms</p><p className="mt-1 text-muted-foreground">Browser-local files. No database import execution.</p></div></li>
        </ul>
        <Link href="/rehearsal" className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-primary hover:underline">Explore the CSV demo<ArrowUpRight aria-hidden="true" className="size-4" /></Link>
      </section>
      <section aria-label="Account access" className="mx-auto w-full max-w-sm py-6 lg:py-10">
        {children}
      </section>
    </main>
    <footer className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 text-xs text-muted-foreground sm:px-6 lg:px-8">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm hover:text-foreground"><ArrowLeft aria-hidden="true" className="size-4" />Back to Rowzen</Link>
      <p>Preflight validation. Your records stay in browser memory.</p>
    </footer>
  </div>;
}

function ProviderButtons({ action, pending, onStart }: {
  action: OAuthAction; pending: { provider: LoginProvider; action: OAuthAction } | null;
  onStart: (provider: LoginProvider, action: OAuthAction) => void;
}) {
    return <div className="grid gap-3">{(["github", "google"] as const).map(provider => {
      const busy = pending?.provider === provider && pending.action === action, label = providerLabels[provider];
      return <Button key={provider} type="button" variant={provider === "github" ? "primary" : "secondary"} disabled={Boolean(pending)} pending={busy}
        className="w-full" onClick={() => onStart(provider, action)}>{!busy && <span aria-hidden="true" className="w-5 shrink-0 font-mono text-xs font-semibold">{provider === "github" ? "GH" : "G"}</span>}{busy ? `${action === "link" ? "Connecting" : "Opening"} ${label}...` : `${action === "link" ? "Connect" : "Continue with"} ${label}`}</Button>;
    })}</div>;
  }

function LoginContent() {
  const searchParams = useSearchParams();
  const destination = loginDestination(searchParams.get("next"));
  const connectTarget = connectionProvider(searchParams.get("connect"));
  const recoveryTarget = searchParams.get("error") === "account_not_linked" ? connectionProvider(searchParams.get("provider")) : null;
  const { data: session, isPending, error: sessionError } = authClient.useSession();
  const [pending, setPending] = useState<{ provider: LoginProvider; action: OAuthAction } | null>(null);
  const [error, setError] = useState(() => oauthFeedback(searchParams.get("error"), searchParams.get("provider"), searchParams.get("action")));
  const submitting = useRef(false);
  const attempt = useRef(0);

  useEffect(() => {
    const restore = () => { attempt.current++; submitting.current = false; setPending(null); };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  async function startOAuth(provider: LoginProvider, action: OAuthAction = "sign-in", resumeConnection?: LoginProvider) {
    if (submitting.current) return;
    const currentAttempt = ++attempt.current;
    submitting.current = true; setPending({ provider, action }); setError("");
    const label = providerLabels[provider], operation = action === "link" ? "connection" : "sign-in";
    try {
      const intent = resumeConnection ?? connectTarget;
      const callbackURL = intent ? connectionReturn(intent, destination) : destination;
      const errorCallbackURL = oauthErrorCallback(provider, action, destination) + (intent ? "&connect=" + intent : "");
      const options = { provider, callbackURL, errorCallbackURL };
      const result = action === "link" ? await authClient.linkSocial(options) : await authClient.signIn.social(options);
      if (result.error && currentAttempt === attempt.current) setError(`Could not start ${label} ${operation}. Try again.`);
    } catch {
      if (currentAttempt === attempt.current) setError(`Could not start ${label} ${operation}. Check your connection and try again.`);
    } finally { if (currentAttempt === attempt.current) { submitting.current = false; setPending(null); } }
  }


  return <LoginFrame>
    {isPending ? <PageLoading label="Checking your session..." compact /> : sessionError ? <div className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <StatusMessage tone="error">Could not check your session. Reload this page to retry.</StatusMessage>
      <Button type="button" onClick={() => window.location.reload()}>Reload sign-in</Button>
    </div> : session ? <div className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight [overflow-wrap:anywhere]">Welcome, {session.user.name}</h1>
      <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{session.user.email}</p>
      <Link href={destination} className="inline-flex min-h-control items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">Continue to Rowzen</Link>
      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">Connect another sign-in method using the same verified email. Your existing account and projects stay together.</p>
        {connectTarget ? <ConnectedMethod key={session.user.id + connectTarget} userId={session.user.id} provider={connectTarget} pending={Boolean(pending)} onConnect={() => void startOAuth(connectTarget, "link")} /> : <ProviderButtons action="link" pending={pending} onStart={(provider, action) => void startOAuth(provider, action)} />}
      </div>
      <SignOutButton />
      {pending && <p role="status" className="text-sm text-muted-foreground">Connecting {providerLabels[pending.provider]}...</p>}
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
    </div> : <div className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in to Rowzen</h1>
      <p className="text-sm text-muted-foreground">Continue with GitHub or Google to open your projects.</p>
      {recoveryTarget && <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <p className="text-sm font-medium">Connect {providerLabels[recoveryTarget]} to your existing account</p>
        <p className="text-sm text-muted-foreground">Step 1: Sign in with the provider you used before. You will return here to explicitly connect {providerLabels[recoveryTarget]}; no accounts are merged automatically.</p>
        <Button type="button" className="w-full" disabled={Boolean(pending)} onClick={() => void startOAuth(recoveryTarget === "google" ? "github" : "google", "sign-in", recoveryTarget)}>Sign in with {recoveryTarget === "google" ? "GitHub" : "Google"} to connect {providerLabels[recoveryTarget]}</Button>
      </div>}
      <ProviderButtons action="sign-in" pending={pending} onStart={(provider, action) => void startOAuth(provider, action)} />
      <p className="text-xs text-muted-foreground">Already have an account? Use your connected provider first, then connect another after signing in.</p>
      {pending && <p role="status" className="text-sm text-muted-foreground">Opening {providerLabels[pending.provider]} sign-in...</p>}
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
    </div>}
  </LoginFrame>;
}
export default function LoginPage() {
  return <Suspense fallback={<LoginFrame><PageLoading label="Checking your session..." compact /></LoginFrame>}><LoginContent /></Suspense>;
}
