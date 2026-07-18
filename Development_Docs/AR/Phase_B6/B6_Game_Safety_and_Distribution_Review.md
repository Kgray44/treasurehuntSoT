# Phase B-6 game safety and distribution review

## Technical boundary

The Companion captures only a user-selected application window through Electron/Windows desktop capture. It does not inject into Sea of Thieves, read process memory, alter game files, automate controls, synthesize input, render an in-game overlay, or run continuously without a governed Player scan. Runtime processing is local and transient by default.

## Policy boundary

Those constraints reduce technical risk but do not create permission. Rare’s current [Enforcement Policy Updates](https://support.seaofthieves.com/articles/24643308439314) say third-party tools are generally against the Sea of Thieves Code of Conduct and warn that even an external solution discussed as an exception may still be detected and used at the player’s risk. The [Xbox Community Standards](https://www.xbox.com/en-US/legal/community-standards) prohibit cheating, harmful modification, and inappropriate use of game content.

## Decision

No public distribution, Creator Preview approval, stable badge, safe-list claim, or Rare/Microsoft affiliation is authorized by this implementation. The project owner must obtain and archive written clarification for the exact capture-only design, distribution method, branding, screenshots/assets, data handling, and update behavior. Any imposed conditions must be reflected in code, installer, documentation, and the release issue register before B6-012 can close.

This is a product release gate, not legal advice.
