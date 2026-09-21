# Community Harbor Production Provider Architecture

Community owns public eligibility, package/asset association, scan-receipt projection, and moderation response. Sealed Hold owns low-level scanner transport and storage/provider conventions. The Community ClamAV adapter uses the shared bounded INSTREAM transport and maps timeouts, malformed responses, absence, and outages to non-clean states.

Provider health exposes only kind, configured, healthy, ready, classification, and safe code. Local storage and synthetic scanner validation are `SIMULATED_LOCAL`; real scanner, object storage, MySQL, and alert delivery remain external gates until an isolated configured environment is contacted.
