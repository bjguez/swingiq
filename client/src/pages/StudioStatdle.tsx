import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Trophy, X, Lock, Delete, RefreshCw } from "lucide-react";

const MAX_GUESSES = 6;
const CLUES_INITIALLY_VISIBLE = 7;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split("T")[0]; }

function formatDate(dateStr: string) {
  if (dateStr.startsWith("random-")) return "Random game";
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    month: "long", day: "numeric", year: "numeric",
  });
}

function storageKey(date: string) { return `statdle2_${date}`; }

function loadGame(date: string): StoredGame {
  try { const r = localStorage.getItem(storageKey(date)); if (r) return JSON.parse(r); } catch {}
  return { rows: [], won: false, lost: false };
}

function saveGame(date: string, s: StoredGame) {
  localStorage.setItem(storageKey(date), JSON.stringify(s));
}

function totalLetters(ns: number[]) { return ns.reduce((a, b) => a + b, 0); }

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

// ── Letter square ─────────────────────────────────────────────────────────────

const squareClass: Record<string, string> = {
  correct: "bg-green-600 border-green-600 text-white",
  present: "bg-yellow-500 border-yellow-500 text-white",
  absent:  "bg-zinc-600 border-zinc-600 text-white",
  active:  "bg-transparent border-primary text-foreground",
  empty:   "bg-transparent border-border text-foreground",
};

function LetterSquare({ char, result, isCurrent }: { char: string; result?: LetterResult; isCurrent?: boolean }) {
  const state = result ?? (isCurrent && char ? "active" : "empty");
  return (
    <motion.div
      animate={result ? { rotateX: [0, -90, 0] } : {}}
      transition={{ duration: 0.35 }}
      className={`w-9 h-9 border-2 rounded flex items-center justify-center font-bold text-sm uppercase ${squareClass[state]}`}
    >
      {char}
    </motion.div>
  );
}

function GuessRow({ letters, nameStructure, results, isCurrent }: {
  letters: string; nameStructure: number[]; results?: LetterResult[]; isCurrent?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 justify-center">
      {toDisplayItems(letters, nameStructure).map((item, i) =>
        item.isSpace ? <div key={i} className="w-2" /> : (
          <LetterSquare key={i} char={item.char} result={results?.[item.letterIdx]} isCurrent={isCurrent} />
        )
      )}
    </div>
  );
}

// ── Keyboard ──────────────────────────────────────────────────────────────────

