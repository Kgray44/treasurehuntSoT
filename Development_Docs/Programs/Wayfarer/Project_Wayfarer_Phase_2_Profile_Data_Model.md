# Project Wayfarer Phase 2 Profile Data Model

`UserAccount` remains the private canonical person root. `PlayerProfile` is its one visible identity and owns display name, optional normalized handle, biography, avatar/banner references, profile status, and default visibility.

The new additive records are `ProfileHandleHistory` (permanent redirect lookup), `ProfileMedia` (restricted re-encoded profile image metadata), `ExternalIdentity` (immutable provider subject, permission/visibility state, and encrypted token field), `ProviderLinkAttempt` (state/PKCE/nonce), `ProfilePreferenceSet` (typed V1 payload), and `ProfilePrivacyRule`.

`CommunityProfile.accountId` remains Harborlight's Community relation. Its existing handle/name/biography are compatibility snapshots for old releases; new public identity reads use the current Wayfarer account profile. No Phase 2 table writes Chronicle runtime, Sealed Hold package, or Lanternwake state.
