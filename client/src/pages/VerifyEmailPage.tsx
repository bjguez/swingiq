import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type State = "verifying" | "success" | "error";

export default function VerifyEmailPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get("token");
    if (!token) { setState("error"); setErrorMsg("No token provided."); return; }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Verification failed");
        // Update auth cache so the app recognises the user as logged in
        queryClient.setQueryData(["/api/auth/me"], data.user);
        sessionStorage.removeItem("pendingVerificationEmail");
        // Auto-accept a pending coach invite if one was stored before registration
        const pendingInvite = sessionStorage.getItem("pendingInviteToken");
        if (pendingInvite) {
          fetch(`/api/coach/invite/accept?token=${encodeURIComponent(pendingInvite)}`).catch(() => {});
          sessionStorage.removeItem("pendingInviteToken");
        }
        setState("success");
      })
      .catch((err) => {
        setState("error");
        setErrorMsg(err.message);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2">
          <img src="/logo-option-b-square.svg" alt="Swing Studio" className="w-10 h-10" />
          <span className="font-display font-bold text-3xl tracking-tighter text-primary">Swing Studio</span>
        </div>
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              {state === "verifying" && <Loader className="w-10 h-10 text-primary animate-spin" />}
              {state === "success" && <CheckCircle className="w-10 h-10 text-green-500" />}
              {state === "error" && <XCircle className="w-10 h-10 text-destructive" />}
            </div>
            <CardTitle>
              {state === "verifying" && "Verifying your email..."}
              {state === "success" && "Email verified!"}
              {state === "error" && "Verification failed"}
            </CardTitle>
            <CardDescription>
              {state === "verifying" && "Please wait a moment."}
              {state === "success" && "Your account is active. Let's set up your profile."}
              {state === "error" && (errorMsg || "This link may have expired.")}
            </CardDescription>
          </CardHeader>
          {state !== "verifying" && (
            <CardContent>
              {state === "success" && (
                <Button className="w-full" onClick={() => navigate("/onboarding")}>
                  Continue
                </Button>
              )}
              {state === "error" && (
                <div className="space-y-2">
                  <Button className="w-full" onClick={() => navigate("/check-email")}>
                    Resend verification email
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => navigate("/auth")}>
                    Back to sign in
                  </Button>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
