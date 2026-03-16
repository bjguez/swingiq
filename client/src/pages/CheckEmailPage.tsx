import { useState } from "react";
import { useLocation } from "wouter";
import { Video, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CheckEmailPage() {
  const [, navigate] = useLocation();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Email is passed via sessionStorage so it survives navigation
  const email = sessionStorage.getItem("pendingVerificationEmail") || "";

  async function handleResend() {
    if (!email) return;
    setResending(true);
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResent(true);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2 text-primary font-bold text-3xl tracking-tighter">
          <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
            <Video size={22} />
          </div>
          Swing Studio
        </div>
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="w-6 h-6 text-primary" />
              </div>
            </div>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We sent a verification link to{" "}
              {email ? <span className="font-medium text-foreground">{email}</span> : "your email address"}.
              Click the link to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {resent ? (
              <p className="text-sm text-center text-green-500">Verification email resent!</p>
            ) : (
              <Button variant="outline" className="w-full" onClick={handleResend} disabled={resending || !email}>
                {resending ? "Sending..." : "Resend verification email"}
              </Button>
            )}
            <Button variant="ghost" className="w-full" onClick={() => navigate("/auth")}>
              Back to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
