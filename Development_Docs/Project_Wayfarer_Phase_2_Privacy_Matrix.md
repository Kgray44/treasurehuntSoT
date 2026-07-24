# Project Wayfarer Phase 2 Privacy Matrix

| Section                  | Default          | Public projection rule                                                         |
| ------------------------ | ---------------- | ------------------------------------------------------------------------------ |
| Header and profile media | REGISTERED_USERS | Explicit profile DTO only; media is a no-store authorized route.               |
| Biography                | ONLY_ME          | Included only after section policy allows the server-derived viewer.           |
| Linked providers         | ONLY_ME          | Requires section policy and the provider's independent public/unlisted choice. |
| Chronicle summary        | ONLY_ME          | No Phase 2 history data is serialized.                                         |
| Crews                    | ONLY_ME          | Deferred; exact crew data is never serialized.                                 |
| Community                | ONLY_ME          | Harborlight status remains separate and Wayfarer may make the stricter choice. |

`ONLY_ME`, `CREW_ONLY`, `REGISTERED_USERS`, `PUBLIC`, and `UNLISTED` are typed server-side values. Account email, sessions, credentials, provider tokens, invitations, private packages/assets, and moderation records have no public projection path.
