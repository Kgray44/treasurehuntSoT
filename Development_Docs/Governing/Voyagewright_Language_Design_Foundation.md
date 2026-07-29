# Voyagewright Language Design Foundation

> Searchable companion to `Voyagewright_Language_Design_Foundation.pdf` (Foundation v1.0, July 2026). The PDF is the authoritative source. This companion preserves its governing requirements for implementation and review; if any rendering or transcription question arises, follow the PDF.

**Product:** Voyagewright
**Company:** Absolute Relative Systems
**Governing statement:** **Clear first. Human always. Wonder earned.**

## Document purpose and use

This foundation governs the public brand, core platform, Player, Captain, Studio, errors and recovery, and the boundary between platform copy and Chronicle-authored narrative. Treat its voice principles as product requirements, use the canonical glossary in user-visible product language, keep platform language separate from Chronicle narration and dialogue, audit new screens with the copy review checklist, and let each Chronicle retain its own voice while platform language remains clear.

## 1. The voice thesis

Voyagewright speaks with measured wonder. It should feel like a trusted guide standing beside an unfinished map: clear enough that the user always knows what to do, poetic enough for the interface to belong to the experience, warm enough to feel human, and restrained enough never to become corny. **A lantern, not a loudspeaker. A compass, not a monologue.**

The voice is warm but not sentimental by default; precise but not clinical; observant but not over-explanatory; quietly imaginative but never vague when action is required; nautical in texture rather than pirate costume; confident but never grandiose; and human without pretending the system is a character unless a Chronicle explicitly provides one.

Voyagewright helps creators build stories worth entering, helps Captains guide those stories, and helps players understand what is happening without draining the experience of mystery.

## 2. Voice and tone

Voice is stable; tone responds to the moment.

| Context              | Tone                      | Primary objective                                 |
| -------------------- | ------------------------- | ------------------------------------------------- |
| Public landing page  | Inviting and aspirational | Explain the product and create curiosity          |
| Player experience    | Mysterious and reassuring | Frame the Chronicle without overpowering it       |
| Captain's Console    | Focused and operational   | Support fast, reliable live control               |
| Voyagewright Studio  | Clear and encouraging     | Help creators build valid, publishable Chronicles |
| Errors and recovery  | Calm and direct           | Explain impact, safety, and next action           |
| Finale or reflection | Minimal and spacious      | Let the Chronicle earn the emotion                |

Tone always serves the user's need before atmosphere. A confirmation dialog for deleting a Chronicle must not recite poetry about impermanence.

## 3. Six governing principles

1. **Clear before clever.** The user must not decode the interface. Atmosphere may accompany meaning; it may not replace it. Prefer “Awaiting the Captain. Your progress is saved. The next Chapter will appear when it is released.” over vague tide metaphors.
2. **Suggest wonder instead of announcing it.** Do not rely on “epic,” “magical,” “incredible,” “immersive,” or “unforgettable.” Prefer “A new mark has appeared on the chart.”
3. **Nautical texture, not pirate cosplay.** Use nautical vocabulary when it improves identity and comprehension. Never use fake pirate dialect in platform voice.
4. **Emotion is observed, not commanded.** Present evidence and trust the player. Do not prescribe the emotion they should feel.
5. **The player is capable and must never be shamed.** Hints, recovery, wrong answers, and verification failures preserve dignity and support progress.
6. **Humor creates breathing room.** Humor is dry, restrained, and situational. It may appear in harmless moments, never in security, privacy, billing, or data-loss states.

## 4. The six voice layers

### 4.1 Voyagewright brand voice

For product sites, marketing, trailers, onboarding, descriptions, and public empty states. It may be poetic but must explain the product. Examples: “Create stories worth entering.” “Build a Chronicle. Gather your Crew. Turn an ordinary game night into a Voyage they will remember.” “Your games already provide the world. Voyagewright gives that world a story made for your Crew.”

### 4.2 Platform voice

For navigation, authentication, invitations, loading states, settings, and system notifications. It is neutral, concise, lightly atmospheric, and never pretends to be a story character. Examples: “Invitation accepted.” “Your Voyage is ready.” “Progress saved.” “The next Chapter has not been released.” “No active Voyages.”

