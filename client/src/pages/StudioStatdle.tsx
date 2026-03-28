import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Trophy, X, ChevronRight, Lock, RotateCcw, Delete } from "lucide-react";

const MAX_GUESSES = 6;
const CLUES_INITIALLY_VISIBLE = 3;
const API_BASE = "/api/statdle";

const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
];

// ── Types ─────────────────────────────────────────────────────────────────────

type LetterResult = "correct" | "present" | "absent";
type SubmittedRow = { letters: string; results: LetterResult[] };
type StoredGame = { rows: SubmittedRow[]; won: boolean; lost: boolean };
type Clue = { label: string; value: string };
type ArchiveEntry = { date: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    month: "long", day: "numeric", year: "numeric",
  });
}

function storageKey(date: string) { return `statdle2_${date}`; }

function loadGame(date: string): StoredGame {
  try {
    const raw = localStorage.getItem(storageKey(date));
    if (raw) return JSON.parse(raw);
  } catch {}
  return { rows: [], won: false, lost: false };
}

function saveGame(date: string, state: StoredGame) {
  localStorage.setItem(storageKey(date), JSON.stringify(state));
}

function totalLetters(nameStructure: number[]) {
  return nameStructure.reduce((a, b) => a + b, 0);
}

// Convert flat letters + nameStructure into display items (letters + space markers)
function toDisplayItems(letters: string, nameStructure: number[]) {
  const items: { char: string; isSpace: boolean; letterIdx: number }[] = [];
  let idx = 0;
  for (let wi = 0; wi < nameStructure.length; wi++) {
    if (wi > 0) items.push({ char: " ", isSpace: true, letterIdx: -1 });
    for (let li = 0; li < nameStructure[wi]; li++) {
      items.push({ char: letters[idx] ?? "", isSpace: false, letterIdx: idx });
      idx++;
    }
  }
  return items;
}

function mlbHeadshotUrl(mlbId: string) {
  return `https://img.mlb.com/headshots/current/180x180/${mlbId}.png`;
}

// ── Square ────────────────────────────────────────────────────────────────────

const squareColors: Record<string, string> = {
  correct: "bg-green-600 border-green-600 text-white",
  present: "bg-yellow-500 border-yellow-500 text-white",
  absent: "bg-zinc-600 border-zinc-600 text-white",
  active: "bg-transparent border-primary text-foreground",
  empty: "bg-transparent border-border text-foreground",
};

function LetterSquare({ char, result, isCurrent }: { char: string; result?: LetterResult; isCurrent?: boolean }) {
  const state = result ?? (isCurrent && char ? "active" : "empty");
  return (
    <motion.div
      initial={result ? { rotateX: 0 } : {}}
      animate={result ? { rotateX: [0, -90, 0] } : {}}
      transition={{ duration: 0.4 }}
      className={`w-9 h-9 border-2 rounded flex items-center justify-center font-bold text-sm uppercase ${squareColors[state]}`}
    >
      {char}
    </motion.div>
  );
}

// ── Guess row ─────────────────────────────────────────────────────────────────

function GuessRow({ letters, nameStructure, results, isCurrent }: {
  letters: string;
  nameStructure: number[];
  results?: LetterResult[];
  isCurrent?: boolean;
}) {
  const items = toDisplayItems(letters, nameStructure);
  return (
    <div className="flex items-center gap-1 justify-center">
      {items.map((item, i) =>
        item.isSpace ? (
          <div key={i} className="w-2" />
        ) : (
          <LetterSquare
            key={i}
            char={item.char}
            result={results?.[item.letterIdx]}
            isCurrent={isCurrent}
          />
        )
      )}
    </div>
  );
}

// ── Keyboard ──────────────────────────────────────────────────────────────────

