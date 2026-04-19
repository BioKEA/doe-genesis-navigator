import type { Profile } from "../types";
import { SECTORS, sectorFor, type Sector } from "./rfa";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface TeamTarget {
  challenges: string[];          // selected RFA challenge areas
  requiredOfferings: string[];   // tags the team must collectively cover
  minSize: number;
  maxSize: number;
  targetSize: number;
  requireSectors: Sector[];      // sectors the team must include (RFA: academic + industry + natlab)
  lockedSlugs: string[];         // always include (your org, anchor PI, etc.)
  weights?: Partial<Weights>;
}

export interface Weights {
  challengeCoverage: number;
  offeringCoverage: number;
  sectorEntropy: number;
  sectorRequirements: number;     // reward for satisfying requireSectors
  internalComplementarity: number;
  profileRichness: number;
  sizeBalance: number;
  redundancy: number;             // subtracted
}

export const DEFAULT_WEIGHTS: Weights = {
  challengeCoverage: 3.0,
  offeringCoverage: 2.5,
  sectorEntropy: 1.5,
  sectorRequirements: 2.0,
  internalComplementarity: 1.0,
  profileRichness: 0.5,
  sizeBalance: 1.0,
  redundancy: 0.5,
};

// Three variant weightings used to produce three distinct proposed teams that
// optimize different aspects of the RFA.
export const VARIANT_WEIGHTS: Record<VariantId, Partial<Weights>> = {
  coverage: {
    challengeCoverage: 5.0,
    offeringCoverage: 4.0,
    sectorEntropy: 1.0,
    sectorRequirements: 1.5,
    internalComplementarity: 0.5,
  },
  diversity: {
    challengeCoverage: 2.0,
    offeringCoverage: 2.0,
    sectorEntropy: 4.0,
    sectorRequirements: 3.0,
    internalComplementarity: 1.5,
  },
  complementarity: {
    challengeCoverage: 2.0,
    offeringCoverage: 2.0,
    sectorEntropy: 1.5,
    sectorRequirements: 1.5,
    internalComplementarity: 4.0,
  },
};

export type VariantId = "coverage" | "diversity" | "complementarity";

export const VARIANT_META: Record<VariantId, { label: string; tagline: string }> = {
  coverage: {
    label: "Max Coverage",
    tagline: "Widest capability footprint across your chosen challenges",
  },
  diversity: {
    label: "Max Diversity",
    tagline: "Strongest cross-sector balance — Academic + Industry + National Lab",
  },
  complementarity: {
    label: "Max Complementarity",
    tagline: "Team members fill each other's seeking/offering gaps internally",
  },
};

export interface ScoreBreakdown {
  total: number;
  challengeCoverage: number;
  offeringCoverage: number;
  sectorEntropy: number;
  sectorRequirements: number;
  internalComplementarity: number;
  profileRichness: number;
  sizeBalance: number;
  redundancy: number;
}

export interface Team {
  members: Profile[];
  score: ScoreBreakdown;
  variantId?: VariantId;
  lockedSlugs: Set<string>;
}

// -----------------------------------------------------------------------------
// Scoring
// -----------------------------------------------------------------------------

