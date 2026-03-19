import { useEffect, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { Video, CheckCircle, XCircle, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

type State = "checking" | "accepting" | "success" | "error" | "needs_login";

export default function AcceptInvitePage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { user, isLoading } = useAuth();
  const [state, setState] = useState<State>("checking");
  const [coachName, setCoachName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const token = new URLSearchParams(search).get("token");

  useEffect(() => {
    if (isLoading) return;
    if (!token) { setState("error"); setErrorMsg("Invalid invitation link."); return; }
    if (!user) {
      // Store token so we can accept after login
      sessionStorage.setItem("pendingInviteToken", token);
      setState("needs_login");
      return;
    }
    accept(token);
  }, [isLoading, user]);

  async function accept(t: string) {
    setState("accepting");
    try {
      const res = await fetch(`/api/coach/invite/accept?token=${encodeURIComponent(t)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setCoachName(data.coachName || "your coach");
      sessionStorage.removeItem("pendingInviteToken");
      setState("success");
    } catch (err: any) {
      setState("error");
      setErrorMsg(err.message);
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
              {(state === "checking" || state === "accepting") && <Loader className="w-10 h-10 text-primary animate-spin" />}
              {state === "success" && <CheckCircle className="w-10 h-10 text-green-500" />}
              {(state === "error") && <XCircle className="w-10 h-10 text-destructive" />}
              {state === "needs_login" && <Video className="w-10 h-10 text-primary" />}
            </div>
            <CardTitle>
              {(state === "checking" || state === "accepting") && "Accepting invitation..."}
              {state === "success" && "You're connected!"}
              {state === "error" && "Invitation error"}
              {state === "needs_login" && "Sign in to accept"}
            </CardTitle>
            <CardDescription>
              {(state === "checking" || state === "accepting") && "Please wait a moment."}
              {state === "success" && `You are now connected with ${coachName}. They can share analysis sessions with you.`}
              {state === "error" && (errorMsg || "This invitation may have expired.")}
              {state === "needs_login" && "Sign in or create an account to accept this coaching invitation."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state === "success" && (
              <Button className="w-full" onClick={() => navigate("/")}>
                Go to Swing Studio
              </Button>
            )}
            {state === "error" && (
              <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
                Go Home
              </Button>
            )}
            {state === "needs_login" && (
              <Button className="w-full" onClick={() => navigate(`/auth?invite=${token}`)}>
                Sign In or Create Account
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
