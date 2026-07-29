# Community Release Update Model

An installed linked item records installed release/package checksum and optional local modification fingerprint. Updates compare the current release identity, package checksum, semantic version, dependencies, licence and accessibility snapshots. A local modification prevents in-place update: the user may keep current, create an editable copy, or create a fork. Update application uses a new installation operation; it does not mutate the prior receipt or any active session.
