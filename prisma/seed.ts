import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";

const db = new PrismaClient();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const preset = process.argv[2] ?? process.env.DEV_PRESET ?? "awaiting-first-release";
const supportedPresets = new Set([
  "awaiting-first-release",
  "active-chapter",
  "mid-voyage",
  "artifact-award-ready",
  "side-quest-active",
  "nearly-complete-shell",
  "all-empty",
  "long-log",
  "mobile-stress-test",
]);

const statesByPreset: Record<string, string[]> = {
  "awaiting-first-release": ["LOCKED", "LOCKED", "LOCKED", "LOCKED", "LOCKED"],
  "all-empty": ["LOCKED", "LOCKED", "LOCKED", "LOCKED", "LOCKED"],
  "active-chapter": ["ACTIVE", "TEASER", "LOCKED", "LOCKED", "LOCKED"],
  "artifact-award-ready": ["COMPLETE", "ACTIVE", "TEASER", "LOCKED", "LOCKED"],
  "side-quest-active": ["COMPLETE", "ACTIVE", "READY", "LOCKED", "LOCKED"],
  "mid-voyage": ["COMPLETE", "ACTIVE", "TEASER", "LOCKED", "LOCKED"],
  "nearly-complete-shell": ["COMPLETE", "COMPLETE", "ACTIVE", "READY", "LOCKED"],
  "long-log": ["COMPLETE", "ACTIVE", "TEASER", "LOCKED", "LOCKED"],
  "mobile-stress-test": ["COMPLETE", "ACTIVE", "TEASER", "LOCKED", "LOCKED"],
};

