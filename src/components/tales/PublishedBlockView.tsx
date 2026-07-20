"use client";

/* eslint-disable @next/next/no-img-element -- Version-bound media is served by the application's authorized asset endpoint. */
import { useState } from "react";
import { errorCopy } from "@/language/error-copy";
import { playerCopy } from "@/language/player-copy";
import type { JsonObject } from "@/tall-tale/types";

type PlayerBlock = { id: string; blockType: string; title: string; configuration: JsonObject };
type PlayerAsset = { id: string; displayName: string; url: string };

const value = (config: JsonObject, key: string) => (typeof config[key] === "string" ? (config[key] as string) : "");

export function PublishedBlockView({ block, assets }: { block: PlayerBlock; assets: PlayerAsset[] }) {
  const [replay, setReplay] = useState(0);
  const asset = (id: unknown) => assets.find((item) => item.id === id)?.url;
  const config = block.configuration;
  if (block.blockType === "image")
    return (
      <article className={`runtime-block image-block mode-${value(config, "displayMode")}`}>
        <img
          src={asset(config.assetId)}
          alt={value(config, "altText")}
          style={{ objectPosition: `${Number(config.focalX ?? 50)}% ${Number(config.focalY ?? 50)}%` }}
        />
        {Boolean(config.caption) && <p>{value(config, "caption")}</p>}
      </article>
    );
  if (block.blockType === "imageTransformation" || block.blockType === "hiddenMessageReveal") {
    const before = asset(config.beforeAssetId ?? config.baseAssetId);
    const after = asset(config.afterAssetId ?? config.revealedAssetId);
    const alignment = config.alignment && typeof config.alignment === "object" ? (config.alignment as JsonObject) : {};
    return (
      <article
        className={`runtime-block transformation preset-${value(config, "transitionPreset") || value(config, "revealStyle")}`}
        key={replay}
        style={
          {
            "--transform-duration": `${Number(config.duration ?? 3000)}ms`,
            "--after-transform": `translate(${Number(alignment.x ?? 0)}px, ${Number(alignment.y ?? 0)}px) scale(${Number(alignment.scale ?? 1)}) rotate(${Number(alignment.rotation ?? 0)}deg)`,
          } as React.CSSProperties
        }
      >
        {before && <img className="before" src={before} alt="Before transformation" />}
        {after && (
          <img
            className="after"
            src={after}
            alt={value(config, "caption") || value(config, "messageText") || "Revealed image"}
          />
        )}
        {Boolean(config.caption || config.messageText) && (
          <p>{value(config, "caption") || value(config, "messageText")}</p>
        )}
        <button onClick={() => setReplay((item) => item + 1)}>{playerCopy.replayPresentation.value}</button>
      </article>
    );
  }
  if (block.blockType === "cinematic")
    return (
      <article className="runtime-block media-block">
        <video controls autoPlay={Boolean(config.autoplay)} poster={asset(config.posterAssetId)}>
          <source src={asset(config.videoAssetId)} />
        </video>
        <p>If playback does not begin automatically, use the player controls.</p>
      </article>
    );
  if (block.blockType === "audio")
    return (
      <article className="runtime-block media-block">
        <h2>{value(config, "title") || block.title}</h2>
        <audio controls loop={Boolean(config.loop)} src={asset(config.audioAssetId)} />
        {Boolean(config.transcript) && (
          <details>
            <summary>Transcript</summary>
            <p>{value(config, "transcript")}</p>
          </details>
        )}
      </article>
    );
  if (block.blockType === "artifactReveal" || block.blockType === "collectionUpdate")
    return (
      <article className="runtime-block artifact-block">
        {asset(config.revealArtworkId) && <img src={asset(config.revealArtworkId)} alt="" />}
        <span aria-hidden="true">✦</span>
        <p className="eyebrow">{playerCopy.artifactRecovered.value}</p>
        <h2>{value(config, "loreTitle") || value(config, "progressLabel") || block.title}</h2>
        <p>{value(config, "loreDescription")}</p>
      </article>
    );
  if (block.blockType === "captainsNote")
    return (
      <article className="runtime-block captains-note">
        <p className="eyebrow">A page from the Captain</p>
        <h2>{value(config, "title") || block.title}</h2>
        <div className="rich-copy">
          {value(config, "body")
            .split("\n")
            .map((line, index) => (
              <p key={index}>{line}</p>
            ))}
        </div>
        <footer>{value(config, "signature")}</footer>
      </article>
    );
  if (block.blockType === "travelDirection" || block.blockType === "location" || block.blockType === "arrivalCheck")
    return (
      <article className="runtime-block direction-block">
        <span aria-hidden="true">⌖</span>
        <p className="eyebrow">Set a course</p>
        <h2>{value(config, "heading") || value(config, "playerTitle") || block.title}</h2>
        <p>{value(config, "directionText") || value(config, "playerDescription") || value(config, "prompt")}</p>
        {asset(config.mapAssetId) && <img src={asset(config.mapAssetId)} alt="Voyage map" />}
      </article>
    );
  if (block.blockType === "taleComplete" || block.blockType === "chapterComplete")
    return (
      <article className="runtime-block completion-block">
        <span aria-hidden="true">★</span>
        <p className="eyebrow">{block.blockType === "taleComplete" ? "Voyage complete" : "Chapter complete"}</p>
        <h2>{value(config, "finaleHeading") || value(config, "completionMessage") || block.title}</h2>
        <p>{value(config, "finaleContent") || value(config, "summary") || value(config, "completionMessage")}</p>
        {Boolean(config.credits) && <footer>{value(config, "credits")}</footer>}
      </article>
    );
  if (
    ["narrative", "information", "riddle", "textAnswer", "confirmation", "choice", "captainApproval", "wait"].includes(
      block.blockType,
    )
  )
    return (
      <article className={`runtime-block prose-block type-${block.blockType}`}>
        <p className="eyebrow">{value(config, "narratorLabel") || block.title}</p>
        <h2>{value(config, "heading") || value(config, "riddleTitle") || block.title}</h2>
        <div className="rich-copy">
          {(
            value(config, "body") ||
            value(config, "riddleText") ||
            value(config, "prompt") ||
            value(config, "waitingText")
          )
            .split("\n")
            .map((line, index) => (
              <p key={index}>{line}</p>
            ))}
        </div>
      </article>
    );
  return (
    <article className="runtime-block unknown-block" role="alert">
      <h2>{errorCopy.newerVersionRequired.value}</h2>
      <p>
        This Passage type (<code>{block.blockType}</code>) is not supported. {errorCopy.newerVersionRequiredDetail.value}
      </p>
    </article>
  );
}
