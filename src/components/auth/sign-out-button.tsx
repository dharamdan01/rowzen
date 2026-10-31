
"use client";

import { useId, useRef, useState } from "react";
import { Button } from "../ui/primitives";
import { approveWorkspaceUnload, requestWorkspaceDeparture } from "../../lib/browser/workspace-departure";
import { authClient } from "../../lib/auth-client";

export default function SignOutButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const errorId = useId();
  const submitting = useRef(false);

  async function handleSignOut() {
    if (submitting.current || !requestWorkspaceDeparture()) return;
    submitting.current = true;
    setMessage("");
    setLoading(true);

    try {
      const { error } = await authClient.signOut();

      if (error) {
        setMessage("Could not sign out. Try again.");
        return;
      }

      approveWorkspaceUnload();
      window.location.replace("/login");
    } catch {
      setMessage("Could not sign out. Check your connection and try again.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return <div className="flex flex-col items-start gap-2">
    <Button type="button" onClick={() => void handleSignOut()} pending={loading} aria-describedby={message ? errorId : undefined}>
      {loading ? "Signing out..." : "Sign Out"}
    </Button>
    {message && <p id={errorId} role="alert" className="max-w-36 text-xs text-danger">{message}</p>}
  </div>;
}
