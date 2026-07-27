# Command Center information architecture

| Route                        | Workspace     | Primary task                           |
| ---------------------------- | ------------- | -------------------------------------- |
| `/quartermaster`             | Command Deck  | status truth and immediate operations  |
| `/quartermaster/chapters`    | Chapters      | state-machine progression              |
| `/quartermaster/hints`       | Hints         | ordered preparation and release        |
| `/quartermaster/voyage`      | Voyage        | location visibility and chart plotting |
| `/quartermaster/artifacts`   | Artifacts     | award state and ceremony preview       |
| `/quartermaster/quests`      | Side Quests   | discovery and advancement              |
| `/quartermaster/journal`     | Journal       | plain-text narrative dispatches        |
| `/quartermaster/events`      | Event Staging | prepared actions and immutable events  |
| `/quartermaster/player-view` | Player View   | sanitized released-state mirror        |
| `/quartermaster/recovery`    | Recovery      | reversal and emergency controls        |
| `/quartermaster/audit`       | Audit         | actor/outcome/correlation history      |
| `/quartermaster/diagnostics` | Diagnostics   | presence, sequence lag, capabilities   |

All routes use the authenticated shell, browser history, and server truth. Player navigation never links to them. Below 900 px the rail becomes an emergency dock with Pause/Resume, Player View, Next Hint, and Undo. `Ctrl/Cmd+K` opens the command palette, `Escape` closes overlays, and `P` opens pause/resume confirmation.
