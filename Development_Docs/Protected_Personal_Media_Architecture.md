# Protected Personal Media Architecture

`ProtectedMedia` points to an existing `PrivateAssetObject`; it does not copy original bytes. `ProtectedMediaAssociation` binds that media to an allowlisted opaque subject and explicit purpose. `ProtectedMediaDerivative` points to a separate private object in the `derivatives` namespace. `ProtectedMediaGrant` controls delivery; `ProtectedMediaConsentAssertion` controls consent; receipts and withdrawals are immutable durable records.

The derivative worker reads a clean original internally, builds display and thumbnail WebP variants, scans each exact output, and returns only safe checksums and opaque identities. Consumer projects never receive raw provider paths, storage credentials, wrapped keys, or source bytes.
