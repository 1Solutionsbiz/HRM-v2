"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { requestPasswordReset } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Backend always returns the same generic message whether or not the
      // email matches an account, so there's nothing to branch on here.
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4" style={{ backgroundColor: "#114171" }}>
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl sm:p-10 dark:bg-neutral-900">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Image
            src="/1solutions-hrm-logo.webp"
            alt="1Solutions HRM"
            width={1600}
            height={611}
            className="h-16 w-auto"
            priority
          />
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
            <p className="text-muted-foreground text-sm">
              Enter your work email and we&apos;ll send you a link to reset it.
            </p>
          </div>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <MailCheck className="text-primary size-10" />
            <p className="text-sm">
              If an account exists for <span className="font-medium">{email}</span>, a password
              reset link is on its way. It expires in 30 minutes.
            </p>
            <Button asChild variant="outline" className="mt-2 w-full">
              <Link href="/login">
                <ArrowLeft />
                Back to login
              </Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@1solutions.biz"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/login">
                <ArrowLeft />
                Back to login
              </Link>
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
