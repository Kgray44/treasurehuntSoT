const text = (value) => value ?? "UNMEASURED";
const short = (value) => (value ? String(value).slice(0, 12) : "UNMEASURED");
let board = null;
let selectedTab = "ACTIVE";
const bridgewatchBase = window.location.pathname.startsWith("/bridgewatch") ? "/bridgewatch/" : "/";

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
const lifecycle = (project) =>
  selectedTab === "ALL" ||
  (selectedTab === "COMPLETED"
    ? ["COMPLETE", "MERGED"].includes(project.state)
    : selectedTab === "PLANNED"
      ? project.state === "PLANNED"
      : !["COMPLETE", "MERGED", "PLANNED"].includes(project.state));

function renderProgram(program) {
  const host = document.querySelector("#program");
  host.replaceChildren();
  const values = [
    ["Projects", `${program.projects.total} total / ${program.projects.complete} complete`],
    ["Active", String(program.projects.active)],
    ["Phases", `${program.phases.completeOrMerged}/${program.phases.total} complete or merged`],
    ["Open PRs", String(program.operational.openPullRequests)],
    ["Workers", String(program.operational.activeWorkers)],
    ["Root failures", String(program.operational.rootFailures)],
  ];
  values.forEach(([label, value]) => {
    const card = element("article", "metric");
    card.append(element("span", "label", label), element("strong", "metric-value", value));
    host.append(card);
  });
}
function renderAttention(items) {
  const host = document.querySelector("#attention");
  host.replaceChildren();
  if (!items.length) {
    host.append(element("p", "quiet", "No current attention condition is observed."));
    return;
  }
  items.forEach((item) => {
    const row = element("article", `attention-item level-${item.level}`);
    row.append(element("strong", "state", `${item.level} / ${item.code}`), element("p", "", item.message));
    host.append(row);
  });
}
function showProject(project) {
  const host = document.querySelector("#project-detail");
  host.replaceChildren();
  const heading = element("h3", "", `${project.name} / biography`);
  host.append(heading);
  appendRow(host, "Lifecycle", project.state);
  appendRow(host, "Progress", project.milestonePercent === null ? "UNMEASURED" : `${project.milestonePercent}%`);
  appendRow(host, "Evidence", project.governingReferences.join(" / "));
  const timeline = element("ol", "timeline");
  project.phases
    .sort((a, b) => a.ordinal - b.ordinal)
    .forEach((phase) => {
      const item = element("li", "timeline-item");
      item.append(
        element("strong", "", `Phase ${phase.ordinal}: ${phase.name}`),
        element("p", "", `${phase.state} / ${phase.scope}`),
      );
      appendRow(item, "Branch", text(phase.branch));
      appendRow(item, "PR", phase.pullRequest ? `#${phase.pullRequest}` : "UNMEASURED");
      appendRow(item, "Accepted head", short(phase.acceptedHeadSha));
      appendRow(item, "Integrated main", short(phase.integratedMainSha));
      appendRow(item, "Decision", text(phase.finalDecision));
      appendRow(
        item,
        "Milestones",
        phase.milestones.length
          ? phase.milestones
              .map((milestone) => `${milestone.title}: ${milestone.state} (${milestone.weight})`)
              .join("; ")
          : "UNMEASURED",
      );
      timeline.append(item);
    });
  host.append(timeline);
}
function renderProjects() {
  const host = document.querySelector("#projects");
  host.replaceChildren();
  const projects = board.projects.filter(lifecycle);
  if (!projects.length) {
    host.append(element("p", "quiet", "No project is currently evidenced for this lifecycle view."));
    return;
  }
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
    button.addEventListener("click", () => showProject(project));
    card.append(button);
    host.append(card);
  });
}
function renderWorkers(workers) {
  const host = document.querySelector("#workers");
  host.replaceChildren();
  if (!workers.length) {
    host.append(element("p", "quiet", "No reporter activity is currently retained."));
    return;
  }
  workers.forEach((worker) => {
    const row = element("article", "list-item");
    row.append(element("strong", "", `${worker.effectiveState} / ${worker.workerId}`));
    appendRow(row, "Project", `${worker.project} / Phase ${worker.phase}`);
    appendRow(row, "Task", worker.task);
    appendRow(row, "Branch", worker.branch);
    appendRow(row, "Heartbeat", worker.heartbeatAt);
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
  const history = tests.history ?? [];
  if (history.length) {
    host.append(element("h4", "", "Recent observed runs"));
    history.forEach((entry) => {
      const row = element("article", "list-item");
      row.append(element("strong", "", `${entry.value.gate} / ${entry.id}`));
      appendRow(row, "Observed", entry.observedAt);
      appendRow(row, "Nodes", String(entry.value.nodes.length));
      host.append(row);
    });
  }
}
function renderPulls(snapshot) {
  const host = document.querySelector("#pulls");
  host.replaceChildren();
  const pulls = snapshot?.openPullRequests ?? [];
  if (!pulls.length) {
    host.append(element("p", "quiet", "No open pull requests are in the current GitHub snapshot."));
    return;
  }
  pulls.forEach((pull) => {
    const row = element("a", "list-item", `#${pull.number} / ${pull.title}`);
    row.href = pull.url;
    row.rel = "noreferrer";
    row.target = "_blank";
    host.append(row);
  });
}
async function refreshSources() {
  const response = await fetch(new URL(`${bridgewatchBase}api/sources`, window.location.origin));
  const sources = await response.json();
  const host = document.querySelector("#sources");
  host.replaceChildren();
  sources.forEach((source) => {
    const row = element("article", "list-item");
    row.append(element("strong", "", `${source.name}: ${source.state}`), element("p", "mono", text(source.observedAt)));
    host.append(row);
  });
}
function render(data) {
  board = data;
  document.querySelector("#meta").textContent =
    `${data.mode} / GitHub ${data.source.state} / ${text(data.source.observedAt)}`;
  renderProgram(data.program);
  renderAttention(data.attention);
  renderProjects();
  renderWorkers(data.workers);
  renderTests(data.tests);
  renderPulls(data.github);
  refreshSources().catch(() => {});
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
const refreshBoard = () =>
  fetch(new URL(`${bridgewatchBase}api/summary`, window.location.origin))
    .then((response) => response.json())
    .then(render)
    .catch(() => {
      document.querySelector("#meta").textContent = "Dashboard unavailable; no observation claim is made.";
    });
refreshBoard();
setInterval(refreshBoard, 2000);
