export const FREE_CATEGORIES = ["Full Swing", "Game Swing"] as const;
export const PRO_CATEGORIES = ["Gather", "Launch", "Swing"] as const;
export const ALL_USER_CATEGORIES = [...FREE_CATEGORIES, ...PRO_CATEGORIES] as const;
export const PHASES = ["Gather", "Launch", "Swing"] as const;
