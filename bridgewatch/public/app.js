const text = (value) => value ?? "UNMEASURED";
const short = (value) => (value ? String(value).slice(0, 12) : "UNMEASURED");
const lastSeenKey = "bridgewatch:last-seen:v1";
const twelveHours = 12 * 60 * 60 * 1000;
const recentChangePriority = {
  PROJECT_STATE_CHANGED: 0,
  PHASE_STATE_CHANGED: 0,
  MILESTONE_STATE_CHANGED: 1,
  SOUNDING_LINE_ROOT_FAILURE: 1,
  SOUNDING_LINE_DECISION: 1,
  MAIN_ADVANCED: 1,
  PULL_REQUEST_MERGED: 2,
  PULL_REQUEST_OPENED: 3,
  PULL_REQUEST_CLOSED: 3,
  EXTERNAL_GATE_CHANGED: 3,
  PULL_REQUEST_CHECK_STATE_CHANGED: 4,
  WORKER_BLOCKED: 4,
  WORKER_STALE: 4,
  WORKER_FINISHED: 5,
  WORKER_STARTED: 5,
  SOURCE_STATE_CHANGED: 6,
  BRANCH_HEALTH_CHANGED: 7,
};
const recentChangeMaximum = 8;
let board = null;
let selectedTab = "ACTIVE";
const bridgewatchUrl = (path) => {
  const base = window.location.pathname.startsWith("/bridgewatch") ? "/bridgewatch/" : "/";
  return new URL(`${base}${String(path).replace(/^\/+/, "")}`, window.location.origin);
};

const element = (tag, className, content) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
};
const appendRow = (parent, label, value) => {
  const row = element("p", "row");
  row.append(element("span", "label", label), element("span", "value", value));
  parent.append(row);
};
const dateText = (value) => {
  if (!value || Number.isNaN(Date.parse(value))) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
};
const time = (value) => {
  const node = element("time", "mono", dateText(value));
  if (value) node.dateTime = value;
  return node;
};
const durationText = (start, end) => {
  const startMs = Date.parse(start ?? "");
  const endMs = Date.parse(end ?? "");
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return "Not recorded";
  const hours = Math.round((endMs - startMs) / 3_600_000);
  return hours < 48 ? `${hours}h recorded interval` : `${Math.round(hours / 24)}d recorded interval`;
};
const ageText = (ageMs) => {
  if (!Number.isFinite(ageMs) || ageMs < 0) return "Not recorded";
  const hours = Math.floor(ageMs / 3_600_000);
  return hours < 48 ? `${hours}h since activity` : `${Math.floor(hours / 24)}d since activity`;
};
const lifecycle = (project) =>
  selectedTab === "ALL" ||
  (selectedTab === "COMPLETED"
    ? ["COMPLETE", "MERGED"].includes(project.state)
    : selectedTab === "PLANNED"
      ? project.state === "PLANNED"
      : !["COMPLETE", "MERGED", "PLANNED"].includes(project.state));

