"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Row = { id: string; slug: string; title: string; visibility: string; lifecycleState: string; updatedAt: string };
export function VoyageLogOwnerList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const load = async () => {
    setError("");
    try {
      const response = await fetch("/api/community/voyage-logs/owner", { cache: "no-store" });
      if (!response.ok) throw new Error("unavailable");
      setRows((await response.json() as { logs: Row[] }).logs);
    } catch { setRows(null); setError("Voyage Log drafts are unavailable. Try again."); }
  };
  useEffect(() => { void load(); }, []);
  if (error) return <section role="status"><p>{error}</p><button onClick={() => void load()}>Try again</button></section>;
  if (!rows) return <p role="status">Loading Voyage Logs…</p>;
  if (!rows.length) return <section><h2>No Voyage Log drafts yet</h2><p>Prepare an eligible Keepsake before creating a private sharing draft.</p></section>;
  return <ul aria-label="Your Voyage Logs">{rows.map((row) => <li key={row.id}><article><h2>{row.title}</h2><p>{row.visibility.replaceAll("_", " ")} · {row.lifecycleState.replaceAll("_", " ")}</p><Link href={`/community/voyage-logs/owner/${encodeURIComponent(row.id)}`}>Open editor</Link></article></li>)}</ul>;
}