### 4.3 Chronicle narrator

Chronicles own their narrators and characters. Narration, journals, letters, dialogue, found documents, and Chronicle-specific prompts may be authored by a Captain, scientist, ghost, archivist, dispatcher, unreliable narrator, or no narrator. Voyagewright does not force nautical narration into non-nautical Chronicles, and platform errors never masquerade as Chronicle prose.

### 4.4 Player experience voice

For Chapter releases, Artifact reveals, progress framing, Waypoint updates, and collection states. **Functional truth comes first; atmospheric meaning follows.**

- “Chapter III released. A new entry has opened in the journal.”
- “Artifact recovered. The sea-glass lens has been added to your collection.”
- “A new Echo was found. Some places keep more than treasure.”

### 4.5 Captain interface voice

For session controls, approvals, hints, player status, Chapter releases, and live recovery. It is operational, fast, and unambiguous. Examples: “Release Chapter III,” “Awaiting player confirmation,” “Approve discovery,” “Send Hint 2,” “Pause Voyage,” and “The player is offline. This action will be delivered when they reconnect.”

### 4.6 Studio voice

For authoring, validation, publishing, versioning, assets, and preview. It is creator-to-creator, encouraging, structurally intelligent, and comfortable with ordinary design terms. Examples: “Create Chronicle,” “Add Chapter,” “Add Passage,” “Preview from here,” and “Chapter IV cannot be published because it has no completion path.” Publishing creates a permanent version; existing Voyages continue using their current version.

**Boundary rule:** every line has a known owner. System copy, Captain instructions, Chronicle narration, character dialogue, private creator notes, and user-generated content must not leak into one another.

## 5. Error and recovery language

Errors are calm, specific, honest, and actionable. Each recovery message answers: what happened; whether anything was lost; what the system is doing now; and what the user can do next.

| Situation            | Heading                                                 | Supporting copy                                                                          |
| -------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Connection loss      | Connection lost                                         | Your progress is safe. Voyagewright is trying to reconnect.                              |
| Failed reconnect     | Unable to reconnect                                     | Your progress is saved through Chapter II. Check your connection, then try again.        |
| Expired invitation   | This invitation has expired                             | Ask the Captain to create a new invitation.                                              |
| Publishing problem   | The Chronicle was not published                         | Chapter III contains a Passage with no valid destination. Your draft has been preserved. |
| Unsupported content  | This Chronicle requires a newer version of Voyagewright | Update the application before continuing. Your Voyage has not advanced.                  |
| Verification failure | The object could not be confirmed                       | Adjust the view so the full marker is visible, then try again.                           |

Prefer “The Chronicle could not be opened. Your progress has not changed. Try again, or return to the Library.” Never leave the user with only “Something went wrong.”

## 6. Canonical vocabulary

| Concept                              | Canonical term      | Usage                                                                   |
| ------------------------------------ | ------------------- | ----------------------------------------------------------------------- |
| Authored playable experience         | Chronicle           | Central content object created in Studio                                |
| Active playthrough                   | Voyage              | Live or resumable instance of a Chronicle                               |
| Person running the experience        | Captain             | Operator guiding a Voyage                                               |
| Participating players                | Crew                | People taking part in the Voyage                                        |
| Major story division                 | Chapter             | Large authored section                                                  |
| Individual authored unit             | Passage             | Narration, objective, riddle, choice, reveal, checkpoint, or transition |
| Location or progression point        | Waypoint            | Destination, checkpoint, or meaningful position                         |
| Optional discovered memory           | Echo                | Side discovery that deepens context without blocking progress           |
| Significant collected object         | Artifact            | Discovered object with narrative meaning                                |
| Completed-session record             | Voyage Record       | Durable history of an ended or completed Voyage                         |
| Creator application                  | Voyagewright Studio | Authoring and publishing interface                                      |
| Player application                   | Voyagewright Player | Player-facing experience                                                |
| Session-control application          | Captain's Console   | Live operating interface                                                |
| Test playthrough                     | Preview Voyage      | Controlled test run                                                     |
| Completed or retired content storage | Archive             | Clear ordinary storage term                                             |

