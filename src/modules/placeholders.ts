import type { Module, HookContext, VirtualContext } from "../types";
import { booleanValidator } from "../utils/validation";
import {
  getSection,
  setSection,
  setPreamble,
  setPostamble,
  SECTION_ORDER,
  type SectionName,
} from "../utils/virtualContext";
import { calculateSimilarity } from "../utils/similarity";
import { getCardKeys } from "../utils/storyCardHelpers";

const CONFIG_CARD_TITLE = "FoxTweaks Config";
const MAX_PASSES = 16;
const DEFAULT_FUZZY_THRESHOLD = 70;
const REMOVE_SWEEP_MAX_ACTION_COUNT = 2;

const VALID_SECTION_NAMES: ReadonlySet<string> = new Set([
  "World Lore",
  "Story Summary",
  "Memories",
  "Narrative Checklist",
  "Recent Story",
  "Author's Note",
]);

export interface PlaceholdersConfig {
  enable: boolean;
  debug: boolean;
}

export interface MarkerRange {
  start: number;
  end: number;
  body: string;
}

export interface DirectedCapture {
  into: SectionName;
  paragraph: number;
}

export interface PendingDirected {
  range: MarkerRange;
  region: RegionKey;
  directed: DirectedCapture;
}

export type RegionKey = "preamble" | "postamble" | SectionName;

interface EvalContext {
  capturedCreatorOutput: string;
  storyCards: StoryCard[];
  originalPromptText?: string;
}

interface ResolveOptions {
  collectDirectedCaptures?: PendingDirected[];
  region?: RegionKey;
}

const COMMENT_OPEN = "{{%";
const COMMENT_CLOSE = "%}}";

export function stripComments(text: string): string {
  let result = "";
  let i = 0;
  while (i < text.length) {
    const openIdx = text.indexOf(COMMENT_OPEN, i);
    if (openIdx === -1) {
      result += text.slice(i);
      break;
    }
    result += text.slice(i, openIdx);
    const closeIdx = text.indexOf(COMMENT_CLOSE, openIdx + COMMENT_OPEN.length);
    if (closeIdx === -1) {
      result += text.slice(openIdx);
      break;
    }
    i = closeIdx + COMMENT_CLOSE.length;
  }
  return result;
}

export function findOuterMarkers(text: string): MarkerRange[] {
  const markers: MarkerRange[] = [];
  let i = 0;
  while (i < text.length - 1) {
    if (text[i] === "{" && text[i + 1] === "{") {
      let depth = 1;
      let singleDepth = 0;
      let j = i + 2;
      let closed = false;
      while (j < text.length) {
        const ch = text[j];
        const next = text[j + 1];
        if (ch === "{" && next === "{") {
          depth++;
          j += 2;
        } else if (ch === "}" && next === "}") {
          if (singleDepth > 0) {
            singleDepth--;
            j++;
          } else {
            depth--;
            if (depth === 0) {
              markers.push({
                start: i,
                end: j + 2,
                body: text.slice(i + 2, j),
              });
              i = j + 2;
              closed = true;
              break;
            }
            j += 2;
          }
        } else if (ch === "{") {
          singleDepth++;
          j++;
        } else if (ch === "}") {
          if (singleDepth > 0) singleDepth--;
          j++;
        } else {
          j++;
        }
      }
      if (!closed) {
        break;
      }
    } else {
      i++;
    }
  }
  return markers;
}

export function findInnermostMarkers(text: string): MarkerRange[] {
  const result: MarkerRange[] = [];
  const outer = findOuterMarkers(text);
  for (const m of outer) {
    if (m.body.includes("{{")) {
      const inner = findInnermostMarkers(m.body);
      const bodyOffset = m.start + 2;
      for (const child of inner) {
        result.push({
          start: child.start + bodyOffset,
          end: child.end + bodyOffset,
          body: child.body,
        });
      }
    } else {
      result.push(m);
    }
  }
  return result;
}

const OPEN_QUOTE_BOUNDARY = /[\s|{,]/;
const CLOSE_QUOTE_BOUNDARY = /[\s|},]/;

