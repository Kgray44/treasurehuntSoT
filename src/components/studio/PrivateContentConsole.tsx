"use client";
import { useEffect, useRef, useState } from "react";

export function PrivateContentConsole({ authenticated }: { authenticated: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [csrf, setCsrf] = useState("");
  const [plan, setPlan] = useState("");
  const [message, setMessage] = useState("");
  const [imports, setImports] = useState<
    Array<{ id: string; packageId: string; packageRevision: number; status: string }>
  >([]);
  const [exportId, setExportId] = useState("");
  const [operation, setOperation] = useState<"idle" | "inspecting" | "importing" | "exporting">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  async function refreshImports() {
    const response = await fetch("/api/studio/private-content/imports", { cache: "no-store" });
    if (response.ok) {
      const value = (await response.json()) as {
        imports?: Array<{ id: string; packageId: string; packageRevision: number; status: string }>;
      };
      setImports(value.imports ?? []);
    }
  }
  useEffect(() => {
    if (authenticated)
      void fetch("/api/studio/tales", { cache: "no-store" })
        .then((response) => response.json())
        .then((value: { csrfToken?: string }) => {
          setCsrf(value.csrfToken ?? "");
          return refreshImports();
        })
        .catch(() => setMessage("Private-content controls could not be initialized."));
  }, [authenticated]);
  async function body(confirm = false) {
    if (!file) throw new Error("Select an encrypted package.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return { packageBase64: btoa(binary), passphrase, confirm };
  }
  async function inspect() {
    try {
      setOperation("inspecting");
      setMessage("");
      const response = await fetch("/api/studio/private-content/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(await body()),
      });
      const result = (await response.json()) as {
        error?: string;
        plan?: { packageId: string; packageRevision: number; assetCount: number };
      };
      if (!response.ok) throw new Error(result.error);
      setPlan(
        `${result.plan?.packageId ?? "Package"}, revision ${result.plan?.packageRevision ?? "?"}, ${result.plan?.assetCount ?? 0} assets`,
      );
      setMessage("Inspection succeeded. Import remains private and is not yet committed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The private package could not be authenticated or opened.");
    } finally {
      setOperation("idle");
    }
  }
  async function commit() {
    try {
      setOperation("importing");
      const response = await fetch("/api/studio/private-content/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(await body(true)),
      });
      const result = (await response.json()) as { error?: string; importId?: string };
      if (!response.ok) throw new Error(result.error);
      setMessage(`Private import completed: ${result.importId}. It remains unpublished.`);
      setPassphrase("");
      if (inputRef.current) inputRef.current.value = "";
      setFile(null);
      setPlan("");
      await refreshImports();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The private package could not be imported.");
    } finally {
      setOperation("idle");
    }
  }
  async function exportPackage() {
    try {
      setOperation("exporting");
      if (!exportId || !passphrase) throw new Error("Select an import and enter an export passphrase.");
      const response = await fetch("/api/studio/private-content/export", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ importId: exportId, passphrase }),
      });
      const result = (await response.json()) as { error?: string; packageBytes?: string; packageId?: string };
      if (!response.ok || !result.packageBytes) throw new Error(result.error);
      const binary = atob(result.packageBytes);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
      link.download = `${result.packageId ?? "private-chronicle"}.ftprivate`;
      link.click();
      URL.revokeObjectURL(link.href);
      setPassphrase("");
      setMessage("Encrypted export was verified before download.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The private export could not be created.");
    } finally {
      setOperation("idle");
    }
  }
  if (!authenticated)
    return (
      <main className="studio-auth-gate">
        <h1>Creator access is required.</h1>
      </main>
    );
  return (
    <main className="studio-home studio-private-content" data-private-operation={operation}>
      <header className="studio-home-header">
        <div>
          <p className="eyebrow">Private Chronicle</p>
          <h1>Private content</h1>
          <p>
            Move protected Chronicle packages through deliberate import, verified export, and private history review.
          </p>
        </div>
      </header>
      <div className="studio-private-content__layout">
        <section className="studio-editor-section studio-private-content__import">
          <p className="eyebrow">1. Import</p>
          <h2>Inspect an encrypted package</h2>
          <p id="private-content-help">
            Choose a .ftprivate package and enter its passphrase. The passphrase is held only in this form while the
            request runs.
          </p>
          <div className="studio-private-content__file-select">
            <span>Encrypted package</span>
            <strong>{file ? file.name : "Choose a .ftprivate package"}</strong>
            <small>
              {file
                ? `${Math.ceil(file.size / 1024)} KB selected; nothing has been imported.`
                : "The selected package stays private while it is inspected."}
            </small>
            <button type="button" onClick={() => inputRef.current?.click()}>
              Select protected package
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".ftprivate,application/json"
              aria-label="Select an encrypted private-content package"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <label>
            <span>Passphrase</span>
            <input
              type="password"
              autoComplete="off"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              aria-describedby="private-content-help"
            />
          </label>
          <div className="tale-card-actions">
            <button onClick={() => void inspect()} disabled={operation !== "idle" || !file || !passphrase || !csrf}>
              {operation === "inspecting" ? "Inspecting package…" : "Inspect package"}
            </button>
            <button
              className="primary"
              onClick={() => void commit()}
              disabled={operation !== "idle" || !plan || !file || !passphrase || !csrf}
            >
              {operation === "importing" ? "Importing privately…" : "Confirm private import"}
            </button>
          </div>
          {plan && <p role="status">Plan: {plan}</p>}
          <p role="status" aria-live="polite">
            {message}
          </p>
        </section>
        <section
          className="studio-editor-section studio-private-content__export"
          aria-labelledby="private-export-heading"
        >
          <p className="eyebrow">2. Verified export</p>
          <h2 id="private-export-heading">Verified private export</h2>
          <p>Exports are encrypted and round-trip verified before download.</p>
          <label>
            <span>Imported package</span>
            <select value={exportId} onChange={(event) => setExportId(event.target.value)}>
              <option value="">Select a completed import</option>
              {imports
                .filter((item) => item.status === "COMPLETED")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.packageId} revision {item.packageRevision}
                  </option>
                ))}
            </select>
          </label>
          <button
            className="primary"
            onClick={() => void exportPackage()}
            disabled={operation !== "idle" || !exportId || !passphrase || !csrf}
          >
            {operation === "exporting" ? "Verifying export…" : "Export verified package"}
          </button>
        </section>
        <section
          className="studio-editor-section studio-private-content__history"
          aria-labelledby="private-history-heading"
        >
          <p className="eyebrow">3. History</p>
          <h2 id="private-history-heading">Private import history</h2>
          {imports.length ? (
            <ul>
              {imports.map((item) => (
                <li key={item.id}>
                  {item.packageId} revision {item.packageRevision}: {item.status}
                </li>
              ))}
            </ul>
          ) : (
            <p>No private import has completed in this workspace yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
