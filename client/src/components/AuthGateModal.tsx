import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { Lock, User, ChevronRight } from "lucide-react";

type Step = "gate" | "login" | "register" | "profile";

interface AuthGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: string;
  onSuccess?: () => void;
}

const SKILL_LEVELS = [
  { value: "little_league", label: "Little League" },
  { value: "select", label: "Select / Travel" },
  { value: "high_school", label: "High School" },
  { value: "college", label: "College" },
  { value: "pro", label: "Pro / Semi-Pro" },
];

export function AuthGateModal({ open, onOpenChange, reason, onSuccess }: AuthGateModalProps) {
  const { login, register, updateProfile, isLoggingIn, isRegistering, isUpdatingProfile, loginError, registerError } = useAuth();
  const [step, setStep] = useState<Step>("gate");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState({ age: "", city: "", state: "", skillLevel: "", bats: "", throws: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ username, password });
      onSuccess?.();
      onOpenChange(false);
    } catch {}
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register({ username, password });
      setStep("profile");
    } catch {}
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({
        age: profile.age ? Number(profile.age) : undefined,
        city: profile.city || undefined,
        state: profile.state || undefined,
        skillLevel: profile.skillLevel || undefined,
        bats: profile.bats || undefined,
        throws: profile.throws || undefined,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch {}
  };

  const handleSkipProfile = () => {
    onSuccess?.();
    onOpenChange(false);
  };

  const resetState = () => {
    setStep("gate");
    setUsername("");
    setPassword("");
    setProfile({ age: "", city: "", state: "", skillLevel: "", bats: "", throws: "" });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }}>
      <DialogContent className="max-w-md bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase tracking-wider">
            {step === "gate" && "Sign In Required"}
            {step === "login" && "Sign In"}
            {step === "register" && "Create Account"}
            {step === "profile" && "Tell Us About You"}
          </DialogTitle>
          <DialogDescription className="sr-only">Authentication</DialogDescription>
        </DialogHeader>

        {/* Gate step */}
        {step === "gate" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">{reason ?? "Create a free account to continue."}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={() => setStep("register")}>
                Create Free Account
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setStep("login")}>
                Sign In
              </Button>
            </div>
          </div>
        )}

        {/* Login step */}
        {step === "login" && (
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="space-y-2">
              <Input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {loginError && <p className="text-xs text-destructive">{loginError.message}</p>}
            <Button type="submit" className="w-full" disabled={isLoggingIn}>
              {isLoggingIn ? "Signing in..." : "Sign In"}
            </Button>
            <button type="button" onClick={() => setStep("gate")} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
              ← Back
            </button>
          </form>
        )}

        {/* Register step */}
        {step === "register" && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div className="space-y-2">
              <Input
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
              <Input
                type="password"
                placeholder="Choose a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            {registerError && <p className="text-xs text-destructive">{registerError.message}</p>}
            <Button type="submit" className="w-full" disabled={isRegistering}>
              {isRegistering ? "Creating account..." : "Create Account"}
            </Button>
            <button type="button" onClick={() => setStep("gate")} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
              ← Back
            </button>
          </form>
        )}

        {/* Profile step */}
        {step === "profile" && (
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">Help us personalize your experience. You can always update this later.</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Age"
                type="number"
                min={5}
                max={100}
                value={profile.age}
                onChange={(e) => setProfile(p => ({ ...p, age: e.target.value }))}
              />
              <div className="flex gap-1.5">
                {["L", "R"].map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setProfile(p => ({ ...p, bats: h }))}
                    className={`flex-1 py-2 rounded-md text-sm font-semibold border transition-colors ${profile.bats === h ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                  >
                    Bats {h}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="City"
                value={profile.city}
                onChange={(e) => setProfile(p => ({ ...p, city: e.target.value }))}
              />
              <Input
                placeholder="State"
                value={profile.state}
                onChange={(e) => setProfile(p => ({ ...p, state: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {SKILL_LEVELS.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setProfile(p => ({ ...p, skillLevel: s.value }))}
                  className={`py-2 px-3 rounded-md text-xs font-semibold border transition-colors text-left ${profile.skillLevel === s.value ? "bg-primary/10 border-primary/50 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1" disabled={isUpdatingProfile}>
                {isUpdatingProfile ? "Saving..." : "Save Profile"}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <Button type="button" variant="ghost" onClick={handleSkipProfile} className="text-muted-foreground">
                Skip
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Hook to get a gated action — shows auth modal if not logged in */
export function useAuthGate() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [reason, setReason] = useState<string | undefined>();

  const requireAuth = (action: () => void, gateReason?: string) => {
    if (user) {
      action();
    } else {
      setPendingAction(() => action);
      setReason(gateReason);
      setOpen(true);
    }
  };

  const modal = (
    <AuthGateModal
      open={open}
      onOpenChange={setOpen}
      reason={reason}
      onSuccess={() => { pendingAction?.(); setPendingAction(null); }}
    />
  );

  return { requireAuth, modal };
}
