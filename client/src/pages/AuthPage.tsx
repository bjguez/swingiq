import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Video } from "lucide-react";

const BATS_OPTIONS = ["R", "L", "S"] as const;
const THROWS_OPTIONS = ["R", "L"] as const;
const SKILL_OPTIONS = ["beginner", "intermediate", "advanced", "professional"] as const;

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { login, register, updateProfile, isLoggingIn, isRegistering, isUpdatingProfile, loginError, registerError } = useAuth();

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ username: "", password: "", confirmPassword: "" });
  const [registerValidationError, setRegisterValidationError] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    bats: "" as string,
    throws: "" as string,
    skillLevel: "" as string,
    age: "" as string,
    city: "",
    state: "",
  });

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
    setShowProfile(true);
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, any> = {};
    if (profileForm.bats) payload.bats = profileForm.bats;
    if (profileForm.throws) payload.throws = profileForm.throws;
    if (profileForm.skillLevel) payload.skillLevel = profileForm.skillLevel;
    if (profileForm.age) payload.age = parseInt(profileForm.age, 10);
    if (profileForm.city) payload.city = profileForm.city;
    if (profileForm.state) payload.state = profileForm.state;
    if (Object.keys(payload).length > 0) await updateProfile(payload);
    navigate("/");
  }

  if (showProfile) {
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
            <CardHeader>
              <CardTitle>Tell us about yourself</CardTitle>
              <CardDescription>Help us personalize your experience</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label>Bats</Label>
                  <div className="flex gap-2">
                    {BATS_OPTIONS.map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setProfileForm(f => ({ ...f, bats: f.bats === v ? "" : v }))}
                        className={`flex-1 py-2 rounded-md border text-sm font-semibold transition-colors ${
                          profileForm.bats === v
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {v === "R" ? "Right" : v === "L" ? "Left" : "Switch"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Throws</Label>
                  <div className="flex gap-2">
                    {THROWS_OPTIONS.map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setProfileForm(f => ({ ...f, throws: f.throws === v ? "" : v }))}
                        className={`flex-1 py-2 rounded-md border text-sm font-semibold transition-colors ${
                          profileForm.throws === v
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {v === "R" ? "Right" : "Left"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Skill Level</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {SKILL_OPTIONS.map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setProfileForm(f => ({ ...f, skillLevel: f.skillLevel === v ? "" : v }))}
                        className={`py-2 rounded-md border text-sm font-semibold capitalize transition-colors ${
                          profileForm.skillLevel === v
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="profile-age">Age</Label>
                    <Input
                      id="profile-age"
                      type="number"
                      min={5}
                      max={100}
                      placeholder="e.g. 22"
                      value={profileForm.age}
                      onChange={(e) => setProfileForm(f => ({ ...f, age: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="profile-city">City</Label>
                    <Input
                      id="profile-city"
                      placeholder="e.g. Chicago"
                      value={profileForm.city}
                      onChange={(e) => setProfileForm(f => ({ ...f, city: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="profile-state">State</Label>
                  <Input
                    id="profile-state"
                    placeholder="e.g. IL"
                    value={profileForm.state}
                    onChange={(e) => setProfileForm(f => ({ ...f, state: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="submit" className="flex-1" disabled={isUpdatingProfile}>
                    {isUpdatingProfile ? "Saving..." : "Save & Continue"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => navigate("/")}>
                    Skip
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
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
