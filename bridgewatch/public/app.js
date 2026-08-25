const text = (value) => (value === null || value === undefined || value === "" ? "UNMEASURED" : String(value));
const short = (value) => (value ? String(value).slice(0, 12) : "UNMEASURED");
let routeHost;
const dateText = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value))
    : "UNMEASURED";
const apiUrl = (path) => {
  const base = window.location.pathname.startsWith("/bridgewatch") ? "/bridgewatch/" : "/";
  return new URL(`${base}${String(path).replace(/^\/+/, "")}`, window.location.origin);
};
const request = async (path) => {
  const response = await fetch(apiUrl(path));
  if (!response.ok) throw new Error(`Observation request failed (${response.status})`);
  return response.json();
};
const element = (tag, className, content) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
};
const section = (title, description) => {
  const node = element("section", "section");
  const heading = element("div", "section-heading");
  heading.append(element("h2", "", title), element("p", "quiet", description));
  node.append(heading);
  return node;
};
const empty = (message) => element("p", "empty", message);
const detail = (entries, className = "detail") => {
  const card = element("article", className);
  const list = document.createElement("dl");
  entries
    .filter(([, value]) => value !== undefined)
    .forEach(([label, value]) => {
      list.append(element("dt", "", label), element("dd", "", text(value)));
    });
  card.append(list);
  return card;
};
const stateClass = (value) =>
  /FAIL|BLOCK|UNAVAILABLE|DEGRADED|STALE|ERROR/u.test(text(value))
    ? "bad"
    : /ACCEPT|HEALTHY|COMPLETE|PASS|MAINLINE/u.test(text(value))
      ? "good"
      : "warn";