export function splitOnPipe(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === undefined) continue;
    if (inQuote) {
      current += ch;
      if (ch === quoteChar) {
        const next = text[i + 1];
        if (next === undefined || CLOSE_QUOTE_BOUNDARY.test(next)) {
          inQuote = false;
          quoteChar = "";
        }
      }
    } else if (ch === '"' || ch === "'") {
      const prev = i === 0 ? undefined : text[i - 1];
      if (prev === undefined || OPEN_QUOTE_BOUNDARY.test(prev)) {
        inQuote = true;
        quoteChar = ch;
      }
      current += ch;
    } else if (ch === "|") {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

function stripOuterQuotes(text: string): string {
  const t = text.trim();
  if (t.length >= 2) {
    const first = t[0];
    const last = t[t.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return t.slice(1, -1);
    }
  }
  return t;
}

interface MarkerHead {
  type: string;
  args: string;
}

export function parseMarkerHead(body: string): MarkerHead | undefined {
  const trimmed = body.trim();
  if (!trimmed) return undefined;
  const wsIdx = trimmed.search(/\s/);
  if (wsIdx === -1) {
    return { type: trimmed.toLowerCase(), args: "" };
  }
  return {
    type: trimmed.slice(0, wsIdx).toLowerCase(),
    args: trimmed.slice(wsIdx + 1).trim(),
  };
}

function evalDefault(args: string): string | undefined {
  const parts = splitOnPipe(args);
  if (parts.length < 2) return undefined;
  const expr = parts[0]?.trim() ?? "";
  const fallback = parts.slice(1).join("|").trim();
  if (expr.length > 0) {
    return expr;
  }
  return fallback;
}

interface IfMath {
  kind: "math";
  lhs: string;
  op: "<" | ">" | "<=" | ">=" | "==" | "!=";
  rhs: string;
}

interface IfFuzzy {
  kind: "fuzzy";
  lhs: string;
  threshold: number;
  rhs: string;
}

interface IfExact {
  kind: "exact";
  lhs: string;
  rhs: string;
}

type IfTerminator =
  | { kind: "branch"; thenText: string; elseText: string }
  | { kind: "transclude" };

interface IfMarker {
  comparator: IfMath | IfFuzzy | IfExact;
  terminator: IfTerminator;
}

const COMPARATOR_PATTERN = /(<=|>=|!=|==|~=\d*|<|>)/;

export function parseIfMarker(args: string): IfMarker | undefined {
  const opMatch = args.match(COMPARATOR_PATTERN);
  if (!opMatch || opMatch.index === undefined) return undefined;

  const lhs = args.slice(0, opMatch.index).trim();
  const op = opMatch[0];
  const rest = args.slice(opMatch.index + op.length).trim();

  let rhsRaw: string;
  let terminatorRaw: string;
  if (rest.startsWith('"') || rest.startsWith("'")) {
    const quote = rest[0] ?? '"';
    const endQuote = rest.indexOf(quote, 1);
    if (endQuote === -1) return undefined;
    rhsRaw = rest.slice(0, endQuote + 1);
    terminatorRaw = rest.slice(endQuote + 1).trim();
  } else {
    const m = rest.match(/^(\S+)\s*([\s\S]*)$/);
    if (!m) return undefined;
    rhsRaw = m[1] ?? "";
    terminatorRaw = (m[2] ?? "").trim();
  }

  const rhs = stripOuterQuotes(rhsRaw);

  let terminator: IfTerminator;
  if (terminatorRaw.toLowerCase() === "transclude") {
    terminator = { kind: "transclude" };
  } else if (terminatorRaw.startsWith("|")) {
    const branchParts = splitOnPipe(terminatorRaw.slice(1));
    if (branchParts.length < 2) return undefined;
    terminator = {
      kind: "branch",
      thenText: (branchParts[0] ?? "").trim(),
      elseText: branchParts.slice(1).join("|").trim(),
    };
  } else {
    return undefined;
  }

  let comparator: IfMath | IfFuzzy | IfExact;
  if (op.startsWith("~=")) {
    const tail = op.slice(2);
    const threshold = tail ? parseInt(tail, 10) : DEFAULT_FUZZY_THRESHOLD;
    comparator = {
      kind: "fuzzy",
      lhs,
      threshold: Number.isNaN(threshold) ? DEFAULT_FUZZY_THRESHOLD : threshold,
      rhs,
    };
  } else if ((op === "==" || op === "!=") && !looksNumeric(rhs)) {
    comparator = { kind: "exact", lhs, rhs };
    if (op === "!=") {
      const t = terminator;
      if (t.kind === "branch") {
        terminator = {
          kind: "branch",
          thenText: t.elseText,
          elseText: t.thenText,
        };
      }
    }
  } else {
    if (terminator.kind === "transclude") {
      return undefined;
    }
    comparator = {
      kind: "math",
      lhs,
      op: op as IfMath["op"],
      rhs,
    };
  }

  return { comparator, terminator };
}

function looksNumeric(text: string): boolean {
  return /^[-+]?\d+(\.\d+)?$/.test(text.trim());
}

interface ArithExpr {
  base: string;
  op?: "+" | "-" | "*" | "/";
  operand?: number;
}

function parseArithExpr(text: string): ArithExpr {
  const trimmed = text.trim();
  const m = trimmed.match(/^(.+?)\s*([+\-*/])\s*([-+]?\d+(?:\.\d+)?)$/);
  if (m) {
    return {
      base: (m[1] ?? "").trim(),
      op: m[2] as ArithExpr["op"],
      operand: Number(m[3]),
    };
  }
  return { base: trimmed };
}

function applyArith(
  value: number,
  op: ArithExpr["op"],
  operand: number
): number {
  switch (op) {
    case "+":
      return value + operand;
    case "-":
      return value - operand;
    case "*":
      return value * operand;
    case "/":
      return value / operand;
    default:
      return value;
  }
}

function evaluateMath(
  lhsRaw: string,
  op: IfMath["op"],
  rhsRaw: string
): boolean {
  const lhsExpr = parseArithExpr(lhsRaw);
  const rhsExpr = parseArithExpr(rhsRaw);

  const lhsBase = Number(lhsExpr.base);
  const rhsBase = Number(rhsExpr.base);

  if (Number.isNaN(lhsBase) || Number.isNaN(rhsBase)) {
    if (op === "==") return lhsExpr.base === rhsExpr.base;
    if (op === "!=") return lhsExpr.base !== rhsExpr.base;
    return false;
  }

  const lhs =
    lhsExpr.op !== undefined && lhsExpr.operand !== undefined
      ? applyArith(lhsBase, lhsExpr.op, lhsExpr.operand)
      : lhsBase;
  const rhs =
    rhsExpr.op !== undefined && rhsExpr.operand !== undefined
      ? applyArith(rhsBase, rhsExpr.op, rhsExpr.operand)
      : rhsBase;

  switch (op) {
    case "<":
      return lhs < rhs;
    case ">":
      return lhs > rhs;
    case "<=":
      return lhs <= rhs;
    case ">=":
      return lhs >= rhs;
    case "==":
      return lhs === rhs;
    case "!=":
      return lhs !== rhs;
  }
}

function fuzzyMatchAny(
  lhs: string,
  choices: string[],
  threshold: number
): boolean {
  const lowerLhs = lhs.toLowerCase().trim();
  for (const choice of choices) {
    const score = calculateSimilarity(lowerLhs, choice.toLowerCase().trim());
    if (score >= threshold) return true;
  }
  return false;
}

function exactMatchAny(lhs: string, choices: string[]): boolean {
  const normalized = lhs.toLowerCase().trim();
  for (const choice of choices) {
    if (choice.toLowerCase().trim() === normalized) return true;
  }
  return false;
}

function splitChoices(rhs: string): string[] {
  return rhs
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

interface BestMatch {
  card: StoryCard;
  score: number;
}

function findTranscludeCard(
  lhs: string,
  cardType: string,
  storyCards: StoryCard[],
  matcher: "fuzzy" | "exact",
  threshold: number
): StoryCard | undefined {
  const lowerType = cardType.toLowerCase().trim();
  const normalizedLhs = lhs.toLowerCase().trim();

  if (matcher === "exact") {
    for (const card of storyCards) {
      if (card.title === CONFIG_CARD_TITLE) continue;
      if (card.type?.toLowerCase() !== lowerType) continue;
      if (card.title && card.title.toLowerCase().trim() === normalizedLhs) {
        return card;
      }
      const keys = getCardKeys(card);
      if (keys.some((k) => k.toLowerCase().trim() === normalizedLhs)) {
        return card;
      }
    }
    return undefined;
  }

  let best: BestMatch | undefined;
  for (const card of storyCards) {
    if (card.title === CONFIG_CARD_TITLE) continue;
    if (card.type?.toLowerCase() !== lowerType) continue;

    let score = 0;
    if (card.title) {
      score = Math.max(
        score,
        calculateSimilarity(normalizedLhs, card.title.toLowerCase().trim())
      );
    }
    for (const key of getCardKeys(card)) {
      score = Math.max(
        score,
        calculateSimilarity(normalizedLhs, key.toLowerCase().trim())
      );
    }

    if (score >= threshold && (!best || score > best.score)) {
      best = { card, score };
    }
  }
  return best?.card;
}

function evalIf(args: string, ctx: EvalContext): string | undefined {
  const parsed = parseIfMarker(args);
  if (!parsed) return undefined;

  const { comparator, terminator } = parsed;

  if (terminator.kind === "transclude") {
    if (comparator.kind === "math") return undefined;
    const matcher = comparator.kind === "fuzzy" ? "fuzzy" : "exact";
    const threshold = comparator.kind === "fuzzy" ? comparator.threshold : 100;
    const card = findTranscludeCard(
      comparator.lhs,
      comparator.rhs,
      ctx.storyCards,
      matcher,
      threshold
    );
    return card?.entry ?? "";
  }

  let truthy: boolean;
  if (comparator.kind === "fuzzy") {
    truthy = fuzzyMatchAny(
      comparator.lhs,
      splitChoices(comparator.rhs),
      comparator.threshold
    );
  } else if (comparator.kind === "exact") {
    truthy = exactMatchAny(comparator.lhs, splitChoices(comparator.rhs));
  } else {
    truthy = evaluateMath(comparator.lhs, comparator.op, comparator.rhs);
  }
  return truthy ? terminator.thenText : terminator.elseText;
}

interface FilterMarker {
  expr: string;
  name: string;
  filterArgs: string[];
}

export function parseFilterMarker(args: string): FilterMarker | undefined {
  const parts = splitOnPipe(args);
  const head = (parts[0] ?? "").trim();
  if (!head) return undefined;
  const m = head.match(/^([\s\S]*?)\s+(\S+)$/);
  if (!m) {
    return {
      expr: "",
      name: head.toLowerCase(),
      filterArgs: parts.slice(1).map((p) => p.trim()),
    };
  }
  return {
    expr: (m[1] ?? "").trim(),
    name: (m[2] ?? "").toLowerCase(),
    filterArgs: parts.slice(1).map((p) => p.trim()),
  };
}

function decodeReplacement(text: string): string {
  return text.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\r/g, "\r");
}

function evalFilter(args: string): string | undefined {
  const parsed = parseFilterMarker(args);
  if (!parsed) return undefined;

  const expr = stripOuterQuotes(parsed.expr);

  switch (parsed.name) {
    case "capitalize":
      if (!expr) return expr;
      return expr.charAt(0).toUpperCase() + expr.slice(1);
    case "uncapitalize":
      if (!expr) return expr;
      return expr.charAt(0).toLowerCase() + expr.slice(1);
    case "trim":
      return expr.trim();
    case "lower":
      return expr.toLowerCase();
    case "upper":
      return expr.toUpperCase();
    case "replace": {
      if (parsed.filterArgs.length < 2) return undefined;
      const pattern = parsed.filterArgs[0] ?? "";
      const replacement = decodeReplacement(parsed.filterArgs[1] ?? "");
      try {
        const re = new RegExp(pattern, "g");
        return expr.replace(re, replacement);
      } catch {
        return undefined;
      }
    }
    case "dedupe": {
      if (parsed.filterArgs.length < 1) return undefined;
      const needle = parsed.filterArgs[0] ?? "";
      if (!needle || !expr) return expr;
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      try {
        const re = new RegExp(`(?:${escaped}){2,}`, "g");
        return expr.replace(re, needle);
      } catch {
        return undefined;
      }
    }
    default:
      return undefined;
  }
}

interface CaptureArgs {
  directed?: DirectedCapture;
}

function parseCaptureArgs(args: string): CaptureArgs {
  const trimmed = args.trim();
  if (!trimmed) return {};

  const intoMatch = trimmed.match(/into=(?:"([^"]+)"|'([^']+)'|(\S+))/i);
  if (!intoMatch) return {};
  const intoRaw = intoMatch[1] ?? intoMatch[2] ?? intoMatch[3] ?? "";

  const matched = Array.from(VALID_SECTION_NAMES).find(
    (s) => s.toLowerCase() === intoRaw.toLowerCase()
  );
  if (!matched) return {};

  const paraMatch = trimmed.match(/paragraph=(\d+)/i);
  const paragraph = paraMatch ? parseInt(paraMatch[1] ?? "0", 10) : 0;
  return {
    directed: {
      into: matched as SectionName,
      paragraph: Number.isNaN(paragraph) ? 0 : paragraph,
    },
  };
}

function evalExtract(args: string, ctx: EvalContext): string {
  let prefix = args.trim();
  if (!prefix) return "";
  prefix = stripOuterQuotes(prefix);

  const sources = [
    ctx.originalPromptText,
    ctx.capturedCreatorOutput,
  ].filter((s): s is string => typeof s === "string" && s.length > 0);
  if (sources.length === 0) return "";

  const reMatch = prefix.match(/^\/(.+)\/([gimsy]*)$/);
  if (reMatch) {
    for (const source of sources) {
      try {
        const re = new RegExp(reMatch[1] ?? "", reMatch[2] ?? "");
        const m = source.match(re);
        if (!m) continue;
        const group = m[1] !== undefined ? m[1] : m[0];
        const trimmed = group.trim();
        if (trimmed) return trimmed;
      } catch {
        return "";
      }
    }
    return "";
  }

  for (const source of sources) {
    const lines = source.split("\n");
    for (const line of lines) {
      const trimmedLine = line.trimStart();
      if (!trimmedLine.startsWith(prefix)) continue;
      const value = trimmedLine.slice(prefix.length).trim();
      if (!value) continue;
      if (value.includes("{{") || value.includes("}}")) continue;
      return value;
    }
  }
  return "";
}

const PARTIAL_PLACEHOLDER_PATTERN = /(?<!\$)\{[^{}]*\}/;

export function hasPartialPlaceholder(text: string): boolean {
  return PARTIAL_PLACEHOLDER_PATTERN.test(text);
}

interface CleanupMarker {
  expr: string;
  prefix?: string;
  suffix?: string;
}

export function parseCleanupMarker(args: string): CleanupMarker {
  const parts = splitOnPipe(args);
  const expr = parts[0] ?? "";
  if (parts.length === 1) {
    return { expr };
  }
  if (parts.length === 2) {
    return { expr, prefix: parts[1] };
  }
  return {
    expr,
    prefix: parts[1],
    suffix: parts.slice(2).join("|"),
  };
}

function evalCleanup(args: string): string {
  const parsed = parseCleanupMarker(args);
  if (hasPartialPlaceholder(parsed.expr)) return "";
  const cleaned = parsed.expr.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  if (parsed.suffix !== undefined) {
    const prefix = (parsed.prefix ?? "").trim();
    const suffix = parsed.suffix.trim();
    return prefix ? `${prefix} ${cleaned}${suffix}` : `${cleaned}${suffix}`;
  }

  if (parsed.prefix !== undefined) {
    const prefix = parsed.prefix.trim();
    return prefix ? `${prefix} ${cleaned}` : cleaned;
  }

  return cleaned;
}

interface EvalResult {
  text: string;
  directed?: DirectedCapture;
}

function evaluateMarker(
  body: string,
  ctx: EvalContext
): EvalResult | undefined {
  const head = parseMarkerHead(body);
  if (!head) return undefined;

  switch (head.type) {
    case "default": {
      const r = evalDefault(head.args);
      return r === undefined ? undefined : { text: r };
    }
    case "if": {
      const r = evalIf(head.args, ctx);
      return r === undefined ? undefined : { text: r };
    }
    case "filter": {
      const r = evalFilter(head.args);
      return r === undefined ? undefined : { text: r };
    }
    case "capture": {
      const parsed = parseCaptureArgs(head.args);
      if (parsed.directed) {
        return { text: "", directed: parsed.directed };
      }
      return { text: ctx.capturedCreatorOutput };
    }
    case "extract": {
      return { text: evalExtract(head.args, ctx) };
    }
    case "cleanup": {
      return { text: evalCleanup(head.args) };
    }
    case "remove":
      return { text: "" };
    default:
      return undefined;
  }
}

export function resolveMarkers(
  text: string,
  ctx: EvalContext,
  options: ResolveOptions = {}
): string {
  if (!text) return text;
  let current = text;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const markers = findInnermostMarkers(current);
    if (markers.length === 0) break;

    let changed = false;
    const replacements: Array<{
      start: number;
      end: number;
      replacement: string;
    }> = [];

    for (const marker of markers) {
      const head = parseMarkerHead(marker.body);
      if (!head) continue;

      if (isCleanupDirectiveType(head.type)) {
        continue;
      }

      const result = evaluateMarker(marker.body, ctx);
      if (!result) continue;

      if (
        result.directed &&
        options.collectDirectedCaptures &&
        options.region
      ) {
        options.collectDirectedCaptures.push({
          range: marker,
          region: options.region,
          directed: result.directed,
        });
      }

      replacements.push({
        start: marker.start,
        end: marker.end,
        replacement: result.text,
      });
    }

    if (replacements.length === 0) break;

    replacements.sort((a, b) => b.start - a.start);

    for (const rep of replacements) {
      const before = current.slice(0, rep.start);
      const after = current.slice(rep.end);
      const next = before + rep.replacement + after;
      if (next !== current) changed = true;
      current = next;
    }

    if (!changed) break;
  }
  return current;
}

