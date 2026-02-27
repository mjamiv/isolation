/**
 * Pure functions for computing comparison dashboard metrics.
 *
 * These functions take raw analysis results and model data and compute
 * the derived metrics for the comparison summary dashboard.
 */

import type { HingeState } from '@/types/analysis';
import type {
  DriftProfile,
  BaseShearComparison,
  BearingDemand,
  HingeDistribution,
  VariantResult,
  ComparisonSummary,
} from '@/types/comparison';
import type { Node, TFPBearing } from '@/types/storeModel';

/** Estimated bearing displacement as fraction of max roof displacement */
const BEARING_DEMAND_ROOF_RATIO = 0.8;

/**
 * Compute inter-story drift profiles for both variants.
 *
 * For each story, drift ratio = (disp_top - disp_bottom) / story_height.
 * Uses DOF 1 (horizontal X) displacements from final pushover state.
 */
export function computeDriftProfile(
  isolated: VariantResult,
  fixedBase: VariantResult,
  nodes: Map<number, Node>,
): DriftProfile[] {
  // Group nodes by Y coordinate to determine stories
  const nodesByHeight = new Map<number, number[]>();
  for (const [id, node] of nodes) {
    const y = Math.round(node.y);
    const ids = nodesByHeight.get(y) ?? [];
    ids.push(id);
    nodesByHeight.set(y, ids);
  }

  // Sort unique heights
  const heights = Array.from(nodesByHeight.keys()).sort((a, b) => a - b);
  if (heights.length < 2) return [];

  const driftProfiles: DriftProfile[] = [];

  for (let i = 1; i < heights.length; i++) {
    const bottomHeight = heights[i - 1]!;
    const topHeight = heights[i]!;
    const storyHeight = topHeight - bottomHeight;
    if (storyHeight <= 0) continue;

    const bottomNodes = nodesByHeight.get(bottomHeight) ?? [];
    const topNodes = nodesByHeight.get(topHeight) ?? [];

    // Average horizontal displacement at each level
    const avgDisp = (result: VariantResult, nodeIds: number[]): number => {
      // nodeDisplacements lives alongside pushoverResults on the variant
      const nodeDisplacements = (
        result as unknown as {
          pushoverResults?: { nodeDisplacements?: Record<string, number[]> } | null;
        }
      ).pushoverResults?.nodeDisplacements;
      if (!nodeDisplacements) return 0;

      let sum = 0;
      let count = 0;
      for (const nid of nodeIds) {
        const d = nodeDisplacements[String(nid)];
        if (d && d.length > 0) {
          sum += d[0]!;
          count++;
        }
      }
      return count > 0 ? sum / count : 0;
    };

    const isoTopDisp = avgDisp(isolated, topNodes);
    const isoBottomDisp = avgDisp(isolated, bottomNodes);
    const fbTopDisp = avgDisp(fixedBase, topNodes);
    const fbBottomDisp = avgDisp(fixedBase, bottomNodes);

    driftProfiles.push({
      story: i,
      height: topHeight,
      isolatedDrift: Math.abs(isoTopDisp - isoBottomDisp) / storyHeight,
      fixedBaseDrift: Math.abs(fbTopDisp - fbBottomDisp) / storyHeight,
    });
  }

  return driftProfiles;
}

/**
 * Compute base shear comparison between isolated and fixed-base variants.
 */
export function computeBaseShear(
  isolated: VariantResult,
  fixedBase: VariantResult,
): BaseShearComparison {
  const isoShear = isolated.maxBaseShear;
  const fbShear = fixedBase.maxBaseShear;
  const reduction = fbShear > 0 ? ((fbShear - isoShear) / fbShear) * 100 : 0;

  return {
    isolatedBaseShear: isoShear,
    fixedBaseBaseShear: fbShear,
    reductionPercent: reduction,
  };
}

/**
 * Compute bearing demand-capacity ratios.
 * Uses max roof displacement as a proxy for bearing displacement demand
 * (scaled by bearing-to-roof displacement ratio from pushover results).
 */
export function computeBearingDemands(
  isolated: VariantResult,
  bearings: Map<number, TFPBearing>,
): BearingDemand[] {
  const demands: BearingDemand[] = [];

  for (const [id, bearing] of bearings) {
    // Use the maximum displacement capacity from the bearing (sum of all surfaces)
    const capacity = bearing.dispCapacities.reduce((s: number, d: number) => s + d, 0);

    // Estimate demand from roof displacement (simplified)
    // In reality this would come from bearing response, but for pushover
    // we use the max roof displacement as an upper bound estimate
    const demand = isolated.maxRoofDisplacement * BEARING_DEMAND_ROOF_RATIO;

    demands.push({
      bearingId: id,
      demand,
      capacity,
      dcRatio: capacity > 0 ? demand / capacity : 0,
    });
  }

  return demands;
}

/**
 * Count plastic hinges by performance level for both variants.
 */
export function countHingesByLevel(
  isolatedHinges: HingeState[],
  fixedBaseHinges: HingeState[],
): HingeDistribution[] {
  const levels = ['IO', 'LS', 'CP'] as const;

  return levels.map((level) => ({
    level,
    isolatedCount: isolatedHinges.filter((h) => h.performanceLevel === level).length,
    fixedBaseCount: fixedBaseHinges.filter((h) => h.performanceLevel === level).length,
  }));
}

/**
 * Compute full comparison summary from paired variant results.
 */
export function computeComparisonSummary(
  isolated: VariantResult,
  fixedBase: VariantResult,
  nodes: Map<number, Node>,
  bearings: Map<number, TFPBearing>,
): ComparisonSummary {
  return {
    driftProfiles: computeDriftProfile(isolated, fixedBase, nodes),
    baseShear: computeBaseShear(isolated, fixedBase),
    bearingDemands: computeBearingDemands(isolated, bearings),
    hingeDistribution: countHingesByLevel(isolated.hingeStates ?? [], fixedBase.hingeStates ?? []),
  };
}
