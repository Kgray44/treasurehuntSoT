# Project True North test plan

## Focused automated checks

1. `src/navigation/navigation.test.ts`: registry identity, order, aliases, route ownership, capability filtering, immersive policy, account and Community classification.
2. `src/components/shell/ProductShell.test.tsx`: stable application bar, active link semantics, profile context states, account context, mobile menu focus/Escape/backdrop/route-close, and immersive Player restrictions.
3. `src/app/api/shell/context/route.test.ts`: anonymous and role projections; confirms no email, token, session ID, provider subject, or role internals are emitted.
4. Existing Player, Captain, Studio, Passport and accessibility tests: rerun after shell integration.

## Browser acceptance (task-owned runtime)

Use synthetic Player, Captain, Creator, and combined-role accounts only. Validate public, Player, Captain, Creator, account, compact-player and compact-Captain paths at 2560x1440, 1920x1080, 1440x900, 1024x768, 430x932, 390x844 and 844x390. Assert stable bar location, exact menu ordering, profile reachability, URL/back-forward semantics, no Player-to-Captain/Creator exposure, menu keyboard flow, no horizontal overflow, and zero serious/critical Axe findings on the listed shell contexts.

## Completion gates

Run focused unit/component tests, typecheck, formatting, lint, language and architecture validation, privacy scan, full Vitest, production build, then task-owned browser acceptance where its runtime is available. A shared validation lock is observed but never deleted or bypassed.