function currentLastSeen() {
  try {
    const value = localStorage.getItem(lastSeenKey);
    const parsed = value ? Date.parse(value) : Number.NaN;
    if (!Number.isFinite(parsed) || parsed > Date.now() + 60_000 || Date.now() - parsed > 30 * 24 * 60 * 60 * 1000)
      return null;
    return value;
  } catch {
    return null;
  }
}
function rememberVisit() {
  try {
    localStorage.setItem(lastSeenKey, new Date().toISOString());
  } catch {
    /* Browser-local enhancement only. */
  }
}
function renderProgram(program) {
  const host = document.querySelector("#program");
  host.replaceChildren();
  [
    ["Projects", `${program.projects.total} total / ${program.projects.complete} complete`],
    ["Active", String(program.projects.active)],
    ["Phases", `${program.phases.completeOrMerged}/${program.phases.total} complete or merged`],
    ["Open PRs", String(program.operational.openPullRequests)],
    ["Workers", String(program.operational.activeWorkers)],
    ["Root failures", String(program.operational.rootFailures)],
  ].forEach(([label, value]) => {
    const card = element("article", "metric");
    card.append(element("span", "label", label), element("strong", "metric-value", value));
    host.append(card);
  });
}
function renderAttention(items) {
  const host = document.querySelector("#attention");
  host.replaceChildren();
  if (!items.length) return host.append(element("p", "quiet", "No current attention condition is observed."));
  items.forEach((item) => {
    const row = element("article", `attention-item level-${item.level}`);
    row.append(element("strong", "state", `${item.level} / ${item.code}`), element("p", "", item.message));
    host.append(row);
  });
}
async function showProject(project) {
  const host = document.querySelector("#project-detail");
  host.replaceChildren();
  host.append(element("h3", "", `${project.name} / biography`));
  appendRow(host, "Current lifecycle", project.state);
  appendRow(host, "Progress", project.milestonePercent === null ? "UNMEASURED" : `${project.milestonePercent}%`);
  appendRow(host, "Evidence", project.governingReferences.join(" / "));
  let trend = null;
  let history = [];
  try {
    trend = await fetch(bridgewatchUrl(`api/projects/${encodeURIComponent(project.id)}/trends`)).then((response) =>
      response.ok ? response.json() : null,
    );
    history = await fetch(bridgewatchUrl(`api/projects/${encodeURIComponent(project.id)}/history?limit=20`)).then(
      (response) => (response.ok ? response.json() : []),
    );
  } catch {
    trend = null;
    history = [];
  }
  const timeline = element("ol", "timeline");
  (trend?.phases ?? project.phases)
    .sort((a, b) => a.ordinal - b.ordinal)
    .forEach((phase) => {
      const item = element("li", "timeline-item");
      item.append(
        element("strong", "", `Phase ${phase.ordinal}: ${phase.name}`),
        element("p", "", `${phase.state} / ${phase.scope ?? "Recorded governed scope"}`),
      );
      [
        ["Defined / planned", phase.plannedAt],
        ["Started", phase.startedAt],
        ["Accepted", phase.acceptedAt],
        ["Merged", phase.mergedAt],
        ["Completed", phase.completedAt],
      ].forEach(([label, value]) => appendRow(item, label, dateText(value)));
      appendRow(item, "Branch", text(phase.branch));
      appendRow(item, "PR", phase.pullRequest ? `#${phase.pullRequest}` : "Not recorded");
      appendRow(item, "Accepted head", short(phase.acceptedHeadSha));
      appendRow(item, "Integrated main", short(phase.integratedMainSha));
      appendRow(item, "Final decision", text(phase.finalDecision));
      appendRow(item, "Implementation interval", durationText(phase.startedAt, phase.completedAt ?? phase.mergedAt));
      appendRow(item, "Acceptance wait", durationText(phase.completedAt, phase.acceptedAt));
      const milestones = phase.milestones ?? [];
      appendRow(
        item,
        "Milestones",
        milestones.length
          ? milestones.map((milestone) => `${milestone.title}: ${milestone.state}`).join("; ")
          : "UNMEASURED",
      );
      timeline.append(item);
    });
  host.append(timeline);
  const milestones = (trend?.phases ?? project.phases)
    .flatMap((phase) => (phase.milestones ?? []).map((milestone) => ({ ...milestone, phase: phase.name })))
    .filter((milestone) => milestone.acceptedAt)
    .sort((left, right) => left.acceptedAt.localeCompare(right.acceptedAt));
  const milestoneHistory = element("section", "project-history");
  milestoneHistory.append(element("h4", "", "Accepted milestone timeline"));
  if (milestones.length)
    milestones.forEach((milestone) => {
      const row = element("article", "history-event");
      row.append(element("strong", "", `${milestone.phase}: ${milestone.title}`), time(milestone.acceptedAt));
      milestoneHistory.append(row);
    });
  else milestoneHistory.append(element("p", "quiet", "No accepted milestone timestamp is recorded."));
  host.append(milestoneHistory);
  const historicalEvents = element("section", "project-history");
  historicalEvents.append(element("h4", "", "Recent meaningful project history"));
  if (history.length) history.forEach((event) => historicalEvents.append(eventRow(event)));
  else historicalEvents.append(element("p", "quiet", "No additional retained event is recorded for this project."));
  host.append(historicalEvents);
}
function renderProjects() {
  const host = document.querySelector("#projects");
  host.replaceChildren();
  const projects = board.projects.filter(lifecycle);
  if (!projects.length)
    return host.append(element("p", "quiet", "No project is currently evidenced for this lifecycle view."));
  projects.forEach((project) => {
    const card = element("article", "card");
    card.append(
      element("strong", "project-name", project.name),
      element("p", "state", `${project.state} / ${project.phases.length} recorded phases`),
      element(
        "p",
        "",
        `Progress: ${project.milestonePercent === null ? "UNMEASURED" : `${project.milestonePercent}%`}`,
      ),
      element("p", "mono", `Main: ${short(project.finalMainSha)}`),
    );
    if (project.state === "COMPLETE")
      card.append(element("p", "quiet", `Final decision: ${text(project.finalDecision)}`));
    const button = element("button", "detail-button", "View project biography");
    button.type = "button";
    button.addEventListener("click", () => {
      void showProject(project);
    });
    card.append(button);
    host.append(card);
  });
}
function renderWorkers(workers) {
  const host = document.querySelector("#workers");
  host.replaceChildren();
  if (!workers.length) return host.append(element("p", "quiet", "No reporter activity is currently retained."));
  workers.forEach((worker) => {
    const row = element("article", "list-item");
    row.append(element("strong", "", `${worker.effectiveState} / ${worker.workerId}`));
    appendRow(row, "Project", `${worker.project} / Phase ${worker.phase}`);
    appendRow(row, "Task", worker.task);
    appendRow(row, "Branch", worker.branch);
    appendRow(row, "Heartbeat", dateText(worker.heartbeatAt));
    host.append(row);
  });
}
function renderTests(tests) {
  const host = document.querySelector("#tests");
  host.replaceChildren();
  const totals = tests.totals;
  [
    ["Queued", totals.queued],
    ["Running", totals.running],
    ["Passed", totals.passed],
    ["Passed after retry", totals.retries],
    ["Root failures", totals.rootFailures],
    ["Blocked dependents", totals.blockedDependents],
  ].forEach(([label, value]) => appendRow(host, label, String(value)));
  const plans = tests.projection?.plans ?? [];
  if (!plans.length) host.append(element("p", "quiet", "No active Sounding Line plan is observed."));
  plans.forEach((plan) => {
    const row = element("article", "list-item");
    row.append(element("strong", "", `${plan.gate} / ${plan.id}`));
    appendRow(row, "Source", short(plan.sourceSha));
    appendRow(row, "Cleanup", plan.cleanupState);
    appendRow(row, "Finalizer", text(plan.finalDecision));
    host.append(row);
  });
}
function renderPulls(snapshot) {
  const host = document.querySelector("#pulls");
  host.replaceChildren();
  const pulls = snapshot?.openPullRequests ?? [];
  if (!pulls.length)
    return host.append(element("p", "quiet", "No open pull requests are in the current GitHub snapshot."));
  pulls.forEach((pull) => {
    const row = element("a", "list-item", `#${pull.number} / ${pull.title} / checks ${text(pull.checkState)}`);
    row.href = pull.url;
    row.rel = "noreferrer";
    row.target = "_blank";
    host.append(row);
  });
}
function renderBranches(branches) {
  const host = document.querySelector("#branches");
  host.replaceChildren();
  if (!branches.length)
    return host.append(element("p", "quiet", "No relevant remote branch comparison is currently available."));
  branches.forEach((branch) => {
    const row = element("article", `list-item${branch.attention ? " branch-attention" : ""}`);
    row.append(element("strong", "", branch.name));
    appendRow(
      row,
      "Divergence",
      branch.compareState === "AVAILABLE" ? `ahead ${branch.ahead} / behind ${branch.behind}` : "UNMEASURED",
    );
    appendRow(row, "Last activity", dateText(branch.lastActivityAt));
    appendRow(row, "Branch age", ageText(branch.ageMs));
    appendRow(
      row,
      "PR",
      branch.pullRequestNumber ? `#${branch.pullRequestNumber} / ${branch.pullRequestState}` : "Not recorded",
    );
    appendRow(
      row,
      "Lifecycle",
      branch.merged ? "MERGED / historical branch" : branch.stale ? "STALE active context" : "Current context",
    );
    if (branch.message) row.append(element("p", "quiet", branch.message));
    host.append(row);
  });
}
function evidenceUrl(reference) {
  const pull = /^github:([^:]+):pull:(\d+)$/u.exec(reference);
  if (pull) return `https://github.com/${pull[1]}/pull/${pull[2]}`;
  const branch = /^github:([^:]+):branch:([^:]+)$/u.exec(reference);
  if (branch) return `https://github.com/${branch[1]}/tree/${encodeURIComponent(branch[2])}`;
  const run = /^sounding-line:(.+)$/u.exec(reference);
  if (run && board?.github?.repository) return `https://github.com/${board.github.repository}/actions/runs/${run[1]}`;
  return null;
}
function eventRow(event) {
  const row = element("article", "history-event");
  row.append(element("strong", "", event.summary), time(event.occurredAt));
  const context = [event.projectId, event.phaseId, event.kind].filter(Boolean).join(" / ");
  if (context) row.append(element("p", "quiet", context));
  const link = (event.evidenceRefs ?? []).map(evidenceUrl).find(Boolean);
  if (link) {
    const evidence = element("a", "evidence-link", "Evidence");
    evidence.href = link;
    evidence.target = "_blank";
    evidence.rel = "noreferrer";
    row.append(evidence);
  }
  return row;
}
function eventChronology(left, right) {
  return (
    Date.parse(right.occurredAt) - Date.parse(left.occurredAt) ||
    Date.parse(right.observedAt) - Date.parse(left.observedAt) ||
    String(right.id).localeCompare(String(left.id))
  );
}
function conciseRecentChanges(events) {
  const selected = [];
  const entities = new Set();
  [...events]
    .sort(
      (left, right) =>
        (recentChangePriority[left.kind] ?? Number.MAX_SAFE_INTEGER) -
          (recentChangePriority[right.kind] ?? Number.MAX_SAFE_INTEGER) || eventChronology(left, right),
    )
    .forEach((event) => {
      if (event.kind === "BRANCH_HEALTH_CHANGED" || event.kind === "SOURCE_STATE_CHANGED") return;
      const entity = `${event.entityType}:${event.entityId}`;
      if (entities.has(entity) || selected.length >= recentChangeMaximum) return;
      entities.add(entity);
      selected.push(event);
    });
  return selected.sort(eventChronology);
}
function renderHistory(events, hostSelector, { concise = false } = {}) {
  const host = document.querySelector(hostSelector);
  host.replaceChildren();
  const visible = concise ? conciseRecentChanges(events) : events;
  if (!visible.length) {
    const message = events.length
      ? "No accepted lifecycle, blocker, mainline, PR, milestone, or validation change was observed in this interval. Branch and source context remain available below."
      : "No meaningful governed changes were observed in this bounded interval.";
    return host.append(element("p", "quiet", message));
  }
  visible.forEach((event) => host.append(eventRow(event)));
  const omitted = events.length - visible.length;
  if (concise && omitted > 0)
    host.append(
      element(
        "p",
        "quiet",
        `${omitted} lower-priority or related event${omitted === 1 ? " is" : "s are"} available in Program history.`,
      ),
    );
}
async function loadRecent(windowName = "visit") {
  const since = windowName === "visit" ? currentLastSeen() : null;
  const effectiveSince = since ?? new Date(Date.now() - twelveHours).toISOString();
  document.querySelector("#last-check-meta").textContent = since
    ? `Since browser-local visit: ${dateText(since)}`
    : "Last 12 hours (no usable local visit cursor).";
  try {
    const result = await fetch(bridgewatchUrl(`api/history?since=${encodeURIComponent(effectiveSince)}`)).then(
      (response) => (response.ok ? response.json() : { events: [] }),
    );
    renderHistory(result.events ?? [], "#last-check", { concise: true });
  } catch {
    renderHistory([], "#last-check", { concise: true });
  }
}
async function renderArchive(order = "chronological") {
  const host = document.querySelector("#archive");
  host.replaceChildren();
  try {
    const projects = await fetch(bridgewatchUrl(`api/archive?order=${order}`)).then((response) =>
      response.ok ? response.json() : [],
    );
    if (!projects.length)
      return host.append(element("p", "quiet", "No completed project record is currently available."));
    projects.forEach((project) => {
      const row = element("article", "archive-item");
      row.append(element("strong", "", `${project.name} / COMPLETE`), time(project.completionDate));
      appendRow(row, "Final main", short(project.finalMainSha));
      appendRow(row, "Final decision", text(project.finalDecision));
      appendRow(row, "Phases", String(project.phases.length));
      host.append(row);
    });
  } catch {
    host.append(element("p", "quiet", "Completed archive is currently unavailable."));
  }
}
async function renderTrends() {
  const host = document.querySelector("#trends");
  host.replaceChildren();
  try {
    const trends = await fetch(bridgewatchUrl("api/trends")).then((response) => (response.ok ? response.json() : null));
    const accepted = trends?.acceptedTimeline ?? [];
    if (!accepted.length)
      return host.append(element("p", "quiet", "No accepted timestamp is currently recorded for a program trend."));
    accepted.slice(-24).forEach((entry) => {
      const row = element("article", "history-event");
      row.append(element("strong", "", entry.summary), time(entry.at));
      const counts = `Cumulative projects ${entry.projectsComplete}; phases ${entry.phasesAccepted}`;
      row.append(element("p", "quiet", counts));
      host.append(row);
    });
  } catch {
    host.append(element("p", "quiet", "Program trend projection is currently unavailable."));
  }
}
async function refreshSources() {
  const response = await fetch(bridgewatchUrl("api/sources"));
  const sources = await response.json();
  const host = document.querySelector("#sources");
  host.replaceChildren();
  sources.forEach((source) => {
    const row = element("article", "list-item");
    row.append(element("strong", "", `${source.name}: ${source.state}`), time(source.observedAt));
    host.append(row);
  });
}
async function render(data) {
  board = data;
  document.querySelector("#meta").textContent =
    `${data.mode} / GitHub ${data.source.state} / ${text(data.source.observedAt)}`;
  renderProgram(data.program);
  renderAttention(data.attention);
  renderProjects();
  renderWorkers(data.workers);
  renderTests(data.tests);
  renderPulls(data.github);
  renderBranches(data.branches ?? []);
  renderHistory(data.history?.recent ?? [], "#history");
  await Promise.all([refreshSources(), loadRecent(), renderArchive(), renderTrends()]);
  rememberVisit();
}
document.querySelectorAll("[data-tab]").forEach((button) =>
  button.addEventListener("click", () => {
    selectedTab = button.dataset.tab;
    document
      .querySelectorAll("[data-tab]")
      .forEach((entry) => entry.setAttribute("aria-selected", String(entry === button)));
    document.querySelector("#projects").setAttribute("aria-labelledby", button.id);
    renderProjects();
  }),
);
document.querySelectorAll("[data-history-window]").forEach((button) =>
  button.addEventListener("click", () => {
    void loadRecent(button.dataset.historyWindow);
  }),
);
document.querySelectorAll("[data-archive-order]").forEach((button) =>
  button.addEventListener("click", () => {
    void renderArchive(button.dataset.archiveOrder);
  }),
);
const refreshBoard = () =>
  fetch(bridgewatchUrl("api/summary"))
    .then((response) => response.json())
    .then(render)
    .catch(() => {
      document.querySelector("#meta").textContent = "Dashboard unavailable; no observation claim is made.";
    });
void refreshBoard();
setInterval(refreshBoard, 2_000);
