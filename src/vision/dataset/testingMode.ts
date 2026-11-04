export function isDatasetTestingMode(search = globalThis.location?.search ?? ""): boolean {
  return new URLSearchParams(search).get("dataset") === "1";
}

type RandomSource = Pick<Crypto, "randomUUID"> & Partial<Pick<Crypto, "getRandomValues">>;

export function createDatasetSessionGroupId(
  random: Partial<RandomSource> = globalThis.crypto,
  fallbackRandom = Math.random,
): string {
  if (random.randomUUID) return random.randomUUID();
  if (random.getRandomValues) {
    const bytes = random.getRandomValues(new Uint8Array(16));
    return `dataset-${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  return `dataset-${fallbackRandom().toString(36).slice(2)}-${fallbackRandom().toString(36).slice(2)}`;
}
