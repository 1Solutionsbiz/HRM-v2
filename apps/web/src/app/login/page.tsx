"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/lib/role-context";
import { mockLogin } from "@/lib/mock/mock-api";
import { ROLES, ROLE_LABELS, type Role } from "@/types/role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function LoginPage() {
  const router = useRouter();
  const { setRole } = useRole();
  const [email, setEmail] = React.useState("aditi.sharma@1solutions.biz");
  const [password, setPassword] = React.useState("");
  const [role, setLocalRole] = React.useState<Role>("employee");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await mockLogin(email, password);
      setRole(role);
      toast.success(`Signed in as ${ROLE_LABELS[role]} (preview)`);
      router.push(role === "employee" ? "/my-day" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-muted/40 flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="bg-primary flex items-center justify-center rounded-xl px-6 py-3">
            <Image
              src="/hrm-logo-white.png"
              alt="1Solutions HRM"
              width={400}
              height={120}
              className="h-12 w-auto"
              priority
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              UI preview build - no account is checked against a real
              backend. Any password with 4+ characters signs you in; pick a
              role to preview that experience.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@1solutions.biz"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder="Try: preview"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Preview as</Label>
                <Select
                  value={role}
                  onValueChange={(v) => setLocalRole(v as Role)}
                >
                  <SelectTrigger id="role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
              <button
                type="button"
                onClick={() =>
                  toast.info("Password reset isn't wired up yet.")
                }
                className="text-muted-foreground hover:text-foreground block w-full text-center text-xs underline-offset-4 hover:underline"
              >
                Forgot password?
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
