export const passwordStrengthLevels = ["TOO_WEAK", "WEAK", "GOOD", "STRONG"] as const;

export type PasswordStrengthLevel = (typeof passwordStrengthLevels)[number];

export type PasswordAssessment = Readonly<{
  level: PasswordStrengthLevel;
  label: "Too weak" | "Weak" | "Good" | "Strong";
  acceptable: boolean;
  message: string;
}>;

const commonPasswords = new Set([
  "123456789012",
  "adminadminadmin",
  "letmeinletmein",
  "password1234",
  "qwertyqwerty",
  "welcome12345",
]);

function comparable(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function identityTerms(email?: string, displayName?: string) {
  const localPart = email?.split("@", 1)[0] ?? "";
  return [localPart, ...(displayName?.split(/\s+/u) ?? [])].map(comparable).filter((term) => term.length >= 4);
}

export function assessPassword(
  password: string,
  identity: { email?: string; displayName?: string } = {},
): PasswordAssessment {
  const normalized = password.normalize("NFKC");
  const compact = comparable(normalized);
  if (normalized.length > 256)
    return {
      level: "TOO_WEAK",
      label: "Too weak",
      acceptable: false,
      message: "Use no more than 256 characters.",
    };
  if (normalized.length < 12 || !/\S/u.test(normalized))
    return {
      level: "TOO_WEAK",
      label: "Too weak",
      acceptable: false,
      message: "Use at least 12 characters.",
    };
  if (commonPasswords.has(compact) || /^(.)\1{11,}$/u.test(normalized))
    return {
      level: "TOO_WEAK",
      label: "Too weak",
      acceptable: false,
      message: "Choose a password that is not commonly used.",
    };
  if (identityTerms(identity.email, identity.displayName).some((term) => compact.includes(term)))
    return {
      level: "TOO_WEAK",
      label: "Too weak",
      acceptable: false,
      message: "Choose a password that does not contain your email or display name.",
    };

  let score = 1;
  if (normalized.length >= 16) score += 1;
  if (normalized.length >= 24) score += 1;
  const characterGroups = [/[a-z]/u, /[A-Z]/u, /\d/u, /[^\p{L}\p{N}\s]/u].filter((pattern) =>
    pattern.test(normalized),
  ).length;
  const phraseSegments = normalized
    .trim()
    .split(/[\s_-]+/u)
    .filter(Boolean).length;
  if (characterGroups >= 3 || phraseSegments >= 3 || new Set(normalized).size >= 10) score += 1;

  if (score <= 1)
    return {
      level: "TOO_WEAK",
      label: "Too weak",
      acceptable: false,
      message: "Make this password longer or less predictable.",
    };
  if (score === 2)
    return {
      level: "WEAK",
      label: "Weak",
      acceptable: false,
      message: "Add length or use a less predictable passphrase.",
    };
  if (score === 3)
    return { level: "GOOD", label: "Good", acceptable: true, message: "This password meets the account policy." };
  return {
    level: "STRONG",
    label: "Strong",
    acceptable: true,
    message: "This password meets the account policy.",
  };
}