function OnscreenKeyboard({ onKey, letterStatuses }: {
  onKey: (key: string) => void;
  letterStatuses: Record<string, LetterResult>;
}) {
  function keyColor(k: string) {
    const s = letterStatuses[k];
    if (s === "correct") return "bg-green-600 text-white";
    if (s === "present") return "bg-yellow-500 text-white";
    if (s === "absent") return "bg-zinc-600 text-muted-foreground";
    return "bg-secondary text-foreground hover:bg-secondary/70";
  }

  return (
    <div className="flex flex-col items-center gap-1.5 mt-4">
      {KEYBOARD_ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map((k) => (
            <button
              key={k}
              onClick={() => onKey(k)}
              className={`h-14 rounded font-semibold text-sm transition-colors ${
                k === "ENTER" || k === "⌫" ? "px-2 min-w-[52px] text-xs" : "w-9"
              } ${keyColor(k)}`}
            >
              {k === "⌫" ? <Delete size={16} className="mx-auto" /> : k}
            </button>
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
    <div className="flex flex-col items-center gap-2 mb-2">
      <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-border bg-card">
        {!imgError ? (
          <img
            src={mlbHeadshotUrl(mlbId)}
            alt={revealed ? name : "Mystery player"}
            className={`w-full h-full object-cover transition-all duration-500 ${revealed ? "" : "blur-md scale-110"}`}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary text-4xl">⚾</div>
        )}
        {!revealed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock size={18} className="text-white drop-shadow" />
          </div>
        )}
      </div>
      {revealed && <p className="font-bold text-xl text-center">{name}</p>}
    </div>
  );
}

// ── Clue card ─────────────────────────────────────────────────────────────────

function ClueCard({ clue, index, visible }: { clue: Clue; index: number; visible: boolean }) {
  return visible ? (
    <motion.div
      key="visible"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0"
    >
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground w-32 shrink-0 pt-0.5">{clue.label}</span>
      <span className="text-foreground font-medium text-right">{clue.value}</span>
    </motion.div>
  ) : (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0 opacity-30">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground w-32 shrink-0">{clue.label}</span>
      <Lock size={14} className="text-muted-foreground" />
    </div>
  );
}

// ── Game panel ────────────────────────────────────────────────────────────────

function GamePanel({ date, isArchive = false }: { date: string; isArchive?: boolean }) {
  const [nameStructure, setNameStructure] = useState<number[]>([]);
  const [mlbId, setMlbId] = useState("");
  const [clues, setClues] = useState<Clue[]>([]);
  const [rows, setRows] = useState<SubmittedRow[]>([]);
  const [currentLetters, setCurrentLetters] = useState("");
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [letterStatuses, setLetterStatuses] = useState<Record<string, LetterResult>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  const total = totalLetters(nameStructure);
  const gameOver = won || lost;
  const wrongCount = rows.filter(r => r.results[0] !== "correct" || !r.results.every(x => x === "correct")).length;
  const cluesVisible = Math.min(CLUES_INITIALLY_VISIBLE + wrongCount, clues.length);

  useEffect(() => {
    setLoading(true);
    const url = isArchive ? `${API_BASE}/game/${date}` : `${API_BASE}/daily`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setNameStructure(data.nameStructure ?? []);
        setMlbId(data.mlbId ?? "");
        setClues(data.clues ?? []);

        const saved = loadGame(date);
        setRows(saved.rows);
        setWon(saved.won);
        setLost(saved.lost);
        if (saved.won || saved.lost) revealAnswer(date);

        // Rebuild letter statuses from saved rows
        const statuses: Record<string, LetterResult> = {};
        for (const row of saved.rows) {
          const letters = row.letters.toUpperCase().split("");
          row.results.forEach((result, i) => {
            const k = letters[i];
            if (!statuses[k] || result === "correct") statuses[k] = result;
          });
        }
        setLetterStatuses(statuses);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [date, isArchive]);

  async function revealAnswer(d: string) {
    try {
      const res = await fetch(`${API_BASE}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: d, reveal: true }),
      });
      const data = await res.json();
      if (data.answer?.name) setAnswer(data.answer.name);
    } catch {}
  }

  const handleKey = useCallback(async (key: string) => {
    if (gameOver || submitting) return;

    if (key === "⌫" || key === "BACKSPACE") {
      setCurrentLetters(prev => prev.slice(0, -1));
      return;
    }

    if (key === "ENTER") {
      if (currentLetters.length < total) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch(`${API_BASE}/guess`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, guessLetters: currentLetters }),
        });
        const data = await res.json();
        const newRow: SubmittedRow = { letters: currentLetters, results: data.letterResults };
        const newRows = [...rows, newRow];
        const newWon = data.correct;
        const newLost = !data.correct && newRows.length >= MAX_GUESSES;

        setRows(newRows);
        setCurrentLetters("");

        // Update letter statuses
        setLetterStatuses(prev => {
          const next = { ...prev };
          const letters = currentLetters.toUpperCase().split("");
          data.letterResults.forEach((result: LetterResult, i: number) => {
            const k = letters[i];
            if (!next[k] || result === "correct") next[k] = result;
          });
          return next;
        });

        if (newWon) {
          setWon(true);
          setAnswer(data.answer?.name ?? null);
        } else if (newLost) {
          setLost(true);
          await revealAnswer(date);
        }

        saveGame(date, { rows: newRows, won: newWon, lost: newLost });
      } catch {}
      setSubmitting(false);
      return;
    }

    if (/^[A-Z]$/.test(key) && currentLetters.length < total) {
      setCurrentLetters(prev => prev + key.toLowerCase());
    }
  }, [gameOver, submitting, currentLetters, total, rows, date]);

  // Physical keyboard support
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Backspace") handleKey("BACKSPACE");
      else if (e.key === "Enter") handleKey("ENTER");
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKey]);

  if (loading) return <div className="text-center text-muted-foreground py-16">Loading...</div>;
  if (error) return (
    <div className="text-center text-muted-foreground py-16">
      {error === "No players in pool yet" ? "The player pool isn't seeded yet." : `Error: ${error}`}
    </div>
  );

  const emptyRowCount = Math.max(0, MAX_GUESSES - rows.length - (gameOver ? 0 : 1));

  return (
    <div className="space-y-5">
      {/* Photo */}
      {mlbId && <PlayerPhoto mlbId={mlbId} revealed={gameOver} name={answer ?? ""} />}

      {/* Clue board */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Clues</p>
        {clues.map((clue, i) => (
          <ClueCard key={clue.label} clue={clue} index={i} visible={i < cluesVisible} />
        ))}
      </div>

      {/* Guess grid */}
      {nameStructure.length > 0 && (
        <div className="space-y-1.5">
          {rows.map((row, i) => (
            <GuessRow key={i} letters={row.letters} nameStructure={nameStructure} results={row.results} />
          ))}
          {!gameOver && (
            <motion.div animate={shake ? { x: [-6, 6, -6, 6, 0] } : {}} transition={{ duration: 0.3 }}>
              <GuessRow letters={currentLetters} nameStructure={nameStructure} isCurrent />
            </motion.div>
          )}
          {Array.from({ length: emptyRowCount }).map((_, i) => (
            <GuessRow key={`empty-${i}`} letters="" nameStructure={nameStructure} />
          ))}
        </div>
      )}

      {/* Win / Lose */}
      {gameOver && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`rounded-xl border p-4 text-center ${won ? "border-green-500/30 bg-green-500/10" : "border-destructive/30 bg-destructive/10"}`}
        >
          {won ? (
            <>
              <Trophy className="mx-auto mb-1 text-green-400" size={24} />
              <p className="font-bold text-green-400">Got it!</p>
              <p className="text-muted-foreground text-sm">{rows.length === 1 ? "1 guess" : `${rows.length} guesses`}</p>
            </>
          ) : (
            <>
              <X className="mx-auto mb-1 text-destructive" size={24} />
              <p className="font-bold text-destructive">Better luck tomorrow</p>
            </>
          )}
        </motion.div>
      )}

      {/* Keyboard */}
      {!gameOver && nameStructure.length > 0 && (
        <>
          <OnscreenKeyboard onKey={handleKey} letterStatuses={letterStatuses} />
          <button
            onClick={() => revealAnswer(date).then(() => {
              const next = { rows, won: false, lost: true };
              setLost(true);
              saveGame(date, next);
            })}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1 mt-1"
          >
            Give up and show the answer
          </button>
        </>
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
      .then(r => r.json())
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center text-muted-foreground py-12">Loading...</div>;
  if (!entries.length) return <div className="text-center text-muted-foreground py-12">No archive yet.</div>;

  return (
    <div className="space-y-2">
      {entries.map(e => {
        const saved = loadGame(e.date);
        const played = saved.rows.length > 0;
        return (
          <div key={e.date} className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card">
            <p className="text-sm font-medium">{formatDate(e.date)}</p>
            <Button size="sm" variant={played ? "ghost" : "outline"} onClick={() => onPlay(e.date)}>
              {played ? <><RotateCcw size={13} className="mr-1.5" />Replay</> : <><ChevronRight size={14} className="mr-1" />Play</>}
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
  const today = todayStr();

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="mb-8">
          <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-2">Daily Game</p>
          <h1 className="font-display font-bold text-4xl tracking-tight">StudioStatdle</h1>
          <p className="text-muted-foreground text-sm mt-2">Guess the MLB player. A new player every day.</p>
        </div>

        <div className="flex gap-1 mb-6 border-b border-border">
          {(["today", "archive"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === "today") setArchiveDate(null); }}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "today" && (
          <>
            <p className="text-xs text-muted-foreground mb-4">{formatDate(today)}</p>
            <GamePanel date={today} />
          </>
        )}
        {tab === "archive" && !archiveDate && <ArchiveTab onPlay={d => { setArchiveDate(d); }} />}
        {tab === "archive" && archiveDate && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <Button variant="ghost" size="sm" onClick={() => setArchiveDate(null)}>← Back</Button>
              <p className="text-xs text-muted-foreground">{formatDate(archiveDate)}</p>
            </div>
            <GamePanel date={archiveDate} isArchive />
          </>
        )}
      </div>
    </Layout>
  );
}
