// Listing-group tree surgery for Standard Shopping ad groups (build-order
// step 9, founder go 2026-09-04). Deliberately the LAST optimise surface
// built, and deliberately the narrowest: Google's listing trees are
// replace-semantics, and a malformed tree silently excludes a whole catalog
// while returning 200s, so v1 holds three hard lines:
//
//   1. SINGLE-LEVEL ONLY. A root, and unit children. Any existing subdivision
//      below the first level refuses; reshaping a nested tree is a founder-by-
//      hand job or a later increment with its own spec.
//   2. THE DIFF IS THE SURFACE. Every dry run and approval item renders the
//      complete before and after trees as text; nothing is approved from a
//      description of a tree.
//   3. EVERYTHING-ELSE ALWAYS SURVIVES. Every subdivision this module builds
//      carries an explicit "everything else" unit, included and bid, so no
//      mutation can strand the rest of the catalog unserved by omission.
//
// PMax asset-group filter trees are the same discipline on a different
// resource and are NOT here; brand exclusions on PMax already ride
// attach_shared_set.
import { gaqlSearch } from "@/lib/integrations/google-ads";
import type { ListingDimension, ListingDimensionType } from "@/lib/integrations/google-ads/write";

const num = (v: unknown) => Number(v ?? 0) || 0;

export interface TreeNode {
  resourceName: string;
  type: "SUBDIVISION" | "UNIT";
  parent: string | null;
  /** null on the root; { type, value: null } is the "everything else" node. */
  caseValue: { type: ListingDimensionType | "other"; value: string | null } | null;
  negative: boolean;
  cpcBidMicros: number | null;
}

const DIMENSION_FIELDS: Record<string, ListingDimensionType> = {
  productItemId: "item_id",
  productBrand: "brand",
  productType: "product_type_l1",
};

