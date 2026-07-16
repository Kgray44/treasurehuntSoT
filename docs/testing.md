# Testing

`npm test` covers valid/invalid transitions, event deduplication/order, and full/reduced ceremony plans. Playwright smoke coverage proves the player gate omits unreleased text and the GM route remains login-protected. Manual vertical-slice validation covered login, confirmation, prepare, live release without refresh, ordered ceremony, persistent active refresh state, replay, undo to READY/LOCKED, portrait navigation, muted control, reduced-motion plan, and SSE recovery semantics.

Screenshots are written to ignored `artifacts/screenshots/`. Pass one found early objective disclosure and a disappearing map marker; both were corrected. Pass two found short-landscape spine collision; the layout now switches to one sheet. Add deterministic timeline fixtures and fuller end-to-end mutation coverage next.
