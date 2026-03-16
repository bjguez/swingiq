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
  profileComplete?: boolean;
  subscriptionTier?: string;
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
        throw error;
      }
      return res.json() as Promise<AuthUser>;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/me"], user);
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string; email: string }) => {
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
      age?: number;
      city?: string;
      state?: string;
      skillLevel?: string;
      bats?: string;
      throws?: string;
      heightInches?: number;
      weightLbs?: number;
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
