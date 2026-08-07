---
title: Project Homeport Workspace Capability and Active Chronicle Policy
audience: product-engineering
status: current
canonical_for: project-homeport-workspace-capability-active-chronicle-policy
last_reviewed: 2026-08-04
---

# Workspace capability and active Chronicle policy

One canonical account and AccountSession project Player, Captain, and Creator capabilities. Claimed active accounts have
Player and may idempotently initialize Captain or Creator workspace setup without another credential product. Resource
authorization remains server-side: Captain access to a Voyage and Creator access to private work still require their own
authoritative relationships. Guest, restricted, Moderator, and Administrator boundaries remain explicit.

The All Workspaces hub presents account identity, current workspace, all three governed workspace cards, initialization
and content states, genuine restrictions, recent safe content, return paths, and complete loading/empty/error states on
desktop and mobile.

Before a transition to Captain or Creator, the server evaluates active Player participation. A risk-bearing active
Chronicle returns a lock decision naming the Chronicle safely and offering Return, Cancel, or Leave Chronicle safely.
Leave requires consequences and confirmation, updates participation/crew truth authoritatively, reconciles tabs, and only
then permits switching. A second tab cannot grant Captain authority over that same Chronicle. Client navigation is a
projection of this decision, never the authority.