const tag = (value) => element("span", `tag ${stateClass(value)}`, text(value));
const linkButton = (label, hash) => {
  const button = element("button", "link-button", label);
  button.type = "button";
  button.addEventListener("click", () => {
    window.location.hash = hash;
  });
  return button;
};
const externalLink = (label, href) => {
  if (!href || !/^https:\/\//iu.test(href)) return element("span", "quiet", "UNMEASURED");
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
};
const listRow = (title, state, body) => {
  const row = element("article", `list-item ${stateClass(state)}`);
  const top = element("div", "row-top");
  top.append(element("strong", "", title), tag(state));
  row.append(top);
  if (body) row.append(body);
  return row;
};
let snapshot = null;
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
async function refreshSources() {
  return request("api/sources");
}
routeHost = document.querySelector("#route");
const renderMetric = (label, value, note) => {
  const card = element("article", "card metric");
  card.append(element("p", "quiet", label), element("strong", "", text(value)));
  if (note) card.append(element("p", "quiet", note));
  return card;
};
const eventList = (events) => {
  const host = element("div", "list");
  if (!events?.length) return empty("No retained observations match this scope.");
  events.forEach((entry) => {
    const body = element(
      "p",
      "quiet",
      `${entry.summary ?? entry.kind} / ${dateText(entry.occurredAt ?? entry.observedAt)}`,
    );
    host.append(listRow(entry.entityType ?? "Observation", entry.kind ?? "OBSERVED", body));
  });
  return host;
};
const table = (headers, rows) => {
  const wrap = element("div", "table-wrap");
  const node = document.createElement("table");
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headers.forEach((header) => headerRow.append(element("th", "", header)));
  head.append(headerRow);
  const body = document.createElement("tbody");
  rows.forEach((cells) => {
    const row = document.createElement("tr");
    cells.forEach((cell) => {
      const item = document.createElement("td");
      item.append(cell instanceof Node ? cell : document.createTextNode(text(cell)));
      row.append(item);
    });
    body.append(row);
  });
  node.append(head, body);
  wrap.append(node);
  return wrap;
};
const searchText = (value) =>
  Array.isArray(value) ? value.map(searchText).join(" ") : value === null || value === undefined ? "" : String(value);
const nodeCount = (nodes, states) => (nodes ?? []).filter((node) => states.includes(node.state)).length;
const nodeSummary = (nodes) => ({
  suites: [...new Set((nodes ?? []).map((node) => node.suiteId))].join(", ") || "UNMEASURED",
  total: nodes?.length ?? 0,
  passed: nodeCount(nodes, ["PASSED", "PASSED_AFTER_RETRY"]),
  failed: nodeCount(nodes, ["FAILED"]),
  skipped: nodeCount(nodes, ["SKIPPED", "NOT_RUN"]),
  blocked: nodeCount(nodes, ["BLOCKED"]),
  retries: (nodes ?? []).filter((node) => node.state === "PASSED_AFTER_RETRY" || node.attempt > 1).length,
  roots: new Set((nodes ?? []).filter((node) => node.rootFailureId).map((node) => node.rootFailureId)).size,
  resources: [...new Set((nodes ?? []).flatMap((node) => node.resources ?? []))].join(", ") || "UNMEASURED",
});
function filteredTable({ records, headers, row, matches, placeholder, emptyMessage }) {
  const host = element("div", "filterable-table");
  const controls = element("div", "filter-controls");
  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = placeholder;
  input.setAttribute("aria-label", placeholder);
  const result = element("div", "filter-results");
  const render = () => {
    const query = input.value.trim().toLocaleLowerCase();
    const retained = records.filter((record) => !query || matches(record).toLocaleLowerCase().includes(query));
    result.replaceChildren(
      retained.length
        ? table(headers, retained.map(row))
        : empty(query ? "No retained observation matches this filter." : emptyMessage),
    );
  };
  input.addEventListener("input", render);
  controls.append(input);
  host.append(controls, result);
  render();
  return host;
}
function renderOverview() {
  const node = document.createDocumentFragment();
  const summary = snapshot ?? {};
  const program = summary.program ?? {};
  const overview = section("Observation overview", "Live status is bounded to retained evidence and source freshness.");
  const metrics = element("div", "grid");
  [
    ["Projects", program.projects?.total],
    ["Accepted phases", program.phases?.completeOrMerged],
    ["Workers", summary.workers?.length],
    ["Attention items", summary.attention?.length],
  ].forEach(([label, value]) => metrics.append(renderMetric(label, value)));
  overview.append(metrics);
  node.append(overview);
  const changes = section("Since last check", "Governed transitions are prioritized; polling noise is suppressed.");
  changes.append(eventList(conciseRecentChanges(summary.history?.recent ?? [])));
  node.append(changes);
  const attention = section("Current attention", "Root conditions are deduplicated before display.");
  attention.append(renderAttentionList(summary.attention));
  node.append(attention);
  return node;
}
function renderAttentionList(items) {
  const host = element("div", "list");
  if (!items?.length) return empty("No current attention item is retained.");
  items.forEach((item) =>
    host.append(
      listRow(
        item.code ?? item.title ?? item.kind ?? "Attention",
        item.level ?? item.severity ?? item.state ?? "OBSERVED",
        element("p", "quiet", text(item.message ?? item.detail ?? item.summary)),
      ),
    ),
  );
  return host;
}
async function renderProgram() {
  const data = await request("api/program");
  const node = document.createDocumentFragment();
  const summary = section(
    "Program intelligence",
    "Counts and accepted-history trends; no fabricated global completion percentage.",
  );
  const metrics = element("div", "grid");
  Object.entries(data.summary ?? {}).forEach(([scope, values]) =>
    Object.entries(values ?? {})
      .filter(([, value]) => typeof value === "number")
      .forEach(([label, value]) =>
        metrics.append(renderMetric(`${scope} ${label}`.replaceAll(/([A-Z])/g, " $1"), value)),
      ),
  );
  summary.append(metrics);
  summary.append(detail([["Current observed main", data.currentMain ?? "NOT_RECORDED"]]));
  node.append(summary);
  const discovered = section(
    "Discovered project truth",
    "Repository documents, local refs, and GitHub observations are reconciled without rewriting accepted history.",
  );
  const rows = (data.discoveredProjects ?? []).map((project) => [
    linkButton(project.name, `#/projects/${encodeURIComponent(project.id)}`),
    project.state ?? "OBSERVED",
    project.confidence,
    project.phaseCount ?? "UNMEASURED",
  ]);
  discovered.append(
    rows.length
      ? table(["Project", "State", "Confidence", "Declared phases"], rows)
      : empty("No durable discovery record is retained yet."),
  );
  node.append(discovered);
  const timeline = section(
    "Accepted timeline",
    "Chronological accepted results remain distinct from active discovery.",
  );
  timeline.append(eventList(data.acceptedHistory ?? []));
  node.append(timeline);
  const historyWindow = section(
    "Program history window",
    "Choose a bounded From/To interval to inspect retained program events without changing observation state.",
  );
  const controls = element("div", "actions");
  const from = document.createElement("input");
  from.type = "datetime-local";
  from.value = new Date(Date.now() - 86_400_000).toISOString().slice(0, 16);
  from.setAttribute("aria-label", "Program history from");
  const to = document.createElement("input");
  to.type = "datetime-local";
  to.value = new Date().toISOString().slice(0, 16);
  to.setAttribute("aria-label", "Program history to");
  const load = element("button", "", "Load window");
  const result = element("div", "filter-results");
  const loadWindow = async () => {
    if (!from.value || !to.value) {
      result.replaceChildren(empty("Both From and To are required for a bounded history window."));
      return;
    }
    try {
      const parameters = new URLSearchParams({
        since: new Date(from.value).toISOString(),
        until: new Date(to.value).toISOString(),
        limit: "250",
      });
      const history = await request(`api/history?${parameters}`);
      result.replaceChildren(
        filteredTable({
          records: history.events ?? [],
          headers: ["When", "Type", "Entity", "Summary"],
          row: (event) => [
            dateText(event.occurredAt ?? event.observedAt),
            event.kind ?? "OBSERVED",
            `${event.entityType ?? "Observation"}: ${event.entityId ?? "UNMEASURED"}`,
            event.summary ?? "UNMEASURED",
          ],
          matches: (event) =>
            searchText([event.kind, event.entityType, event.entityId, event.projectId, event.phaseId, event.summary]),
          placeholder: "Search retained history",
          emptyMessage: "No retained observation matches this program window.",
        }),
      );
    } catch (error) {
      result.replaceChildren(empty(error instanceof Error ? error.message : "Program history is unavailable."));
    }
  };
  load.addEventListener("click", () => void loadWindow());
  controls.append(from, to, load);
  historyWindow.append(controls, result);
  node.append(historyWindow);
  return node;
}
async function renderProjects() {
  const projects = await request("api/projects");
  const node = document.createDocumentFragment();
  const sectionNode = section(
    "Project portfolio",
    "Open a project for state, governing evidence, phase history, and first-class versions.",
  );
  sectionNode.append(
    filteredTable({
      records: projects,
      headers: ["Project", "State", "Phase progress", "Versions", "Main", "Confidence"],
      row: (project) => [
        linkButton(project.name, `#/projects/${encodeURIComponent(project.id)}`),
        project.state,
        project.phaseProgress?.state === "MEASURED"
          ? `${project.phaseProgress.completed}/${project.phaseProgress.total}`
          : "NOT_RECORDED",
        (project.versions ?? []).map((version) => version.identity).join(", ") || "NOT_RECORDED",
        short(project.mainSha ?? project.finalMainSha) === "UNMEASURED"
          ? "NOT_RECORDED"
          : short(project.mainSha ?? project.finalMainSha),
        project.discoveryConfidence ?? "RETAINED",
      ],
      matches: (project) =>
        searchText([
          project.name,
          project.id,
          project.state,
          project.discoveryConfidence,
          project.versions,
          project.mainSha,
        ]),
      placeholder: "Search projects",
      emptyMessage: "No project registry is available.",
    }),
  );
  node.append(sectionNode);
  return node;
}
async function renderProjectProfile(id) {
  const project = await request(`api/projects/${encodeURIComponent(id)}`);
  const versions = await request(`api/projects/${encodeURIComponent(id)}/versions`);
  const node = document.createDocumentFragment();
  const profile = section(
    `${project.name} project profile`,
    "Truth is attributed to retained governing references and observed evidence.",
  );
  profile.append(
    detail([
      ["State", project.state],
      ["Discovery confidence", project.discoveryConfidence],
      ["Final main", project.finalMainSha],
      ["Final decision", project.finalDecision],
      ["Governing references", (project.governingReferences ?? []).join("; ")],
    ]),
  );
  node.append(profile);
  const phases = section("Phases", "Accepted history is preserved; select a phase for evidence and validation detail.");
  phases.append(
    filteredTable({
      records: project.phases ?? [],
      headers: ["Phase", "State", "Accepted source", "Receipt"],
      row: (phase) => [
        linkButton(`Phase ${phase.ordinal}`, `#/projects/${encodeURIComponent(id)}/phases/${phase.ordinal}`),
        phase.state,
        short(phase.integratedMainSha ?? phase.acceptedHeadSha),
        phase.completionReceipt ?? "UNMEASURED",
      ],
      matches: (phase) =>
        searchText([
          phase.ordinal,
          phase.name,
          phase.state,
          phase.acceptedHeadSha,
          phase.integratedMainSha,
          phase.completionReceipt,
        ]),
      placeholder: "Search phases",
      emptyMessage: "No phase record is retained.",
    }),
  );
  node.append(phases);
  const versionsSection = section(
    "Versions",
    "Version lifecycle is a first-class observation, separate from phase history.",
  );
  versionsSection.append(
    filteredTable({
      records: versions,
      headers: ["Version", "Lifecycle", "Confidence", "Summary"],
      row: (version) => [
        linkButton(
          version.identity,
          `#/projects/${encodeURIComponent(id)}/versions/${encodeURIComponent(version.identity)}`,
        ),
        version.lifecycle,
        version.confidence,
        version.summary ?? "UNMEASURED",
      ],
      matches: (version) =>
        searchText([version.identity, version.lifecycle, version.confidence, version.summary, version.evidence]),
      placeholder: "Search versions",
      emptyMessage: "No discovered version is retained.",
    }),
  );
  node.append(versionsSection);
  const related = section(
    "Related activity",
    "Only observed GitHub, worker, validation, and retained-history records associated with this project.",
  );
  related.append(
    detail([
      ["Observed branches", project.branches?.length ?? 0],
      ["Observed pull requests", project.pullRequests?.length ?? 0],
      ["Retained worker records", project.workers?.length ?? 0],
      ["Validation runs", project.tests?.length ?? 0],
      ["Retained history events", project.history?.length ?? 0],
      ["Evidence", (project.evidence ?? []).join("; ")],
    ]),
  );
  const activity = [
    ...(project.history ?? []),
    ...(project.workers ?? []).map((worker) => ({
      entityType: "worker",
      kind: worker.effectiveState ?? worker.state,
      summary: `${worker.workerId}: ${worker.task}`,
      occurredAt: worker.heartbeatAt,
    })),
  ];
  related.append(eventList(activity));
  node.append(related);
  return node;
}
async function renderVersionProfile(id, version) {
  const data = await request(`api/projects/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}`);
  const node = document.createDocumentFragment();
  const profile = section(
    `${data.project.name} ${data.version.identity}`,
    "Version profile with its own evidence, lifecycle, and associated read-only records.",
  );
  profile.append(
    detail([
      ["Lifecycle", data.version.lifecycle],
      ["Confidence", data.version.confidence],
      ["Summary", data.version.summary],
      ["Integrated main", data.version.integratedMainSha],
      ["Evidence", (data.evidence ?? []).map((entry) => entry.reference ?? entry).join("; ")],
    ]),
  );
  node.append(profile);
  const evidence = section(
    "Associated evidence",
    "Evidence is listed with its retained source; absence is reported as unmeasured.",
  );
  evidence.append(eventList(data.history));
  node.append(evidence);
  const related = section(
    "Associated work",
    "Observed phases, branches, and pull requests with explicit version evidence.",
  );
  related.append(
    detail([
      ["Associated phases", data.phases?.map((phase) => `Phase ${phase.ordinal}`).join(", ")],
      ["Observed branches", data.branches?.map((branch) => branch.name).join(", ")],
      ["Observed pull requests", data.pullRequests?.map((pull) => `#${pull.number}`).join(", ")],
    ]),
  );
  node.append(related);
  return node;
}
async function renderPhaseProfile(id, ordinal) {
  const data = await request(`api/projects/${encodeURIComponent(id)}/phases/${encodeURIComponent(ordinal)}`);
  const node = document.createDocumentFragment();
  const profile = section(
    `${data.project.name} / Phase ${data.phase.ordinal}`,
    "Phase-level truth, workers, validation, and history.",
  );
  profile.append(
    detail([
      ["State", data.phase.state],
      ["Accepted head", data.phase.acceptedHeadSha],
      ["Integrated main", data.phase.integratedMainSha],
      ["Decision", data.phase.finalDecision],
      ["Receipt", data.phase.completionReceipt],
      ["Evidence", (data.evidence ?? []).join("; ")],
    ]),
  );
  node.append(profile);
  const tasks = section(
    "Phase tasks and workers",
    "Current and historical telemetry is retained as observed work evidence; zero active workers does not erase it.",
  );
  tasks.append(
    (data.tasks ?? []).length
      ? table(
          ["Task", "Worker", "State", "Branch", "Started", "Heartbeat", "Result"],
          data.tasks.map((task) => [
            task.title,
            task.workerId ?? "UNMEASURED",
            task.result ?? "UNMEASURED",
            task.branch ?? "UNMEASURED",
            dateText(task.startedAt),
            dateText(task.heartbeatAt),
            task.result ?? "UNMEASURED",
          ]),
        )
      : empty("No task or worker evidence is retained for this phase."),
  );
  node.append(tasks);
  const validation = section(
    "Phase validation and Sounding Line runs",
    "Only runs whose retained source SHA matches this phase are shown; missing test-level fields remain unmeasured.",
  );
  validation.append(
    (data.tests ?? []).length
      ? table(
          ["Run", "Suites", "Tests", "Passed", "Failed", "Blocked", "Retries", "Roots", "Resources", "Observed"],
          data.tests.map((run) => {
            const summary = nodeSummary(run.value?.nodes);
            return [
              linkButton(run.id, `#/operations/runs/${encodeURIComponent(run.id)}`),
              summary.suites,
              summary.total,
              summary.passed,
              summary.failed,
              summary.blocked,
              summary.retries,
              summary.roots,
              summary.resources,
              dateText(run.observedAt),
            ];
          }),
        )
      : empty("No retained Sounding Line run is associated with this phase source SHA."),
  );
  node.append(validation);
  const activity = section(
    "Related operations",
    "Read-only telemetry and retained validation evidence associated with this phase.",
  );
  activity.append(
    eventList([
      ...(data.history ?? []),
      ...(data.tests ?? []).map((run) => ({
        entityType: "validation",
        kind: run.value?.decision ?? "OBSERVED",
        summary: run.value?.name,
        occurredAt: run.value?.observedAt,
      })),
    ]),
  );
  node.append(activity);
  return node;
}
async function renderOperations() {
  const [workers, runs, totals, nightwatch] = await Promise.all([
    request("api/workers"),
    request("api/sounding-line/runs"),
    request("api/tests"),
    request("api/nightwatch"),
  ]);
  const node = document.createDocumentFragment();
  const workerSection = section("Workers", "Telemetry is activity evidence only; it never controls a worker.");
  workerSection.append(
    workers.length
      ? table(
          ["Worker", "Project", "State", "Heartbeat"],
          workers.map((worker) => [
            worker.workerId,
            worker.project,
            worker.effectiveState ?? worker.state,
            dateText(worker.heartbeatAt),
          ]),
        )
      : empty("No active worker telemetry is retained."),
  );
  node.append(workerSection);
  const controller = nightwatch.controller ?? {
    state: "DOWN",
    instanceId: null,
    heartbeatAt: null,
    lastSuccessfulReconciliationAt: null,
    detail: "Nightwatch controller health is unavailable.",
  };
  const controllerHealth = section(
    "Nightwatch controller health",
    "Read-only liveness and last successful reconciliation evidence for the persistent integration controller.",
  );
  controllerHealth.append(
    detail([
      ["Ledger availability", nightwatch.state],
      ["Controller state", controller.state],
      ["Controller instance", controller.instanceId],
      ["Last heartbeat", dateText(controller.heartbeatAt)],
      ["Last successful reconciliation", dateText(controller.lastSuccessfulReconciliationAt)],
      ["Detail", controller.detail],
    ]),
  );
  node.append(controllerHealth);
  const acceptance = section(
    "Nightwatch acceptance transaction",
    "Current exact queue-front acceptance truth. Pending authority is not a product failure.",
  );
  const transaction = (nightwatch.transactions ?? []).find(
    (entry) => !["INTEGRATED", "POST_MERGE_VERIFIED"].includes(entry.state),
  );
  const cascade = (nightwatch.cascades ?? []).find((entry) => entry.id === transaction?.cascadeId);
  const cost = (nightwatch.costs ?? []).find((entry) => entry.cascadeId === transaction?.cascadeId);
  acceptance.append(
    transaction
      ? detail([
          ["State", transaction.state],
          ["Candidate SHA / tree", `${short(transaction.candidateSha)} / ${short(transaction.candidateTreeSha)}`],
          ["Qualified base / tree", `${short(transaction.baseSha)} / ${short(transaction.baseTreeSha)}`],
          ["Authority run", transaction.authorityRunId],
          ["Binding run", transaction.bindingRunId],
          ["Integration lease", transaction.leaseId ?? nightwatch.acceptanceOwnership],
          ["Last semantic invalidation", transaction.lastSemanticInvalidation],
          ["Preserved / rerun evidence", `${transaction.preservedEvidenceCount} / ${transaction.rerunEvidenceCount}`],
          ["Cascade status", cascade?.status],
          [
            "Cascade PRs / authority attempts / rebuilds",
            cascade
              ? `${cascade.maintenancePrCount} / ${cascade.authorityAttempts} / ${cascade.mainlineRebuilds}`
              : undefined,
          ],
          [
            "Total elapsed / product value",
            cost
              ? `${Math.round((Date.now() - Date.parse(cost.startedAt)) / 60000)}m / ${Math.round(cost.productValueMs / 60000)}m`
              : undefined,
          ],
          [
            "Control-plane active / wait",
            cost
              ? `${Math.round(cost.controlPlaneActiveMs / 60000)}m / ${Math.round(cost.controlPlaneWaitMs / 60000)}m`
              : undefined,
          ],
          [
            "External / maintenance",
            cost
              ? `${Math.round(cost.externallyBlockedMs / 60000)}m / ${Math.round(cost.descendantMaintenanceMs / 60000)}m`
              : undefined,
          ],
          ["Remaining closure steps", cost?.remainingClosureSteps?.join(" → ")],
        ])
      : empty(
          nightwatch.state === "UNAVAILABLE"
            ? "Nightwatch has not created a local ledger yet."
            : "No active acceptance transaction is retained.",
        ),
  );
  node.append(acceptance);
  const validation = section(
    "Validation",
    "Sounding Line evidence is shown without rerun, cancellation, or cleanup controls.",
  );
  const metrics = element("div", "grid");
  Object.entries(totals ?? {}).forEach(([label, value]) => metrics.append(renderMetric(label, value)));
  validation.append(metrics);
  node.append(validation);
  const testSection = section("Sounding Line runs", "Retained validation runs are independent deep-link resources.");
  testSection.append(
    runs.length
      ? table(
          ["Run", "Decision", "Observed"],
          runs.map((run) => [
            linkButton(run.id, `#/operations/runs/${encodeURIComponent(run.id)}`),
            run.value?.finalDecision ?? "UNMEASURED",
            dateText(run.observedAt),
          ]),
        )
      : empty("No retained validation run is available."),
  );
  node.append(testSection);
  return node;
}
async function renderSoundingLineProfile(id) {
  const data = await request(`api/sounding-line/runs/${encodeURIComponent(id)}`);
  const node = document.createDocumentFragment();
  const profile = section(
    `Sounding Line run ${data.run.id}`,
    "Retained validation evidence; Bridgewatch provides no rerun, cancel, or cleanup control.",
  );
  profile.append(
    detail([
      ["Gate", data.run.value.gate],
      ["State", data.run.value.state],
      ["Decision", data.run.value.finalDecision],
      ["Cleanup", data.run.value.cleanupState],
      ["Source SHA", data.run.value.sourceSha],
      ["Authority version", data.run.value.authorityVersion],
      ["Authority boundary", data.run.value.authorityBoundary],
      ["Candidate type", data.run.value.authorityMode],
      ["Qualified base", data.run.value.qualifiedBaseSha],
      ["Candidate tree", data.run.value.candidateTreeSha],
      ["Predicted integration tree", data.run.value.predictedIntegrationTreeSha],
      ["Plan digest", data.run.value.planDigest],
      ["Train", data.run.value.trainId],
      ["Evidence dispositions", JSON.stringify(data.run.value.evidenceDispositionCounts ?? {})],
      ["Conservative fallback", data.run.value.semanticFallback],
      ["Finalizer", data.run.value.finalizerAuthority],
      ["Evidence digest", data.run.value.evidenceDigest],
      ["Observed", dateText(data.run.observedAt)],
      ["Evidence", (data.evidence ?? []).join("; ")],
    ]),
  );
  node.append(profile);
  const execution = section(
    "Selected suites and execution",
    "Per-node detail is retained only where the runtime projection exposes it; unavailable fields remain unmeasured.",
  );
  execution.append(
    (data.run.value.nodes ?? []).length
      ? table(
          ["Suite", "State", "Wave", "Attempt", "Disposition", "Resources", "Root failure"],
          data.run.value.nodes.map((test) => [
            test.suiteId,
            test.state,
            test.wave ?? "UNMEASURED",
            test.attempt,
            test.evidenceDisposition ?? "UNMEASURED",
            (test.resources ?? []).join(", ") || "UNMEASURED",
            test.rootFailureId ?? "UNMEASURED",
          ]),
        )
      : empty("No selected-suite detail is retained for this run."),
  );
  node.append(execution);
  const train = section(
    "Mainline train",
    "Train cars and predicted integration trees are displayed only when the retained v1.4 plan carries them.",
  );
  train.append(
    (data.run.value.trainCars ?? []).length
      ? table(
          ["Car", "State", "Candidate", "Candidate tree", "Predicted integration tree"],
          data.run.value.trainCars.map((car) => [
            car.id,
            car.state ?? "UNMEASURED",
            car.candidateSha ?? "UNMEASURED",
            car.candidateTreeSha ?? "UNMEASURED",
            car.predictedIntegrationTreeSha ?? "UNMEASURED",
          ]),
        )
      : empty("No train-car detail is retained for this run."),
  );
  node.append(train);
  const history = section("Run history", "Only retained observations associated with this run.");
  history.append(eventList(data.history));
  node.append(history);
  return node;
}
async function renderGithub() {
  const [branches, pulls, actions] = await Promise.all([
    request("api/branches"),
    request("api/pull-requests"),
    request("api/actions"),
  ]);
  const node = document.createDocumentFragment();
  const branchSection = section(
    "Branches",
    "Observed branch health and project association; no branch action is offered.",
  );
  branchSection.append(
    filteredTable({
      records: branches,
      headers: ["Branch", "Association", "Health", "SHA"],
      row: (branch) => [
        linkButton(branch.name, `#/github/branches?name=${encodeURIComponent(branch.name)}`),
        branch.project?.name ?? branch.projectId ?? "UNCLASSIFIED",
        branch.health ?? branch.state ?? "UNMEASURED",
        short(branch.headSha ?? branch.sha),
      ],
      matches: (branch) =>
        searchText([
          branch.name,
          branch.project?.name,
          branch.projectId,
          branch.health,
          branch.state,
          branch.headSha,
          branch.sha,
        ]),
      placeholder: "Search branches",
      emptyMessage: "No branch observation is available.",
    }),
  );
  node.append(branchSection);
  const pullSection = section(
    "Pull requests",
    "Open and retained GitHub observations, displayed without merge controls.",
  );
  const pullControls = element("div", "filter-controls");
  const pullSearch = document.createElement("input");
  pullSearch.type = "search";
  pullSearch.placeholder = "Search PRs";
  pullSearch.setAttribute("aria-label", "Search PRs");
  const pullState = document.createElement("select");
  pullState.setAttribute("aria-label", "Pull request state");
  ["Open", "Historical", "All"].forEach((label) => {
    const option = document.createElement("option");
    option.value = label.toUpperCase();
    option.textContent = label;
    pullState.append(option);
  });
  pullState.value = "ALL";
  const pullResult = element("div", "filter-results");
  const renderPulls = () => {
    const query = pullSearch.value.trim().toLocaleLowerCase();
    const retained = pulls.filter((pull) => {
      const historical = pull.state !== "OPEN";
      const stateMatch = pullState.value === "ALL" || (pullState.value === "OPEN" ? !historical : historical);
      return (
        stateMatch &&
        (!query || searchText([pull.number, pull.title, pull.state, pull.headRef]).toLocaleLowerCase().includes(query))
      );
    });
    pullResult.replaceChildren(
      retained.length
        ? table(
            ["PR", "Title", "State", "Updated"],
            retained.map((pull) => [
              linkButton(`#${pull.number}`, `#/github/pull-requests/${pull.number}`),
              pull.title,
              pull.state ?? "OPEN",
              dateText(pull.updatedAt),
            ]),
          )
        : empty("No pull-request observation matches this view."),
    );
  };
  pullSearch.addEventListener("input", renderPulls);
  pullState.addEventListener("change", renderPulls);
  pullControls.append(pullSearch, pullState);
  pullSection.append(pullControls, pullResult);
  renderPulls();
  node.append(pullSection);
  const actionsSection = section("Actions", "GitHub workflow observations only.");
  actionsSection.append(
    actions.length
      ? table(
          ["Workflow", "State", "Updated"],
          actions.map((run) => [run.name ?? run.workflowName, run.conclusion ?? run.status, dateText(run.updatedAt)]),
        )
      : empty("No workflow observation is available."),
  );
  node.append(actionsSection);
  return node;
}
async function renderPullRequestProfile(number) {
  const data = await request(`api/pull-requests/${encodeURIComponent(number)}`);
  const node = document.createDocumentFragment();
  const profile = section(
    `Pull request #${data.pullRequest.number}`,
    "Read-only GitHub profile with explicit project, version, and phase association.",
  );
  profile.append(
    detail([
      ["Title", data.pullRequest.title],
      ["State", data.pullRequest.state],
      ["Draft", data.pullRequest.draft],
      ["Author", data.pullRequest.author],
      ["Created", dateText(data.pullRequest.createdAt)],
      ["Updated", dateText(data.pullRequest.updatedAt)],
      ["Closed", dateText(data.pullRequest.closedAt)],
      ["Merged", dateText(data.pullRequest.mergedAt)],
      ["Checks", data.pullRequest.checkState],
      ["Mergeability", data.pullRequest.mergeableState],
      ["Base branch", data.pullRequest.baseRef],
      ["Base SHA", data.pullRequest.baseSha],
      ["Head branch", data.pullRequest.headRef],
      ["Head SHA", data.pullRequest.headSha],
      ["Merge SHA", data.pullRequest.mergeSha],
      ["Commit count", data.pullRequest.commitCount],
      ["Changed files", data.pullRequest.changedFiles],
      ["Additions", data.pullRequest.additions],
      ["Deletions", data.pullRequest.deletions],
      ["Projects", (data.associations?.projectIds ?? []).join(", ") || "UNCLASSIFIED"],
      ["Versions", (data.associations?.versionIds ?? []).join(", ") || "UNMEASURED"],
      ["Evidence", (data.evidence ?? []).join("; ")],
    ]),
  );
  profile.append(externalLink("Open on GitHub", data.pullRequest.url));
  node.append(profile);
  const history = section("Pull-request history", "Retained state and check observations only.");
  history.append(eventList(data.history));
  node.append(history);
  return node;
}
async function renderBranchProfile(query) {
  const name = new URLSearchParams(query).get("name");
  if (!name) return empty("A branch name is required for this profile.");
  const data = await request(`api/branches/profile?name=${encodeURIComponent(name)}`);
  const node = document.createDocumentFragment();
  const profile = section(
    data.branch.name,
    "Read-only branch profile with staleness, divergence, and association evidence.",
  );
  profile.append(
    detail([
      ["Head SHA", data.branch.headSha],
      ["Default SHA", data.branch.defaultSha],
      ["Ahead", data.branch.ahead],
      ["Behind", data.branch.behind],
      ["Last activity", dateText(data.branch.lastActivityAt)],
      ["Attention", data.branch.message],
      ["Pull request", data.pullRequest ? `#${data.pullRequest.number}` : "UNMEASURED"],
      ["Projects", (data.associations?.projectIds ?? []).join(", ") || "UNCLASSIFIED"],
      ["Evidence", (data.evidence ?? []).join("; ")],
    ]),
  );
  node.append(profile);
  const history = section("Branch history", "Only retained divergence and lifecycle observations.");
  history.append(eventList(data.history));
  node.append(history);
  return node;
}
async function renderAttention() {
  const data = snapshot ?? (await request("api/summary"));
  const node = document.createDocumentFragment();
  const attention = section(
    "Attention required",
    "Root conditions are deduplicated, attributed, and never silently cleared.",
  );
  attention.append(renderAttentionList(data.attention));
  node.append(attention);
  return node;
}
async function renderHistory() {
  const data = await request("api/history?limit=250");
  const node = document.createDocumentFragment();
  const history = section("Program history", "Detailed retained events can be compared across a bounded interval.");
  const actions = element("div", "actions");
  const from = document.createElement("input");
  from.type = "datetime-local";
  from.value = new Date(Date.now() - 86_400_000).toISOString().slice(0, 16);
  const to = document.createElement("input");
  to.type = "datetime-local";
  to.value = new Date().toISOString().slice(0, 16);
  const compare = element("button", "", "Compare interval");
  compare.addEventListener("click", () => {
    window.location.hash = `#/compare?from=${encodeURIComponent(new Date(from.value).toISOString())}&to=${encodeURIComponent(new Date(to.value).toISOString())}`;
  });
  actions.append(from, to, compare);
  history.append(
    actions,
    filteredTable({
      records: data.events ?? [],
      headers: ["When", "Type", "Entity", "Summary"],
      row: (event) => [
        dateText(event.occurredAt ?? event.observedAt),
        event.kind ?? "OBSERVED",
        `${event.entityType ?? "Observation"}: ${event.entityId ?? "UNMEASURED"}`,
        event.summary ?? "UNMEASURED",
      ],
      matches: (event) =>
        searchText([event.kind, event.entityType, event.entityId, event.projectId, event.phaseId, event.summary]),
      placeholder: "Search retained history",
      emptyMessage: "No retained observations match this scope.",
    }),
  );
  node.append(history);
  return node;
}
async function renderComparison(parameters) {
  const query = new URLSearchParams(parameters);
  const data = await request(`api/compare?${query}`);
  const node = document.createDocumentFragment();
  const changed = data.changed ?? {};
  const coarse = data.coarse ?? {};
  const comparison = section(
    "Historical comparison",
    "Exact detail is distinguished from coarse retained history; no precision is invented.",
  );
  comparison.append(
    detail([
      ["Fidelity", data.fidelity],
      ["From", data.from],
      ["To", data.to],
      [
        "Changed projects",
        coarse.changedProjectIds?.length ??
          (changed.projectsDiscovered?.length ?? 0) + (changed.projectsCompleted?.length ?? 0),
      ],
      [
        "Changed phases",
        coarse.acceptedPhaseChanges ??
          (changed.phasesStarted?.length ?? 0) +
            (changed.phasesAccepted?.length ?? 0) +
            (changed.phasesMerged?.length ?? 0),
      ],
      [
        "Changed versions",
        (changed.versionsDiscovered?.length ?? 0) +
          (changed.versionsStarted?.length ?? 0) +
          (changed.versionsAccepted?.length ?? 0),
      ],
    ]),
  );
  comparison.append(eventList(data.events));
  node.append(comparison);
  return node;
}
async function renderSources() {
  const sources = await refreshSources();
  const node = document.createDocumentFragment();
  const sourceSection = section(
    "Source health",
    "Freshness, authorization state, cache age, retry timing, and degradation are explicit.",
  );
  const rows = sources.map((source) => [
    linkButton(source.name, `#/sources/${encodeURIComponent(source.name)}`),
    source.state,
    source.configured ? "CONFIGURED" : "NOT CONFIGURED",
    source.reachable === null ? "UNMEASURED" : String(source.reachable),
    dateText(source.lastSuccessAt),
    source.detail ?? "",
  ]);
  sourceSection.append(table(["Source", "State", "Setup", "Reachable", "Last success", "Detail"], rows));
  node.append(sourceSection);
  return node;
}
async function renderSourceProfile(name) {
  const data = await request(`api/sources/${encodeURIComponent(name)}`);
  const node = document.createDocumentFragment();
  const profile = section(
    `${data.source.name} source profile`,
    "Source configuration, freshness, reachable state, cached evidence, and retry timing are explicit.",
  );
  profile.append(
    detail([
      ["State", data.source.state],
      ["Configured", data.source.configured],
      ["Authentication", data.source.authenticationState],
      ["Reachable", data.source.reachable],
      ["Last attempt", dateText(data.source.lastAttemptAt)],
      ["Last success", dateText(data.source.lastSuccessAt)],
      ["Next retry", dateText(data.source.nextRetryAt)],
      ["Cache age (ms)", data.source.cacheAgeMs],
      ["Rate-limit remaining", data.source.rateLimitRemaining],
      ["Detail", data.source.detail],
    ]),
  );
  node.append(profile);
  const history = section("Source events", "Only retained availability observations are shown.");
  history.append(eventList(data.recentEvents));
  node.append(history);
  return node;
}
const parseRoute = () => {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return { parts: path.split("/").filter(Boolean).map(decodeURIComponent), query };
};
async function renderRoute() {
  routeHost.replaceChildren(element("p", "quiet", "Loading bounded observation..."));
  const { parts, query } = parseRoute();
  const station = parts[0] ?? "overview";
  document
    .querySelectorAll("[data-station]")
    .forEach((link) => link.toggleAttribute("aria-current", link.dataset.station === station));
  try {
    let content;
    if (station === "overview") content = renderOverview();
    else if (station === "program") content = await renderProgram();
    else if (station === "projects" && parts[2] === "versions")
      content = await renderVersionProfile(parts[1], parts[3]);
    else if (station === "projects" && parts[2] === "phases") content = await renderPhaseProfile(parts[1], parts[3]);
    else if (station === "projects" && parts[1]) content = await renderProjectProfile(parts[1]);
    else if (station === "projects") content = await renderProjects();
    else if (station === "operations" && parts[1] === "runs" && parts[2])
      content = await renderSoundingLineProfile(parts[2]);
    else if (station === "operations") content = await renderOperations();
    else if (station === "github" && parts[1] === "pull-requests" && parts[2])
      content = await renderPullRequestProfile(parts[2]);
    else if (station === "github" && parts[1] === "branches") content = await renderBranchProfile(query);
    else if (station === "github") content = await renderGithub();
    else if (station === "attention") content = await renderAttention();
    else if (station === "history") content = await renderHistory();
    else if (station === "compare") content = await renderComparison(query);
    else if (station === "sources" && parts[1]) content = await renderSourceProfile(parts[1]);
    else if (station === "sources") content = await renderSources();
    else content = empty("Unknown station. Choose a Mission Control station above.");
    routeHost.replaceChildren(content);
  } catch (error) {
    routeHost.replaceChildren(
      element(
        "p",
        "empty error",
        `${error instanceof Error ? error.message : "Observation unavailable"}. No state change was attempted.`,
      ),
    );
  }
}
const refreshBoard = async () => {
  try {
    snapshot = await request("api/summary");
    document.querySelector("#meta").textContent =
      `${snapshot.mode ?? "PRIVATE"} / GitHub ${snapshot.source?.state ?? "UNMEASURED"} / ${dateText(snapshot.source?.observedAt)}`;
  } catch {
    document.querySelector("#meta").textContent = "Dashboard unavailable; no observation claim is made.";
  }
};
window.addEventListener("hashchange", renderRoute);
void refreshBoard().then(renderRoute);
setInterval(() => {
  void refreshBoard();
}, 15_000);
