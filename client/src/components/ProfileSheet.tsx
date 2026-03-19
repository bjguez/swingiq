import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { fetchVideos } from "@/lib/api";
import { LogOut, User, CheckCircle2, GraduationCap } from "lucide-react";
import type { Video } from "@shared/schema";
import { AuthGateModal } from "@/components/AuthGateModal";

const SKILL_LEVELS = [
  { value: "little_league", label: "Little League" },
  { value: "select", label: "Select / Travel" },
  { value: "high_school", label: "High School" },
  { value: "college", label: "College" },
  { value: "pro", label: "Pro / Semi-Pro" },
];

const COACHING_LEVELS = [
  { value: "little_league", label: "Little League" },
  { value: "select", label: "Select" },
  { value: "high_school", label: "High School" },
  { value: "college", label: "College" },
  { value: "pro", label: "Pro" },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

const FREE_UPLOAD_LIMIT = 5;

interface ProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSheet({ open, onOpenChange }: ProfileSheetProps) {
  const { user, logout, updateProfile, isUpdatingProfile } = useAuth();
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const isCoach = user?.accountType === "coach";
  const [form, setForm] = useState({
    age: user?.age ? String(user.age) : "",
    city: user?.city ?? "",
    state: user?.state ?? "",
    skillLevel: user?.skillLevel ?? "",
    bats: user?.bats ?? "",
    throws: user?.throws ?? "",
    organization: (user as any)?.organization ?? "",
    coachingLevel: (user as any)?.coachingLevel ?? "",
  });

  const { data: allVideos = [] } = useQuery({
    queryKey: ["/api/videos"],
    queryFn: () => fetchVideos(),
    enabled: open && !!user,
  });

  const { data: coaches = [] } = useQuery<any[]>({
    queryKey: ["/api/coach/coaches"],
    enabled: open && !!user && user.accountType !== "coach",
  });

  const userVideos = (allVideos as Video[]).filter(v => !v.isProVideo && v.sourceUrl);
  const isPaid = user?.subscriptionTier === "player" || user?.subscriptionTier === "pro" || user?.subscriptionTier === "coach";
  const swingsUsed = userVideos.length;

  const handleEdit = () => {
    setForm({
      age: user?.age ? String(user.age) : "",
      city: user?.city ?? "",
      state: user?.state ?? "",
      skillLevel: user?.skillLevel ?? "",
      bats: user?.bats ?? "",
      throws: user?.throws ?? "",
      organization: (user as any)?.organization ?? "",
      coachingLevel: (user as any)?.coachingLevel ?? "",
    });
    setEditing(true);
    setSaved(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      age: form.age ? Number(form.age) : undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      skillLevel: form.skillLevel || undefined,
      bats: form.bats || undefined,
      throws: form.throws || undefined,
      organization: form.organization || undefined,
      coachingLevel: form.coachingLevel || undefined,
    });
    setEditing(false);
    setSaved(true);
  };

  const handleSignOut = () => {
    logout();
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-sm bg-card border-border text-foreground flex flex-col gap-0 p-0">
          <SheetHeader className="p-6 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="font-display text-lg uppercase tracking-wide truncate">
                  {user ? user.username : "Guest"}
                </SheetTitle>
                <SheetDescription className="sr-only">Your profile and account settings</SheetDescription>
                {user ? (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isCoach ? "bg-blue-500/20 text-blue-400" : isPaid ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                    {isCoach ? "Coach" : isPaid ? "Pro" : "Free"}
                  </span>
                ) : (
                  <p className="text-xs text-muted-foreground">Not signed in</p>
                )}
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {!user ? (
              <div className="p-6 flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">Sign in to save your swings and compare against pro hitters.</p>
                <Button className="w-full" onClick={() => setAuthGateOpen(true)}>
                  Sign In / Create Account
                </Button>
              </div>
            ) : (
              <div className="p-6 flex flex-col gap-6">
                {/* Player: Swings Used */}
                {!isCoach && !isPaid && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Swings Used</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${swingsUsed >= FREE_UPLOAD_LIMIT ? "bg-yellow-500" : "bg-primary"}`}
                          style={{ width: `${Math.min((swingsUsed / FREE_UPLOAD_LIMIT) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{swingsUsed} / {FREE_UPLOAD_LIMIT}</span>
                    </div>
                    {swingsUsed >= FREE_UPLOAD_LIMIT && (
                      <p className="text-xs text-yellow-500 mt-1.5">Free limit reached — upgrade to keep uploading.</p>
                    )}
                  </div>
                )}

                {/* Profile Info */}
                {!editing ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Profile</p>
                      <button onClick={handleEdit} className="cursor-pointer text-xs text-primary hover:underline">Edit</button>
                    </div>
                    <dl className="space-y-2 text-sm">
                      {isCoach ? [
                        { label: "Organization", value: (user as any).organization },
                        { label: "Coaching Level", value: COACHING_LEVELS.find(s => s.value === (user as any).coachingLevel)?.label },
                        { label: "Location", value: [user.city, user.state].filter(Boolean).join(", ") || null },
                      ].map(({ label, value }) => value ? (
                        <div key={label} className="flex justify-between">
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="font-medium">{value}</dd>
                        </div>
                      ) : null) : [
                        { label: "Skill Level", value: SKILL_LEVELS.find(s => s.value === user.skillLevel)?.label },
                        { label: "Bats", value: user.bats },
                        { label: "Throws", value: user.throws },
                        { label: "Age", value: user.age },
                        { label: "Location", value: [user.city, user.state].filter(Boolean).join(", ") || null },
                      ].map(({ label, value }) => value ? (
                        <div key={label} className="flex justify-between">
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="font-medium">{value}</dd>
                        </div>
                      ) : null)}
                    </dl>
                    {saved && (
                      <p className="text-xs text-primary flex items-center gap-1 mt-3">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Profile saved
                      </p>
                    )}
                  </div>
                ) : isCoach ? (
                  /* Coach edit form */
                  <form onSubmit={handleSave} className="space-y-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Edit Profile</p>

                    <Input placeholder="Organization / Team Name"
                      value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} />

                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Coaching Level</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {COACHING_LEVELS.map(s => (
                          <button key={s.value} type="button"
                            onClick={() => setForm(f => ({ ...f, coachingLevel: s.value }))}
                            className={`cursor-pointer py-2 px-3 rounded-md text-xs font-semibold border transition-colors text-left ${form.coachingLevel === s.value ? "bg-primary/10 border-primary/50 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                          >{s.label}</button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="City"
                        value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                      <select
                        value={form.state}
                        onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-foreground"
                      >
                        <option value="">State</option>
                        {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1" disabled={isUpdatingProfile}>
                        {isUpdatingProfile ? "Saving..." : "Save"}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  /* Player edit form */
                  <form onSubmit={handleSave} className="space-y-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Edit Profile</p>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-muted-foreground w-14 shrink-0">Bats</span>
                      <div className="flex gap-1.5 flex-1">
                        {["L", "R"].map(h => (
                          <button key={h} type="button"
                            onClick={() => setForm(f => ({ ...f, bats: h }))}
                            className={`cursor-pointer flex-1 py-1.5 rounded-md text-sm font-semibold border transition-colors ${form.bats === h ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                          >{h}</button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-muted-foreground w-14 shrink-0">Throws</span>
                      <div className="flex gap-1.5 flex-1">
                        {["L", "R"].map(h => (
                          <button key={h} type="button"
                            onClick={() => setForm(f => ({ ...f, throws: h }))}
                            className={`cursor-pointer flex-1 py-1.5 rounded-md text-sm font-semibold border transition-colors ${form.throws === h ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                          >{h}</button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {SKILL_LEVELS.map(s => (
                        <button key={s.value} type="button"
                          onClick={() => setForm(f => ({ ...f, skillLevel: s.value }))}
                          className={`cursor-pointer py-2 px-3 rounded-md text-xs font-semibold border transition-colors text-left ${form.skillLevel === s.value ? "bg-primary/10 border-primary/50 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                        >{s.label}</button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Age" type="number" min={5} max={100}
                        value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} />
                      <Input placeholder="City"
                        value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                    </div>
                    <select
                      value={form.state}
                      onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-foreground"
                    >
                      <option value="">State</option>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1" disabled={isUpdatingProfile}>
                        {isUpdatingProfile ? "Saving..." : "Save"}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                    </div>
                  </form>
                )}

                {/* My Coaches — player accounts only */}
                {!isCoach && coaches.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">My Coaches</p>
                    <div className="space-y-2">
                      {coaches.map((c: any) => {
                        const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;
                        return (
                          <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-primary/5 border border-primary/10">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <GraduationCap size={14} className="text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{name}</p>
                              {c.organization && <p className="text-xs text-muted-foreground">{c.organization}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {user && (
            <div className="p-4 border-t border-border">
              <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive justify-start" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AuthGateModal
        open={authGateOpen}
        onOpenChange={setAuthGateOpen}
        onSuccess={() => onOpenChange(false)}
      />
    </>
  );
}
