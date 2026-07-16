# Security

Player access uses a bcrypt-verified campaign code and strict HTTP-only cookie. GM login uses bcrypt, database sessions, secure/strict cookies, a per-session CSRF token, generic failures, and a five-failure/15-minute fingerprint limit. Zod validates mutation input. Admin actions are audited. Logs redact passwords, access codes, cookies, and authorization headers. Player snapshots omit all chapter content until the chapter is released; tests and manual DOM/network inspection verify the gate contains no clue text.

Production must set a random 32+ byte session secret, unique GM password and player code, HTTPS, reverse-proxy rate controls, database least privilege, and private repository visibility before real surprise content is committed.
