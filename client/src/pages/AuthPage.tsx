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
  const [registerForm, setRegisterForm] = useState({ username: "", password: "", confirmPassword: "" });
  const [registerValidationError, setRegisterValidationError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    await login(loginForm);
    navigate("/");
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegisterValidationError(null);
    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterValidationError("Passwords do not match");
      return;
    }
    await register({ username: registerForm.username, password: registerForm.password });
    navigate("/");
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
                    <p className="text-sm text-destructive">{loginError.message}</p>
                  )}
                  <Button type="submit" className="w-full" disabled={isLoggingIn}>
                    {isLoggingIn ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
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
