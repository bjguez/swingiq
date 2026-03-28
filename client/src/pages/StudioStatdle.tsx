import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Trophy, X, ChevronRight, Lock, RotateCcw } from "lucide-react";

const MAX_GUESSES = 6;
const CLUES_INITIALLY_VISIBLE = 3;
const API_BASE = "/api/statdle";

// ── Types ─────────────────────────────────────────────────────────────────────

type Clue = { label: string; value: string };
type Guess = { name: string; correct: boolean };
type GameState = { guesses: Guess[]; won: boolean; lost: boolean };
type ArchiveEntry = { date: string; playerName: string; position: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    month: "long", day: "numeric", year: "numeric",
  });
}

function storageKey(date: string) {
  return `statdle_${date}`;
}

function loadState(date: string): GameState {
  try {
    const raw = localStorage.getItem(storageKey(date));
    if (raw) return JSON.parse(raw);
  } catch {}
  return { guesses: [], won: false, lost: false };
}

function saveState(date: string, state: GameState) {
  localStorage.setItem(storageKey(date), JSON.stringify(state));
}

function mlbHeadshotUrl(mlbId: string) {
  return `https://img.mlb.com/headshots/current/180x180/${mlbId}.png`;
}

// ── Name blanks ───────────────────────────────────────────────────────────────

