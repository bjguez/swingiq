import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type AuthUser = {
  id: string;
  username: string;
  email?: string | null;
  emailVerified?: boolean;
  isAdmin: boolean;
  age?: number | null;
  city?: string | null;
  state?: string | null;
  skillLevel?: string | null;
  bats?: string | null;
  throws?: string | null;
  heightInches?: number | null;
  weightLbs?: number | null;
  firstName?: string | null;
  lastName?: string | null;
  profileComplete?: boolean;
  subscriptionTier?: string;
  accountType?: "player" | "coach" | "parent";
  organization?: string | null;
  coachingLevel?: string | null;
  coachTrialStartedAt?: string | null;
  coachTrialDaysRemaining?: number | null;
};

async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to fetch user");
  return res.json();
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: Infinity,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const err = await res.json();
        const error = new Error(err.message || "Login failed") as any;
        error.emailNotVerified = err.emailNotVerified ?? false;
        error.emailRequired = err.emailRequired ?? false;
        throw error;
      }
      return res.json() as Promise<AuthUser>;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/me"], user);
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      // Auto-accept a pending coach invite if one was stored before login
      const pendingInvite = sessionStorage.getItem("pendingInviteToken");
      if (pendingInvite) {
        fetch(`/api/coach/invite/accept?token=${encodeURIComponent(pendingInvite)}`).catch(() => {});
        sessionStorage.removeItem("pendingInviteToken");
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Registration failed");
      }
      return res.json(); // returns { message } — not a user (email verification required)
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (profile: {
      username?: string;
      accountType?: "player" | "coach" | "parent";
      firstName?: string;
      lastName?: string;
      age?: number;
      city?: string;
      state?: string;
      skillLevel?: string;
      bats?: string;
      throws?: string;
      heightInches?: number;
      weightLbs?: number;
      organization?: string;
      coachingLevel?: string;
      profileComplete?: boolean;
    }) => {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Profile update failed");
      }
      return res.json() as Promise<AuthUser>;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/me"], user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    },
  });

  return {
    user: user ?? null,
    isLoading,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    updateProfile: updateProfileMutation.mutateAsync,
    logout: logoutMutation.mutate,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    updateProfileError: updateProfileMutation.error,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isUpdatingProfile: updateProfileMutation.isPending,
  };
}