Creators see **Passage** even when an internal type is named `StoryBlock`. A Passage can contain narration, a riddle, an objective, a confirmation, an Artifact reveal, an image transformation, a choice, a Captain checkpoint, or a Chapter ending. Keep ordinary clear words literal: Save, Cancel, Delete, Email, Password, Privacy, Version history, and Validation errors.

## 7. Required microcopy transformations

| Generic or inherited language | Voyagewright language                   |
| ----------------------------- | --------------------------------------- |
| Start Chronicle               | Begin Chronicle                         |
| Active game session           | Active Voyage                           |
| Create new story              | Create Chronicle                        |
| Game master dashboard         | Captain's Console                       |
| Continue                      | Continue Voyage                         |
| Submit                        | Confirm Answer                          |
| You unlocked an item!         | Artifact recovered                      |
| Waiting for admin             | Awaiting the Captain                    |
| No data                       | Nothing has been recorded yet           |
| Replay animation              | Replay Presentation                     |
| Go back                       | Return to Library                       |
| End session                   | End Voyage                              |
| Duplicate campaign            | Create a new Voyage from this Chronicle |
| Error loading story           | This Chronicle could not be opened      |
| Testing mode                  | Preview Voyage                          |
| Draft game                    | Draft Chronicle                         |

For important Player events, use functional truth first and atmospheric meaning second.

## 8. Sentence-level standards

Use sentence case for buttons, labels, dialogs, and settings; title case only for proper product names, Chronicle titles, Chapter titles, named places, and proper nouns. Prefer active voice, short labels, natural contractions, direct second person, and concrete verbs. Use exclamation marks rarely. Use an ellipsis only for actual ongoing work. Name the object rather than referring to “it.” Do not narrate an internal emotion the user is supposed to feel. Avoid decorative punctuation.

## 9. Language across the emotional arc

Early Chronicles may be energetic, curious, and lightly playful. Middle movement becomes observant and widening. Reflection Chapters are quiet and concrete. Finales are minimal and spacious: no marketing language, emotional instructions, or unnecessary explanation. **Reveal the thing; do not explain the correct emotional response to the thing.**

## 10. Speaker ownership

Every meaningful line needs a known speaker, audience, and delivery context. Recommended fields are `speakerType`, `speakerId`, `voiceProfile`, `deliveryContext`, `audience`, `tone`, `visibility`, `localizationKey`, and `contentVersion`.

Recommended speaker types are `SYSTEM`, `NARRATOR`, `CHARACTER`, `CAPTAIN_OPERATOR`, `CREATOR`, `PLAYER`, and `UNATTRIBUTED_DOCUMENT`. The interface must know whether a line is platform-owned, Chronicle-owned, or user-generated, and must prevent system errors, private Captain notes, and narrator voices from crossing their audience boundary.

## 11. Nautical intensity

Brand and marketing can use roughly 40% nautical texture; product navigation and terminology about 25%; ordinary controls about 10%; Captain's Console about 15%; Studio about 5–10%; and errors, security, privacy, and billing 0%. Chronicle content is author-defined. The nautical metaphor supports many genres; fake pirate speech does not.

## 12. Accessibility and localization

Atmosphere must never be the only carrier of status or instruction. Pair supporting poetry with literal headings when action matters, do not encode status through color or decoration alone, use labels that retain meaning outside their visual context, avoid idioms in security/privacy/verification/recovery, preserve semantic order in all motion modes, and keep announcements concise for screen readers.

Store platform strings separately from Chronicle prose; use stable localization keys, not English strings, as identifiers; avoid concatenation that breaks grammar; allow layouts to expand; preserve speaker and tone metadata; do not translate names or invented Chronicle terms without creator intent; and provide translator context, audience, and speaker information. Literal language overrides atmosphere for safety, privacy, data loss, payment, and account access.

## 13. Copy governance

The workflow requires a canonical terminology registry, screen-by-screen inventory with ownership and status, reusable patterns for recovery/confirmation/loading/empty states/hints/invitations, a Chronicle voice profile schema, a copy review checklist in PR and release review, automated banned-term detection, and versioned migration notes.