interface CleanupDirective {
  kind: "removepost" | "removepre";
  marker: string;
  start: number;
  end: number;
}

function isCleanupDirectiveType(
  type: string
): type is "removepost" | "removepre" | "removeafter" | "removebefore" {
  return (
    type === "removepost" ||
    type === "removepre" ||
    type === "removeafter" ||
    type === "removebefore"
  );
}

function normalizeCleanupKind(type: string): "removepost" | "removepre" {
  if (type === "removeafter" || type === "removepost") return "removepost";
  return "removepre";
}

function collectCleanupDirectives(text: string): CleanupDirective[] {
  const directives: CleanupDirective[] = [];
  const markers = findInnermostMarkers(text);
  for (const m of markers) {
    const head = parseMarkerHead(m.body);
    if (!head) continue;
    if (!isCleanupDirectiveType(head.type)) continue;
    const arg = stripOuterQuotes(head.args);
    if (!arg) continue;
    directives.push({
      kind: normalizeCleanupKind(head.type),
      marker: arg,
      start: m.start,
      end: m.end,
    });
  }
  return directives;
}

export function applyCleanupDirectives(text: string): string {
  const directives = collectCleanupDirectives(text);
  if (directives.length === 0) return text;

  let stripped = text;
  const sorted = directives.slice().sort((a, b) => b.start - a.start);
  for (const d of sorted) {
    let start = d.start;
    let end = d.end;
    while (start > 0) {
      const prev = stripped[start - 1];
      if (prev === "\n" || prev === "\r" || prev === " " || prev === "\t") {
        start--;
      } else {
        break;
      }
    }
    while (end < stripped.length) {
      const next = stripped[end];
      if (next === "\n" || next === "\r" || next === " " || next === "\t") {
        end++;
      } else {
        break;
      }
    }
    stripped = stripped.slice(0, start) + stripped.slice(end);
  }

  const orderedMarkers = directives
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((d) => ({ kind: d.kind, marker: d.marker }));

  let result = stripped;
  for (const d of orderedMarkers) {
    const idx = result.indexOf(d.marker);
    if (idx === -1) continue;
    if (d.kind === "removepost") {
      result = result.slice(0, idx);
    } else {
      result = result.slice(idx + d.marker.length);
    }
  }

  return result.trim();
}

