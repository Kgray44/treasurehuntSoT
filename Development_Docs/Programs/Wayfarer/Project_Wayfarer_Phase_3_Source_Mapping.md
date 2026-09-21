# Phase 3 Source Mapping

The projector reads `PlaythroughMembership`, `Invitation`, `TaleSession`,
`PublishedTaleVersion`, and safe `TaleSessionEvent` type/timestamp metadata.
It writes only Wayfarer Phase 3 tables. Raw payloads, session variables, answer
text, invitation credentials, account data, Captain/Creator notes, and object
keys are never copied. Missing published version evidence is a projection
failure, not a guessed record.
