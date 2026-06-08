import type { PostIt } from "@bindings/mycheet/models";

export type MatchScore = {
  prefixRank: number;
  index: number;
  length: number;
  fieldPriority: number;
};

export type RankedEntry = {
  item: PostIt;
  fileName: string;
  originalIndex: number;
  match: MatchScore | null;
};

export function getBestMatch(item: PostIt, fileName: string, query: string): MatchScore | null {
  if (!query) return null;

  const fields = [
    { value: String(item.title || "").toLowerCase(), fieldPriority: 0 },
    { value: String(fileName || "").toLowerCase(), fieldPriority: 1 },
    { value: String(item.path || "").toLowerCase(), fieldPriority: 2 },
  ];

  const matches = fields
    .map(field => scoreMatch(field.value, query, field.fieldPriority))
    .filter((value): value is MatchScore => value !== null)
    .sort(compareMatches);

  return matches[0] || null;
}

function scoreMatch(value: string, query: string, fieldPriority: number): MatchScore | null {
  const index = value.indexOf(query);
  if (index === -1) return null;

  const previous = index > 0 ? value[index - 1] : "";
  const boundary = index === 0 || /[\s_./\\\-[\](){}]/.test(previous);
  const prefixRank = index === 0 ? 0 : boundary ? 1 : 2;

  return {
    prefixRank,
    index,
    length: value.length,
    fieldPriority,
  };
}

function compareMatches(left: MatchScore, right: MatchScore) {
  if (left.prefixRank !== right.prefixRank) return left.prefixRank - right.prefixRank;
  if (left.fieldPriority !== right.fieldPriority) return left.fieldPriority - right.fieldPriority;
  if (left.index !== right.index) return left.index - right.index;
  return left.length - right.length;
}

export function comparePaletteEntries(left: RankedEntry, right: RankedEntry, query: string) {
  if (!query) return left.originalIndex - right.originalIndex;
  const matchCompare = compareMatches(left.match!, right.match!);
  if (matchCompare !== 0) return matchCompare;
  return left.originalIndex - right.originalIndex;
}
