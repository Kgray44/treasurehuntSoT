# Community Harbor Deployment and Rollout Runbook

Required process roles are web, Community worker, scheduler, database, object storage, scanner, backup target, and alert delivery. Readiness is role-specific. Scanner or rate-limit failure blocks new high-risk publication/mutation; public delivery must continue to honor database moderation eligibility.

Flags remain fail-closed: Harbor availability, public publishing, moderation requirement, package imports, reviews, comments, public Voyage Logs, 3D, derivatives, external search, scanner requirement, worker requirement, and rollout stage. Allowed stages are `INTERNAL_ONLY`, `INVITED_CREATORS`, `UNLISTED`, `MODERATED_PUBLIC`, `COMMUNITY_BETA`, and `GENERAL_AVAILABILITY`; this branch does not authorize a production rollout.