export function selectCreatorOutput(history: readonly History[]): string {
  const parts: string[] = [];
  for (const entry of history) {
    if (!entry) continue;
    if (entry.type === "continue") {
      if (entry.text) parts.push(entry.text);
    } else if (
      entry.type === "do" ||
      entry.type === "say" ||
      entry.type === "story" ||
      entry.type === "see"
    ) {
      break;
    }
  }
  return parts.join("\n\n");
}

export function spliceAtParagraph(
  body: string,
  index: number,
  insertion: string
): string {
  const trimmedInsertion = insertion.trim();
  if (!trimmedInsertion) return body;
  if (!body.trim()) return trimmedInsertion;

  const paragraphs = body.split(/\n\n+/);
  const clamped = Math.max(0, Math.min(index, paragraphs.length));
  paragraphs.splice(clamped, 0, trimmedInsertion);
  return paragraphs.join("\n\n");
}

const REGION_ORDER: readonly RegionKey[] = [
  "preamble",
  ...SECTION_ORDER,
  "postamble",
];

function collectPromptText(ctx: VirtualContext): string {
  const parts: string[] = [];
  if (ctx.preamble) parts.push(ctx.preamble);
  for (const section of SECTION_ORDER) {
    const body = ctx.sections.get(section)?.body;
    if (body) parts.push(body);
  }
  if (ctx.postamble) parts.push(ctx.postamble);
  return parts.join("\n\n");
}