function OnscreenKeyboard({ onKey, statuses }: { onKey: (k: string) => void; statuses: Record<string, LetterResult> }) {
  function keyClass(k: string) {
    const s = statuses[k];
    if (s === "correct") return "bg-green-600 text-white";
    if (s === "present") return "bg-yellow-500 text-white";
    if (s === "absent")  return "bg-zinc-600 text-muted-foreground";
    return "bg-secondary text-foreground hover:bg-secondary/70";
  }
  return (
    <div className="flex flex-col items-center gap-1.5">
      {KEYBOARD_ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map(k => (
            <button
              key={k}
              onClick={() => onKey(k)}
              className={`h-12 rounded font-semibold text-sm transition-colors ${
                k === "ENTER" || k === "⌫" ? "px-2 min-w-12 text-xs" : "w-8"
              } ${keyClass(k)}`}
            >
              {k === "⌫" ? <Delete size={14} className="mx-auto" /> : k}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Player photo ──────────────────────────────────────────────────────────────

function PlayerPhoto({ mlbId, revealed, name }: { mlbId: string; revealed: boolean; name: string }) {
  const urls = [
    `https://img.mlb.com/headshots/current/180x180/${mlbId}.png`,
    `https://securea.mlb.com/mlb/images/players/head_shot/${mlbId}.jpg`,
  ];
  const [urlIdx, setUrlIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setUrlIdx(0); setFailed(false); }, [mlbId]);

  function handleError() {
    if (urlIdx + 1 < urls.length) setUrlIdx(i => i + 1);
    else setFailed(true);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-border bg-card">
        {!failed ? (
          <img
            src={urls[urlIdx]}
            alt={revealed ? name : "Mystery player"}
            className={`w-full h-full object-cover transition-all duration-500 ${revealed ? "" : "blur-md scale-110"}`}
            onError={handleError}
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
      {revealed && name && <p className="font-bold text-lg text-center">{name}</p>}
    </div>
  );
}

// ── Clue card ─────────────────────────────────────────────────────────────────

function ClueCard({ clue, index, visible }: { clue: Clue; index: number; visible: boolean }) {
  return visible ? (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="flex items-start justify-between gap-3 py-2.5 border-b border-border last:border-0"
    >
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground w-28 shrink-0 pt-0.5">{clue.label}</span>
      <span className="text-foreground font-medium text-right text-sm">{clue.value}</span>
    </motion.div>
  ) : (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0 opacity-25">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground w-28 shrink-0">{clue.label}</span>
      <Lock size={13} className="text-muted-foreground" />
    </div>
  );
}

// ── Game panel ────────────────────────────────────────────────────────────────

function GamePanel({ date, onPlayAgain }: { date: string; onPlayAgain: () => void }) {
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
  const wrongCount = rows.filter(r => !r.results.every(x => x === "correct")).length;
  const cluesVisible = Math.min(CLUES_INITIALLY_VISIBLE + wrongCount, clues.length);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setRows([]); setCurrentLetters(""); setWon(false); setLost(false);
    setAnswer(null); setLetterStatuses({});

    const url = date.startsWith("random-")
      ? `${API_BASE}/random?seed=${date.replace("random-", "")}`
      : date === todayStr() ? `${API_BASE}/daily` : `${API_BASE}/game/${date}`;

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

        const statuses: Record<string, LetterResult> = {};
        for (const row of saved.rows) {
          row.letters.toUpperCase().split("").forEach((k, i) => {
            if (!statuses[k] || row.results[i] === "correct") statuses[k] = row.results[i];
          });
        }
        setLetterStatuses(statuses);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  async function revealAnswer(d: string) {
    try {
      const res = await fetch(`${API_BASE}/guess`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: d, reveal: true }),
      });
      const data = await res.json();
      if (data.answer?.name) setAnswer(data.answer.name);
    } catch {}
  }

  const handleKey = useCallback(async (key: string) => {
    if (gameOver || submitting) return;

    if (key === "⌫" || key === "BACKSPACE") {
      setCurrentLetters(p => p.slice(0, -1));
      return;
    }

    if (key === "ENTER") {
      if (currentLetters.length < total) {
        setShake(true); setTimeout(() => setShake(false), 400);
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch(`${API_BASE}/guess`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, guessLetters: currentLetters }),
        });
        const data = await res.json();
        const newRow: SubmittedRow = { letters: currentLetters, results: data.letterResults };
        const newRows = [...rows, newRow];
        const newWon = data.correct;
        const newLost = !data.correct && newRows.length >= MAX_GUESSES;

        setRows(newRows);
        setCurrentLetters("");
        setLetterStatuses(prev => {
          const next = { ...prev };
          currentLetters.toUpperCase().split("").forEach((k, i) => {
            if (!next[k] || data.letterResults[i] === "correct") next[k] = data.letterResults[i];
          });
          return next;
        });

        if (newWon) { setWon(true); setAnswer(data.answer?.name ?? null); }
        else if (newLost) { setLost(true); await revealAnswer(date); }

        saveGame(date, { rows: newRows, won: newWon, lost: newLost });
      } catch {}
      setSubmitting(false);
      return;
    }

    if (/^[A-Z]$/.test(key) && currentLetters.length < total) {
      setCurrentLetters(p => p + key.toLowerCase());
    }
  }, [gameOver, submitting, currentLetters, total, rows, date]);

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
  if (error) return <div className="text-center text-muted-foreground py-12">{error}</div>;

  const emptyRowCount = Math.max(0, MAX_GUESSES - rows.length - (gameOver ? 0 : 1));

  return (
    <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-end">

      {/* ── Left: photo + clues ──────────────────────────────── */}
      <div className="space-y-4">
        {mlbId && <PlayerPhoto mlbId={mlbId} revealed={gameOver} name={answer ?? ""} />}

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Clues</p>
          {clues.map((clue, i) => (
            <ClueCard key={clue.label} clue={clue} index={i} visible={i < cluesVisible} />
          ))}
        </div>
      </div>

      {/* ── Right: grid + keyboard ───────────────────────────── */}
      <div className="flex flex-col gap-3 mt-4 lg:mt-0">

        {/* Guess grid */}
        {nameStructure.length > 0 && (
          <div className="space-y-1.5">
            {rows.map((row, i) => (
              <GuessRow key={i} letters={row.letters} nameStructure={nameStructure} results={row.results} />
            ))}
            {!gameOver && (
              <motion.div animate={shake ? { x: [-5, 5, -5, 5, 0] } : {}} transition={{ duration: 0.3 }}>
                <GuessRow letters={currentLetters} nameStructure={nameStructure} isCurrent />
              </motion.div>
            )}
            {Array.from({ length: emptyRowCount }).map((_, i) => (
              <GuessRow key={`e-${i}`} letters="" nameStructure={nameStructure} />
            ))}
          </div>
        )}

        {/* Win / Lose */}
        {gameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className={`rounded-xl border p-4 text-center ${won
              ? "border-green-500/30 bg-green-500/10"
              : "border-destructive/30 bg-destructive/10"}`}
          >
            {won ? (
              <>
                <Trophy className="mx-auto mb-1 text-green-400" size={22} />
                <p className="font-bold text-green-400">Got it!</p>
                <p className="text-muted-foreground text-sm">{rows.length === 1 ? "1 guess" : `${rows.length} guesses`}</p>
              </>
            ) : (
              <>
                <X className="mx-auto mb-1 text-destructive" size={22} />
                <p className="font-bold text-destructive">Better luck next time</p>
              </>
            )}
            <Button size="sm" className="mt-3" onClick={onPlayAgain}>
              <RefreshCw size={14} className="mr-2" /> Play Again
            </Button>
          </motion.div>
        )}

        {/* Keyboard */}
        {!gameOver && nameStructure.length > 0 && (
          <>
            <OnscreenKeyboard onKey={handleKey} statuses={letterStatuses} />
            <button
              onClick={async () => {
                await revealAnswer(date);
                const next = { rows, won: false, lost: true };
                setLost(true);
                saveGame(date, next);
              }}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Give up and show the answer
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StudioStatdle() {
  const [gameDate, setGameDate] = useState(todayStr());

  function playAgain() {
    const seed = Math.floor(Math.random() * 999999);
    setGameDate(`random-${seed}`);
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-6">
          <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-2">Daily Game</p>
          <h1 className="font-display font-bold text-4xl tracking-tight">StudioStatdle</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {formatDate(gameDate)} · Guess the MLB player.
          </p>
        </div>
        <GamePanel key={gameDate} date={gameDate} onPlayAgain={playAgain} />
      </div>
    </Layout>
  );
}