export async function readTree(customerId: string, adGroupId: string): Promise<TreeNode[] | { error: string }> {
  try {
    const rows = await gaqlSearch(
      customerId,
      `SELECT ad_group_criterion.resource_name, ad_group_criterion.status, ad_group_criterion.negative,
              ad_group_criterion.cpc_bid_micros, ad_group_criterion.listing_group.type,
              ad_group_criterion.listing_group.parent_ad_group_criterion,
              ad_group_criterion.listing_group.case_value.product_item_id.value,
              ad_group_criterion.listing_group.case_value.product_brand.value,
              ad_group_criterion.listing_group.case_value.product_type.value,
              ad_group_criterion.listing_group.case_value.product_type.level,
              ad_group_criterion.listing_group.case_value.product_custom_attribute.value,
              ad_group_criterion.listing_group.case_value.product_custom_attribute.index
       FROM ad_group_criterion
       WHERE ad_group.id = ${adGroupId} AND ad_group_criterion.type = 'LISTING_GROUP'
         AND ad_group_criterion.status != 'REMOVED'`,
    );
    return rows.map((r) => {
      const c = (r.adGroupCriterion ?? {}) as Record<string, unknown>;
      const lg = (c.listingGroup ?? {}) as Record<string, unknown>;
      const cv = (lg.caseValue ?? null) as Record<string, Record<string, unknown>> | null;
      let caseValue: TreeNode["caseValue"] = null;
      if (cv) {
        const key = Object.keys(cv)[0];
        if (key === "productCustomAttribute") {
          const idx = String(cv[key]?.index ?? "INDEX0").replace("INDEX", "");
          caseValue = { type: `custom_label_${idx}` as ListingDimensionType, value: (cv[key]?.value as string | undefined) ?? null };
        } else if (key && DIMENSION_FIELDS[key]) {
          caseValue = { type: DIMENSION_FIELDS[key], value: (cv[key]?.value as string | undefined) ?? null };
        } else if (key) {
          caseValue = { type: "other", value: (cv[key]?.value as string | undefined) ?? null };
        }
      }
      return {
        resourceName: String(c.resourceName ?? ""),
        type: (String(lg.type ?? "UNIT") as "SUBDIVISION" | "UNIT"),
        parent: (lg.parentAdGroupCriterion as string | undefined) ?? null,
        caseValue,
        negative: c.negative === true,
        cpcBidMicros: c.cpcBidMicros != null ? num(c.cpcBidMicros) : null,
      };
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** The complete tree as text: this rendering IS the approval surface. */
export function renderTree(nodes: TreeNode[], currency: string): string {
  if (!nodes.length) return "(no listing groups: the ad group cannot serve products)";
  const root = nodes.find((n) => !n.parent);
  if (!root) return "(malformed tree: no root)";
  const bid = (n: TreeNode) => (n.cpcBidMicros != null ? ` bid ${currency} ${(n.cpcBidMicros / 1e6).toFixed(2)}` : " (ad group default bid)");
  const lines: string[] = [];
  const label = (n: TreeNode) =>
    !n.caseValue ? "ALL PRODUCTS"
    : n.caseValue.value === null ? `everything else (${n.caseValue.type})`
    : `${n.caseValue.type} = "${n.caseValue.value}"`;
  const walk = (n: TreeNode, depth: number) => {
    const pad = "  ".repeat(depth);
    if (n.type === "SUBDIVISION") {
      lines.push(`${pad}${label(n)} [subdivided]`);
      for (const ch of nodes.filter((x) => x.parent === n.resourceName)) walk(ch, depth + 1);
    } else {
      lines.push(`${pad}${label(n)}: ${n.negative ? "EXCLUDED" : "included" + bid(n)}`);
    }
  };
  walk(root, 0);
  return lines.join("\n");
}

/** v1's shape gate: a root with only unit children (or a lone root unit). */
export function singleLevel(nodes: TreeNode[]): { root: TreeNode; children: TreeNode[] } | { error: string } {
  const root = nodes.find((n) => !n.parent);
  if (!root) return { error: "The ad group has no listing-group root; it is not a servable shopping ad group." };
  const children = nodes.filter((n) => n.parent === root.resourceName);
  const deeper = nodes.filter((n) => n.parent && n.parent !== root.resourceName);
  if (deeper.length || children.some((c) => c.type === "SUBDIVISION")) {
    return { error: "This tree is subdivided beyond one level. v1 performs single-level surgery only: reshaping a nested tree is done by hand or waits for its own increment." };
  }
  return { root, children };
}

function caseValueJson(type: ListingDimensionType, value: string | null): Record<string, unknown> {
  const v = value === null ? {} : { value };
  if (type === "item_id") return { productItemId: v };
  if (type === "brand") return { productBrand: v };
  if (type === "product_type_l1") return { productType: { ...v, level: "LEVEL1" } };
  const idx = type.replace("custom_label_", "");
  return { productCustomAttribute: { ...v, index: `INDEX${idx}` } };
}

let tempCounter = 0;
const temp = (cid: string, agid: string) => `customers/${cid}/adGroupCriteria/${agid}~${-(++tempCounter % 1000) - 1}`;

interface PlannedNode { resourceName: string; type: "SUBDIVISION" | "UNIT"; parent: string | null; caseType: ListingDimensionType; caseValue: string | null; negative: boolean; cpcBidMicros: number | null }
function createOp(cid: string, agid: string, n: PlannedNode): unknown {
  return { adGroupCriterionOperation: { create: {
    resourceName: n.resourceName,
    adGroup: `customers/${cid}/adGroups/${agid}`,
    status: "ENABLED",
    ...(n.negative ? { negative: true } : {}),
    ...(n.cpcBidMicros != null && !n.negative && n.type === "UNIT" ? { cpcBidMicros: String(n.cpcBidMicros) } : {}),
    listingGroup: {
      type: n.type,
      ...(n.parent ? { parentAdGroupCriterion: n.parent } : {}),
      ...(n.parent ? { caseValue: caseValueJson(n.caseType, n.caseValue) } : {}),
    },
  } } };
}

export interface TreePlan { ops: unknown[]; afterText: (currency: string) => string; expected: { units: number; excluded: number } }

/** Exclude one dimension value. From a lone all-products unit this rebuilds a
 *  one-level subdivision (excluded unit + everything-else unit carrying the
 *  old bid); on an existing same-dimension subdivision it adds one excluded
 *  unit. Anything else refuses. */
export function planExclusion(
  cid: string, agid: string, nodes: TreeNode[], dim: ListingDimension,
): TreePlan | { error: string } {
  const shape = singleLevel(nodes);
  if ("error" in shape) return shape;
  const { root, children } = shape;

  if (root.type === "UNIT") {
    const rootRes = temp(cid, agid);
    const planned: PlannedNode[] = [
      { resourceName: rootRes, type: "SUBDIVISION", parent: null, caseType: dim.type, caseValue: null, negative: false, cpcBidMicros: null },
      { resourceName: temp(cid, agid), type: "UNIT", parent: rootRes, caseType: dim.type, caseValue: dim.value, negative: true, cpcBidMicros: null },
      { resourceName: temp(cid, agid), type: "UNIT", parent: rootRes, caseType: dim.type, caseValue: null, negative: false, cpcBidMicros: root.cpcBidMicros },
    ];
    return {
      ops: [{ adGroupCriterionOperation: { remove: root.resourceName } }, ...planned.map((n) => createOp(cid, agid, n))],
      afterText: (cx) => [
        `ALL PRODUCTS [subdivided by ${dim.type}]`,
        `  ${dim.type} = "${dim.value}": EXCLUDED`,
        `  everything else (${dim.type}): included${root.cpcBidMicros != null ? ` bid ${cx} ${(root.cpcBidMicros / 1e6).toFixed(2)}` : " (ad group default bid)"}`,
      ].join("\n"),
      expected: { units: 2, excluded: 1 },
    };
  }

  // Existing one-level subdivision: it must be on the SAME dimension.
  const existingType = children.find((c) => c.caseValue)?.caseValue?.type;
  if (existingType !== dim.type)
    return { error: `The tree is subdivided by ${existingType ?? "an unknown dimension"}, not ${dim.type}; excluding across dimensions needs a nested tree, which v1 does not perform.` };
  if (children.some((c) => c.caseValue?.value === dim.value))
    return { error: `A node for ${dim.type} "${dim.value}" already exists on this tree; adjust it by hand or leave it, but a duplicate cannot be created.` };
  if (!children.some((c) => c.caseValue?.value === null && !c.negative))
    return { error: "This subdivision has no included everything-else node; the tree is already unusual and v1 will not modify it." };

  const planned: PlannedNode = { resourceName: temp(cid, agid), type: "UNIT", parent: root.resourceName, caseType: dim.type, caseValue: dim.value, negative: true, cpcBidMicros: null };
  return {
    ops: [createOp(cid, agid, planned)],
    afterText: (cx) => renderTree([
      ...nodes,
      { resourceName: planned.resourceName, type: "UNIT", parent: root.resourceName, caseValue: { type: dim.type, value: dim.value }, negative: true, cpcBidMicros: null },
    ], cx),
    expected: { units: children.length + 1, excluded: children.filter((c) => c.negative).length + 1 },
  };
}

/** Tier split: ONLY from a lone all-products unit, into N bid tiers plus an
 *  explicit everything-else unit. */
export function planSplit(
  cid: string, agid: string, nodes: TreeNode[],
  dimType: ListingDimensionType, tiers: { value: string; cpcBid: number }[], othersBid: number,
): TreePlan | { error: string } {
  const shape = singleLevel(nodes);
  if ("error" in shape) return shape;
  if (shape.root.type !== "UNIT" || shape.children.length)
    return { error: "lg_split only splits a flat all-products tree; this ad group is already subdivided, and reshaping an existing split is by hand or a later increment." };

  const rootRes = temp(cid, agid);
  const planned: PlannedNode[] = [
    { resourceName: rootRes, type: "SUBDIVISION", parent: null, caseType: dimType, caseValue: null, negative: false, cpcBidMicros: null },
    ...tiers.map((t): PlannedNode => ({ resourceName: temp(cid, agid), type: "UNIT", parent: rootRes, caseType: dimType, caseValue: t.value, negative: false, cpcBidMicros: Math.round(t.cpcBid * 1e6) })),
    { resourceName: temp(cid, agid), type: "UNIT", parent: rootRes, caseType: dimType, caseValue: null, negative: false, cpcBidMicros: Math.round(othersBid * 1e6) },
  ];
  return {
    ops: [{ adGroupCriterionOperation: { remove: shape.root.resourceName } }, ...planned.map((n) => createOp(cid, agid, n))],
    afterText: (cx) => [
      `ALL PRODUCTS [subdivided by ${dimType}]`,
      ...tiers.map((t) => `  ${dimType} = "${t.value}": included bid ${cx} ${t.cpcBid.toFixed(2)}`),
      `  everything else (${dimType}): included bid ${cx} ${othersBid.toFixed(2)}`,
    ].join("\n"),
    expected: { units: tiers.length + 1, excluded: 0 },
  };
}

/** Rollback: rebuild the snapshot tree exactly, atomic remove-all + recreate. */
export function planRestore(cid: string, agid: string, current: TreeNode[], snapshot: TreeNode[]): TreePlan | { error: string } {
  const root = snapshot.find((n) => !n.parent);
  if (!root) return { error: "The stored snapshot has no root; cannot restore." };
  const removes = current.map((n) => n.resourceName).filter(Boolean)
    // Removing the root cascades in the API; removing only the root is the
    // documented way to drop a whole tree in one operation.
    .filter((rn) => current.find((n) => n.resourceName === rn && !n.parent));
  const rootRes = temp(cid, agid);
  const mapped = new Map<string, string>([[root.resourceName, rootRes]]);
  const planned: PlannedNode[] = [{
    resourceName: rootRes, type: root.type, parent: null,
    caseType: (root.caseValue?.type as ListingDimensionType) ?? "item_id", caseValue: null,
    negative: false, cpcBidMicros: root.cpcBidMicros,
  }];
  for (const n of snapshot.filter((x) => x.parent)) {
    const parent = mapped.get(n.parent!);
    if (!parent) return { error: "The snapshot tree is deeper than one level; restore it by hand from the stored snapshot." };
    if (!n.caseValue || n.caseValue.type === "other") return { error: "The snapshot carries a dimension v1 cannot rebuild; restore by hand." };
    planned.push({
      resourceName: temp(cid, agid), type: n.type, parent,
      caseType: n.caseValue.type, caseValue: n.caseValue.value,
      negative: n.negative, cpcBidMicros: n.cpcBidMicros,
    });
  }
  return {
    ops: [...removes.map((rn) => ({ adGroupCriterionOperation: { remove: rn } })), ...planned.map((n) => createOp(cid, agid, n))],
    afterText: (cx) => renderTree(snapshot, cx),
    expected: { units: snapshot.filter((n) => n.type === "UNIT").length, excluded: snapshot.filter((n) => n.negative).length },
  };
}