function getRegionText(ctx: VirtualContext, region: RegionKey): string {
  if (region === "preamble") return ctx.preamble;
  if (region === "postamble") return ctx.postamble;
  return getSection(ctx, region)?.body ?? "";
}

function setRegionText(
  ctx: VirtualContext,
  region: RegionKey,
  text: string
): VirtualContext {
  if (region === "preamble") return setPreamble(ctx, text);
  if (region === "postamble") return setPostamble(ctx, text);
  return setSection(ctx, region, text);
}

const DEBUG_CARD_TITLE_CONTEXT = "Placeholders Debug (onContext)";
const DEBUG_CARD_TITLE_OUTPUT = "Placeholders Debug (onOutput)";
const DEBUG_CARD_KEYS = "foxtweaks_placeholders_debug";

interface MarkerTrace {
  region: RegionKey | "input" | "output";
  body: string;
  resolved: string;
  pass: number;
}

interface BakeTargetOutcome {
  status:
    | "skipped-no-cache"
    | "skipped-no-memory"
    | "skipped-unchanged"
    | "skipped-not-cache-efficient"
    | "skipped-transient-conflict-risk"
    | "wrote";
  bytesWritten?: number;
}

interface BakeOptions {
  /**
   * When true, bake unconditionally. When false (default), only bake on
   * cache-efficient models (where the `onContext` modifier output is ignored
   * and persistent state mutations are the only way to affect future turns).
   *
   * Placeholders passes `always: true` because its markers are an author-time
   * tool — they should resolve once and be baked permanently into Plot
   * Essentials and card entries regardless of runtime model behavior.
   */
  always?: boolean;
}

