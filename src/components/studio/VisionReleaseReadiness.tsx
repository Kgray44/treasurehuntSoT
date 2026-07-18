import Link from "next/link";
import { VisionImprovementQueue } from "@/components/studio/VisionImprovementQueue";
import type { VisionReleaseReadiness as Readiness } from "@/vision/release-readiness";

function label(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

export function VisionReleaseReadiness({ readiness }: { readiness: Readiness }) {
  return (
    <main className="vision-release-readiness">
      <header>
        <div>
          <p className="eyebrow">Phase B-6 release authority</p>
          <h1>Vision release readiness</h1>
          <p>
            Version {readiness.version} · {label(readiness.channel)} channel · build {readiness.buildId}
          </p>
        </div>
        <nav aria-label="Release readiness destinations">
          <Link href="/studio">Studio</Link>
          <Link href="/vision-companion">Companion health</Link>
          <Link href="/studio/vision-waypoints">Vision Waypoints</Link>
        </nav>
      </header>

      <section className="release-decision" aria-labelledby="release-decision-heading" role="status">
        <p className="eyebrow">Current decision</p>
        <h2 id="release-decision-heading">{label(readiness.readinessStatus)}</h2>
        <p>
          {readiness.openBlockerCount} release-blocking{" "}
          {readiness.openBlockerCount === 1 ? "issue remains" : "issues remain"}. Experimental or synthetic behavior is
          not promoted by this dashboard.
        </p>
        <dl>
          <div>
            <dt>Feature status</dt>
            <dd>{label(readiness.status)}</dd>
          </div>
          <div>
            <dt>Source commit</dt>
            <dd>
              <code>{readiness.sourceCommit}</code>
            </dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{new Date(readiness.updatedAt).toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="readiness-sections-heading">
        <h2 id="readiness-sections-heading">Gate summary</h2>
        <div className="release-status-grid">
          {readiness.sections.map((section) => (
            <article key={section.id}>
              <p className="release-status-text">{label(section.status)}</p>
              <h3>{section.label}</h3>
              <p>{section.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="release-blockers-heading">
        <h2 id="release-blockers-heading">Issue register</h2>
        <p>Status is written in text and never communicated by color alone.</p>
        <div className="release-issue-list">
          {readiness.issues.map((issue) => (
            <article key={issue.id}>
              <header>
                <p>
                  <strong>{issue.id}</strong> · {label(issue.severity)} · {label(issue.status)}
                </p>
                {issue.releaseBlocking && <span>Release blocking</span>}
              </header>
              <h3>{issue.title}</h3>
              <p>
                Component: {label(issue.component)} · Owner: {label(issue.owner)}
              </p>
              {issue.regressionTest && (
                <p>
                  Evidence path: <code>{issue.regressionTest}</code>
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="compatibility-heading">
        <h2 id="compatibility-heading">Version and compatibility policy</h2>
        <div className="release-table-scroll" tabIndex={0} aria-label="Scrollable compatibility table">
          <table>
            <caption>Versions interpreted by this development release</caption>
            <thead>
              <tr>
                <th scope="col">Component</th>
                <th scope="col">Current</th>
                <th scope="col">Supported range</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {readiness.compatibility.map((rule) => (
                <tr key={rule.component}>
                  <th scope="row">{label(rule.component)}</th>
                  <td>{rule.currentVersion}</td>
                  <td>
                    {rule.minimumVersion ?? "none"} through {rule.maximumVersion ?? "unbounded"}
                  </td>
                  <td>{label(rule.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="test-evidence-heading">
        <h2 id="test-evidence-heading">Persisted test evidence</h2>
        {!readiness.testRuns.length ? (
          <p>No persisted test evidence is available.</p>
        ) : (
          <ul className="release-test-list">
            {readiness.testRuns.map((run) => (
              <li key={run.id}>
                <strong>{run.status}</strong> — {run.category}: <code>{run.suite}</code>
                {run.completedAt ? ` (${new Date(run.completedAt).toLocaleString()})` : ""}
              </li>
            ))}
          </ul>
        )}
        <p>
          Reliability runs: {readiness.reliabilityRuns.length}. Signed artifacts:{" "}
          {readiness.artifacts.filter((artifact) => artifact.signatureStatus === "SIGNED").length}.
        </p>
      </section>

      <VisionImprovementQueue />

      <section aria-labelledby="limitations-heading">
        <h2 id="limitations-heading">Known limitations</h2>
        <ul>
          {readiness.knownLimitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
        <p>
          Support diagnostics are metadata-only by default. Open{" "}
          <Link href="/vision-companion">Companion health and privacy controls</Link> to create a governed bundle.
        </p>
      </section>
    </main>
  );
}