function intersectCount(a: string[], b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

function entropy(counts: number[]): number {
  const total = counts.reduce((s, x) => s + x, 0);
  if (total === 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c === 0) continue;
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return h;
}

function richnessOf(p: Profile): number {
  let n = 0;
  for (const v of [
    p.affiliation, p.orgType, p.orgSize, p.website, p.introduction,
    p.offerings?.text, p.seeking?.text, p.projectIdeaSummary,
    p.relevantProjects, p.relevantPublications, p.rfaNumber,
  ]) if (v && v.trim().length > 0) n++;
  if (p.challengeAreas.length > 0) n++;
  if (p.partnerTypeSeeking.length > 0) n++;
  return n / 13; // normalized to [0, 1]
}

/**
 * Score a team against a target. Returns a full breakdown so the UI can
 * explain exactly why each team ranked where it did.
 */
export function scoreTeam(team: Profile[], target: TeamTarget): ScoreBreakdown {
  const weights: Weights = { ...DEFAULT_WEIGHTS, ...(target.weights ?? {}) };

  const challengeSet = new Set(target.challenges);
  const offeringSet = new Set(target.requiredOfferings);

  // 1. Challenge coverage
  const coveredChallenges = new Set<string>();
  for (const p of team) for (const c of p.challengeAreas) {
    if (challengeSet.has(c)) coveredChallenges.add(c);
  }
  const challengeCoverage =
    challengeSet.size === 0 ? 1 : coveredChallenges.size / challengeSet.size;

  // 2. Offering coverage
  const coveredOfferings = new Set<string>();
  for (const p of team) for (const t of p.offerings?.tags ?? []) {
    if (offeringSet.has(t)) coveredOfferings.add(t);
  }
  const offeringCoverage =
    offeringSet.size === 0 ? 1 : coveredOfferings.size / offeringSet.size;

  // 3. Sector entropy (0 = all same sector, 1 = uniform across 4 sectors)
  const sectorCounts = Object.fromEntries(SECTORS.map((s) => [s, 0])) as Record<Sector, number>;
  for (const p of team) sectorCounts[sectorFor(p.affiliation)]++;
  const sectorEntropy = team.length === 0 ? 0 :
    entropy(Object.values(sectorCounts)) / Math.log2(SECTORS.length);

  // 4. Required-sectors satisfaction (fraction of required sectors present)
  let requiredPresent = 0;
  for (const s of target.requireSectors) if (sectorCounts[s] > 0) requiredPresent++;
  const sectorRequirements = target.requireSectors.length === 0 ? 1 :
    requiredPresent / target.requireSectors.length;

  // 5. Internal complementarity: fraction of pairs (a,b) where A offers ≥1 tag B seeks
  let pairs = 0;
  let matchedPairs = 0;
  for (let i = 0; i < team.length; i++) {
    for (let j = 0; j < team.length; j++) {
      if (i === j) continue;
      pairs++;
      const aOffers = new Set(team[i].offerings?.tags ?? []);
      const bSeeks = team[j].seeking?.tags ?? [];
      if (intersectCount(bSeeks, aOffers) > 0) matchedPairs++;
    }
  }
  const internalComplementarity = pairs === 0 ? 0 : matchedPairs / pairs;

  // 6. Profile richness (avg)
  const profileRichness = team.length === 0 ? 0 :
    team.reduce((s, p) => s + richnessOf(p), 0) / team.length;

  // 7. Size balance: peaks at targetSize, drops off quadratically
  const distance = Math.abs(team.length - target.targetSize);
  const maxDistance = Math.max(target.targetSize - target.minSize, target.maxSize - target.targetSize);
  const sizeBalance = team.length === 0 ? 0 :
    Math.max(0, 1 - Math.pow(distance / Math.max(1, maxDistance), 2));

  // 8. Redundancy: per-offering count of members exceeding 3 covering that tag
  const offeringHits = new Map<string, number>();
  for (const p of team) for (const t of p.offerings?.tags ?? []) {
    offeringHits.set(t, (offeringHits.get(t) ?? 0) + 1);
  }
  let redundancy = 0;
  for (const count of offeringHits.values()) {
    if (count > 3) redundancy += (count - 3);
  }
  // Normalize: max conceivable redundancy is team.length per tag
  const normalizedRedundancy = team.length === 0 ? 0 :
    Math.min(1, redundancy / team.length);

  const total =
    weights.challengeCoverage * challengeCoverage +
    weights.offeringCoverage * offeringCoverage +
    weights.sectorEntropy * sectorEntropy +
    weights.sectorRequirements * sectorRequirements +
    weights.internalComplementarity * internalComplementarity +
    weights.profileRichness * profileRichness +
    weights.sizeBalance * sizeBalance -
    weights.redundancy * normalizedRedundancy;

  return {
    total,
    challengeCoverage,
    offeringCoverage,
    sectorEntropy,
    sectorRequirements,
    internalComplementarity,
    profileRichness,
    sizeBalance,
    redundancy: normalizedRedundancy,
  };
}

// -----------------------------------------------------------------------------
// Greedy + random-restart team builder
// -----------------------------------------------------------------------------

/**
 * Greedy team construction: start with locked members, then iteratively add
 * the partner that maximizes the marginal score. With `randomness > 0`, occasionally
 * picks from the top-K instead of strictly the best, producing variation
 * across restarts.
 */
export function greedyBuild(
  profiles: Profile[],
  target: TeamTarget,
  randomness = 0,
): Profile[] {
  const lockedSlugs = new Set(target.lockedSlugs);
  const locked = profiles.filter((p) => lockedSlugs.has(p.slug));
  const team = [...locked];
  const used = new Set(team.map((p) => p.slug));
  const available = profiles.filter((p) => !used.has(p.slug));

  while (team.length < target.maxSize) {
    const currentScore = scoreTeam(team, target).total;
    const scored = available
      .map((c) => ({
        candidate: c,
        delta: scoreTeam([...team, c], target).total - currentScore,
      }))
      .sort((a, b) => b.delta - a.delta);

    if (scored.length === 0) break;

    // Stop once adding anyone hurts the score and we've reached min size
    if (scored[0].delta <= 0 && team.length >= target.minSize) break;

    // ε-random: sometimes pick from top 5 to escape local optima
    let pickIdx = 0;
    if (randomness > 0 && Math.random() < randomness) {
      pickIdx = Math.floor(Math.random() * Math.min(5, scored.length));
    }
    const pick = scored[pickIdx];
    team.push(pick.candidate);
    used.add(pick.candidate.slug);
    const availIdx = available.findIndex((p) => p.slug === pick.candidate.slug);
    available.splice(availIdx, 1);
  }

  return team;
}

/**
 * Build three distinct team variants using the three weight profiles. Each
 * variant is generated with ε-greedy + 5 random restarts, keeping the highest
 * scoring instance per variant. Variants with >70% member overlap are
 * regenerated with higher randomness to ensure distinct proposals.
 */
export function buildVariants(
  profiles: Profile[],
  baseTarget: TeamTarget,
): Team[] {
  const variants: VariantId[] = ["coverage", "diversity", "complementarity"];
  const produced: Team[] = [];

  for (const v of variants) {
    const target: TeamTarget = {
      ...baseTarget,
      weights: { ...DEFAULT_WEIGHTS, ...VARIANT_WEIGHTS[v] },
    };
    let best: Profile[] = greedyBuild(profiles, target, 0);
    let bestScore = scoreTeam(best, target).total;

    for (let i = 0; i < 5; i++) {
      const candidate = greedyBuild(profiles, target, 0.3);
      const candScore = scoreTeam(candidate, target).total;
      if (candScore > bestScore) {
        best = candidate;
        bestScore = candScore;
      }
    }

    // Guard against duplicate teams: if highly overlapping with an already-
    // produced variant, regenerate with max randomness.
    for (let attempt = 0; attempt < 3; attempt++) {
      const duplicate = produced.some((p) => jaccardSlug(p.members, best) > 0.7);
      if (!duplicate) break;
      const regen = greedyBuild(profiles, target, 0.6);
      if (scoreTeam(regen, target).total > bestScore * 0.85) {
        best = regen;
        bestScore = scoreTeam(regen, target).total;
      }
    }

    produced.push({
      members: best,
      score: scoreTeam(best, baseTarget), // score against BASE weights for fair comparison
      variantId: v,
      lockedSlugs: new Set(baseTarget.lockedSlugs),
    });
  }

  return produced;
}

function jaccardSlug(a: Profile[], b: Profile[]): number {
  const sa = new Set(a.map((p) => p.slug));
  const sb = new Set(b.map((p) => p.slug));
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

// -----------------------------------------------------------------------------
// Refinement helpers
// -----------------------------------------------------------------------------

/**
 * Ranked list of alternative partners for a given team slot, by marginal score
 * delta when they replace the member at that slot.
 */
export function suggestSwap(
  team: Profile[],
  target: TeamTarget,
  slotIndex: number,
  allProfiles: Profile[],
  limit = 10,
): Array<{ candidate: Profile; delta: number }> {
  const base = team.filter((_, i) => i !== slotIndex);
  const currentScore = scoreTeam(team, target).total;
  const used = new Set(team.map((p) => p.slug));
  const lockedSet = new Set(target.lockedSlugs);

  return allProfiles
    .filter((p) => !used.has(p.slug) && !lockedSet.has(p.slug))
    .map((c) => ({
      candidate: c,
      delta: scoreTeam([...base, c], target).total - currentScore,
    }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, limit);
}

/**
 * The single best partner to ADD to the team (no removal). Useful for
 * "what would help this team most?" callouts.
 */
export function findMarginalAddition(
  team: Profile[],
  target: TeamTarget,
  allProfiles: Profile[],
): { candidate: Profile; delta: number } | null {
  if (team.length >= target.maxSize) return null;
  const currentScore = scoreTeam(team, target).total;
  const used = new Set(team.map((p) => p.slug));
  let best: { candidate: Profile; delta: number } | null = null;
  for (const c of allProfiles) {
    if (used.has(c.slug)) continue;
    const delta = scoreTeam([...team, c], target).total - currentScore;
    if (!best || delta > best.delta) best = { candidate: c, delta };
  }
  return best;
}

/**
 * Returns the contribution breakdown for each member: what they uniquely
 * (or notably) bring to this team. Used by the UI to show "why this person".
 */
export interface MemberContribution {
  profile: Profile;
  uniqueChallenges: string[];   // challenges they cover that NO other member covers
  uniqueOfferings: string[];    // offerings they cover that no other member covers
  sharedChallenges: string[];   // shared challenges with the team (not unique)
  sharedOfferings: string[];
  sector: Sector;
  locked: boolean;
}

export function analyzeContributions(
  team: Profile[],
  target: TeamTarget,
): MemberContribution[] {
  const lockedSet = new Set(target.lockedSlugs);
  const challengeSet = new Set(target.challenges);
  const offeringSet = new Set(target.requiredOfferings);

  return team.map((p) => {
    const otherChallenges = new Set<string>();
    const otherOfferings = new Set<string>();
    for (const q of team) {
      if (q.slug === p.slug) continue;
      for (const c of q.challengeAreas) otherChallenges.add(c);
      for (const t of q.offerings?.tags ?? []) otherOfferings.add(t);
    }

    const myChallenges = p.challengeAreas.filter((c) => challengeSet.has(c));
    const myOfferings = (p.offerings?.tags ?? []).filter((t) => offeringSet.has(t));

    return {
      profile: p,
      uniqueChallenges: myChallenges.filter((c) => !otherChallenges.has(c)),
      uniqueOfferings: myOfferings.filter((t) => !otherOfferings.has(t)),
      sharedChallenges: myChallenges.filter((c) => otherChallenges.has(c)),
      sharedOfferings: myOfferings.filter((t) => otherOfferings.has(t)),
      sector: sectorFor(p.affiliation),
      locked: lockedSet.has(p.slug),
    };
  });
}
