const text = (value) => (value === null || value === undefined || value === "" ? "UNMEASURED" : String(value));
const short = (value) => (value ? String(value).slice(0, 12) : "UNMEASURED");
let routeHost;
const dateText = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value))
    : "UNMEASURED";
const sourceDateText = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value))
    : "NOT_RECORDED";
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
  if (note) card.append(element("p", "quiet metric-note", note));
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
  wrap.tabIndex = 0;
  wrap.setAttribute("role", "region");
  wrap.setAttribute("aria-label", `Scrollable table: ${headers.join(", ")}`);
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
  const overview = section(
    "Fleet overview",
    "A dense command view of the current portfolio. Lifecycle, verification, and source availability remain separate facts.",
  );
  const metrics = element("div", "grid dense");
  [
    [
      "Projects",
      program.projects?.total,
      `${program.projects?.active ?? 0} active / ${program.projects?.complete ?? 0} complete`,
    ],
    [
      "Accepted phases",
      program.phases?.completeOrMerged,
      `${program.phases?.active ?? 0} active / ${program.phases?.blocked ?? 0} blocked`,
    ],
    [
      "Current main",
      short(summary.github?.headSha ?? summary.currentMain),
      summary.github?.defaultBranch ?? "LOCAL_GIT_OBSERVATION",
    ],
    ["Active workers", program.operational?.activeWorkers, "Activity telemetry only; zero is not missing history."],
    ["Open pull requests", program.operational?.openPullRequests, "Repository observation is bounded."],
    ["Attention", summary.attention?.length, "Each condition links to retained source evidence."],
  ].forEach(([label, value, note]) => metrics.append(renderMetric(label, value, note)));
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
  items.forEach((item) => {
    const body = document.createDocumentFragment();
    body.append(element("p", "quiet", text(item.message ?? item.detail ?? item.summary)));
    if (item.source) {
      body.append(
        element(
          "p",
          "source-ref",
          `Source: ${item.source.id} / ${item.source.reference} / ${sourceDateText(item.source.observedAt)}`,
        ),
      );
    }
    if (item.projectId)
      body.append(linkButton(`Open ${item.projectId} project profile`, `#/projects/${item.projectId}`));
    host.append(
      listRow(
        item.title ?? item.code ?? item.kind ?? "Attention",
        item.level ?? item.severity ?? item.state ?? "OBSERVED",
        body,
      ),
    );
  });
  return host;
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
  const [project, versions, program, fabric] = await Promise.all([
    request(`api/projects/${encodeURIComponent(id)}`),
    request(`api/projects/${encodeURIComponent(id)}/versions`),
    request("api/program"),
    request("api/facts"),
  ]);
  const node = document.createDocumentFragment();
  const profile = section(
    `${project.name} project profile`,
    "Mission-grade profile: lifecycle, candidate/main relationships, validation, operations, and source limits are independently attributed.",
  );
  const completed = (project.phases ?? []).filter((phase) => ["COMPLETE", "MERGED"].includes(phase.state)).length;
  const declared = project.declaredPhaseCount ?? null;
  const currentMain = program.currentMain ?? null;
  const catalog = (fabric.facts ?? []).find((fact) => fact.factClass === "features.catalog");
  const capability = (fabric.facts ?? []).find((fact) => fact.factClass === "deepwater.capability-evidence");
  profile.append(
    detail([
      ["State", project.state],
      ["Discovery confidence", project.discoveryConfidence],
      ["Governing confidence", project.confidence],
      [
        "Phase record",
        declared === null ? `${completed} completed / total NOT_RECORDED` : `${completed}/${declared} completed`,
      ],
      ["Current repository main", currentMain],
      ["Final main", project.finalMainSha],
      ["Final decision", project.finalDecision],
      [
        "Current-main relationship",
        project.finalMainSha && currentMain
          ? project.finalMainSha === currentMain
            ? "FINAL_MAIN_MATCHES_CURRENT_OBSERVATION"
            : "FINAL_MAIN_DIFFERS_FROM_CURRENT_OBSERVATION (ancestry and update need NOT_INFERRED)"
          : "NOT_RECORDED",
      ],
      ["Governing references", `${project.governingReferences?.length ?? 0} retained; inspect provenance below`],
    ]),
  );
  node.append(profile);
  const phases = section(
    "Mainline, candidates, and phases",
    "Branch, pull-request, accepted-candidate, and integrated-main identities are shown together only where retained evidence binds them.",
  );
  phases.append(
    filteredTable({
      records: project.phases ?? [],
      headers: ["Phase", "State", "Branch", "PR", "Candidate", "Integrated main", "Decision"],
      row: (phase) => [
        linkButton(`Phase ${phase.ordinal}`, `#/projects/${encodeURIComponent(id)}/phases/${phase.ordinal}`),
        phase.state,
        phase.branch
          ? linkButton(phase.branch, `#/github/branches?name=${encodeURIComponent(phase.branch)}`)
          : "NOT_RECORDED",
        phase.pullRequest
          ? linkButton(`#${phase.pullRequest}`, `#/github/pull-requests/${phase.pullRequest}`)
          : "NOT_RECORDED",
        short(phase.acceptedHeadSha) === "UNMEASURED" ? "NOT_RECORDED" : short(phase.acceptedHeadSha),
        short(phase.integratedMainSha) === "UNMEASURED" ? "NOT_RECORDED" : short(phase.integratedMainSha),
        phase.finalDecision ?? "NOT_RECORDED",
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
  const repository = section(
    "Repository activity and current-main delta",
    "Only project-associated GitHub observations are included. Association uncertainty stays unclassified rather than being assigned by name similarity alone.",
  );
  repository.append(
    (project.branches ?? []).length
      ? table(
          ["Branch", "Ahead", "Behind", "Health", "Last activity", "Current-main note"],
          project.branches.map((branch) => [
            linkButton(branch.name, `#/github/branches?name=${encodeURIComponent(branch.name)}`),
            branch.ahead ?? "NOT_RECORDED",
            branch.behind ?? "NOT_RECORDED",
            branch.reason ?? branch.health ?? "OBSERVED",
            dateText(branch.lastActivityAt),
            branch.message ?? "No observed delta condition.",
          ]),
        )
      : empty(
          "No project-associated branch observation is retained. Unclassified repository branches remain visible in Repository.",
        ),
  );
  repository.append(
    (project.pullRequests ?? []).length
      ? table(
          ["PR", "State", "Checks", "Mergeability", "Updated", "Head / base"],
          project.pullRequests.map((pull) => [
            linkButton(`#${pull.number}`, `#/github/pull-requests/${pull.number}`),
            pull.state ?? "NOT_RECORDED",
            pull.checkState ?? "NOT_RECORDED",
            pull.mergeableState ?? "NOT_RECORDED",
            dateText(pull.updatedAt),
            `${short(pull.headSha)} / ${short(pull.baseSha)}`,
          ]),
        )
      : empty("No project-associated pull-request observation is retained."),
  );
  node.append(repository);
  const verification = section(
    "Verification and Sounding Line evidence",
    "Runs are included only when their retained source SHA matches an accepted or integrated phase identity. Absence is not a pass.",
  );
  verification.append(
    (project.tests ?? []).length
      ? table(
          ["Run", "Decision", "Suites", "Tests", "Passed", "Failed", "Blocked", "Observed"],
          project.tests.map((run) => {
            const summary = nodeSummary(run.value?.nodes);
            return [
              linkButton(run.id, `#/operations/runs/${encodeURIComponent(run.id)}`),
              run.value?.finalDecision ?? run.value?.decision ?? "NOT_RECORDED",
              summary.suites,
              summary.total,
              summary.passed,
              summary.failed,
              summary.blocked,
              dateText(run.observedAt),
            ];
          }),
        )
      : empty("No retained Sounding Line run is bound to this project's accepted or integrated phase source SHA."),
  );
  node.append(verification);
  const operations = section(
    "Workers, current attention, and dependencies",
    "Worker records are activity-only. No dependency relationship is inferred when the P2 sources do not publish one.",
  );
  operations.append(
    detail([
      ["Current / retained worker records", project.workers?.length ?? 0],
      ["Project attention conditions", (snapshot?.attention ?? []).filter((item) => item.projectId === id).length],
      ["Dependency mapping", "NOT_RECORDED by the bounded observation sources"],
      ["Capability realization mapping", "NOT_RECORDED unless a source-bound realization record is supplied"],
    ]),
  );
  operations.append(
    (project.workers ?? []).length
      ? table(
          ["Worker", "State", "Task", "Branch", "Source SHA", "Heartbeat"],
          project.workers.map((worker) => [
            worker.workerId,
            worker.effectiveState ?? worker.state,
            worker.task,
            worker.branch ?? "NOT_RECORDED",
            short(worker.sourceSha),
            dateText(worker.heartbeatAt),
          ]),
        )
      : empty("No active or retained worker telemetry is associated with this project."),
  );
  operations.append(renderAttentionList((snapshot?.attention ?? []).filter((item) => item.projectId === id)));
  node.append(operations);
  const provenance = section(
    "Product intelligence, provenance, and coverage",
    "The Bridgewatch Feature Catalog and Deepwater capability evidence are global bounded sources, not inferred project-level claims.",
  );
  provenance.append(
    detail([
      [
        "Bridgewatch Feature Catalog",
        catalog
          ? `${catalog.state} / ${catalog.value.bridgewatchFeatureCount ?? "NOT_RECORDED"} recorded entries`
          : "UNKNOWN",
      ],
      [
        "Capability evidence",
        capability
          ? `${capability.state} / ${capability.limitation ?? "no further realization detail recorded"}`
          : "UNKNOWN",
      ],
      ["Project evidence", `${project.evidence?.length ?? 0} retained references`],
      ["Missing / historical gaps", `${project.missingEvidence?.length ?? 0} recorded`],
      ["Source paths", `${project.sourcePaths?.length ?? 0} retained references`],
      ["Project limitations", `${project.limitations?.length ?? 0} recorded`],
    ]),
  );
  const provenanceRecords = [
    ...new Set([...(project.governingReferences ?? []), ...(project.sourcePaths ?? []), ...(project.evidence ?? [])]),
  ].map((reference) => ({
    reference,
    role: project.governingReferences?.includes(reference)
      ? "GOVERNING_OR_DISCOVERY"
      : project.sourcePaths?.includes(reference)
        ? "SOURCE_PATH"
        : "RETAINED_EVIDENCE",
  }));
  provenance.append(
    filteredTable({
      records: provenanceRecords,
      headers: ["Reference", "Role"],
      row: (entry) => [entry.reference, entry.role],
      matches: (entry) => `${entry.reference} ${entry.role}`,
      placeholder: "Search project provenance",
      emptyMessage: "No project provenance reference is retained.",
    }),
  );
  node.append(provenance);
  const history = section("Project history", "Only durable source-bound historical events are shown.");
  history.append(eventList(project.history ?? []));
  node.append(history);
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
async function renderMainline() {
  const data = snapshot ?? (await request("api/summary"));
  const node = document.createDocumentFragment();
  const mainline = section(
    "Mainline / Sounding Line",
    "Candidate, decision, and predicted-integration observations remain source-owned. This station cannot merge, rerun, cancel, or advance a lane.",
  );
  mainline.append(
    detail([
      ["Current observed main", data.github?.headSha ?? data.currentMain ?? "NOT_RECORDED"],
      ["Default branch", data.github?.defaultBranch ?? "NOT_RECORDED"],
      ["Source freshness", data.source?.state ?? "NOT_RECORDED"],
      ["Current Sounding Line plans", data.tests?.projection?.plans?.length ?? "NOT_RECORDED"],
      ["Active test nodes", data.tests?.totals?.running ?? "NOT_RECORDED"],
      ["Root failures", data.tests?.totals?.rootFailures ?? "NOT_RECORDED"],
    ]),
  );
  node.append(mainline);
  const plans = section(
    "Candidate and decision ledger",
    "Plan identity, source SHA, final decision, and cleanup are displayed together only when the runtime projection retains them.",
  );
  const planRows = data.tests?.projection?.plans ?? [];
  plans.append(
    planRows.length
      ? table(
          ["Run", "State", "Candidate SHA", "Decision", "Cleanup", "Created", "Nodes"],
          planRows.map((plan) => [
            linkButton(plan.id, `#/operations/runs/${encodeURIComponent(plan.id)}`),
            plan.state ?? "NOT_RECORDED",
            short(plan.sourceSha) === "UNMEASURED" ? "NOT_RECORDED" : short(plan.sourceSha),
            plan.finalDecision ?? "PENDING_OR_NOT_RECORDED",
            plan.cleanupState ?? "NOT_RECORDED",
            dateText(plan.createdAt),
            plan.nodes?.length ?? "NOT_RECORDED",
          ]),
        )
      : empty("No current Sounding Line plan is retained by the configured projection."),
  );
  node.append(plans);
  const intelligence = section(
    "Mainline attention",
    "Only attention with Sounding Line, GitHub, or runtime provenance is included here; source metadata explains the observation.",
  );
  intelligence.append(
    renderAttentionList(
      (data.attention ?? []).filter((item) =>
        ["sounding-line-runtime-projection", "github-repository-api", "voyagewright-runtime"].includes(item.source?.id),
      ),
    ),
  );
  node.append(intelligence);
  return node;
}
async function renderVerification() {
  const [data, runs] = await Promise.all([snapshot ?? request("api/summary"), request("api/sounding-line/runs")]);
  const node = document.createDocumentFragment();
  const summary = section(
    "Verification",
    "Sounding Line is observed as the decision authority. Test totals, node outcomes, retries, and failure roots never authorize Bridgewatch to act.",
  );
  const metrics = element("div", "grid dense");
  Object.entries(data.tests?.totals ?? {}).forEach(([label, value]) => metrics.append(renderMetric(label, value)));
  summary.append(metrics);
  node.append(summary);
  const executions = section(
    "Retained verification runs",
    "Deep-link into a run for source SHA, authority boundary, selected suite, node, train, and evidence detail.",
  );
  executions.append(
    runs.length
      ? table(
          ["Run", "Gate", "State", "Decision", "Cleanup", "Source SHA", "Observed"],
          runs.map((run) => [
            linkButton(run.id, `#/operations/runs/${encodeURIComponent(run.id)}`),
            run.value?.gate ?? "NOT_RECORDED",
            run.value?.state ?? "NOT_RECORDED",
            run.value?.finalDecision ?? "NOT_RECORDED",
            run.value?.cleanupState ?? "NOT_RECORDED",
            short(run.value?.sourceSha) === "UNMEASURED" ? "NOT_RECORDED" : short(run.value?.sourceSha),
            dateText(run.observedAt),
          ]),
        )
      : empty("No retained verification run is available. This is not evidence of a passing or failing decision."),
  );
  node.append(executions);
  const regressions = section(
    "Verification regressions and evidence gaps",
    "Only source-bound blocked, failed, or missing-evidence conditions are shown.",
  );
  regressions.append(
    renderAttentionList(
      (data.attention ?? []).filter((item) =>
        /VERIFICATION|EXPECTED_FACT_GAP|CANDIDATE_STALLED/u.test(item.code ?? ""),
      ),
    ),
  );
  node.append(regressions);
  return node;
}
async function renderProductIntelligence() {
  const [program, fabric] = await Promise.all([request("api/program"), request("api/facts")]);
  const node = document.createDocumentFragment();
  const facts = fabric.facts ?? [];
  const relevant = facts.filter((fact) =>
    ["features.catalog", "deepwater.capability-evidence", "governance.records", "projects.registry"].includes(
      fact.factClass,
    ),
  );
  const intelligence = section(
    "Product intelligence",
    "Program realization is limited to source-bound catalog, governance, registry, and capability evidence. A backend capability is never presumed product-realized.",
  );
  intelligence.append(
    detail([
      ["Current observed main", program.currentMain ?? "NOT_RECORDED"],
      ["Discovered projects", program.discoveredProjects?.length ?? "NOT_RECORDED"],
      ["Accepted timeline records", program.acceptedHistory?.length ?? "NOT_RECORDED"],
      [
        "Realization rule",
        "NOT_RECORDED unless an authoritative source explicitly links capability evidence to a product surface",
      ],
    ]),
  );
  node.append(intelligence);
  const evidence = section(
    "Catalog, governance, and capability evidence",
    "Each record carries fact state, authority, observation time, and an explicit limitation rather than a derived product-completion claim.",
  );
  evidence.append(
    relevant.length
      ? table(
          ["Evidence class", "State", "Authority", "Observed", "Value", "Limitation"],
          relevant.map((fact) => [
            linkButton(fact.label, `#/data/facts/${encodeURIComponent(fact.key)}`),
            tag(fact.state),
            fact.provenance?.authority ?? "NOT_RECORDED",
            sourceDateText(fact.provenance?.sourceObservedAt),
            Object.entries(fact.value ?? {})
              .map(([key, value]) => `${key}=${text(value)}`)
              .join(" / ") || "NOT_RECORDED",
            fact.limitation ?? "NONE",
          ]),
        )
      : empty("No product-intelligence fact has been retained. That is a coverage gap, not a product conclusion."),
  );
  node.append(evidence);
  return node;
}
async function renderRuntime() {
  const [fabric, sources] = await Promise.all([request("api/facts"), request("api/sources")]);
  const node = document.createDocumentFragment();
  const facts = (fabric.facts ?? []).filter((fact) =>
    ["voyagewright.runtime-identity", "voyagewright.schema-migrations", "operations.provider-jobs"].includes(
      fact.factClass,
    ),
  );
  const runtime = section(
    "Voyagewright Runtime",
    "Host-owned allowlisted identity, schema inventory, and provider/job status. Bridgewatch does not inspect product data, command lines, credentials, prompts, logs, or controls.",
  );
  runtime.append(
    facts.length
      ? table(
          ["Observation", "State", "Source", "Observed", "Allowlisted value", "Limitation"],
          facts.map((fact) => [
            linkButton(fact.label, `#/data/facts/${encodeURIComponent(fact.key)}`),
            tag(fact.state),
            fact.provenance?.sourceId ?? "NOT_RECORDED",
            sourceDateText(fact.provenance?.sourceObservedAt),
            Object.entries(fact.value ?? {})
              .map(([key, value]) => `${key}=${text(value)}`)
              .join(" / ") || "NOT_RECORDED",
            fact.limitation ?? "NONE",
          ]),
        )
      : empty("No runtime observation has been retained. Runtime state remains UNKNOWN rather than assumed healthy."),
  );
  node.append(runtime);
  const sourceHealth = section(
    "Runtime source health",
    "Runtime and provider adapters are distinct from repository and deployment state, so unavailable configuration remains visible.",
  );
  const runtimeSources = sources.filter((source) =>
    /voyagewright-runtime|schema-migrations|provider-jobs/u.test(source.name),
  );
  sourceHealth.append(
    runtimeSources.length
      ? table(
          ["Source", "Health", "Configured", "Last success", "Coverage", "Diagnostic"],
          runtimeSources.map((source) => [
            linkButton(source.name, `#/sources/${encodeURIComponent(source.name)}`),
            tag(source.state),
            source.configured ? "CONFIGURED" : "NOT_CONFIGURED",
            sourceDateText(source.lastSuccessAt),
            source.coverage?.state ?? "NOT_RECORDED",
            source.failure?.diagnostic ?? source.detail ?? "NONE",
          ]),
        )
      : empty("No runtime source profile is retained."),
  );
  node.append(sourceHealth);
  return node;
}
async function renderGithub() {
  const [branches, pulls, actions] = await Promise.all([
    request("api/branches"),
    request("api/pull-requests"),
    request("api/actions"),
  ]);
  const node = document.createDocumentFragment();
  const repositoryOverview = section(
    "Repository",
    "Bounded read-only GitHub observations: branch health, pull-request state, workflow outcomes, and explicit association confidence. No repository action is offered.",
  );
  repositoryOverview.append(
    detail([
      ["Observed branches", branches.length],
      ["Observed pull requests", pulls.length],
      ["Observed workflows", actions.length],
      ["Association policy", "Project binding is required; uncertain repository activity remains UNCLASSIFIED."],
    ]),
  );
  node.append(repositoryOverview);
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
  const initialSince = new Date(Date.now() - 86_400_000).toISOString();
  const data = await request(`api/history?${new URLSearchParams({ since: initialSince })}`);
  const node = document.createDocumentFragment();
  const history = section("Program history", "Detailed retained events can be compared across a bounded interval.");
  const actions = element("div", "actions");
  const from = document.createElement("input");
  from.type = "datetime-local";
  from.value = initialSince.slice(0, 16);
  from.setAttribute("aria-label", "History comparison from");
  const to = document.createElement("input");
  to.type = "datetime-local";
  to.value = new Date().toISOString().slice(0, 16);
  to.setAttribute("aria-label", "History comparison to");
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
async function renderDataFabric() {
  const data = await request("api/facts");
  const node = document.createDocumentFragment();
  const coverage = section(
    "Data fabric & observation coverage",
    "Expected fact classes are counted explicitly. An unavailable source is not treated as proof that a fact does not exist.",
  );
  if (data.warning) coverage.append(element("p", "empty error", data.warning));
  coverage.append(
    table(
      ["System", "Expected", "Authoritative", "Provisional", "Stale", "Unavailable", "Not recorded", "Unknown"],
      (data.coverage ?? []).map((entry) => [
        entry.system,
        entry.expected,
        entry.authoritative,
        entry.provisional,
        entry.stale,
        entry.sourceUnavailable,
        entry.notHistoricallyRecorded,
        entry.unknown,
      ]),
    ),
  );
  node.append(coverage);

  const sources = section(
    "P2 adapter health",
    "Each fixed adapter retains its own last-known-good observation. No adapter can act on a repository, job, or runtime.",
  );
  sources.append(
    table(
      ["Adapter", "State", "Authority", "Configured", "Reachable", "Last success", "Retained stale data", "Diagnostic"],
      (data.sources ?? []).map((source) => [
        source.name,
        tag(source.state),
        source.authority,
        source.configured ? "CONFIGURED" : "NOT CONFIGURED",
        source.reachable === null ? "NOT RECORDED" : String(source.reachable),
        sourceDateText(source.lastSuccessAt),
        source.servingRetainedStaleData ? "YES" : "NO",
        source.failure ?? "NONE",
      ]),
    ),
  );
  node.append(sources);

  const facts = section(
    "Observed facts",
    "Provenance, source precedence, and freshness accompany every fact. Higher-precedence current authority wins; retained history never overrides it.",
  );
  facts.append(
    filteredTable({
      records: data.facts ?? [],
      headers: ["Fact class", "State", "Source", "Authority", "Precedence", "Source observed", "Limitation"],
      row: (item) => [
        linkButton(item.label ?? item.factClass, `#/data/facts/${encodeURIComponent(item.key)}`),
        tag(item.state),
        item.provenance?.sourceId ?? "UNKNOWN",
        item.provenance?.authority ?? "UNKNOWN",
        item.provenance?.precedence ?? "UNKNOWN",
        sourceDateText(item.provenance?.sourceObservedAt),
        item.limitation ?? "NONE",
      ],
      matches: (item) =>
        searchText([
          item.label,
          item.factClass,
          item.state,
          item.provenance?.sourceId,
          item.provenance?.authority,
          item.provenance?.reference,
          item.limitation,
        ]),
      placeholder: "Search observed facts",
      emptyMessage: "No data-fabric facts have been retained yet. Source availability remains explicit above.",
    }),
  );
  node.append(facts);
  return node;
}
async function renderFactProfile(key) {
  const data = await request(`api/facts/${encodeURIComponent(key)}`);
  const node = document.createDocumentFragment();
  const fact = data.fact;
  const profile = section(
    fact.label ?? fact.factClass,
    "A read-only fact profile. It separates current source authority from retained stale observation and never offers a repair or control action.",
  );
  profile.append(
    detail([
      ["Fact class", fact.factClass],
      ["State", fact.state],
      ["Source", fact.provenance?.sourceId],
      ["Source identity", fact.provenance?.sourceIdentity],
      ["Authority", fact.provenance?.authority],
      ["Precedence", fact.provenance?.precedence],
      ["Evidence reference", fact.provenance?.reference],
      ["Source observed", sourceDateText(fact.provenance?.sourceObservedAt)],
      ["Bridgewatch observed", sourceDateText(fact.provenance?.bridgewatchObservedAt)],
      ["Retained from cache", fact.provenance?.retainedFromCache ? "YES" : "NO"],
      ["Value", JSON.stringify(fact.value ?? {})],
      ["Limitation", fact.limitation ?? "NONE"],
    ]),
  );
  node.append(profile);
  const history = section(
    "Retained fact history",
    "Changes are retained as durable observation history; unsupported older facts are never invented.",
  );
  history.append(
    data.history?.length
      ? table(
          ["State", "Source observed", "Bridgewatch observed", "Retained from cache", "Limitation"],
          data.history.map((entry) => [
            tag(entry.state),
            sourceDateText(entry.provenance?.sourceObservedAt),
            sourceDateText(entry.provenance?.bridgewatchObservedAt),
            entry.provenance?.retainedFromCache ? "YES" : "NO",
            entry.limitation ?? "NONE",
          ]),
        )
      : empty("No historical change has been retained for this fact."),
  );
  node.append(history);
  return node;
}
async function renderSources() {
  const [sources, fabric] = await Promise.all([refreshSources(), request("api/facts")]);
  const node = document.createDocumentFragment();
  const coverage = section(
    "Data & Coverage",
    "Every fixed expected fact class is counted. Unavailable, stale, provisional, and historically unrecorded evidence stay visible instead of becoming a synthetic health score.",
  );
  coverage.append(
    table(
      ["System", "Expected", "Authoritative", "Provisional", "Stale", "Unavailable", "Not recorded", "Unknown"],
      (fabric.coverage ?? []).map((entry) => [
        entry.system,
        entry.expected,
        entry.authoritative,
        entry.provisional,
        entry.stale,
        entry.sourceUnavailable,
        entry.notHistoricallyRecorded,
        entry.unknown,
      ]),
    ),
  );
  node.append(coverage);
  const sourceSection = section(
    "Sources & Data Quality",
    "Acquisition health and observation coverage are separate: a reachable source can still have bounded or unavailable evidence.",
  );
  const rows = sources.map((source) => [
    linkButton(source.name, `#/sources/${encodeURIComponent(source.name)}`),
    tag(source.state),
    tag(source.coverage?.state ?? "NOT_RECORDED"),
    source.configured ? "CONFIGURED" : "NOT CONFIGURED",
    source.reachable === null ? "NOT_RECORDED" : String(source.reachable),
    sourceDateText(source.lastSuccessAt),
    source.records?.retained ?? "NOT_RECORDED",
    source.records?.displayed ?? "NOT_RECORDED",
    source.failure?.classification ?? source.detail ?? source.coverage?.limitation ?? "NONE",
  ]);
  sourceSection.append(
    table(
      ["Source", "Health", "Coverage", "Setup", "Reachable", "Last success", "Retained", "Displayed", "Diagnostic"],
      rows,
    ),
  );
  node.append(sourceSection);
  const factGaps = section(
    "Expected-fact gaps",
    "A gap names the exact fact class and source limitation; it is not an assertion that the underlying project, runtime, or provider is absent.",
  );
  const gaps = (fabric.facts ?? []).filter((fact) =>
    ["SOURCE_UNAVAILABLE", "STALE", "UNKNOWN", "NOT_HISTORICALLY_RECORDED"].includes(fact.state),
  );
  factGaps.append(
    gaps.length
      ? table(
          ["Fact class", "State", "Source", "Observed", "Limitation"],
          gaps.map((fact) => [
            linkButton(fact.label, `#/data/facts/${encodeURIComponent(fact.key)}`),
            tag(fact.state),
            fact.provenance?.sourceId ?? "NOT_RECORDED",
            sourceDateText(fact.provenance?.sourceObservedAt),
            fact.limitation ?? "NONE",
          ]),
        )
      : empty("No retained fact gap is currently reported by the bounded data fabric."),
  );
  node.append(factGaps);
  return node;
}
async function renderSourceProfile(name) {
  const data = await request(`api/sources/${encodeURIComponent(name)}`);
  const node = document.createDocumentFragment();
  const profile = section(
    `${data.source.name} data-quality profile`,
    "This source record distinguishes source absence, connector loss, retained stale data, and unsupported history.",
  );
  profile.append(
    detail([
      ["Source ID", data.source.sourceId],
      ["Expected", data.source.expected],
      ["State", data.source.state],
      ["Coverage", data.source.coverage?.state],
      ["Coverage summary", data.source.coverage?.summary],
      ["Coverage limitation", data.source.coverage?.limitation],
      ["Configured", data.source.configured],
      ["Configuration source", data.source.configurationSource],
      ["Authority level", data.source.authorityLevel],
      ["Authentication", data.source.authenticationState],
      ["Reachable", data.source.reachable],
      ["Last attempt", sourceDateText(data.source.lastAttemptAt)],
      ["Last success", sourceDateText(data.source.lastSuccessAt)],
      ["Last source occurrence", sourceDateText(data.source.sourceOccurrenceAt)],
      ["Bridgewatch observed", sourceDateText(data.source.bridgewatchObservedAt)],
      ["Next retry", sourceDateText(data.source.nextRetryAt)],
      ["Cache age (ms)", data.source.cacheAgeMs],
      ["Serving retained stale data", data.source.servingRetainedStaleData],
      ["Rate-limit remaining", data.source.rateLimitRemaining],
      ["Schema / contract", data.source.schemaVersion],
      ["Records received", data.source.records?.received],
      ["Records retained", data.source.records?.retained],
      ["Records exposed", data.source.records?.exposed],
      ["Records displayed", data.source.records?.displayed],
      ["Supported capabilities", data.source.capabilityClasses?.supported?.join(", ") || "NONE"],
      ["Missing capabilities", data.source.capabilityClasses?.missing?.join(", ") || "NONE"],
      ["Failure classification", data.source.failure?.classification ?? "NONE"],
      ["Sanitized diagnostic", data.source.failure?.diagnostic ?? data.source.detail ?? "NONE"],
      ["Repairability", data.source.repairability],
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
  const station = parts[0] ?? "fleet";
  document
    .querySelectorAll("[data-station]")
    .forEach((link) => link.toggleAttribute("aria-current", link.dataset.station === station));
  try {
    let content;
    if (station === "fleet" || station === "overview") content = renderOverview();
    else if (station === "intelligence" || station === "program") content = await renderProductIntelligence();
    else if (station === "projects" && parts[2] === "versions")
      content = await renderVersionProfile(parts[1], parts[3]);
    else if (station === "projects" && parts[2] === "phases") content = await renderPhaseProfile(parts[1], parts[3]);
    else if (station === "projects" && parts[1]) content = await renderProjectProfile(parts[1]);
    else if (station === "projects") content = await renderProjects();
    else if (station === "operations" && parts[1] === "runs" && parts[2])
      content = await renderSoundingLineProfile(parts[2]);
    else if (station === "operations") content = await renderOperations();
    else if (station === "mainline") content = await renderMainline();
    else if (station === "verification") content = await renderVerification();
    else if (station === "github" && parts[1] === "pull-requests" && parts[2])
      content = await renderPullRequestProfile(parts[2]);
    else if (station === "github" && parts[1] === "branches") content = await renderBranchProfile(query);
    else if (station === "github" || station === "repository") content = await renderGithub();
    else if (station === "attention") content = await renderAttention();
    else if (station === "history") content = await renderHistory();
    else if (station === "compare") content = await renderComparison(query);
    else if (station === "runtime") content = await renderRuntime();
    else if (station === "sources" && parts[1]) content = await renderSourceProfile(parts[1]);
    else if (station === "sources") content = await renderSources();
    else if (station === "data" && parts[1] === "facts" && parts[2]) content = await renderFactProfile(parts[2]);
    else if (station === "data") content = await renderDataFabric();
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
