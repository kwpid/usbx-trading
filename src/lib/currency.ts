export const SCRIPS_PER_TOKEN = 50;

export function tokensToScrips(tokens: number) {
  return Math.round(tokens * SCRIPS_PER_TOKEN);
}
