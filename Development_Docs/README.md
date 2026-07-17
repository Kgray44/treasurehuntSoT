# Shared development documentation

`Development_Docs` is the canonical repository location for shared development references, requirements, architecture notes, design decisions, implementation plans, testing notes, meeting notes, and other planning material that should remain available across Codex sessions and computers.

Files in this directory are normal Git-tracked project files. The repository's end-of-task synchronization workflow inspects additions, modifications, renames, moves, and deletions here and, after safety checks, can commit and push them through the same approved branch workflow used for `Codex_Chats`. The files are not copied into the conversation archive or packaged into a second store.

## Working from another computer

Before relying on or editing these documents:

1. Confirm that this is the intended repository and branch with `git remote -v`, `git branch --show-current`, and `git status --short --branch`.
2. Preserve and review any local modifications. Do not reset, clean, restore, or force-push them away.
3. Run `git fetch --prune origin`, then compare the branch with its upstream using `git rev-list --left-right --count "HEAD...@{upstream}"`.
4. If the branch is only behind and the working tree is clean, update it with `git pull --ff-only`. If it is ahead, diverged, or locally modified, reconcile the work deliberately before editing these documents.
5. If Git reports a conflict, preserve both versions and resolve it visibly. Do not push unresolved conflict markers. For an unmergeable binary document, retain clearly named local and remote variants for review when repository conventions permit.

This pull-before-edit check matters: a Codex session on a different computer must synchronize the latest repository state before treating local `Development_Docs` content as current.

## Safety and change behavior

Do not store secrets, credentials, private keys, access or API tokens, production database exports, private authentication caches, or sensitive company information here unless both the repository and the specific contents have been explicitly approved for that purpose. This repository may be publicly visible. Temporary, recovery, credential-shaped, and obvious secret files are ignored, and the synchronizer also checks changed file names, bounded textual content, and file sizes before staging.

Deleting a tracked file locally and committing that deletion also removes it from the GitHub version after the commit is pushed. Git history can still preserve earlier versions of documents that were changed or deleted, subject to the repository's retention and history policies.

Preserve authored formatting and native file types. Do not rewrite a document merely to normalize it, and do not use this directory as a dumping ground for terminal output, build artifacts, dependency archives, database dumps, application installers, or routine generated test results.

Git tracks files rather than empty directories. A new subdirectory is synchronized automatically when it contains an eligible file; use an intentional `.gitkeep` only when preserving an otherwise empty directory is genuinely necessary.
