import type { BrokenValue, DiffResult, FillSource } from '@fixture-automation/fixture-studio-api/contract';

import type { FixOrigin, PathHighlight } from '../../shared/document-view/common/document-view.type.ts';
import { pathSegments, pointerOf } from '../../shared/json/utils/json-path.util.ts';
import { isRecord } from '../../shared/json/utils/record.util.ts';

const ERROR_SEPARATOR = ': ';

const startsWithSegments = (segments: string[], prefix: string[]): boolean => {
  const isLongEnough = segments.length >= prefix.length;
  const isSharedAt = (segment: string, index: number): boolean => segments[index] === segment;

  return isLongEnough && prefix.every(isSharedAt);
};

/** Whether one path holds the other, or they are the same. */
const isRelatedPath = (segments: string[], other: string[]): boolean => {
  const isInside = startsWithSegments(segments, other);
  const isAround = startsWithSegments(other, segments);

  return isInside || isAround;
};

const withEnvelope = (segments: string[], objectShape: string | undefined): string[] => {
  if (objectShape === undefined) return segments;

  return [objectShape, ...segments];
};

/**
 * Every path a fill targets, by where its value came from (`sources`, else `fallback`), then every broken value the
 * user chose to keep: no fill touches those, so they stay broken.
 */
export const targetHighlights = (result: DiffResult, sources: Record<string, FillSource>, fallback: FillSource): PathHighlight[] => {
  const targetOf = (path: string): PathHighlight => {
    const isReplaced = result.replacedPaths.includes(path);
    const origin: FixOrigin = isReplaced ? 'broken' : 'missing';
    const outcome = sources[path] ?? fallback;
    const highlight: PathHighlight = { path, origin, outcome };

    return highlight;
  };

  const isKept = (value: BrokenValue): boolean => !result.missingPaths.includes(value.path);

  const keptOf = (value: BrokenValue): PathHighlight => {
    const highlight: PathHighlight = { path: value.path, origin: 'broken', outcome: 'unfilled' };

    return highlight;
  };

  const targets = result.missingPaths.map(targetOf);
  const kept = result.broken.filter(isKept).map(keptOf);

  return [...targets, ...kept];
};

/** The broken values of the existing fixture, as the compare found them. */
export const brokenHighlights = (result: DiffResult): PathHighlight[] => {
  const brokenOf = (value: BrokenValue): PathHighlight => {
    const highlight: PathHighlight = { path: value.path, origin: 'broken', outcome: 'broken' };

    return highlight;
  };

  return result.broken.map(brokenOf);
};

/**
 * The envelope a merge error's path sits under: the compared `objectShape`, trimmed, but only when the fixture really
 * holds it, since without it the API validates the whole fixture.
 */
export const payloadEnvelope = (fixture: unknown, objectShape: string | undefined): string | undefined => {
  const shape = objectShape?.trim() ?? '';

  if (shape === '' || !isRecord(fixture)) return undefined;

  const hasEnvelope = Object.hasOwn(fixture, shape);

  return hasEnvelope ? shape : undefined;
};

/** A JSON pointer stays a pointer, so keys holding a dot or a bracket keep their meaning; a dotted path stays dotted. */
const errorPathOf = (path: string, envelope: string | undefined): string => {
  const isPointer = path.startsWith('/');

  if (isPointer) {
    const segments = pathSegments(path);

    return pointerOf(withEnvelope(segments, envelope));
  }

  if (envelope === undefined) return path;

  return `${envelope}.${path}`;
};

/**
 * Merge errors (`path: message`) as still-broken values. Their paths are relative to the payload, so `envelope` (from
 * `payloadEnvelope`) is put in front; an error at the root names no value and is left out. A value near an absent
 * path was missing.
 */
export const errorHighlights = (errors: string[], result: DiffResult, envelope: string | undefined): PathHighlight[] => {
  const isAbsent = (path: string): boolean => !result.replacedPaths.includes(path);
  const absentSegments = result.missingPaths.filter(isAbsent).map(pathSegments);

  const errorOf = (error: string): PathHighlight[] => {
    const separator = error.indexOf(ERROR_SEPARATOR);
    const errorPath = error.slice(0, Math.max(separator, 0));
    const isRoot = pathSegments(errorPath).length === 0;

    if (isRoot) return [];

    const path = errorPathOf(errorPath, envelope);
    const segments = pathSegments(path);
    const isNearAbsent = absentSegments.some((absent) => isRelatedPath(absent, segments));
    const origin: FixOrigin = isNearAbsent ? 'missing' : 'broken';
    const highlight: PathHighlight = { path, origin, outcome: 'unfilled' };

    return [highlight];
  };

  return errors.flatMap(errorOf);
};
