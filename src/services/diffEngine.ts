export interface FieldDiff {
  field: string;
  before: unknown;
  after: unknown;
}

export interface DiffResult {
  event_id: string;
  entity_type: string;
  entity_id: string;
  action_type: string;
  diffs: FieldDiff[];
  computed_at: string;
}

/**
 * Deep object diff between before_state and after_state.
 * Walks nested objects with dot-notation keys (e.g. "metadata.tag").
 * Arrays are compared by JSON equality (no element-level diffing).
 */
export function computeDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): FieldDiff[] {
  if (!before && !after) return [];

  const diffs: FieldDiff[] = [];

  function walk(
    b: Record<string, unknown> | null | undefined,
    a: Record<string, unknown> | null | undefined,
    prefix: string,
  ) {
    const bObj = b ?? {};
    const aObj = a ?? {};
    const allKeys = new Set([...Object.keys(bObj), ...Object.keys(aObj)]);

    for (const key of allKeys) {
      const field = prefix ? `${prefix}.${key}` : key;
      const bVal = bObj[key];
      const aVal = aObj[key];

      // Both are plain objects — recurse
      if (isPlainObject(bVal) && isPlainObject(aVal)) {
        walk(
          bVal as Record<string, unknown>,
          aVal as Record<string, unknown>,
          field,
        );
        continue;
      }

      // One side is an object, the other isn't (type changed), or primitives/arrays
      if (!deepEqual(bVal, aVal)) {
        diffs.push({
          field,
          before: bVal === undefined ? null : bVal,
          after: aVal === undefined ? null : aVal,
        });
      }
    }
  }

  walk(before, after, "");
  return diffs;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((k) => deepEqual(a[k], b[k]));
  }

  return false;
}