async function main() {
  if (!supportedPresets.has(preset)) throw new Error(`Unknown development preset: ${preset}`);
  const gmUsername = process.env.GM_USERNAME ?? "kato";
  const gmPassword = process.env.GM_PASSWORD ?? "development-captain-only";
  const accessCode = process.env.PLAYER_ACCESS_CODE ?? "development-moonwake";
  const user = await db.gameMasterUser.upsert({
    where: { username: gmUsername },
    update: { passwordHash: await bcrypt.hash(gmPassword, 12) },
    create: { username: gmUsername, passwordHash: await bcrypt.hash(gmPassword, 12) },
  });

  const prior = await db.campaign.findUnique({ where: { slug: "development-forever-treasure" } });
  if (prior) await db.campaign.delete({ where: { id: prior.id } });
  await db.chapterContent.deleteMany({ where: { developmentOnly: true } });
  const expanded = !["awaiting-first-release", "all-empty"].includes(preset);
  const campaign = await db.campaign.create({
    data: {
      slug: "development-forever-treasure",
      title: "The Forever Treasure — Development Voyage",
      status: "ACTIVE",
      accessCodeHash: await bcrypt.hash(accessCode, 12),
      finaleState: expanded ? "REQUIREMENTS_PARTIAL" : "SEALED",
      finaleTeaser: expanded ? "A neutral arrangement of brass rings rests behind the final seal." : null,
      finaleRequirements: JSON.stringify([
        { key: "chapter-seals", label: "Voyage seals", current: expanded ? 1 : 0, target: 4 },
        { key: "relic-sockets", label: "Unmarked relic sockets", current: expanded ? 1 : 0, target: 3 },
        {
          key: "optional-stars",
          label: "Optional guiding stars",
          current: expanded ? 1 : 0,
          target: 3,
          optional: true,
        },
      ]),
    },
  });

  const chapters = [
    [
      "The Lantern Test",
      "A test lantern wakes over a fictional harbor, marking the beginning of this development voyage.",
      "Confirm the lantern mark on the practice chart.",
      "Where painted waves meet borrowed light, the practice lantern keeps its watch.",
      "The first practice page is complete.",
    ],
    [
      "The Cartographer’s Long Development Heading for Narrow Screens",
      "A deliberately long development narrative tests reading rhythm without containing any final Tall Tale story. The crew follows a harmless line of blue ink between invented islands.",
      "Trace the blue practice route to the current destination.",
      "Follow the ink that bends but never crosses the small brass moon.",
      "Fresh ink gathers at the page edge.",
    ],
    [
      "A Page of Salt",
      "A short development teaser waits behind a safe paper seal.",
      "Await the next safe release.",
      "This clue remains unavailable.",
      "A salt-marked page waits to be prepared.",
    ],
    [
      "Chapter IV",
      "Locked development content.",
      "Locked development objective.",
      "Locked development clue.",
      "The page remains sealed.",
    ],
    [
      "Chapter V",
      "Locked development content.",
      "Locked development objective.",
      "Locked development clue.",
      "No title has been entrusted to this page.",
    ],
  ] as const;
  for (let index = 0; index < chapters.length; index += 1) {
    const [title, narrative, objective, clue, safeTeaser] = chapters[index];
    const content = await db.chapterContent.create({ data: { title, narrative, objective, developmentOnly: true } });
    const state = statesByPreset[preset][index];
    await db.chapter.create({
      data: {
        campaignId: campaign.id,
        ordinal: index + 1,
        state,
        contentId: content.id,
        safeTeaser,
        relatedMapKey: index < 2 ? ["practice-harbor", "moonwake-cay"][index] : null,
        relatedArtifactKey: index < 2 ? ["brass-lantern-key", "blue-glass-token"][index] : null,
        revealedAt: ["ACTIVE", "SOLVED", "COMPLETE"].includes(state) ? new Date() : null,
        solvedAt: ["SOLVED", "COMPLETE"].includes(state) ? new Date() : null,
        clues: { create: { ordinal: 1, body: clue } },
        hints: {
          create: [
            {
              ordinal: 1,
              body: "A kind development hint points toward the lowest lantern.",
              releasedAt: index === 1 && expanded ? new Date() : null,
            },
            {
              ordinal: 2,
              body: "A second ordered hint mentions the blue practice mark.",
              releasedAt:
                index === 1 && ["long-log", "mobile-stress-test", "nearly-complete-shell"].includes(preset)
                  ? new Date()
                  : null,
            },
            { ordinal: 3, body: "This future hint must never leak before release." },
          ],
        },
      },
    });
  }

  const locations = [
    {
      key: "practice-harbor",
      name: "Practice Harbor",
      safeLabel: "A familiar harbor",
      regionLabel: "The Painted Reach",
      state: expanded ? "COMPLETED" : "UNKNOWN",
      x: 18,
      y: 68,
      chapterOrdinal: 1,
      description: "A completed fictional starting mark.",
    },
    {
      key: "moonwake-cay",
      name: "Moonwake Cay",
      safeLabel: "A moonlit destination",
      regionLabel: "The Painted Reach",
      state: expanded ? "ACTIVE_DESTINATION" : "UNKNOWN",
      x: 45,
      y: 42,
      chapterOrdinal: 2,
      description: "The active destination in this development preset.",
    },
    {
      key: "whisper-bank",
      name: "Whisper Bank",
      safeLabel: "A rumor beyond the shoals",
      regionLabel: "Hidden internal region",
      state: expanded ? "RUMORED" : "UNKNOWN",
      x: 72,
      y: 25,
      chapterOrdinal: 3,
    },
    {
      key: "hidden-test-rock",
      name: "Hidden Test Rock",
      safeLabel: null,
      regionLabel: "Never serialize",
      state: "UNKNOWN",
      x: 91,
      y: 8,
      chapterOrdinal: 4,
    },
    {
      key: "starling-inlet",
      name: "Starling Inlet",
      safeLabel: "An optional star-mark",
      regionLabel: "The Painted Reach",
      state: expanded ? "SIDE_QUEST" : "UNKNOWN",
      x: 67,
      y: 76,
      sideQuestKey: "borrowed-star",
      description: "An optional development-only marker.",
    },
  ];
  for (const location of locations)
    await db.mapLocation.create({
      data: {
        campaignId: campaign.id,
        locationType: location.sideQuestKey ? "SIDE_QUEST" : "STORY",
        exactness: location.state === "RUMORED" ? "REGION" : "EXACT",
        mobileX: location.x,
        mobileY: location.y,
        revealedAt: expanded && location.state !== "RUMORED" && location.state !== "UNKNOWN" ? new Date() : null,
        completedAt: location.state === "COMPLETED" ? new Date() : null,
        ...location,
      },
    });
  await db.mapRoute.createMany({
    data: [
      {
        campaignId: campaign.id,
        key: "harbor-to-cay",
        fromKey: "practice-harbor",
        toKey: "moonwake-cay",
        ordinal: 1,
        state: expanded ? "REVEALED" : "HIDDEN",
        annotation: "Development route one",
        revealedAt: expanded ? new Date() : null,
      },
      {
        campaignId: campaign.id,
        key: "cay-to-inlet",
        fromKey: "moonwake-cay",
        toKey: "starling-inlet",
        ordinal: 2,
        state: ["nearly-complete-shell", "long-log", "mobile-stress-test"].includes(preset) ? "REVEALED" : "HIDDEN",
        annotation: "Optional development route",
        revealedAt: ["nearly-complete-shell", "long-log", "mobile-stress-test"].includes(preset) ? new Date() : null,
      },
    ],
  });

  const artifacts = [
    {
      key: "brass-lantern-key",
      name: "Brass Lantern Key",
      safeName: "A narrow key",
      state: expanded ? "AWARDED" : "UNKNOWN",
      description: "A harmless development relic engraved with a practice wave.",
      discoveryText: "Recovered during the Lantern Test.",
      displayX: 18,
      displayY: 52,
      assemblyPosition: "west",
      connectedArtifactKey: "blue-glass-token",
      chapterOrdinal: 1,
    },
    {
      key: "blue-glass-token",
      name: "Blue Glass Token",
      safeName: "A round token",
      state: expanded ? "SILHOUETTE" : "UNKNOWN",
      description: "A neutral glass disk used only to test artifact relationships.",
      discoveryText: "Its edge matches the key’s practice groove.",
      displayX: 42,
      displayY: 35,
      assemblyPosition: "center",
      connectedArtifactKey: "brass-lantern-key",
      chapterOrdinal: 2,
    },
    {
      key: "folded-copper-mark",
      name: "Folded Copper Mark",
      safeName: "Unidentified copper shape",
      state: "UNKNOWN",
      description: "Hidden development artifact content.",
      discoveryText: null,
      displayX: 70,
      displayY: 58,
      assemblyPosition: "east",
      connectedArtifactKey: null,
      chapterOrdinal: 3,
    },
    {
      key: "practice-moon-shard",
      name: "Practice Moon Shard",
      safeName: "A pale fragment",
      state: expanded ? "AWARDED" : "UNKNOWN",
      description: "A development-only optional reward.",
      discoveryText: "Granted for following an optional star-mark.",
      displayX: 84,
      displayY: 28,
      assemblyPosition: "north",
      connectedArtifactKey: null,
      chapterOrdinal: null,
    },
    {
      key: "empty-assembly-position",
      name: "Reserved Development Position",
      safeName: null,
      state: "UNKNOWN",
      description: "This name must remain hidden.",
      discoveryText: null,
      displayX: 58,
      displayY: 78,
      assemblyPosition: "south",
      connectedArtifactKey: null,
      chapterOrdinal: null,
    },
  ];
  for (const artifact of artifacts) {
    const created = await db.artifact.create({
      data: {
        campaignId: campaign.id,
        category: "DEVELOPMENT_RELIC",
        silhouetteLabel: "A safe practice silhouette",
        assemblyGroup: "neutral-test-array",
        ...artifact,
      },
    });
    if (["AWARDED", "CONNECTED", "INSPECTED"].includes(artifact.state))
      await db.artifactAward.create({ data: { campaignId: campaign.id, artifactId: created.id } });
  }

  const questStates = expanded
    ? ["HIDDEN", "RUMORED", "ACTIVE", "COMPLETE"]
    : ["HIDDEN", "RUMORED", "HIDDEN", "HIDDEN"];
  const quests = [
    ["sleeping-rumor", "The Sleeping Rumor", "A rumor that remains fully hidden.", "HIDDEN"],
    ["bell-in-fog", "The Bell in the Fog", "A bell-shaped mark appears in the margin.", "RUMORED"],
    [
      "borrowed-star",
      "The Borrowed Star",
      "Follow the optional star marks without delaying the main voyage.",
      questStates[2],
    ],
    [
      "paper-constellation",
      "The Paper Constellation",
      "A completed development mystery about folded practice charts.",
      questStates[3],
    ],
  ] as const;
  for (const [key, title, description, state] of quests)
    await db.sideQuest.create({
      data: {
        campaignId: campaign.id,
        key,
        title,
        description,
        state,
        safeTeaser: state === "RUMORED" ? description : null,
        rewardType: "MEMORY_STAR",
        rewardLabel: state === "COMPLETE" ? "Development Star" : null,
        completionSummary: state === "COMPLETE" ? "The practice constellation now rests in the ledger." : null,
        mapLocationKey: key === "borrowed-star" ? "starling-inlet" : null,
        artifactKey: key === "borrowed-star" ? "practice-moon-shard" : null,
        completedAt: state === "COMPLETE" ? new Date() : null,
        objectives: {
          create: [
            { ordinal: 1, body: `Observe the first safe sign for ${title}.`, complete: state === "COMPLETE" },
            { ordinal: 2, body: "Record the optional development observation.", complete: state === "COMPLETE" },
          ],
        },
      },
    });

  if (expanded)
    await db.journalEntry.create({
      data: {
        campaignId: campaign.id,
        title: "Cartographer’s margin",
        body: "The blue ink is development-only and may be replaced without changing this component.",
        kind: "ANNOTATION",
        chapterOrdinal: 2,
        releasedAt: new Date(),
      },
    });
  const eventTemplates = expanded
    ? ([
        ["CAMPAIGN_STARTED", {}],
        ["CHAPTER_RELEASED", { ordinal: 1, title: chapters[0][0] }],
        ["MAP_LOCATION_REVEALED", { key: "practice-harbor", name: "Practice Harbor" }],
        ["ARTIFACT_AWARDED", { key: "brass-lantern-key", name: "Brass Lantern Key" }],
        ["CHAPTER_SOLVED", { ordinal: 1 }],
        ["CHAPTER_RELEASED", { ordinal: 2, title: chapters[1][0] }],
        ["MAP_LOCATION_REVEALED", { key: "moonwake-cay", name: "Moonwake Cay" }],
        ["MAP_ROUTE_REVEALED", { key: "harbor-to-cay", fromKey: "practice-harbor", toKey: "moonwake-cay" }],
        ["HINT_RELEASED", { ordinal: 2, hintOrdinal: 1 }],
        ["SIDE_QUEST_DISCOVERED", { key: "borrowed-star", title: "The Borrowed Star" }],
        [
          "SIDE_QUEST_COMPLETED",
          { key: "paper-constellation", title: "The Paper Constellation", rewardLabel: "Development Star" },
        ],
        ["FINALE_REQUIREMENT_UPDATED", { key: "chapter-seals" }],
      ] as Array<[string, Record<string, unknown>]>)
    : [];
  if (preset === "long-log" || preset === "mobile-stress-test")
    for (let i = 0; i < 80; i += 1)
      eventTemplates.push([
        i % 2 ? "PLAYER_LOG_ENTRY_ADDED" : "JOURNAL_ANNOTATION_ADDED",
        { key: `stress-${i}`, title: `Development stress entry ${i + 1}`, chapterOrdinal: 2 },
      ]);
  for (let index = 0; index < eventTemplates.length; index += 1) {
    const sequence = index + 1;
    const event = await db.progressEvent.create({
      data: {
        campaignId: campaign.id,
        type: eventTemplates[index][0],
        payload: JSON.stringify(eventTemplates[index][1]),
        actor: "development-seed",
        sequence,
      },
    });
    await db.campaignSnapshot.create({
      data: {
        campaignId: campaign.id,
        sequence,
        state: JSON.stringify({ eventType: event.type, payload: eventTemplates[index][1], developmentOnly: true }),
      },
    });
    await db.adminAuditLog.create({
      data: {
        campaignId: campaign.id,
        userId: user.id,
        action: "DEVELOPMENT_PRESET",
        metadata: JSON.stringify({ eventId: event.id, preset }),
      },
    });
  }
  await db.campaign.update({ where: { id: campaign.id }, data: { currentSequence: eventTemplates.length } });

  const playerToken = randomBytes(24).toString("base64url");
  await db.playerAccess.create({
    data: { campaignId: campaign.id, tokenHash: hash(playerToken), label: "Development player" },
  });
  await db.contentVersion.upsert({
    where: { key_version: { key: `development-companion-${preset}`, version: 1 } },
    update: { checksum: hash(JSON.stringify(chapters)) },
    create: { key: `development-companion-${preset}`, version: 1, checksum: hash(JSON.stringify(chapters)) },
  });

  // Additive migration of the generic development voyage into the Studio model.
  // The original Campaign remains untouched and playable at its established URL.
  const priorStudioTale = await db.tallTale.findUnique({ where: { slug: "development-studio-voyage" } });
  if (priorStudioTale) await db.tallTale.delete({ where: { id: priorStudioTale.id } });
  const studioTale = await db.tallTale.create({
    data: {
      slug: "development-studio-voyage",
      title: "The Forever Treasure — Studio Development Voyage",
      subtitle: "A safe editable migration of the existing development tale",
      shortDescription: "A generic published voyage used to verify Studio, Player, and Captain integration.",
      longDescription:
        "This development-only tale mirrors the existing lantern and cartography progression without containing private or final story material.",
      theme: "CARTOGRAPHERS_TABLE",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      creatorId: user.id,
      playerCountMin: 1,
      playerCountMax: 4,
      estimatedDuration: 25,
      featured: true,
    },
  });
  const studioDraft = await db.taleDraft.create({
    data: {
      taleId: studioTale.id,
      createdBy: user.id,
      validationState: "VALID",
      validationSummary: JSON.stringify({ valid: true, errors: [], warnings: [], migratedFrom: campaign.slug }),
    },
  });
  const studioChapterIds = [randomUUID(), randomUUID()];
  const studioBlockIds = Array.from({ length: 7 }, () => randomUUID());
  await db.taleChapter.create({
    data: {
      id: studioChapterIds[0],
      draftRevisionId: studioDraft.id,
      title: chapters[0][0],
      description: chapters[0][1],
      orderIndex: 0,
      entryBlockId: studioBlockIds[0],
      completionBlockId: studioBlockIds[3],
      estimatedDuration: 12,
      blocks: {
        create: [
          {
            id: studioBlockIds[0],
            blockType: "narrative",
            title: "The Lantern Wakes",
            orderIndex: 0,
            configuration: JSON.stringify({
              heading: chapters[0][0],
              body: chapters[0][1],
              entranceAnimation: "ink",
              completionMode: "playerConfirmation",
            }),
            nextBlockId: studioBlockIds[1],
          },
          {
            id: studioBlockIds[1],
            blockType: "riddle",
            title: "The Practice Lantern",
            orderIndex: 1,
            configuration: JSON.stringify({
              riddleTitle: "A painted-light riddle",
              riddleText: chapters[0][3],
              acceptedAnswers: ["lantern"],
              caseSensitive: false,
              normalizeWhitespace: true,
              wrongAnswerFeedback: "Look again toward the lowest practice light.",
              completionMode: "textAnswer",
            }),
            nextBlockId: studioBlockIds[2],
          },
          {
            id: studioBlockIds[2],
            blockType: "captainApproval",
            title: "Captain Confirms the Mark",
            orderIndex: 2,
            configuration: JSON.stringify({
              waitingText: "The Captain is checking the practice chart.",
              captainInstruction: "Approve after the lantern mark is confirmed.",
              allowRetry: true,
              completionMode: "captainManual",
            }),
            nextBlockId: studioBlockIds[3],
          },
          {
            id: studioBlockIds[3],
            blockType: "chapterComplete",
            title: "Lantern Chapter Complete",
            orderIndex: 3,
            configuration: JSON.stringify({
              completionMessage: "The Lantern Test is complete.",
              summary: chapters[0][4],
              animation: "seal",
              completionMode: "playerConfirmation",
            }),
            nextBlockId: studioBlockIds[4],
          },
        ],
      },
    },
  });
  await db.taleChapter.create({
    data: {
      id: studioChapterIds[1],
      draftRevisionId: studioDraft.id,
      title: chapters[1][0],
      description: chapters[1][1],
      orderIndex: 1,
      entryBlockId: studioBlockIds[4],
      completionBlockId: studioBlockIds[6],
      estimatedDuration: 13,
      blocks: {
        create: [
          {
            id: studioBlockIds[4],
            blockType: "travelDirection",
            title: "Follow the Blue Ink",
            orderIndex: 0,
            configuration: JSON.stringify({
              heading: "Set a practice course",
              directionText: chapters[1][2],
              region: "The Painted Reach",
              completionMode: "playerConfirmation",
            }),
            nextBlockId: studioBlockIds[5],
          },
          {
            id: studioBlockIds[5],
            blockType: "confirmation",
            title: "Confirm the Destination",
            orderIndex: 1,
            configuration: JSON.stringify({
              prompt: "Has the crew reached the blue practice mark?",
              primaryLabel: "We have arrived",
              captainOverride: true,
              completionMode: "playerConfirmation",
            }),
            nextBlockId: studioBlockIds[6],
          },
          {
            id: studioBlockIds[6],
            blockType: "taleComplete",
            title: "Development Voyage Complete",
            orderIndex: 2,
            configuration: JSON.stringify({
              finaleHeading: "The practice chart is complete",
              finaleContent:
                "The lantern, riddle, Captain approval, and version-pinned runtime have all followed one authoritative story model.",
              completionMessage: "This development voyage is safely complete.",
              replayAvailable: true,
              completionMode: "playerConfirmation",
            }),
          },
        ],
      },
    },
  });
  for (let index = 0; index < studioBlockIds.length - 1; index += 1) {
    await db.blockConnection.create({
      data: {
        sourceBlockId: studioBlockIds[index],
        targetBlockId: studioBlockIds[index + 1],
        connectionType: "DEFAULT",
      },
    });
  }
  const publishedAt = new Date();
  const contentSnapshot = JSON.stringify({
    schemaVersion: 1,
    tale: {
      id: studioTale.id,
      slug: studioTale.slug,
      title: studioTale.title,
      subtitle: studioTale.subtitle,
      shortDescription: studioTale.shortDescription,
      longDescription: studioTale.longDescription,
      coverAssetId: null,
      theme: studioTale.theme,
      visibility: studioTale.visibility,
      playerCountMin: studioTale.playerCountMin,
      playerCountMax: studioTale.playerCountMax,
      estimatedDuration: studioTale.estimatedDuration,
      contentWarnings: null,
    },
    chapters: [
      {
        id: studioChapterIds[0],
        title: chapters[0][0],
        subtitle: null,
        description: chapters[0][1],
        coverAssetId: null,
        estimatedDuration: 12,
        isOptional: false,
        metadata: {},
        orderIndex: 0,
        entryBlockId: studioBlockIds[0],
        completionBlockId: studioBlockIds[3],
        blocks: [
          {
            id: studioBlockIds[0],
            chapterId: studioChapterIds[0],
            blockType: "narrative",
            title: "The Lantern Wakes",
            internalLabel: null,
            configuration: {
              heading: chapters[0][0],
              body: chapters[0][1],
              entranceAnimation: "ink",
              completionMode: "playerConfirmation",
            },
            presentation: {},
            completion: {},
            creatorNotes: null,
            isEnabled: true,
            schemaVersion: 1,
            orderIndex: 0,
            nextBlockId: studioBlockIds[1],
            connections: [{ targetBlockId: studioBlockIds[1], connectionType: "DEFAULT", orderIndex: 0 }],
          },
          {
            id: studioBlockIds[1],
            chapterId: studioChapterIds[0],
            blockType: "riddle",
            title: "The Practice Lantern",
            internalLabel: null,
            configuration: {
              riddleTitle: "A painted-light riddle",
              riddleText: chapters[0][3],
              acceptedAnswers: ["lantern"],
              caseSensitive: false,
              normalizeWhitespace: true,
              wrongAnswerFeedback: "Look again toward the lowest practice light.",
              completionMode: "textAnswer",
            },
            presentation: {},
            completion: {},
            creatorNotes: null,
            isEnabled: true,
            schemaVersion: 1,
            orderIndex: 1,
            nextBlockId: studioBlockIds[2],
            connections: [{ targetBlockId: studioBlockIds[2], connectionType: "DEFAULT", orderIndex: 0 }],
          },
          {
            id: studioBlockIds[2],
            chapterId: studioChapterIds[0],
            blockType: "captainApproval",
            title: "Captain Confirms the Mark",
            internalLabel: null,
            configuration: {
              waitingText: "The Captain is checking the practice chart.",
              captainInstruction: "Approve after the lantern mark is confirmed.",
              allowRetry: true,
              completionMode: "captainManual",
            },
            presentation: {},
            completion: {},
            creatorNotes: null,
            isEnabled: true,
            schemaVersion: 1,
            orderIndex: 2,
            nextBlockId: studioBlockIds[3],
            connections: [{ targetBlockId: studioBlockIds[3], connectionType: "DEFAULT", orderIndex: 0 }],
          },
          {
            id: studioBlockIds[3],
            chapterId: studioChapterIds[0],
            blockType: "chapterComplete",
            title: "Lantern Chapter Complete",
            internalLabel: null,
            configuration: {
              completionMessage: "The Lantern Test is complete.",
              summary: chapters[0][4],
              animation: "seal",
              completionMode: "playerConfirmation",
            },
            presentation: {},
            completion: {},
            creatorNotes: null,
            isEnabled: true,
            schemaVersion: 1,
            orderIndex: 3,
            nextBlockId: studioBlockIds[4],
            connections: [{ targetBlockId: studioBlockIds[4], connectionType: "DEFAULT", orderIndex: 0 }],
          },
        ],
      },
      {
        id: studioChapterIds[1],
        title: chapters[1][0],
        subtitle: null,
        description: chapters[1][1],
        coverAssetId: null,
        estimatedDuration: 13,
        isOptional: false,
        metadata: {},
        orderIndex: 1,
        entryBlockId: studioBlockIds[4],
        completionBlockId: studioBlockIds[6],
        blocks: [
          {
            id: studioBlockIds[4],
            chapterId: studioChapterIds[1],
            blockType: "travelDirection",
            title: "Follow the Blue Ink",
            internalLabel: null,
            configuration: {
              heading: "Set a practice course",
              directionText: chapters[1][2],
              region: "The Painted Reach",
              completionMode: "playerConfirmation",
            },
            presentation: {},
            completion: {},
            creatorNotes: null,
            isEnabled: true,
            schemaVersion: 1,
            orderIndex: 0,
            nextBlockId: studioBlockIds[5],
            connections: [{ targetBlockId: studioBlockIds[5], connectionType: "DEFAULT", orderIndex: 0 }],
          },
          {
            id: studioBlockIds[5],
            chapterId: studioChapterIds[1],
            blockType: "confirmation",
            title: "Confirm the Destination",
            internalLabel: null,
            configuration: {
              prompt: "Has the crew reached the blue practice mark?",
              primaryLabel: "We have arrived",
              captainOverride: true,
              completionMode: "playerConfirmation",
            },
            presentation: {},
            completion: {},
            creatorNotes: null,
            isEnabled: true,
            schemaVersion: 1,
            orderIndex: 1,
            nextBlockId: studioBlockIds[6],
            connections: [{ targetBlockId: studioBlockIds[6], connectionType: "DEFAULT", orderIndex: 0 }],
          },
          {
            id: studioBlockIds[6],
            chapterId: studioChapterIds[1],
            blockType: "taleComplete",
            title: "Development Voyage Complete",
            internalLabel: null,
            configuration: {
              finaleHeading: "The practice chart is complete",
              finaleContent:
                "The lantern, riddle, Captain approval, and version-pinned runtime have all followed one authoritative story model.",
              completionMessage: "This development voyage is safely complete.",
              replayAvailable: true,
              completionMode: "playerConfirmation",
            },
            presentation: {},
            completion: {},
            creatorNotes: null,
            isEnabled: true,
            schemaVersion: 1,
            orderIndex: 2,
            nextBlockId: null,
            connections: [],
          },
        ],
      },
    ],
    assets: [],
    locations: [],
    artifacts: [],
    publishedAt: publishedAt.toISOString(),
  });
  const studioVersion = await db.publishedTaleVersion.create({
    data: {
      taleId: studioTale.id,
      versionNumber: 1,
      versionLabel: "1.0",
      publishedBy: user.id,
      releaseNotes: "Automated migration of the generic development voyage.",
      contentSnapshot,
      checksum: hash(contentSnapshot),
      publishedAt,
      isCurrent: true,
    },
  });
  await db.tallTale.update({
    where: { id: studioTale.id },
    data: { currentDraftRevisionId: studioDraft.id, latestPublishedVersionId: studioVersion.id },
  });
  console.log(
    `Development preset '${preset}' ready for ${campaign.slug}; GM user: ${user.username}. Credentials come from local environment values.`,
  );
}

main().finally(() => db.$disconnect());
