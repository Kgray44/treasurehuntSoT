# Sealed Hold migration reconciliation note

- Migration identifier: `20260721130000_project_sealed_hold_phase1` (SQLite) and `0005_project_sealed_hold_phase1` (MySQL)
- Base schema SHA: `0ecd2f9cca6116e2f7f9ab4408ade749fb061e72`
- Added models: `PrivateContentImport`, `PrivateContentImportMapping`, `PrivateAssetObject`, `PrivateAssetReference`
- Added constraints: package ID/revision, package SHA-256, object SHA-256, storage key, import/logical asset ID
- Added indexes: import status/date and private reference playthrough/reveal/availability
- Wayfarer interaction: Wayfarer currently has uncommitted additive account/profile schema work. Sealed Hold uses opaque actor/owner references and no foreign key to those models.
- Integration: retain both migration histories, order after the accepted Wayfarer migration set, regenerate both Prisma clients, and run isolated migration plus combined authorization validation.
