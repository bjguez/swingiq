import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Video } from "lucide-react";

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { login, register, isLoggingIn, isRegistering, loginError, registerError } = useAuth();

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
  const [registerValidationError, setRegisterValidationError] = useState<string | null>(null);

  // Add-email flow for existing accounts that predate email verification
  const [addEmailForm, setAddEmailForm] = useState({ email: "" });
  const [addEmailError, setAddEmailError] = useState<string | null>(null);
  const [addEmailLoading, setAddEmailLoading] = useState(false);

  const isEmailNotVerified = (loginError as any)?.emailNotVerified;
  const isEmailRequired = (loginError as any)?.emailRequired;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(loginForm);
      navigate("/");
    } catch {
      // errors displayed via loginError
    }
  }

  async function handleAddEmail(e: React.FormEvent) {
    e.preventDefault();
    setAddEmailError(null);
    setAddEmailLoading(true);
    try {
      const res = await fetch("/api/auth/add-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginForm.username, password: loginForm.password, email: addEmailForm.email }),
      });
      const data = await res.json();
      if (!res.ok) { setAddEmailError(data.message); return; }
      sessionStorage.setItem("pendingVerificationEmail", addEmailForm.email);
      navigate("/check-email");
    } catch {
      setAddEmailError("Something went wrong. Please try again.");
    } finally {
      setAddEmailLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegisterValidationError(null);
    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterValidationError("Passwords do not match");
      return;
    }
    try {
      await register({ username: registerForm.username, email: registerForm.email, password: registerForm.password });
      sessionStorage.setItem("pendingVerificationEmail", registerForm.email);
      navigate("/check-email");
    } catch {
      // error shown via registerError
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

        <Tabs defaultValue="login">
          <TabsList className="w-full">
            <TabsTrigger value="login" className="flex-1">Sign In</TabsTrigger>
            <TabsTrigger value="register" className="flex-1">Create Account</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Welcome back</CardTitle>
                <CardDescription>Sign in to your Swing Studio account</CardDescription>
              </CardHeader>
              <CardContent>
                {isEmailRequired ? (
                  <form onSubmit={handleAddEmail} className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      We now require an email address for account security. Please add yours to continue.
                    </p>
                    <div className="space-y-1">
                      <Label htmlFor="add-email">Email address</Label>
                      <Input
                        id="add-email"
                        type="email"
                        placeholder="you@example.com"
                        value={addEmailForm.email}
                        onChange={(e) => setAddEmailForm({ email: e.target.value })}
                        required
                        autoFocus
                      />
                    </div>
                    {addEmailError && <p className="text-sm text-destructive">{addEmailError}</p>}
                    <Button type="submit" className="w-full" disabled={addEmailLoading}>
                      {addEmailLoading ? "Sending..." : "Add Email & Verify"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setLoginForm({ username: "", password: "" })}
                    >
                      Use a different account
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="login-username">Username</Label>
                      <Input
                        id="login-username"
                        value={loginForm.username}
                        onChange={(e) => setLoginForm((f) => ({ ...f, username: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                        required
                      />
                    </div>
                    {loginError && (
                      <div className="space-y-2">
                        <p className="text-sm text-destructive">{loginError.message}</p>
                        {isEmailNotVerified && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => navigate("/check-email")}
                          >
                            Resend verification email
                          </Button>
                        )}
                      </div>
                    )}
                    <Button type="submit" className="w-full" disabled={isLoggingIn}>
                      {isLoggingIn ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Create an account</CardTitle>
                <CardDescription>Start analyzing your swing today</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="reg-username">Username</Label>
                    <Input
                      id="reg-username"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm((f) => ({ ...f, username: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="you@example.com"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm((f) => ({ ...f, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm((f) => ({ ...f, password: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="reg-confirm">Confirm Password</Label>
                    <Input
                      id="reg-confirm"
                      type="password"
                      value={registerForm.confirmPassword}
                      onChange={(e) => setRegisterForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                      required
                    />
                  </div>
                  {(registerValidationError || registerError) && (
                    <p className="text-sm text-destructive">
                      {registerValidationError || registerError?.message}
                    </p>
                  )}
                  <Button type="submit" className="w-full" disabled={isRegistering}>
                    {isRegistering ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
