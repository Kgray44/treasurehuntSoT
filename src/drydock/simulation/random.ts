export const DRYDOCK_RANDOM_VERSION = "seeded-random-v1";

export type DrydockSeededRandom = Readonly<{
  version: typeof DRYDOCK_RANDOM_VERSION;
  seed: string;
  state: number;
  draws: number;
}>;

function seedToUint32(seed: string) {
  if (!seed || new TextEncoder().encode(seed).byteLength > 256)
    throw new Error("Drydock random seed must be between 1 and 256 UTF-8 bytes.");
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(seed)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash || 0x6d2b79f5;
}

export function createDrydockSeededRandom(seed: string): DrydockSeededRandom {
  return { version: DRYDOCK_RANDOM_VERSION, seed, state: seedToUint32(seed), draws: 0 };
}

export function drawDrydockRandom(random: DrydockSeededRandom): Readonly<{
  value: number;
  next: DrydockSeededRandom;
}> {
  let state = random.state >>> 0;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  state >>>= 0;
  return {
    value: state / 0x1_0000_0000,
    next: { ...random, state, draws: random.draws + 1 },
  };
}