interface BakeOutcome {
  plotEssentials: BakeTargetOutcome;
  authorsNote: BakeTargetOutcome;
  storyCards: {
    cardsUpdated: number;
    totalCardsScanned: number;
  };
}

interface DebugSnapshot {
  hook: "onInput" | "onContext" | "onOutput";
  actionCount: number;
  enabled: boolean;
  captureCacheState: "null" | "populated" | "still-null";
  capturedCreatorOutput: string;
  markerTraces: MarkerTrace[];
  unresolvedBodies: string[];
  pendingDirected: number;
  removeSweepFired: boolean;
  removedCardCount: number;
  bake?: BakeOutcome;
  useCacheEfficient?: boolean;
  modelName?: string;
}

function collectMarkerTraces(
  text: string,
  ctx: EvalContext,
  region: MarkerTrace["region"]
): MarkerTrace[] {
  const traces: MarkerTrace[] = [];
  let current = stripComments(text);

  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    const markers = findInnermostMarkers(current);
    if (markers.length === 0) break;

    const replacements: Array<{
      start: number;
      end: number;
      replacement: string;
    }> = [];
    let madeProgress = false;

    for (const m of markers) {
      const head = parseMarkerHead(m.body);
      if (!head) continue;

      if (isCleanupDirectiveType(head.type)) {
        traces.push({
          region,
          body: m.body,
          resolved: "<deferred to cleanup pass>",
          pass,
        });
        continue;
      }

      let resolvedText: string | undefined;
      try {
        const result = evaluateMarker(m.body, ctx);
        if (!result) {
          traces.push({
            region,
            body: m.body,
            resolved: `<unknown marker type: ${head.type}>`,
            pass,
          });
        } else {
          resolvedText = result.text;
          traces.push({
            region,
            body: m.body,
            resolved: result.text,
            pass,
          });
        }
      } catch (e) {
        traces.push({
          region,
          body: m.body,
          resolved: `<<error: ${(e as Error).message}>>`,
          pass,
        });
      }

      if (resolvedText !== undefined) {
        replacements.push({
          start: m.start,
          end: m.end,
          replacement: resolvedText,
        });
        madeProgress = true;
      }
    }

    if (!madeProgress) break;

    replacements.sort((a, b) => b.start - a.start);
    for (const rep of replacements) {
      current =
        current.slice(0, rep.start) + rep.replacement + current.slice(rep.end);
    }
  }

  return traces;
}

function findUnresolved(text: string): string[] {
  const markers = findInnermostMarkers(text);
  const bodies: string[] = [];
  for (const m of markers) {
    bodies.push(m.body);
  }
  return bodies;
}

