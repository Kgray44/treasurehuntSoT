---
title: Project Homeport Profile Imagery and Crop Contract
audience: product-engineering
status: current
canonical_for: project-homeport-profile-imagery-crop-contract
last_reviewed: 2026-08-05
---

# Project Homeport Profile Imagery and Crop Contract

## Scope

Profile avatar and banner selection, editing, storage, processing, delivery, replacement, and removal.

## Required behavior

- PROFILE_AVATAR and PROFILE_BANNER belong to one account-owned Profile and retain owner account/Profile, private original, normalized derivative, active version, dimensions, MIME, bytes, checksum, normalized crop, orientation, timestamps, processing/scan/replacement/removal state.
- Selection creates a temporary local preview and exact aspect/mask editor before upload; pan, zoom, wheel/pinch where appropriate, keyboard position and zoom, reset, replace, cancel, save, and removal are available.
- PNG, JPEG, and WebP are decoded and bounded by bytes, dimensions, and pixels; extension is not trusted, malformed or unintended animated input fails closed, and derivative metadata is stripped.
- Confirmed originals remain private. Only READY server-generated derivatives may become active or be delivered through Profile visibility; a failed replacement leaves the prior media intact.
- Object URLs are revoked on replacement, cancel, unmount, success, or terminal failure. Raw object URLs and original filenames are never storage identity.

## Verification

- crop geometry and deterministic derivative units
- upload validation and ownership API tests
- replacement/removal failure tests
- desktop/mobile/zoom/accessibility editor journeys

## Truth boundary

This architecture contract does not prove implementation, migration, live inbox delivery, evidence acceptance, Sounding Line authority, publication, owner acceptance, merge, PR, or deployment.
