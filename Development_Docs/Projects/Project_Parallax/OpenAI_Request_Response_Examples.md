---
title: Parallax OpenAI request and response examples
audience: product-engineering
status: reference-example
canonical_for: parallax-openai-request-response-examples
last_reviewed: 2026-10-13
---

# OpenAI request and response examples

Open the [interactive examples](reference/openai-request-response-examples/examples.html)
to inspect complete request bodies, instructions, strict output schemas and
structured responses for room reconstruction and ordinary Spatial Assistant edits.
The request examples come from the server-side builders at this documentation checkpoint. They are examples,
not fresh inference calls or proof of reconstruction quality.
The continuing provider adds an OUT_OF_SCOPE classification for unrelated chat;
the server replaces classified off-topic text and operations with a fixed Studio
redirect. Proposed-action wording now asks for affirmative future tense. These
later changes do not rewrite the retained historical result shown here.

## Provenance and privacy

The room response is a **wholly synthetic, schema-valid documentation fixture**.
It replaces the owner-derived room observation from the private review page. Its
geometry does not describe an actual person's room. Image bytes are placeholders;
opaque image identities and derivative dimensions are illustrative. No photographs,
EXIF, private room layout, private text, user identities or Windows paths are included.

The ordinary Assistant result is a retained actual Luna result for the public
synthetic `relative-left` evaluation case. It has no private clue content. Its
request example uses the newer current instructions/schema; this is not a fresh
replay. Historical full provider envelopes were not retained. The displayed result
is the schema-parsed model JSON, not a verbatim complete HTTP response.

No API keys, authorization headers, cookies, login credentials, consent grants or
storage locations are published. The HTML contains static text, local JSON links
and official documentation links; it does not execute API requests. Review future
example changes with the same boundary. The original private review artifacts
remain separate from this documentation copy.

## Data flow

Both adapters use the server-side Responses endpoint. The credential is read only
from `process.env.OPENAI_API_KEY`; it is absent from these bodies and the browser.
Room requests contain protected WebP image derivatives, reconstruction instructions
and optional existing-room evidence. Regular Assistant requests contain the Creator
instruction and bounded canonical scene context, including selected members and
named groups; they do not include photographs or omitted private clue text.

The API puts structured model JSON inside an `output_text` message in its `output`
array, alongside provider status and usage. Voyagewright validates that content.
Parallax builds and verifies room geometry from observations; Assistant operations
are validated against canonical scene state. Both flows preview changes before
reviewed Apply. App-generated proposal identities, revisions and digests are not
model-generated geometry or OpenAI response fields.

The example photo configuration uses Sol and the live study's 8,000 output-token
ceiling. The ordinary configured default is 4,000. The Assistant example uses Luna
with low reasoning. These are source-bound examples; effective Admiralty policy
remains authoritative. Image inputs, and expanded Assistant context when necessary,
are checked by the input-count endpoint before paid generation.

## Supporting files and classification

This Markdown file is a current human engineering reference. The supporting HTML
and JSON files are static documentation examples, not qualification receipts or
private evidence:

- [Room request, image bytes omitted](reference/openai-request-response-examples/room-request.redacted.json)
- [Synthetic room response](reference/openai-request-response-examples/room-response.synthetic.json)
- [Assistant request](reference/openai-request-response-examples/assistant-request.json)
- [Actual parsed synthetic Assistant result](reference/openai-request-response-examples/assistant-response.actual-synthetic.json)
- [Source and example provenance](reference/openai-request-response-examples/provenance.json)

Implementation: `src/watchglass/room-perception.ts`,
`src/watchglass/room-observation.ts`, `src/parallax/openai-provider.ts`,
`src/parallax/spatial-assistant.ts` and `src/parallax/spatial-assistant-service.ts`.
API conventions are described by the official [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
and [Input counting](https://developers.openai.com/api/docs/guides/token-counting)
documentation.
