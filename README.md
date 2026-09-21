# Voyagewright

> **Create, run, and remember story-driven adventures.**

Voyagewright is a platform for building and experiencing **Chronicles**: authored adventures that can combine story, choices, puzzles, crew coordination, artifacts, media, cinematic presentation, and real-world or digital moments into one connected experience.

A Chronicle is more than a sequence of pages. It can be prepared as a specific published edition, launched as a live **Voyage**, shared with a crew, guided by a Captain, experienced through a Player-facing Journal, and remembered afterward through each participant's private **Chronicle Passport**.

Voyagewright is designed around one simple idea:

> **The platform should handle the machinery so people can focus on the adventure.**

---

## What Voyagewright is

Voyagewright brings several related experiences together as one product:

| Area | What it is for |
| --- | --- |
| **Explore Chronicles** | Discover Chronicles that are available to preview or experience |
| **Player** | Join invitations, manage your Voyages, gather with the crew, and experience a Chronicle |
| **Captain** | Prepare and operate a Voyage, invite the crew, manage readiness, and guide live progression |
| **Creator Studio** | Author Chronicles, test them, manage assets and Story Blocks, and publish immutable Versions |
| **Community Harbor** | Discover public Chronicles, Creators, artifacts, collections, guides, templates, and other shared material |
| **Chronicle Passport** | Your private archive of Voyages, Memories, artifacts, Keepsakes, statistics, and personal history |
| **Personal Harbor** | Your account, identity, preferences, privacy, security, linked identities, sessions, and support controls |
| **Profile** | The deliberately shareable identity other people may see |

These are not separate accounts or unrelated applications. A single Voyagewright account can have the capabilities needed to be a Player, Captain, Creator, or more than one at the same time.

---

# The core concepts

Voyagewright uses a few terms consistently throughout the product.

### Chronicle

A **Chronicle** is the authored adventure itself.

It contains the story structure and may include Chapters, Passages, Story Blocks, locations, artifacts, assets, conditions, variables, media, choices, completion rules, and other authored material.

A Chronicle can continue to evolve over time.

### Version

A **Version** is an immutable published edition of a Chronicle.

Once a Version is published, the material used by an existing Voyage does not silently change underneath the Players. A later edit becomes a new Version rather than rewriting the one a crew already experienced.

This means a person can return months or years later and know which exact edition they played.

### Voyage

A **Voyage** is a prepared playthrough of one exact Chronicle Version.

A Voyage has its own crew, Captain authority, invitations, live state, progression, and history.

Two crews can therefore play the same Chronicle Version as separate Voyages without sharing each other's state.

### Player

A **Player** participates in the Voyage.

Players receive or accept invitations, join the crew, enter the Muster room, experience the Chronicle through Player-safe surfaces, and retain their own authorized personal history afterward.

### Captain

A **Captain** operates a Voyage.

Captain authority is separate from Player participation. A Captain may run the Voyage without joining as a Player, or may explicitly participate as **Captain + Player** using the same account.

### Creator

A **Creator** authors Chronicles in Creator Studio.

Creator capability controls authoring access. It does not automatically grant Captain authority over every Voyage or access to another person's private Player records.

---

# How a Voyage works

A typical Voyage moves through several stages.

## 1. Discover or receive a Chronicle

A person may begin from public Chronicle discovery, Community Harbor, or an invitation supplied by a Captain.

Public preview information is intentionally limited to material that is safe to reveal before the Voyage begins.

## 2. Use one Voyagewright identity

Voyagewright uses one canonical account and session across its normal workspaces.

A person's account may have Player, Captain, Creator, or administrative capabilities, but those are permissions and relationships of the same identity rather than separate logins.

Some invitation flows can also support an invited guest before that identity is fully claimed.

## 3. Join a Voyage

An invitation can bring a Player into a specific Voyage.

Accepted Voyages appear in the Player experience rather than requiring the person to remember a hidden route or manually reconstruct how they arrived there.