Review in this order: confirm speaker and audience; write functional truth plainly; add only useful atmosphere; check the glossary; check the action label alone; verify impact and next action for recovery; test motion/mobile/screen-reader presentation; and read the line in the complete user flow.

## 14. Definitive voice statement

Voyagewright is warm, observant, precise, and quietly imaginative. It uses nautical language as texture rather than costume. It gives clear direction, trusts the player's intelligence, protects dignity, and never explains an emotion that the experience can earn. The platform speaks as a guide; the Chronicle speaks through its author and characters.

When two versions are equally clear, choose the more human one. When one is clearer, choose clarity. When neither is clear, stop decorating the sentence and fix the sentence.

## Appendix A. Sample copy library

| Area               | Heading or action       | Supporting copy                                                                             |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------------------- |
| Onboarding         | Welcome to Voyagewright | Create a Chronicle, gather your Crew, and turn a familiar world into a story made for them. |
| Onboarding         | Choose your role        | Join as a Player, guide the Voyage as Captain, or create in Studio.                         |
| Onboarding         | No account yet?         | Create one to save your Chronicles, Voyages, and invitations.                               |
| Invitations        | You've been invited     | A Captain has invited you to join a Voyage.                                                 |
| Invitations        | Invitation accepted     | Your place in the Crew is confirmed.                                                        |
| Player progression | Chapter released        | A new entry has opened in the journal.                                                      |
| Player progression | Waypoint revealed       | A new bearing has been marked on the chart.                                                 |
| Player progression | Artifact recovered      | The object has been added to your collection.                                               |
| Player progression | Echo discovered         | This memory is optional, but it may change what the journey means.                          |
| Player progression | Awaiting the Captain    | Your progress is saved. The Voyage will continue when the next Passage is released.         |
| Captain controls   | Release Chapter         | Make the next Chapter available to the Crew.                                                |
| Captain controls   | Approve discovery       | Confirm the player's submission and advance the Voyage.                                     |
| Captain controls   | Send hint               | Reveal the selected hint to the player.                                                     |
| Captain controls   | Pause Voyage            | Players can keep reading, but progression controls will be suspended.                       |
| Captain controls   | End Voyage              | The current Voyage will close. Its record and progress will be preserved.                   |
| Studio             | Create Chronicle        | Start with a title, premise, and first Chapter.                                             |
| Studio             | Add Passage             | Choose narration, objective, riddle, choice, reveal, or Captain checkpoint.                 |
| Studio             | Preview from here       | Run the Chronicle from this Passage without changing the draft.                             |
| Studio             | Draft saved             | Your latest changes are preserved.                                                          |
| Studio             | Cannot publish yet      | Two Passages have no valid destination.                                                     |
| Empty state        | No Chronicles yet       | Every Voyage starts with a first page.                                                      |
| Empty state        | No active Voyages       | Join an invitation or begin one from your Chronicle Library.                                |
| Recovery           | Connection lost         | Your progress is safe. Voyagewright is trying to reconnect.                                 |
| Recovery           | Unable to reconnect     | Your progress is preserved. Check your connection, then try again.                          |
| Recovery           | Upload incomplete       | The file was not saved. Choose it again after checking your connection.                     |

## Appendix B. Copy review checklist

- Speaker: speaker and audience are known; content class is known; no private or unpublished information leaks.
- Clarity: the user knows what happened and what to do next; heading and action stand alone.
- Voice: warm, precise, restrained; nautical texture supports comprehension; the user is trusted; emotion is not prescribed.
- Tone: serious states have no humor; Captain actions are direct; finales are quieter rather than louder.
- Terminology: the canonical glossary is used; inherited Chronicle language is removed from platform copy; literal controls remain literal; Chronicle, Voyage, Chapter, Passage, Waypoint, Echo, and Artifact are consistent.
- Accessibility and localization: screen-reader meaning is complete; color/animation/iconography is not the only meaning; strings survive translation; translation context identifies speaker, audience, and delivery context.
- Recovery: impact, current system action, concrete next step, and dignity are present.

A line is ready when it is clear without context, fluent within context, owned by the correct speaker, consistent with the glossary, and appropriate for accessibility, localization, and the emotional moment.
