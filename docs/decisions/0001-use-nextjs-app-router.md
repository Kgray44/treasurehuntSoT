# ADR 0001: Next.js App Router

Date: 2026-07-16 · Status: accepted

Context: the companion needs server-protected content, responsive React UI, and Debian self-hosting. Decision: Next.js App Router with strict TypeScript and Node runtime. Alternatives: SPA/API split and Remix. Consequences: cohesive authorization/data boundaries and one deployable service, with framework runtime discipline required.
