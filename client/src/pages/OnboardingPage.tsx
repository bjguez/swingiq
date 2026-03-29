import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, GraduationCap, Users } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

const BATS_OPTIONS = ["R", "L", "S"] as const;
const THROWS_OPTIONS = ["R", "L"] as const;
const PLAYER_SKILL_OPTIONS = [
  { value: "little_league", label: "Little League" },
  { value: "select", label: "Select" },
  { value: "high_school", label: "High School" },
  { value: "college", label: "College" },
  { value: "pro", label: "Pro" },
] as const;
const COACHING_LEVELS = [
  { value: "little_league", label: "Little League" },
  { value: "select", label: "Select" },
  { value: "high_school", label: "High School" },
  { value: "college", label: "College" },
  { value: "pro", label: "Pro" },
] as const;
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

type Step = "username" | "account_type" | "player_profile" | "coach_profile" | "parent_profile" | "add_athlete";

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const isGoogleFlow = new URLSearchParams(search).get("google") === "1";
  const { user, updateProfile, isUpdatingProfile } = useAuth();
  const [step, setStep] = useState<Step>(isGoogleFlow ? "username" : "account_type");
  const [playerErrors, setPlayerErrors] = useState<Record<string, string>>({});
  const [coachErrors, setCoachErrors] = useState<Record<string, string>>({});
  const [parentErrors, setParentErrors] = useState<Record<string, string>>({});
  const [athleteErrors, setAthleteErrors] = useState<Record<string, string>>({});

  const [playerForm, setPlayerForm] = useState({
    firstName: "", lastName: "", bats: "", throws: "", skillLevel: "", age: "", city: "", state: "",
  });

  const [coachForm, setCoachForm] = useState({
    firstName: "", lastName: "", organization: "", coachingLevel: "", city: "", state: "",
  });

  const [parentForm, setParentForm] = useState({ firstName: "", lastName: "" });

  const [athleteForm, setAthleteForm] = useState({
    firstName: "", lastName: "", bats: "", throws: "", skillLevel: "", age: "", city: "", state: "",
  });

  // Username step (Google flow)
  const [usernameInput, setUsernameInput] = useState(user?.username ?? "");
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  useEffect(() => {
    if (!usernameInput || usernameInput.length < 3) { setUsernameAvailable(null); return; }
    setUsernameChecking(true);
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(usernameInput)}`);
      const data = await res.json();
      // It's fine if the username matches their current one (no change)
      setUsernameAvailable(data.available || usernameInput.toLowerCase() === user?.username?.toLowerCase());
      setUsernameChecking(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [usernameInput]);

  async function handleUsernameSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = usernameInput.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (clean.length < 3) { setUsernameError("Username must be at least 3 characters"); return; }
    if (!usernameAvailable) { setUsernameError("Username is not available"); return; }
    setUsernameSaving(true);
    try {
      await updateProfile({ username: clean } as any);
    } finally {
      setUsernameSaving(false);
    }
    setStep("account_type");
  }

  const createAthleteMutation = useMutation({
    mutationFn: async (data: object) => {
      const res = await fetch("/api/athletes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create athlete");
      }
      return res.json();
    },
  });

  async function handlePlayerSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!playerForm.firstName.trim()) errs.firstName = "Required";
    if (!playerForm.lastName.trim()) errs.lastName = "Required";
    if (!playerForm.bats) errs.bats = "Please select one";
    if (!playerForm.throws) errs.throws = "Please select one";
    if (!playerForm.skillLevel) errs.skillLevel = "Please select your level";
    if (!playerForm.age) errs.age = "Required";
    if (!playerForm.city.trim()) errs.city = "Required";
    if (!playerForm.state) errs.state = "Required";
    if (Object.keys(errs).length) { setPlayerErrors(errs); return; }
    setPlayerErrors({});
    await updateProfile({
      accountType: "player",
      firstName: playerForm.firstName.trim(),
      lastName: playerForm.lastName.trim(),
      bats: playerForm.bats,
      throws: playerForm.throws,
      skillLevel: playerForm.skillLevel,
      age: parseInt(playerForm.age, 10),
      city: playerForm.city.trim(),
      state: playerForm.state,
      profileComplete: true,
    });
    navigate("/");
  }

  async function handleCoachSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!coachForm.firstName.trim()) errs.firstName = "Required";
    if (!coachForm.lastName.trim()) errs.lastName = "Required";
    if (!coachForm.organization.trim()) errs.organization = "Required";
    if (!coachForm.coachingLevel) errs.coachingLevel = "Please select your level";
    if (!coachForm.city.trim()) errs.city = "Required";
    if (!coachForm.state) errs.state = "Required";
    if (Object.keys(errs).length) { setCoachErrors(errs); return; }
    setCoachErrors({});
    await updateProfile({
      accountType: "coach",
      firstName: coachForm.firstName.trim(),
      lastName: coachForm.lastName.trim(),
      organization: coachForm.organization.trim(),
      coachingLevel: coachForm.coachingLevel,
      city: coachForm.city.trim(),
      state: coachForm.state,
      profileComplete: true,
    });
    navigate("/");
  }

  async function handleParentSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!parentForm.firstName.trim()) errs.firstName = "Required";
    if (!parentForm.lastName.trim()) errs.lastName = "Required";
    if (Object.keys(errs).length) { setParentErrors(errs); return; }
    setParentErrors({});
    await updateProfile({
      accountType: "parent",
      firstName: parentForm.firstName.trim(),
      lastName: parentForm.lastName.trim(),
      profileComplete: false, // stays false until first athlete is added
    });
    setStep("add_athlete");
  }

  async function handleAthleteSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!athleteForm.firstName.trim()) errs.firstName = "Required";
    if (!athleteForm.lastName.trim()) errs.lastName = "Required";
    if (!athleteForm.bats) errs.bats = "Please select one";
    if (!athleteForm.throws) errs.throws = "Please select one";
    if (!athleteForm.skillLevel) errs.skillLevel = "Please select your level";
    if (!athleteForm.age) errs.age = "Required";
    if (!athleteForm.city.trim()) errs.city = "Required";
    if (!athleteForm.state) errs.state = "Required";
    if (Object.keys(errs).length) { setAthleteErrors(errs); return; }
    setAthleteErrors({});
    await createAthleteMutation.mutateAsync({
      firstName: athleteForm.firstName.trim(),
      lastName: athleteForm.lastName.trim(),
      bats: athleteForm.bats,
      throws: athleteForm.throws,
      skillLevel: athleteForm.skillLevel,
      age: parseInt(athleteForm.age, 10),
      city: athleteForm.city.trim(),
      state: athleteForm.state,
    });
    await updateProfile({ profileComplete: true });
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2">
          <img src="/logo-option-b-square.svg" alt="Swing Studio" className="w-10 h-10" />
          <span className="font-display font-bold text-3xl tracking-tighter text-primary">Swing Studio</span>
        </div>

        {/* Step 0: Choose username (Google flow only) */}
        {step === "username" && (
          <Card>
            <CardHeader>
              <CardTitle>Choose your username</CardTitle>
              <CardDescription>This is how other users will see you on Swing Studio</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUsernameSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="username-input">Username</Label>
                  <div className="relative">
                    <Input
                      id="username-input"
                      placeholder="e.g. slugger42"
                      value={usernameInput}
                      onChange={(e) => { setUsernameInput(e.target.value); setUsernameError(""); }}
                      autoFocus
                      autoComplete="off"
                    />
                    {usernameInput.length >= 3 && (
                      <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold ${
                        usernameChecking ? "text-muted-foreground" :
                        usernameAvailable ? "text-green-500" : "text-destructive"
                      }`}>
                        {usernameChecking ? "…" : usernameAvailable ? "✓ Available" : "✗ Taken"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Letters, numbers, and underscores only. Min 3 characters.</p>
                  {usernameError && <p className="text-xs text-destructive">{usernameError}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={usernameSaving || !usernameAvailable || usernameInput.length < 3}>
                  {usernameSaving ? "Saving..." : "Continue →"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Choose account type */}
        {step === "account_type" && (
          <Card>
            <CardHeader>
              <CardTitle>How will you use Swing Studio?</CardTitle>
              <CardDescription>Choose your account type to personalize your experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={() => setStep("player_profile")}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Player</div>
                  <div className="text-sm text-muted-foreground">Upload and analyze your own swings</div>
                </div>
              </button>
              <button
                onClick={() => setStep("coach_profile")}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <GraduationCap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Coach</div>
                  <div className="text-sm text-muted-foreground">Analyze and share sessions with your players</div>
                </div>
              </button>
              <button
                onClick={() => setStep("parent_profile")}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Parent / Guardian</div>
                  <div className="text-sm text-muted-foreground">Manage swing analysis for your kids</div>
                </div>
              </button>
            </CardContent>
          </Card>
        )}

        {/* Step 2a: Player profile */}
        {step === "player_profile" && (
          <Card>
            <CardHeader>
              <CardTitle>Tell us about yourself</CardTitle>
              <CardDescription>Help us personalize your experience</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePlayerSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="player-first">First Name</Label>
                    <Input
                      id="player-first"
                      placeholder="First"
                      value={playerForm.firstName}
                      onChange={(e) => setPlayerForm(f => ({ ...f, firstName: e.target.value }))}
                    />
                    {playerErrors.firstName && <p className="text-xs text-destructive">{playerErrors.firstName}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="player-last">Last Name</Label>
                    <Input
                      id="player-last"
                      placeholder="Last"
                      value={playerForm.lastName}
                      onChange={(e) => setPlayerForm(f => ({ ...f, lastName: e.target.value }))}
                    />
                    {playerErrors.lastName && <p className="text-xs text-destructive">{playerErrors.lastName}</p>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Bats</Label>
                  <div className="flex gap-2">
                    {BATS_OPTIONS.map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setPlayerForm(f => ({ ...f, bats: f.bats === v ? "" : v }))}
                        className={`flex-1 py-2 rounded-md border text-sm font-semibold transition-colors ${
                          playerForm.bats === v
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {v === "R" ? "Right" : v === "L" ? "Left" : "Switch"}
                      </button>
                    ))}
                  </div>
                  {playerErrors.bats && <p className="text-xs text-destructive">{playerErrors.bats}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Throws</Label>
                  <div className="flex gap-2">
                    {THROWS_OPTIONS.map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setPlayerForm(f => ({ ...f, throws: f.throws === v ? "" : v }))}
                        className={`flex-1 py-2 rounded-md border text-sm font-semibold transition-colors ${
                          playerForm.throws === v
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {v === "R" ? "Right" : "Left"}
                      </button>
                    ))}
                  </div>
                  {playerErrors.throws && <p className="text-xs text-destructive">{playerErrors.throws}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Skill Level</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {PLAYER_SKILL_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setPlayerForm(f => ({ ...f, skillLevel: f.skillLevel === value ? "" : value }))}
                        className={`py-2 rounded-md border text-sm font-semibold transition-colors ${
                          playerForm.skillLevel === value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {playerErrors.skillLevel && <p className="text-xs text-destructive">{playerErrors.skillLevel}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="player-age">Age</Label>
                    <Input
                      id="player-age"
                      type="number"
                      min={5}
                      max={100}
                      placeholder="e.g. 22"
                      value={playerForm.age}
                      onChange={(e) => setPlayerForm(f => ({ ...f, age: e.target.value }))}
                    />
                    {playerErrors.age && <p className="text-xs text-destructive">{playerErrors.age}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="player-city">City</Label>
                    <Input
                      id="player-city"
                      placeholder="e.g. Chicago"
                      value={playerForm.city}
                      onChange={(e) => setPlayerForm(f => ({ ...f, city: e.target.value }))}
                    />
                    {playerErrors.city && <p className="text-xs text-destructive">{playerErrors.city}</p>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>State</Label>
                  <select
                    value={playerForm.state}
                    onChange={(e) => setPlayerForm(f => ({ ...f, state: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-foreground"
                  >
                    <option value="">Select state</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {playerErrors.state && <p className="text-xs text-destructive">{playerErrors.state}</p>}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" onClick={() => setStep("account_type")}>← Back</Button>
                  <Button type="submit" className="flex-1" disabled={isUpdatingProfile}>
                    {isUpdatingProfile ? "Saving..." : "Save & Continue"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2b: Coach profile */}
        {step === "coach_profile" && (
          <Card>
            <CardHeader>
              <CardTitle>Tell us about your coaching</CardTitle>
              <CardDescription>Help us set up your coach experience</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCoachSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="coach-first">First Name</Label>
                    <Input
                      id="coach-first"
                      placeholder="First"
                      value={coachForm.firstName}
                      onChange={(e) => setCoachForm(f => ({ ...f, firstName: e.target.value }))}
                    />
                    {coachErrors.firstName && <p className="text-xs text-destructive">{coachErrors.firstName}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="coach-last">Last Name</Label>
                    <Input
                      id="coach-last"
                      placeholder="Last"
                      value={coachForm.lastName}
                      onChange={(e) => setCoachForm(f => ({ ...f, lastName: e.target.value }))}
                    />
                    {coachErrors.lastName && <p className="text-xs text-destructive">{coachErrors.lastName}</p>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="coach-org">Organization / Team Name</Label>
                  <Input
                    id="coach-org"
                    placeholder="e.g. Lincoln HS Baseball"
                    value={coachForm.organization}
                    onChange={(e) => setCoachForm(f => ({ ...f, organization: e.target.value }))}
                  />
                  {coachErrors.organization && <p className="text-xs text-destructive">{coachErrors.organization}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Coaching Level</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {COACHING_LEVELS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCoachForm(f => ({ ...f, coachingLevel: f.coachingLevel === value ? "" : value }))}
                        className={`py-2 rounded-md border text-sm font-semibold transition-colors ${
                          coachForm.coachingLevel === value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {coachErrors.coachingLevel && <p className="text-xs text-destructive">{coachErrors.coachingLevel}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="coach-city">City</Label>
                    <Input
                      id="coach-city"
                      placeholder="e.g. Chicago"
                      value={coachForm.city}
                      onChange={(e) => setCoachForm(f => ({ ...f, city: e.target.value }))}
                    />
                    {coachErrors.city && <p className="text-xs text-destructive">{coachErrors.city}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>State</Label>
                    <select
                      value={coachForm.state}
                      onChange={(e) => setCoachForm(f => ({ ...f, state: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-foreground"
                    >
                      <option value="">State</option>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {coachErrors.state && <p className="text-xs text-destructive">{coachErrors.state}</p>}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" onClick={() => setStep("account_type")}>← Back</Button>
                  <Button type="submit" className="flex-1" disabled={isUpdatingProfile}>
                    {isUpdatingProfile ? "Saving..." : "Save & Continue"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2c: Parent profile */}
        {step === "parent_profile" && (
          <Card>
            <CardHeader>
              <CardTitle>Your information</CardTitle>
              <CardDescription>Tell us your name — you'll add your athletes next</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleParentSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="parent-first">First Name</Label>
                    <Input
                      id="parent-first"
                      placeholder="First"
                      value={parentForm.firstName}
                      onChange={(e) => setParentForm(f => ({ ...f, firstName: e.target.value }))}
                    />
                    {parentErrors.firstName && <p className="text-xs text-destructive">{parentErrors.firstName}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="parent-last">Last Name</Label>
                    <Input
                      id="parent-last"
                      placeholder="Last"
                      value={parentForm.lastName}
                      onChange={(e) => setParentForm(f => ({ ...f, lastName: e.target.value }))}
                    />
                    {parentErrors.lastName && <p className="text-xs text-destructive">{parentErrors.lastName}</p>}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" onClick={() => setStep("account_type")}>← Back</Button>
                  <Button type="submit" className="flex-1" disabled={isUpdatingProfile}>
                    {isUpdatingProfile ? "Saving..." : "Next: Add Athlete →"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Add first athlete (parent flow) */}
        {step === "add_athlete" && (
          <Card>
            <CardHeader>
              <CardTitle>Add your first athlete</CardTitle>
              <CardDescription>Tell us about your player — you can add more later</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAthleteSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="athlete-first">First Name</Label>
                    <Input
                      id="athlete-first"
                      placeholder="First"
                      value={athleteForm.firstName}
                      onChange={(e) => setAthleteForm(f => ({ ...f, firstName: e.target.value }))}
                    />
                    {athleteErrors.firstName && <p className="text-xs text-destructive">{athleteErrors.firstName}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="athlete-last">Last Name</Label>
                    <Input
                      id="athlete-last"
                      placeholder="Last"
                      value={athleteForm.lastName}
                      onChange={(e) => setAthleteForm(f => ({ ...f, lastName: e.target.value }))}
                    />
                    {athleteErrors.lastName && <p className="text-xs text-destructive">{athleteErrors.lastName}</p>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Bats</Label>
                  <div className="flex gap-2">
                    {BATS_OPTIONS.map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAthleteForm(f => ({ ...f, bats: f.bats === v ? "" : v }))}
                        className={`flex-1 py-2 rounded-md border text-sm font-semibold transition-colors ${
                          athleteForm.bats === v
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {v === "R" ? "Right" : v === "L" ? "Left" : "Switch"}
                      </button>
                    ))}
                  </div>
                  {athleteErrors.bats && <p className="text-xs text-destructive">{athleteErrors.bats}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Throws</Label>
                  <div className="flex gap-2">
                    {THROWS_OPTIONS.map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAthleteForm(f => ({ ...f, throws: f.throws === v ? "" : v }))}
                        className={`flex-1 py-2 rounded-md border text-sm font-semibold transition-colors ${
                          athleteForm.throws === v
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {v === "R" ? "Right" : "Left"}
                      </button>
                    ))}
                  </div>
                  {athleteErrors.throws && <p className="text-xs text-destructive">{athleteErrors.throws}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Skill Level</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {PLAYER_SKILL_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAthleteForm(f => ({ ...f, skillLevel: f.skillLevel === value ? "" : value }))}
                        className={`py-2 rounded-md border text-sm font-semibold transition-colors ${
                          athleteForm.skillLevel === value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {athleteErrors.skillLevel && <p className="text-xs text-destructive">{athleteErrors.skillLevel}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="athlete-age">Age</Label>
                    <Input
                      id="athlete-age"
                      type="number"
                      min={5}
                      max={100}
                      placeholder="e.g. 12"
                      value={athleteForm.age}
                      onChange={(e) => setAthleteForm(f => ({ ...f, age: e.target.value }))}
                    />
                    {athleteErrors.age && <p className="text-xs text-destructive">{athleteErrors.age}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="athlete-city">City</Label>
                    <Input
                      id="athlete-city"
                      placeholder="e.g. Chicago"
                      value={athleteForm.city}
                      onChange={(e) => setAthleteForm(f => ({ ...f, city: e.target.value }))}
                    />
                    {athleteErrors.city && <p className="text-xs text-destructive">{athleteErrors.city}</p>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>State</Label>
                  <select
                    value={athleteForm.state}
                    onChange={(e) => setAthleteForm(f => ({ ...f, state: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-foreground"
                  >
                    <option value="">Select state</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {athleteErrors.state && <p className="text-xs text-destructive">{athleteErrors.state}</p>}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" onClick={() => setStep("parent_profile")}>← Back</Button>
                  <Button type="submit" className="flex-1" disabled={createAthleteMutation.isPending || isUpdatingProfile}>
                    {createAthleteMutation.isPending ? "Saving..." : "Save & Continue"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