Invitation state and Voyage membership remain separate concepts: an invitation can be pending, declined, revoked, accepted, or replaced without pretending those states are all the same thing.

## 4. Gather in Muster

Before launch, the crew can gather in the shared **Muster** experience.

Muster can show:

- the Chronicle and published edition being prepared;
- the Captain;
- invited and joined crew;
- readiness;
- connection state;
- Player and Captain roles;
- Voyage-scoped Crew Chat;
- Captain launch and Voyage controls when authorized.

Crew Chat belongs to that Voyage and is available only to the people who currently have the required membership or Captain authority.

Leaving the Muster screen is not the same as leaving the Voyage.

## 5. Launch the Voyage

The Captain launches using the Voyage's real readiness and authorization rules.

A participating Captain still receives ordinary Player membership rather than a magical hybrid identity with access to both public and secret information at once.

Voyagewright keeps Captain-only state and Player-safe state separated deliberately.

## 6. Experience the Chronicle

During a Voyage, Players use the Chronicle's authored presentation, including surfaces such as the Journal and other story views.

Depending on the Chronicle, the experience may involve:

- narrative passages;
- choices;
- clues and answers;
- Captain decisions;
- artifacts;
- media;
- optional objectives;
- waits or timers;
- verification providers;
- cinematic scenes;
- location-aware experiences when supported by an implemented provider.

The platform's progression state remains authoritative. Visual presentation is not allowed to silently advance the story merely because an animation finished.

## 7. Handle crew changes safely

Voyages are designed to preserve history even when the crew changes.

Players can leave a Voyage without deleting the fact that they once participated.

Captains can transfer authority to an eligible joined Player. Relinquishing Captaincy can place a shared Voyage into **Succession Hold** rather than silently cancelling it.

When supported by the current Voyage state, a Player may be offered choices such as:

- **Take Captaincy** of the shared Voyage;
- **Continue Solo** from the last safe committed state;
- **Leave Voyage**.

A solo continuation is its own Voyage. It does not steal another Player's private state or rewrite the original shared Voyage.

## 8. Keep the history afterward

After and during participation, a person's authorized history belongs in **Chronicle Passport**.

Voyagewright keeps the difference between:

- what happened in the shared Voyage;
- what was personally granted to one Player;
- what the person privately wrote or preserved;
- what may be publicly shared.

That distinction is central to the platform.

---

# Player experience

The Player workspace is the ordinary home for participating in Voyages.

## Player Library

The Player Library is where a signed-in Player can find the Voyages and invitation-driven experiences available to them.

It is intended to answer practical questions such as:

- What have I been invited to?
- Which Voyages can I enter?
- Which one is waiting for launch?
- Which one is active?
- Where do I return after leaving an immersive Chronicle view?

Player-facing screens should expose only information that Player is authorized to know.

Captain notes, Creator-private material, hidden answers, other Players' private state, and administrative details do not become visible merely because the same human also has another role elsewhere in Voyagewright.

## Muster and Crew Chat

The Player Muster experience shows the crew gathering around one Voyage.

Recent Crew Chat is retained for that Voyage, and current participants can communicate without turning chat into a separate social network.

The interface distinguishes ordinary navigation from actual membership changes:

- **Leave Waiting Room** returns to the Player area.
- **Leave Voyage** ends the person's current membership after confirmation.

## Chronicle Journal and story surfaces

The Journal and related story views present the Chronicle in the form intended by its Creator.

They may show story pages, choices, progress, revealed material, artifacts, and other Player-safe state.

Immersive routes provide a deliberate way back to the Player experience rather than requiring browser-history archaeology.

---

# Captain experience

Captains prepare and operate Voyages without becoming a separate kind of account.

## Creating a Voyage

A Captain prepares a Voyage from a published Chronicle Version.

The Version is pinned so the crew has a stable source throughout that playthrough.

A Captain can choose whether they are:

- **Captain only**, operating the Voyage without a Player record; or
- **Captain + Player**, joining the crew as one ordinary Player while retaining separate Captain authority.

## Inviting the crew

Voyagewright supports governed invitation lifecycle and crew preparation.

Depending on the available surface, invitations can be represented through individually controlled links, codes, QR handoffs, or other supported invitation mechanisms.

The Captain can distinguish pending invitations from joined crew rather than treating everybody as though they already entered the Voyage.

## Captain Muster

**Captain Muster** shows the same shared gathering room with the controls appropriate to current Captain authority.

It can include:

- Crew and invitation state;
- readiness;
- connection state;
- Crew Chat;
- Chronicle edition details;
- launch readiness;
- Captain and Voyage options.

## Captain's Console

The live Captain experience is intended to show the current Voyage state and only the actions that are meaningful at that moment.

Before an important command, Voyagewright can present information such as:

- the target;
- current revision/state;
- consequence;
- reversibility;
- Player-visible effect.

Captain operations use authoritative commands rather than secretly editing Player state in the browser.

## Captaincy changes

Captain authority can be transferred without rewriting the crew's Voyage history.

**Transfer Captaincy**, **Relinquish Captaincy**, and **Cancel Voyage for Everyone** are deliberately different operations with different consequences.

Cancellation ends the shared Voyage. Relinquishment is not cancellation.

---

# Creator Studio

Creator Studio is where Chronicles are built.

A Creator can work with Chronicle settings and authored material such as:

- Chapters and Passages;
- Story Blocks;
- locations;
- assets and media;
- artifacts;
- variables and conditions;
- versions;
- reusable authoring material;
- publication review.

## Guided, Detailed, and Engineering views

The Story Block Inspector can expose different levels of authoring detail without changing the underlying Chronicle.

- **Guided** focuses on required authoring steps and plain-language help.
- **Detailed** exposes the supported authoring controls.
- **Engineering** exposes safe contract paths, versions, and rule information useful for advanced inspection.

Switching modes changes disclosure, not Chronicle state.

## Typed conditions and variables

Creator Studio uses governed Story Block contracts rather than treating every block as an arbitrary bag of JSON.

Creators can select destinations using human-readable Chronicle structure, work with typed variables, and build supported conditions through the visual authoring system.

## Reusable authoring material

Creators can preserve private reusable material such as Presets, Fragments, or Chapter templates.

Reusing material is designed to retain provenance and remain compatible with ordinary Undo/Redo behavior.

## Drydock and Sea Trials

Drydock provides Chronicle verification and deterministic simulation support for Creator work.

Sea Trials can exercise saved Chronicle scenarios against controlled outcomes, virtual time, supported synthetic faults, assertions, and coverage evidence without advancing a real Player Voyage.

The purpose is to answer questions such as:

- Can this Chronicle reach its intended endings?
- Are important branches covered?
- Does a configuration violate a governed Story Block contract?
- What happens if a provider is unavailable?
- Does the authored experience still behave correctly under an expected failure?

## Reviewing and publishing a Version

Publishing is an explicit boundary.

Before publishing, Creator Studio can review:

- Drydock readiness;
- blockers, warnings, and accepted waivers;
- the authored differences from the current Version;
- asset readiness;
- protected-content evidence where available;
- compatibility;
- Creator release notes.

A successful publication produces an immutable Version and receipt rather than silently replacing an edition already in use.

---

# Community Harbor

Community Harbor is Voyagewright's public/shared discovery environment.

It is separate from private Chronicle authoring and private Player history.

Depending on the current deployed configuration and available content, Community Harbor can organize public material into areas such as:

- Chronicles;
- artifacts;
- templates;
- maps;
- audio and reveal resources;
- Creators;
- collections;
- guides;
- Voyage Logs.

Public discovery can use featured and recent shelves, search, sorting, compact filters, advanced filters, and safe detail views.

Eligible signed-in accounts can use supported social/discovery actions such as saving public content or following eligible Creators.

