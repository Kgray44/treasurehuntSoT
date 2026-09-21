---
title: Specialized Playwright configuration index
audience: engineering
status: current
canonical_for: specialized-playwright-configurations
last_reviewed: 2026-09-21
---

# Specialized Playwright configurations

This directory is the canonical home for project-specific Playwright configurations. The repository-root `playwright.config.ts` remains the ordinary default configuration. Specialized configurations retain their existing filenames and are invoked with their full `tests/config/playwright/` path. `playwright.drydock-phase4.config.ts` remains only as a compatibility entrypoint for the source-resident local browser launcher; it imports this directory's canonical Drydock configuration.
