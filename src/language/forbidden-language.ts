import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type LanguageException = Readonly<{
  pattern: string;
  file: string;
  reason: string;
  owner: string;
  reviewDate: string;
}>;

export type LanguageViolation = Readonly<{
  file: string;
  line: number;
  pattern: string;
  excerpt: string;
}>;

type ForbiddenPattern = Readonly<{ name: string; expression: RegExp }>;

const forbiddenPatterns: readonly ForbiddenPattern[] = [
  { name: "Tall Tale", expression: /\bTall Tales?\b/iu },
  { name: "campaign", expression: /\bcampaigns?\b/iu },
  { name: "game session", expression: /\bgame sessions?\b/iu },
  { name: "game master", expression: /\bgame masters?\b/iu },
  { name: "GM dashboard", expression: /\bGM dashboard\b/iu },
  { name: "admin dashboard", expression: /\badmin dashboard\b/iu },
  { name: "quest editor", expression: /\bquest editor\b/iu },
  { name: "story block", expression: /\bstory blocks?\b/iu },
  { name: "content block", expression: /\bcontent blocks?\b/iu },
  { name: "active session", expression: /\bactive sessions?\b/iu },
  { name: "campaign library", expression: /\bcampaign library\b/iu },
  { name: "campaign history", expression: /\bcampaign history\b/iu },
  { name: "start campaign", expression: /\bstart campaign\b/iu },
  { name: "run campaign", expression: /\brun campaign\b/iu },
  { name: "play campaign", expression: /\bplay campaign\b/iu },
  { name: "mission builder", expression: /\bmission builder\b/iu },
  { name: "scenario editor", expression: /\bscenario editor\b/iu },
  { name: "operator dashboard", expression: /\boperator dashboard\b/iu },
  { name: "Something went wrong", expression: /\bsomething went wrong\b/iu },
  { name: "Unknown error", expression: /\bunknown error\b/iu },
  { name: "Invalid input", expression: /\binvalid input\b/iu },
  { name: "Operation failed", expression: /\boperation failed\b/iu },
  { name: "Request failed", expression: /\brequest failed\b/iu },
];

const supportedExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const ignoredPathPart = /(?:^|\/)(?:node_modules|\.next|Codex_Chats|Development_Docs)(?:\/|$)/u;
const ignoredFile = /(?:^|\.)(?:test|spec)\.[cm]?[jt]sx?$/u;

/**
 * No product-copy exception is currently approved. The validator supports a narrow, review-dated exception entry
 * for future historical imports or externally mandated wording without turning the registry into a blanket bypass.
 */
export const approvedLanguageExceptions: readonly LanguageException[] = [];

function normalizeRelative(file: string) {
  return file.replaceAll("\\", "/");
}

function isLikelyProductCopy(line: string) {
  return /(?:>|<|aria-|\b(?:label|title|detail|description|message|placeholder|error|heading|summary|empty|loading)\b|throw new Error|NextResponse\.json)/iu.test(
    line,
  );
}

function isAllowed(violation: LanguageViolation, exceptions: readonly LanguageException[]) {
  return exceptions.some(
    (exception) =>
      exception.file === violation.file &&
      exception.pattern === violation.pattern &&
      Boolean(exception.reason) &&
      Boolean(exception.owner) &&
      /^\d{4}-\d{2}-\d{2}$/u.test(exception.reviewDate),
  );
}

export function scanLanguageText(
  text: string,
  file: string,
  exceptions: readonly LanguageException[] = approvedLanguageExceptions,
): LanguageViolation[] {
  const normalizedFile = normalizeRelative(file);
  const violations: LanguageViolation[] = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (!isLikelyProductCopy(line)) continue;
    for (const pattern of forbiddenPatterns) {
      if (!pattern.expression.test(line)) continue;
      const violation: LanguageViolation = {
        file: normalizedFile,
        line: index + 1,
        pattern: pattern.name,
        excerpt: line.trim().slice(0, 180),
      };
      if (!isAllowed(violation, exceptions)) violations.push(violation);
    }
  }
  return violations;
}

async function collectFiles(directory: string, root: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    const relative = normalizeRelative(path.relative(root, absolute));
    if (ignoredPathPart.test(relative)) continue;
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolute, root)));
      continue;
    }
    if (entry.isFile() && supportedExtensions.has(path.extname(entry.name)) && !ignoredFile.test(entry.name)) {
      files.push(absolute);
    }
  }
  return files;
}

export async function scanProductionLanguage(
  repositoryRoot: string,
  exceptions: readonly LanguageException[] = approvedLanguageExceptions,
): Promise<LanguageViolation[]> {
  const roots = ["src/app", "src/components", "src/platform"];
  const violations: LanguageViolation[] = [];
  for (const relativeRoot of roots) {
    const absoluteRoot = path.join(repositoryRoot, relativeRoot);
    for (const absoluteFile of await collectFiles(absoluteRoot, repositoryRoot)) {
      const relativeFile = normalizeRelative(path.relative(repositoryRoot, absoluteFile));
      violations.push(...scanLanguageText(await readFile(absoluteFile, "utf8"), relativeFile, exceptions));
    }
  }
  return violations;
}

export function formatLanguageViolations(violations: readonly LanguageViolation[]) {
  return violations
    .map(({ file, line, pattern, excerpt }) => `${file}:${line}: prohibited ${pattern}: ${excerpt}`)
    .join("\n");
}