Public Community projections are allowlisted. Private drafts, private Chronicle prose, hidden answers, session secrets, exact private locations, unconsented participant information, moderation evidence, and protected account data are not supposed to become public simply because the material exists elsewhere in the system.

Community availability also depends on deployment and provider configuration. A capability existing on main does not automatically mean every hosted provider is configured in every environment.

---

# Chronicle Passport

Chronicle Passport is a first-class private personal destination.

It is **not** an account-settings page and it is **not** the same thing as a public Profile.

Passport is about what *you experienced*.

Depending on the records available to the signed-in account, Passport can include:

- Voyage History;
- detailed Voyage records;
- Timeline;
- People;
- private Statistics;
- Voyage Atlas;
- Memories;
- Artifact Cabinet;
- Keepsakes;
- saved Community items;
- exact Chronicle edition information;
- private Reflection;
- replay handoffs;
- Voyage Book presentation.

## Voyage History

Each historical Voyage record is tied to the edition actually played.

A detailed record can include safe retained context such as:

- Journey Summary;
- path and objectives;
- historical crew;
- Captain and Creator attribution;
- artifact context;
- exact Version;
- timing quality;
- remembrance and Memories.

Unavailable historical information is shown as unavailable rather than invented.

For example, **Duration unavailable** means trustworthy duration evidence was not preserved. It does not mean the Voyage lasted zero minutes.

## Shared artifacts vs. your artifacts

Voyagewright distinguishes a shared artifact moment from personal custody.

A Voyage record can truthfully say the crew witnessed or revealed an artifact without automatically claiming every crew member owns one personally.

The **Artifact Cabinet** is the personal provenance-aware view of artifacts actually associated with the signed-in person.

## Private remembrance

Reflections, Memories, and private Keepsakes remain owner-authorized.

Participant consent can limit how another person appears in a private Keepsake or related remembrance material without rewriting the underlying historical Voyage record.

## Compare what changed

Where Tideglass comparison is available, a historical Voyage can hand off to a Version comparison so a person can understand how the Chronicle has changed since the edition they played.

---

# Personal Harbor and Profile

Voyagewright separates account management, private history, and public identity instead of putting all three into one enormous settings landfill.

## Personal Harbor

**Personal Harbor** is the account control center.

It is the natural home for areas such as:

- Personal Information;
- preferences;
- themes and appearance;
- accessibility preferences;
- notifications;
- Privacy & Safety;
- Linked Identities;
- Security;
- Sessions & Devices;
- Support Access;
- Data & Account;
- Sign Out.

It also provides a gateway to Chronicle Passport rather than duplicating the entire Passport experience inside account settings.

## Public Profile

**Profile** is the identity another person may be allowed to see.

It can include intentionally public information such as:

- display name;
- handle;
- biography;
- avatar;
- banner;
- other explicitly shareable profile information.

The public Profile is a server-produced safe projection. Private Passport records are not merely hidden with CSS behind the same page.

---

# Account and security model

Voyagewright is designed around one account lifecycle rather than one password system per workspace.

Supported account flows on current main include ordinary sign-in/account handling, email-verification and recovery infrastructure, session management, and provider-linked identity support where configured.

Google and GitHub OAuth support exists in the repository and has owner-observed staging acceptance, but provider availability still depends on the environment's real configuration.

Security-sensitive surfaces intentionally avoid displaying secrets such as:

- password material;
- session tokens;
- provider access or refresh tokens;
- encryption keys;
- provider secrets.

## Sessions & Devices

Users can inspect bounded session/device information and revoke owned sessions.

Revoking a session does not delete Chronicle history.

## Linked Identities

Linked-provider views expose bounded connection information, not provider credentials.

Unlinking is protected so a person is not casually left with no accepted sign-in path.

## Support Access

Voyagewright includes a user-approved Support Access model for bounded administrative assistance.

Support grants are scoped, time-limited, auditable, and deliberately exclude credentials and other forbidden secret material.

---

# Privacy by design

