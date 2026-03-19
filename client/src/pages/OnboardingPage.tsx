import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, User, GraduationCap } from "lucide-react";

const BATS_OPTIONS = ["R", "L", "S"] as const;
const THROWS_OPTIONS = ["R", "L"] as const;
const PLAYER_SKILL_OPTIONS = [
  { value: "little_league", label: "Little League" },
  { value: "select", label: "Select / Travel" },
  { value: "high_school", label: "High School" },
  { value: "college", label: "College" },
  { value: "pro", label: "Pro / Semi-Pro" },
] as const;
const COACHING_LEVELS = [
  { value: "youth", label: "Youth / Little League" },
  { value: "select", label: "Select / Travel" },
  { value: "high_school", label: "High School" },
  { value: "college", label: "College" },
  { value: "pro", label: "Pro / Semi-Pro" },
] as const;
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

type Step = "account_type" | "player_profile" | "coach_profile";

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { updateProfile, isUpdatingProfile } = useAuth();
  const [step, setStep] = useState<Step>("account_type");

  const [playerForm, setPlayerForm] = useState({
    bats: "",
    throws: "",
    skillLevel: "",
    age: "",
    city: "",
    state: "",
  });

  const [coachForm, setCoachForm] = useState({
    organization: "",
    coachingLevel: "",
    city: "",
    state: "",
  });

  async function handlePlayerSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, any> = { accountType: "player" };
    if (playerForm.bats) payload.bats = playerForm.bats;
    if (playerForm.throws) payload.throws = playerForm.throws;
    if (playerForm.skillLevel) payload.skillLevel = playerForm.skillLevel;
    if (playerForm.age) payload.age = parseInt(playerForm.age, 10);
    if (playerForm.city) payload.city = playerForm.city;
    if (playerForm.state) payload.state = playerForm.state;
    await updateProfile(payload);
    navigate("/");
  }

  async function handleCoachSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, any> = { accountType: "coach" };
    if (coachForm.organization) payload.organization = coachForm.organization;
    if (coachForm.coachingLevel) payload.coachingLevel = coachForm.coachingLevel;
    if (coachForm.city) payload.city = coachForm.city;
    if (coachForm.state) payload.state = coachForm.state;
    await updateProfile(payload);
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
              <Button variant="ghost" className="w-full" onClick={() => navigate("/")}>
                Skip for now
              </Button>
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
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="player-city">City</Label>
                    <Input
                      id="player-city"
                      placeholder="e.g. Chicago"
                      value={playerForm.city}
                      onChange={(e) => setPlayerForm(f => ({ ...f, city: e.target.value }))}
                    />
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
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" onClick={() => setStep("account_type")}>← Back</Button>
                  <Button type="submit" className="flex-1" disabled={isUpdatingProfile}>
                    {isUpdatingProfile ? "Saving..." : "Save & Continue"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => navigate("/")}>Skip</Button>
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
                <div className="space-y-1">
                  <Label htmlFor="coach-org">Organization / Team Name</Label>
                  <Input
                    id="coach-org"
                    placeholder="e.g. Lincoln HS Baseball"
                    value={coachForm.organization}
                    onChange={(e) => setCoachForm(f => ({ ...f, organization: e.target.value }))}
                  />
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
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" onClick={() => setStep("account_type")}>← Back</Button>
                  <Button type="submit" className="flex-1" disabled={isUpdatingProfile}>
                    {isUpdatingProfile ? "Saving..." : "Save & Continue"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => navigate("/")}>Skip</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
