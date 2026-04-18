import type { Profile } from "../types";

export interface MatchReason {
  kind: "they-offer" | "they-seek" | "shared-challenge" | "partner-type";
  tags: string[];
}

export interface Match {
  profile: Profile;
  score: number;
  reasons: MatchReason[];
  theyOffer: string[];   // focus.seeking ∩ candidate.offerings
  theySeek: string[];    // focus.offerings ∩ candidate.seeking
  sharedChallenges: string[];
}

const W_OFFER_MATCH = 3;
const W_SEEK_MATCH = 3;
const W_CHALLENGE = 1;
const W_PARTNER_TYPE = 0.5;

function intersect(a: string[], b: string[] | undefined): string[] {
  if (!b || b.length === 0) return [];
  const bs = new Set(b);
  return a.filter((x) => bs.has(x));
}

/**
 * Rank candidates by partnership fit with `focus`.
 *
 *   score = 3·|focus.seek ∩ candidate.offer|
 *         + 3·|focus.offer ∩ candidate.seek|
 *         + 1·|focus.challenges ∩ candidate.challenges|
 *         + 0.5·(candidate.affiliation matches focus.partnerTypeSeeking)
 *
 * Only candidates with score > 0 are returned, sorted descending.
 */
export function findMatches(focus: Profile, all: Profile[], limit = 20): Match[] {
  const focusOffer = focus.offerings?.tags ?? [];
  const focusSeek = focus.seeking?.tags ?? [];
  const focusChallenges = focus.challengeAreas;
  const focusPartnerTypes = new Set(focus.partnerTypeSeeking);

  const matches: Match[] = [];
  for (const c of all) {
    if (c.slug === focus.slug) continue;
    const theyOffer = intersect(focusSeek, c.offerings?.tags);
    const theySeek = intersect(focusOffer, c.seeking?.tags);
    const sharedChallenges = intersect(focusChallenges, c.challengeAreas);
    const partnerTypeHit = !!c.affiliation && focusPartnerTypes.has(c.affiliation);

    const score =
      W_OFFER_MATCH * theyOffer.length +
      W_SEEK_MATCH * theySeek.length +
      W_CHALLENGE * sharedChallenges.length +
      (partnerTypeHit ? W_PARTNER_TYPE : 0);

    if (score <= 0) continue;

    const reasons: MatchReason[] = [];
    if (theyOffer.length > 0) reasons.push({ kind: "they-offer", tags: theyOffer });
    if (theySeek.length > 0) reasons.push({ kind: "they-seek", tags: theySeek });
    if (sharedChallenges.length > 0) reasons.push({ kind: "shared-challenge", tags: sharedChallenges });
    if (partnerTypeHit) reasons.push({ kind: "partner-type", tags: [c.affiliation!] });

    matches.push({
      profile: c,
      score,
      reasons,
      theyOffer,
      theySeek,
      sharedChallenges,
    });
  }

  matches.sort((a, b) => b.score - a.score || a.profile.name.localeCompare(b.profile.name));
  return matches.slice(0, limit);
}