function NameBlanks({ name, revealed }: { name: string; revealed: boolean }) {
  if (revealed) {
    return <p className="text-2xl font-bold text-center tracking-wide">{name}</p>;
  }

  const words = name.split(" ");
  return (
    <div className="flex flex-wrap gap-3 justify-center">
      {words.map((word, wi) => (
        <div key={wi} className="flex gap-1">
          {word.split("").map((_, li) => (
            <div
              key={li}
              className="w-5 h-0.5 bg-foreground/50 rounded-full mt-6"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Player photo ──────────────────────────────────────────────────────────────

function PlayerPhoto({ mlbId, revealed, name }: { mlbId: string; revealed: boolean; name: string }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex flex-col items-center gap-3 mb-2">
      <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-border bg-card flex items-center justify-center">
        {!imgError ? (
          <img
            src={mlbHeadshotUrl(mlbId)}
            alt={revealed ? name : "Mystery player"}
            className={`w-full h-full object-cover transition-all duration-500 ${revealed ? "" : "blur-md scale-110"}`}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary text-4xl">
            ⚾
          </div>
        )}
        {!revealed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock size={20} className="text-white drop-shadow" />
          </div>
        )}
      </div>
      <NameBlanks name={name} revealed={revealed} />
    </div>
  );
}

// ── Clue card ─────────────────────────────────────────────────────────────────

function ClueCard({ clue, index, visible }: { clue: Clue; index: number; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="visible"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.05 }}
          className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0"
        >
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground w-32 shrink-0 pt-0.5">
            {clue.label}
          </span>
          <span className="text-foreground font-medium text-right">{clue.value}</span>
        </motion.div>
      ) : (
        <div className="flex items-center justify-between py-3 border-b border-border last:border-0 opacity-30">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground w-32 shrink-0">
            {clue.label}
          </span>
          <Lock size={14} className="text-muted-foreground" />
        </div>
      )}
    </AnimatePresence>
  );
}

// ── Autocomplete input ────────────────────────────────────────────────────────

function PlayerSearch({ onSelect, disabled }: { onSelect: (name: string) => void; disabled: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/players/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch {}
    }, 250);
  }, [query]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function select(name: string) {
    onSelect(name);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        placeholder="Search for a player..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40"
      />
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border bg-card shadow-xl overflow-hidden">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => select(r.name)}
              className="w-full text-left px-4 py-2.5 hover:bg-secondary/50 text-sm transition-colors"
            >
              {r.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Game panel ────────────────────────────────────────────────────────────────

function GamePanel({ date, isArchive = false }: { date: string; isArchive?: boolean }) {
  const [clues, setClues] = useState<Clue[]>([]);
  const [mlbId, setMlbId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [gameState, setGameState] = useState<GameState>({ guesses: [], won: false, lost: false });
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const url = isArchive ? `${API_BASE}/game/${date}` : `${API_BASE}/daily`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setClues(data.clues ?? []);
        setMlbId(data.mlbId ?? "");
        setPlayerName(data.nameLength ?? "");
        const saved = loadState(date);
        setGameState(saved);
        if (saved.won || saved.lost) fetchAnswer(date);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [date, isArchive]);

  async function fetchAnswer(d: string) {
    try {
      const res = await fetch(`${API_BASE}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: d, guessName: "__reveal__", reveal: true }),
      });
      const data = await res.json();
      if (data.answer?.name) setAnswer(data.answer.name);
    } catch {}
  }

  async function submitGuess(name: string) {
    if (submitting || gameState.won || gameState.lost) return;
    setSubmitting(true);

    const wrongCount = gameState.guesses.filter((g) => !g.correct).length;
    const isFinal = wrongCount + 1 >= MAX_GUESSES;

    try {
      const res = await fetch(`${API_BASE}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, guessName: name, reveal: isFinal }),
      });
      const data = await res.json();

      const newGuess: Guess = { name, correct: data.correct };
      const newGuesses = [...gameState.guesses, newGuess];
      const won = data.correct;
      const lost = !data.correct && isFinal;

      const next: GameState = { guesses: newGuesses, won, lost };
      setGameState(next);
      saveState(date, next);

      if (won || lost) {
        setAnswer(data.answer?.name ?? null);
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-center text-muted-foreground py-16">Loading...</div>;
  }

  if (error) {
    return (
      <div className="text-center text-muted-foreground py-16">
        {error === "No players in pool yet"
          ? "The player pool isn't seeded yet. Check back soon."
          : `Error: ${error}`}
      </div>
    );
  }

  const wrongGuesses = gameState.guesses.filter((g) => !g.correct).length;
  const cluesVisible = Math.min(CLUES_INITIALLY_VISIBLE + wrongGuesses, clues.length);
  const guessesLeft = MAX_GUESSES - gameState.guesses.length;
  const gameOver = gameState.won || gameState.lost;
  const revealed = gameOver;

  return (
    <div className="space-y-6">
      {/* Player photo + name blanks */}
      {mlbId && playerName && (
        <PlayerPhoto mlbId={mlbId} revealed={revealed} name={answer ?? playerName} />
      )}

      {/* Clue board */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">Clues</p>
        {clues.map((clue, i) => (
          <ClueCard key={clue.label} clue={clue} index={i} visible={i < cluesVisible} />
        ))}
      </div>

      {/* Win / Lose state */}
      {gameOver && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`rounded-xl border p-5 text-center ${
            gameState.won
              ? "border-green-500/30 bg-green-500/10"
              : "border-destructive/30 bg-destructive/10"
          }`}
        >
          {gameState.won ? (
            <>
              <Trophy className="mx-auto mb-2 text-green-400" size={28} />
              <p className="font-bold text-lg text-green-400">Got it!</p>
              <p className="text-muted-foreground text-sm mt-1">
                {answer ?? ""}
                {" · "}
                {gameState.guesses.length === 1 ? "1 guess" : `${gameState.guesses.length} guesses`}
              </p>
            </>
          ) : (
            <>
              <X className="mx-auto mb-2 text-destructive" size={28} />
              <p className="font-bold text-lg text-destructive">Better luck tomorrow</p>
              {answer && <p className="text-muted-foreground text-sm mt-1">The answer was <span className="text-foreground font-semibold">{answer}</span></p>}
            </>
          )}
        </motion.div>
      )}

      {/* Input */}
      {!gameOver && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{guessesLeft} guess{guessesLeft !== 1 ? "es" : ""} remaining</span>
            <span>{MAX_GUESSES - guessesLeft}/{MAX_GUESSES}</span>
          </div>
          <PlayerSearch onSelect={submitGuess} disabled={submitting} />
          <button
            onClick={async () => {
              const res = await fetch(`${API_BASE}/guess`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date, guessName: "__reveal__", reveal: true }),
              });
              const data = await res.json();
              const next: GameState = { guesses: gameState.guesses, won: false, lost: true };
              setGameState(next);
              saveState(date, next);
              if (data.answer?.name) setAnswer(data.answer.name);
            }}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            Give up and show the answer
          </button>
        </div>
      )}

      {/* Guess history */}
      {gameState.guesses.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your guesses</p>
          {gameState.guesses.map((g, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm ${
                g.correct
                  ? "border-green-500/40 bg-green-500/10 text-green-400"
                  : "border-border bg-card text-muted-foreground line-through"
              }`}
            >
              {g.correct ? <Trophy size={14} /> : <X size={14} />}
              {g.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Archive tab ────────────────────────────────────────────────────────────────

function ArchiveTab({ onPlay }: { onPlay: (date: string) => void }) {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/archive`)
      .then((r) => r.json())
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center text-muted-foreground py-12">Loading archive...</div>;
  if (!entries.length) return <div className="text-center text-muted-foreground py-12">No archive yet.</div>;

  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const saved = loadState(e.date);
        const played = saved.guesses.length > 0;
        return (
          <div
            key={e.date}
            className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card"
          >
            <div>
              <p className="font-medium text-sm">{e.playerName}</p>
              <p className="text-xs text-muted-foreground">{formatDate(e.date)} · {e.position}</p>
            </div>
            <Button size="sm" variant={played ? "ghost" : "outline"} onClick={() => onPlay(e.date)}>
              {played ? (
                <><RotateCcw size={13} className="mr-1.5" /> Replay</>
              ) : (
                <><ChevronRight size={14} className="mr-1" /> Play</>
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "today" | "archive";

export default function StudioStatdle() {
  const [tab, setTab] = useState<Tab>("today");
  const [archiveDate, setArchiveDate] = useState<string | null>(null);

  function playArchive(date: string) {
    setArchiveDate(date);
    setTab("archive");
  }

  const today = todayStr();

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-2">Daily Game</p>
          <h1 className="font-display font-bold text-4xl tracking-tight">StudioStatdle</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Guess the MLB player from the clues. A new player every day.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {(["today", "archive"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === "today") setArchiveDate(null); }}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "today" && (
          <>
            <p className="text-xs text-muted-foreground mb-4">{formatDate(today)}</p>
            <GamePanel date={today} />
          </>
        )}

        {tab === "archive" && !archiveDate && (
          <ArchiveTab onPlay={playArchive} />
        )}

        {tab === "archive" && archiveDate && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <Button variant="ghost" size="sm" onClick={() => setArchiveDate(null)}>
                ← Back
              </Button>
              <p className="text-xs text-muted-foreground">{formatDate(archiveDate)}</p>
            </div>
            <GamePanel date={archiveDate} isArchive />
          </>
        )}

      </div>
    </Layout>
  );
}
