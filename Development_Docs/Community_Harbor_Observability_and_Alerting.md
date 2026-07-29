# Community Harbor Observability and Alerting

Metrics and logs use bounded route, operation, provider-family, safe-code, and result labels. They must not use account IDs, titles, slugs, report prose, filenames, storage keys, tokens, or raw provider errors as labels.

Required alerts cover scanner and storage health, worker/dead-letter growth, quarantine/reconciliation failures, stale scans, backup and restore-drill age, migration drift, authorization bursts, and alert-delivery failure. Without a configured external destination, status is explicitly `ALERTING_NOT_CONFIGURED`.
