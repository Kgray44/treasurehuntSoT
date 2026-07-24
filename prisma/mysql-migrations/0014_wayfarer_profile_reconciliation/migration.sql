-- The reviewed application migration creates typed V1 preference records in
-- bounded batches. This ordered marker deliberately does not rewrite legacy
-- JSON in DDL or introduce a redundant CommunityProfile account index.
SELECT 1 AS `wayfarer_profile_reconciliation_marker`;
