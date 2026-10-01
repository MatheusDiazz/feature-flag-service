export interface FlagConfig {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
}

export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function bucket(flagKey: string, userId: string): number {
  return fnv1a(`${flagKey}:${userId}`) % 100;
}

export function evaluate(flag: FlagConfig, userId: string): boolean {
  if (!flag.enabled) return false;
  return bucket(flag.key, userId) < flag.rolloutPercentage;
}