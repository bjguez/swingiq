import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { createElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

export type AthleteProfile = {
  id: string;
  parentUserId: string;
  firstName: string;
  lastName: string;
  age?: number | null;
  bats?: string | null;
  throws?: string | null;
  skillLevel?: string | null;
  city?: string | null;
  state?: string | null;
  createdAt?: string;
};

type AthleteContextValue = {
  athletes: AthleteProfile[];
  activeAthlete: AthleteProfile | null;
  setActiveAthleteId: (id: string) => void;
  isLoading: boolean;
};

const AthleteContext = createContext<AthleteContextValue>({
  athletes: [],
  activeAthlete: null,
  setActiveAthleteId: () => {},
  isLoading: false,
});

const STORAGE_KEY = "activeAthleteId";

export function AthleteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isParent = user?.accountType === "parent";

  const { data: athletes = [], isLoading } = useQuery<AthleteProfile[]>({
    queryKey: ["/api/athletes"],
    queryFn: async () => {
      const res = await fetch("/api/athletes");
      if (!res.ok) throw new Error("Failed to fetch athletes");
      return res.json();
    },
    enabled: isParent,
  });

  const [activeAthleteId, setActiveAthleteIdState] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY);
  });

  // When athletes load, default to first if no active selection or selection is stale
  useEffect(() => {
    if (!isParent || athletes.length === 0) return;
    const valid = athletes.some(a => a.id === activeAthleteId);
    if (!valid) {
      const first = athletes[0].id;
      setActiveAthleteIdState(first);
      localStorage.setItem(STORAGE_KEY, first);
    }
  }, [athletes, activeAthleteId, isParent]);

  function setActiveAthleteId(id: string) {
    setActiveAthleteIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  const activeAthlete = athletes.find(a => a.id === activeAthleteId) ?? athletes[0] ?? null;

  return createElement(
    AthleteContext.Provider,
    { value: { athletes, activeAthlete, setActiveAthleteId, isLoading } },
    children
  );
}

export function useAthletes() {
  return useContext(AthleteContext);
}
