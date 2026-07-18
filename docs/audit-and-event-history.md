# Audit and event history

Progress events are the ordered player-facing/domain history; audits are administrative history. Successful commands record actor, command, time, target, event/sequence where applicable, correlation, outcome, and optional reason. Failures record a sanitized code. Credentials are never metadata.

Event and Audit workspaces load the latest 80 records and constrain long scroll regions. Server cursor pagination is the next step beyond this development scale.