Voyagewright contains experiences that may be personal, private, or surprise-sensitive, so privacy boundaries are part of the product architecture rather than decorative policy text.

Important principles include:

- public views are built from explicit safe projections;
- private data should not be sent to an unauthorized browser and merely hidden;
- Chronicle drafts and Captain/Creator-private information remain separate from Player views;
- one Player's private records do not become another Player's records;
- account capability does not bypass Voyage-specific authorization;
- protected media follows its own authenticated delivery rules;
- Community publication does not automatically expose private source material;
- private Chronicle packages and protected assets are handled separately from ordinary public static files.

Use only content you are authorized to view or share.

---

# Accessibility and presentation

Voyagewright is designed around responsive, keyboard-accessible, reduced-motion-aware product surfaces.

The current implementation includes governed work around:

- keyboard navigation;
- visible focus;
- focus restoration;
- responsive desktop/tablet/mobile layouts;
- narrow mobile behavior;
- effective 200% zoom layouts;
- reduced-motion final states;
- labelled loading, empty, restriction, dependency, and failure states;
- accessible dialogs and confirmations;
- semantic navigation and headings.

Animation is intended to support the experience, not become a requirement for understanding it.

Automated accessibility evidence is useful but does not replace full physical assistive-technology testing in a deployed environment.

---

# Where should I go?

For a normal Voyagewright user, these are the most useful documentation starting points:

### New to Voyagewright

- [Getting started](docs/user/getting-started.md)
- [Account and workspaces](docs/user/account-workspaces.md)
- [Personal Harbor](docs/user/personal-harbor.md)

### Playing

- [Player guide](docs/user/player-guide.md)
- [Chronicle preview and start](docs/user/chronicle-preview-and-start.md)
- [Chronicle Passport](docs/user/chronicle-passport.md)

### Running a Voyage

- [Captain guide](docs/user/captain-guide.md)

### Creating

- [Creator guide](docs/user/creator-guide.md)

### Discovering and sharing

- [Community Harbor](docs/user/community-harbor.md)
- [Community reviews and saves](docs/user/community-reviews-and-saves.md)

### Identity, privacy, and safety

- [Profile](docs/user/profile.md)
- [Account security](docs/user/account-security.md)
- [Linked identities](docs/user/linked-identities.md)
- [Privacy](docs/user/privacy.md)
- [Support Access](docs/user/support-access.md)

### Accessibility and help

- [Accessibility](docs/user/accessibility.md)
- [Troubleshooting](docs/user/troubleshooting.md)

The full user-documentation hub is at [docs/README.md](docs/README.md).

---

# Current availability

This repository contains Voyagewright's current protected-main implementation.

That does **not** mean every capability is necessarily deployed, enabled, or connected to its external production provider in every environment.

Some capabilities depend on separately configured services such as:

- email delivery;
- external identity providers;
- production database infrastructure;
- protected storage;
- scanning or security providers;
- other deployment-specific integrations.

Voyagewright should present those unavailable dependencies truthfully rather than pretending a provider is live when it is not.

The repository also intentionally contains generic development material instead of real private Chronicle surprise content.

---

# Repository note

Some older internal identifiers and historical engineering records still use names such as **Forever Treasure Companion**, **Chronicles**, or earlier compatibility terminology.

**Voyagewright** is the current product identity.

Engineering records under `Development_Docs/` preserve architecture, implementation history, evidence, governance, and project closeout material. They are not intended to be the ordinary user manual.

---

# Proprietary software

Voyagewright is proprietary software.

**Copyright © 2026 Kato Gray. All rights reserved.**

This repository is source-visible but **not open-source software**. No general permission is granted to use, copy, modify, redistribute, self-host, commercialize, sublicense, or create derivative works from Voyagewright except where required by GitHub's applicable platform terms or expressly authorized in writing by the copyright holder.

Third-party components remain subject to their own licenses.

See [LICENSE.md](LICENSE.md) for the complete terms.
