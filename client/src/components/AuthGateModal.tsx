import { useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { Lock, ChevronRight } from "lucide-react";

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

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

export function AuthGateModal({ open, onOpenChange, reason, onSuccess }: AuthGateModalProps) {
  const { login, register, updateProfile, isLoggingIn, isRegistering, isUpdatingProfile, loginError, registerError } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("gate");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState({ age: "", city: "", state: "", skillLevel: "", bats: "", throws: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ username: email, password });
      onSuccess?.();
      onOpenChange(false);
    } catch {}
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register({ email, password });
      sessionStorage.setItem("pendingVerificationEmail", email);
      onOpenChange(false);
      navigate("/check-email");
    } catch {}
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.bats || !profile.throws || !profile.skillLevel) return;
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

  const resetState = () => {
    setStep("gate");
    setEmail("");
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
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
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
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
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
            <p className="text-sm text-muted-foreground">Help us personalize your experience.</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Age"
                type="number"
                min={5}
                max={100}
                value={profile.age}
                onChange={(e) => setProfile(p => ({ ...p, age: e.target.value }))}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-muted-foreground shrink-0">Bats</span>
                <div className="flex gap-1.5 flex-1">
                  {["L", "R"].map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setProfile(p => ({ ...p, bats: h }))}
                      className={`cursor-pointer flex-1 py-2 rounded-md text-sm font-semibold border transition-colors ${profile.bats === h ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-muted-foreground shrink-0">Throws</span>
                <div className="flex gap-1.5 flex-1">
                  {["L", "R"].map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setProfile(p => ({ ...p, throws: h }))}
                      className={`cursor-pointer flex-1 py-2 rounded-md text-sm font-semibold border transition-colors ${profile.throws === h ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  placeholder="City"
                  value={profile.city}
                  onChange={(e) => setProfile(p => ({ ...p, city: e.target.value }))}
                />
                <select
                  value={profile.state}
                  onChange={(e) => setProfile(p => ({ ...p, state: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-foreground"
                >
                  <option value="">State</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {SKILL_LEVELS.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setProfile(p => ({ ...p, skillLevel: s.value }))}
                  className={`cursor-pointer py-2 px-3 rounded-md text-xs font-semibold border transition-colors text-left ${profile.skillLevel === s.value ? "bg-primary/10 border-primary/50 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="pt-1">
              <Button
                type="submit"
                className="w-full"
                disabled={isUpdatingProfile || !profile.bats || !profile.throws || !profile.skillLevel}
              >
                {isUpdatingProfile ? "Saving..." : "Save Profile"}
                <ChevronRight className="w-4 h-4 ml-1" />
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