function writeDebugCard(snapshot: DebugSnapshot): void {
  const lines: string[] = [];
  lines.push(`Hook: ${snapshot.hook}`);
  lines.push(`Enabled: ${snapshot.enabled}`);
  lines.push(`actionCount: ${snapshot.actionCount}`);
  if (snapshot.modelName) {
    lines.push(`Model: ${snapshot.modelName}`);
  }
  if (snapshot.useCacheEfficient !== undefined) {
    lines.push(
      `Cache-efficient model: ${snapshot.useCacheEfficient}` +
        (snapshot.useCacheEfficient
          ? "  (onContext output is ignored; rely on bake-in)"
          : "")
    );
  }
  lines.push(`Capture cache: ${snapshot.captureCacheState}`);
  if (snapshot.capturedCreatorOutput) {
    const preview =
      snapshot.capturedCreatorOutput.length > 300
        ? snapshot.capturedCreatorOutput.slice(0, 300) + "..."
        : snapshot.capturedCreatorOutput;
    lines.push(`Capture preview: ${preview}`);
  }
  lines.push(`Pending directed captures: ${snapshot.pendingDirected}`);
  lines.push(`Remove sweep fired this turn: ${snapshot.removeSweepFired}`);
  if (snapshot.removeSweepFired) {
    lines.push(`Cards removed: ${snapshot.removedCardCount}`);
  }
  lines.push("");
  lines.push(`Markers found and resolved (${snapshot.markerTraces.length}):`);
  for (const trace of snapshot.markerTraces) {
    const r = trace.resolved.startsWith("<")
      ? trace.resolved
      : JSON.stringify(trace.resolved);
    const bodyDisplay = trace.body.replace(/\n/g, "\\n").replace(/\t/g, "\\t");
    lines.push(`  pass ${trace.pass} [${trace.region}] {{${bodyDisplay}}} -> ${r}`);
  }
  if (snapshot.unresolvedBodies.length > 0) {
    lines.push("");
    lines.push(
      `Unresolved markers after value pass (${snapshot.unresolvedBodies.length}):`
    );
    for (const body of snapshot.unresolvedBodies) {
      lines.push(`  {{${body}}}`);
    }
  }
  if (snapshot.bake) {
    lines.push("");
    lines.push("Bake-in to persistent state:");
    lines.push(
      `  state.memory.context: ${snapshot.bake.plotEssentials.status}${
        snapshot.bake.plotEssentials.bytesWritten !== undefined
          ? ` (${snapshot.bake.plotEssentials.bytesWritten} bytes)`
          : ""
      }`
    );
    lines.push(
      `  state.memory.authorsNote: ${snapshot.bake.authorsNote.status}${
        snapshot.bake.authorsNote.bytesWritten !== undefined
          ? ` (${snapshot.bake.authorsNote.bytesWritten} bytes)`
          : ""
      }`
    );
    lines.push(
      `  story card entries: ${snapshot.bake.storyCards.cardsUpdated}/${snapshot.bake.storyCards.totalCardsScanned} updated`
    );
  }
  const content = lines.join("\n");

  const cardTitle =
    snapshot.hook === "onContext"
      ? DEBUG_CARD_TITLE_CONTEXT
      : DEBUG_CARD_TITLE_OUTPUT;
  const existingIdx = storyCards.findIndex((c) => c.title === cardTitle);
  if (existingIdx >= 0) {
    const card = storyCards[existingIdx];
    if (card) {
      card.description = content;
      card.entry = "";
    }
  } else {
    const card = addStoryCard(DEBUG_CARD_KEYS, "", "debug", cardTitle, content, {
      returnCard: true,
    });
    if (card) {
      card.title = cardTitle;
      card.type = "debug";
      card.description = content;
    }
  }
}

function bakeStateMemoryField(
  cached: unknown,
  fieldName: "context" | "authorsNote",
  options: BakeOptions = {}
): BakeTargetOutcome {
  const useCE = info?.useCacheEfficient === true;
  if (!options.always && !useCE) {
    return { status: "skipped-not-cache-efficient" };
  }
  if (typeof cached !== "string") {
    return { status: "skipped-no-cache" };
  }
  const mem = state?.memory;
  if (!mem) {
    return { status: "skipped-no-memory" };
  }
  if (mem[fieldName] === cached) {
    return { status: "skipped-unchanged" };
  }
  mem[fieldName] = cached;
  return { status: "wrote", bytesWritten: cached.length };
}

function bakeStoryCardEntries(
  storyCards: StoryCard[],
  evalCtx: EvalContext,
  options: BakeOptions = {}
): { cardsUpdated: number; totalCardsScanned: number; skippedReason?: string } {
  const useCE = info?.useCacheEfficient === true;
  if (!options.always && !useCE) {
    return {
      cardsUpdated: 0,
      totalCardsScanned: 0,
      skippedReason: "not-cache-efficient",
    };
  }
  let cardsUpdated = 0;
  let totalCardsScanned = 0;
  for (const card of storyCards) {
    if (!card.entry) continue;
    if (card.title === "FoxTweaks Config") continue;
    if (card.title === DEBUG_CARD_TITLE_CONTEXT) continue;
    if (card.title === DEBUG_CARD_TITLE_OUTPUT) continue;
    if (!card.entry.includes("{{")) continue;
    totalCardsScanned++;
    const stripped = stripComments(card.entry);
    const resolved = resolveMarkers(stripped, evalCtx);
    const cleaned = applyCleanupDirectives(resolved);
    if (cleaned !== card.entry) {
      card.entry = cleaned;
      cardsUpdated++;
    }
  }
  return { cardsUpdated, totalCardsScanned };
}

function bakeResolvedTargets(
  context: HookContext,
  evalCtx: EvalContext
): BakeOutcome {
  return {
    plotEssentials: bakeStateMemoryField(
      context.state.lastResolvedPreamble,
      "context",
      { always: true }
    ),
    authorsNote: { status: "skipped-transient-conflict-risk" },
    storyCards: bakeStoryCardEntries(context.storyCards, evalCtx, {
      always: true,
    }),
  };
}

function runRemoveSweep(storyCards: StoryCard[]): number {
  let removed = 0;
  for (let i = storyCards.length - 1; i >= 0; i--) {
    const card = storyCards[i];
    if (!card) continue;
    const entryHas = !!card.entry && card.entry.includes("{{remove}}");
    const keysHas = getCardKeys(card).some((k) => k.includes("{{remove}}"));
    if (entryHas || keysHas) {
      try {
        removeStoryCard(i);
        removed++;
      } catch {
        // ignore — out-of-bounds shouldn't happen since we iterate in reverse
      }
    }
  }
  return removed;
}

