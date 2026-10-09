"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, LockKeyhole, TriangleAlert } from "lucide-react";
import { confirmPasswordReset, isPasswordResetTokenValid } from "@/lib/api/clinic-api";
import { isStrongPassword } from "@/lib/domain";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Status = "checking" | "invalid" | "ready" | "done";

function ResetPasswordContent() {
  const token = useSearchParams().get("token") ?? "";
  const [status, setStatus] = useState<Status>(token ? "checking" : "invalid");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let current = true;
    isPasswordResetTokenValid(token)
      .then((valid) => { if (current) setStatus(valid ? "ready" : "invalid"); })
      .catch(() => { if (current) setStatus("invalid"); });
    return () => { current = false; };
  }, [token]);

  const strong = isStrongPassword(password);
  const matches = password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!strong || !matches) return;
    setError(null);
    setSaving(true);
    try {
      await confirmPasswordReset(token, password);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password");
    } finally {
      setSaving(false);
    }
  }

  if (status === "checking") {
    return (
      <AuthCard title="Reset password" description="Checking your reset link...">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </AuthCard>
    );
  }

  if (status === "invalid") {
    return (
      <AuthCard title="Link expired" description="This reset link is invalid, already used or has expired.">
        <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>Request a new link and use the newest email you receive.</p>
        </div>
        <Button asChild className="mt-6 h-10 w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
        <Link href="/login" className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </AuthCard>
    );
  }

  if (status === "done") {
    return (
      <AuthCard title="Password updated" description="You can now sign in with your new password.">
        <div className="flex gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p>For your security, any other device that was signed in has been signed out.</p>
        </div>
        <Button asChild className="mt-6 h-10 w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password" description="Choose a new password for your clinic account.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 pl-8"
            />
          </div>
          <p className={`text-xs ${password && !strong ? "text-destructive" : "text-muted-foreground"}`}>
            At least 12 characters with an upper case, a lower case, a number and a symbol.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-10"
          />
          {confirm && !matches && <p className="text-xs text-destructive">The passwords do not match.</p>}
        </div>
        {error && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
        <Button type="submit" size="lg" className="h-10 w-full" disabled={!strong || !matches || saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save new password
        </Button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