export const Placeholders: Module<PlaceholdersConfig> = (() => {
  function validateConfig(raw: Record<string, unknown>): PlaceholdersConfig {
    return {
      enable: booleanValidator(raw, "enable", true),
      debug: booleanValidator(raw, "debug", false),
    };
  }

  function buildEvalContext(
    context: HookContext,
    originalPromptText?: string
  ): EvalContext {
    const cached = context.state.capturedCreatorOutput;
    return {
      capturedCreatorOutput: typeof cached === "string" ? cached : "",
      storyCards: context.storyCards,
      originalPromptText,
    };
  }

  function onInput(
    text: string,
    config: PlaceholdersConfig,
    context: HookContext
  ): string {
    if (!config.enable) return text;
    const stripped = stripComments(text);
    const evalCtx = buildEvalContext(context);
    return resolveMarkers(stripped, evalCtx);
  }

  function onContext(
    ctx: VirtualContext,
    config: PlaceholdersConfig,
    context: HookContext
  ): VirtualContext {
    if (!config.enable) return ctx;

    if (context.state.capturedCreatorOutput == null) {
      const captured = selectCreatorOutput(context.history);
      if (captured) {
        context.state.capturedCreatorOutput = captured;
      }
    }

    const originalPromptText = collectPromptText(ctx);
    const originalPreamble = ctx.preamble;
    const evalCtx = buildEvalContext(context, originalPromptText);

    let working = ctx;
    for (const region of REGION_ORDER) {
      const original = getRegionText(working, region);
      if (!original) continue;
      const cleaned = stripComments(original);
      if (cleaned !== original) {
        working = setRegionText(working, region, cleaned);
      }
    }

    const pendingDirected: PendingDirected[] = [];

    for (const region of REGION_ORDER) {
      const text = getRegionText(working, region);
      if (!text) continue;
      const resolved = resolveMarkers(text, evalCtx, {
        collectDirectedCaptures: pendingDirected,
        region,
      });
      if (resolved !== text) {
        working = setRegionText(working, region, resolved);
      }
    }

    if (pendingDirected.length > 0) {
      for (const pd of pendingDirected) {
        const targetBody = getRegionText(working, pd.directed.into);
        const newBody = spliceAtParagraph(
          targetBody,
          pd.directed.paragraph,
          evalCtx.capturedCreatorOutput
        );
        working = setRegionText(working, pd.directed.into, newBody);
      }
    }

    for (const region of REGION_ORDER) {
      const text = getRegionText(working, region);
      if (!text) continue;
      const cleaned = applyCleanupDirectives(text);
      if (cleaned !== text) {
        working = setRegionText(working, region, cleaned);
      }
    }

    context.state.lastOriginalPreamble = originalPreamble;
    context.state.lastResolvedPreamble = working.preamble;
    const resolvedAuthorsNote = getSection(working, "Author's Note")?.body;
    if (typeof resolvedAuthorsNote === "string") {
      context.state.lastResolvedAuthorsNote = resolvedAuthorsNote;
    }

    let removed = 0;
    let removeSweepFired = false;
    if (!context.state.removalDone) {
      const actionCount = context.info?.actionCount ?? 0;
      if (actionCount >= 1 && actionCount <= REMOVE_SWEEP_MAX_ACTION_COUNT) {
        removed = runRemoveSweep(context.storyCards);
        context.state.removalDone = true;
        removeSweepFired = true;
      }
    }

    if (config.debug) {
      const cacheState = context.state.capturedCreatorOutput == null
        ? "null"
        : "populated";
      const traces: MarkerTrace[] = [];
      for (const region of REGION_ORDER) {
        const original = getRegionText(ctx, region);
        if (!original) continue;
        traces.push(...collectMarkerTraces(original, evalCtx, region));
      }
      const unresolved: string[] = [];
      for (const region of REGION_ORDER) {
        const finalText = getRegionText(working, region);
        if (!finalText) continue;
        unresolved.push(...findUnresolved(finalText));
      }
      writeDebugCard({
        hook: "onContext",
        actionCount: context.info?.actionCount ?? 0,
        enabled: config.enable,
        captureCacheState: cacheState,
        capturedCreatorOutput: evalCtx.capturedCreatorOutput,
        markerTraces: traces,
        unresolvedBodies: unresolved,
        pendingDirected: pendingDirected.length,
        removeSweepFired,
        removedCardCount: removed,
        useCacheEfficient: context.info?.useCacheEfficient,
        modelName: context.info?.storyModel?.name,
      });
    }

    return working;
  }

  function onOutput(
    text: string,
    config: PlaceholdersConfig,
    context: HookContext
  ): string {
    if (!config.enable) return text;

    const stripped = stripComments(text);
    const evalCtx = buildEvalContext(context);
    const resolved = resolveMarkers(stripped, evalCtx);

    const bake = bakeResolvedTargets(context, evalCtx);

    if (config.debug) {
      writeDebugCard({
        hook: "onOutput",
        actionCount: context.info?.actionCount ?? 0,
        enabled: config.enable,
        captureCacheState:
          context.state.capturedCreatorOutput == null ? "null" : "populated",
        capturedCreatorOutput: evalCtx.capturedCreatorOutput,
        markerTraces: [],
        unresolvedBodies: [],
        pendingDirected: 0,
        removeSweepFired: false,
        removedCardCount: 0,
        bake,
        useCacheEfficient: context.info?.useCacheEfficient,
        modelName: context.info?.storyModel?.name,
      });
    }

    return resolved;
  }

  return {
    name: "placeholders",
    configSection: `--- Placeholders ---
Enable: true  # Process {{...}} markers (default, if, filter, cleanup, capture, extract, removepost, remove)
Debug: false  # Emit a "Placeholders Debug" story card with per-pass marker diagnostics`,
    validateConfig,
    hooks: {
      onInput,
      onContext,
      onOutput,
    },
    initialState: {
      capturedCreatorOutput: null,
      removalDone: false,
    },
  };
})();
