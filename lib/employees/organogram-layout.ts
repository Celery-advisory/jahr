import type { OrganogramNode } from "@/lib/employees/get-directory";

export const ORG_CARD_WIDTH = 216;
export const ORG_CARD_HEIGHT = 88;

const SIBLING_GAP = 24;
const ROOT_GAP = 48;
const LEVEL_GAP = 48;
const STACK_TOP_GAP = 24;
const STACK_COLUMN_GAP = 40;
const STACK_ROW_GAP = 12;
const ASSISTANT_TOP_GAP = 24;
const ASSISTANT_OFFSET = 24;
const ROW_GUTTER = 24;
const MIN_STACK_SIZE = 3;

/** Widest-first, so ties keep the most natural tree. */
const ROW_LIMITS = [Number.POSITIVE_INFINITY, 8, 6, 5, 4, 3, 2] as const;

export interface PlacedCard {
  node: OrganogramNode;
  x: number;
  y: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface OrganogramLayout {
  width: number;
  height: number;
  cards: PlacedCard[];
  segments: Segment[];
}

interface Block extends OrganogramLayout {
  /** Centre x of the block's top card, used to hang connectors. */
  anchorX: number;
}

interface LayoutOptions {
  maxPerRow: number;
  stackLeaves: boolean;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface OrganogramFit {
  layout: OrganogramLayout;
  scale: number;
}

function isLeaf(node: OrganogramNode): boolean {
  return node.children.length === 0 && node.assistants.length === 0;
}

function horizontal(x1: number, x2: number, y: number): Segment {
  return { x1, y1: y, x2, y2: y };
}

function vertical(x: number, y1: number, y2: number): Segment {
  return { x1: x, y1, x2: x, y2 };
}

function translate(block: OrganogramLayout, dx: number, dy: number) {
  return {
    cards: block.cards.map((card) => ({
      ...card,
      x: card.x + dx,
      y: card.y + dy,
    })),
    segments: block.segments.map((segment) => ({
      x1: segment.x1 + dx,
      y1: segment.y1 + dy,
      x2: segment.x2 + dx,
      y2: segment.y2 + dy,
    })),
  };
}

/** Shifts content so its left edge sits at x = 0 and reports the bounds. */
function finalize(
  cards: PlacedCard[],
  segments: Segment[],
  anchorX: number,
): Block {
  const xs = [
    ...cards.flatMap((card) => [card.x, card.x + ORG_CARD_WIDTH]),
    ...segments.flatMap((segment) => [segment.x1, segment.x2]),
  ];
  const ys = [
    ...cards.map((card) => card.y + ORG_CARD_HEIGHT),
    ...segments.flatMap((segment) => [segment.y1, segment.y2]),
  ];
  const minX = Math.min(...xs);
  const shifted = translate({ width: 0, height: 0, cards, segments }, -minX, 0);

  return {
    ...shifted,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys),
    anchorX: anchorX - minX,
  };
}

/** Contiguous rows of near-equal length, so reading order is preserved. */
function splitIntoRows<T>(items: T[], maxPerRow: number): T[][] {
  const rowCount = Math.max(1, Math.ceil(items.length / maxPerRow));
  const base = Math.floor(items.length / rowCount);
  const extra = items.length % rowCount;
  const rows: T[][] = [];
  let start = 0;
  for (let index = 0; index < rowCount; index += 1) {
    const size = base + (index < extra ? 1 : 0);
    rows.push(items.slice(start, start + size));
    start += size;
  }
  return rows;
}

function rowWidth(blocks: Block[], gap: number): number {
  return (
    blocks.reduce((sum, block) => sum + block.width, 0) +
    gap * Math.max(blocks.length - 1, 0)
  );
}

/** Two columns either side of a spine that drops from the parent. */
function placeStack(
  children: OrganogramNode[],
  top: number,
  cards: PlacedCard[],
  segments: Segment[],
): void {
  const halfGap = STACK_COLUMN_GAP / 2;
  let lastMidY = top;

  children.forEach((child, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const y = top + row * (ORG_CARD_HEIGHT + STACK_ROW_GAP);
    const midY = y + ORG_CARD_HEIGHT / 2;
    const x = column === 0 ? -halfGap - ORG_CARD_WIDTH : halfGap;

    cards.push({ node: child, x, y });
    segments.push(
      column === 0 ? horizontal(-halfGap, 0, midY) : horizontal(0, halfGap, midY),
    );
    lastMidY = midY;
  });

  segments.push(vertical(0, ORG_CARD_HEIGHT, lastMidY));
}

/** Wrapped rows of subtrees. Extra rows hang off a gutter on the left. */
function placeRows(
  children: OrganogramNode[],
  top: number,
  options: LayoutOptions,
  cards: PlacedCard[],
  segments: Segment[],
): void {
  const rows = splitIntoRows(
    children.map((child) => layoutNode(child, options)),
    options.maxPerRow,
  );
  const wrapped = rows.length > 1;
  const widest = Math.max(...rows.map((row) => rowWidth(row, SIBLING_GAP)));
  const regionLeft = wrapped ? ROW_GUTTER : 0;
  const gutterX = ROW_GUTTER / 2;

  const regionCards: PlacedCard[] = [];
  const regionSegments: Segment[] = [];
  const busYs: number[] = [];
  const rowCenters: number[][] = [];
  let rowTop = top;

  for (const row of rows) {
    const busY = rowTop - LEVEL_GAP / 2;
    let x = regionLeft + (widest - rowWidth(row, SIBLING_GAP)) / 2;
    const centers: number[] = [];

    for (const block of row) {
      const placed = translate(block, x, rowTop);
      regionCards.push(...placed.cards);
      regionSegments.push(...placed.segments);
      const centerX = x + block.anchorX;
      centers.push(centerX);
      regionSegments.push(vertical(centerX, busY, rowTop));
      x += block.width + SIBLING_GAP;
    }

    busYs.push(busY);
    rowCenters.push(centers);
    rowTop += Math.max(...row.map((block) => block.height)) + LEVEL_GAP;
  }

  const firstCenters = rowCenters[0] ?? [];
  const firstCenter = firstCenters[0] ?? 0;
  const lastCenter = firstCenters[firstCenters.length - 1] ?? 0;
  const parentX = wrapped
    ? regionLeft + widest / 2
    : (firstCenter + lastCenter) / 2;
  const firstBusY = busYs[0] ?? top;

  regionSegments.push(
    horizontal(
      Math.min(firstCenter, parentX, wrapped ? gutterX : firstCenter),
      Math.max(lastCenter, parentX),
      firstBusY,
    ),
  );

  if (wrapped) {
    const lastBusY = busYs[busYs.length - 1] ?? firstBusY;
    regionSegments.push(vertical(gutterX, firstBusY, lastBusY));
    rowCenters.slice(1).forEach((centers, index) => {
      const busY = busYs[index + 1] ?? lastBusY;
      const rowEnd = centers[centers.length - 1] ?? gutterX;
      regionSegments.push(horizontal(gutterX, rowEnd, busY));
    });
  }

  const aligned = translate(
    { width: 0, height: 0, cards: regionCards, segments: regionSegments },
    -parentX,
    0,
  );
  cards.push(...aligned.cards);
  segments.push(...aligned.segments, vertical(0, ORG_CARD_HEIGHT, firstBusY));
}

/** Lays a subtree out with its top card centred on x = 0. */
function layoutNode(node: OrganogramNode, options: LayoutOptions): Block {
  const cards: PlacedCard[] = [
    { node, x: -ORG_CARD_WIDTH / 2, y: 0 },
  ];
  const segments: Segment[] = [];

  const sideAssistants = node.assistants.filter(isLeaf);
  const children = [
    ...node.assistants.filter((assistant) => !isLeaf(assistant)),
    ...node.children,
  ];

  let contentBottom = ORG_CARD_HEIGHT;

  if (sideAssistants.length > 0) {
    const assistantTop = ORG_CARD_HEIGHT + ASSISTANT_TOP_GAP;
    const tickY = assistantTop + ORG_CARD_HEIGHT / 2;
    sideAssistants.forEach((assistant, index) => {
      cards.push({
        node: assistant,
        x:
          -ASSISTANT_OFFSET -
          ORG_CARD_WIDTH -
          index * (ORG_CARD_WIDTH + SIBLING_GAP),
        y: assistantTop,
      });
    });
    segments.push(horizontal(-ASSISTANT_OFFSET, 0, tickY));
    if (children.length === 0) {
      segments.push(vertical(0, ORG_CARD_HEIGHT, tickY));
    }
    contentBottom = assistantTop + ORG_CARD_HEIGHT;
  }

  if (children.length > 0) {
    const stack =
      options.stackLeaves &&
      children.length >= MIN_STACK_SIZE &&
      children.every(isLeaf);

    if (stack) {
      placeStack(children, contentBottom + STACK_TOP_GAP, cards, segments);
    } else {
      placeRows(children, contentBottom + LEVEL_GAP, options, cards, segments);
    }
  }

  return finalize(cards, segments, 0);
}

function layoutForest(
  roots: OrganogramNode[],
  options: LayoutOptions,
): OrganogramLayout {
  const rows = splitIntoRows(
    roots.map((root) => layoutNode(root, options)),
    options.maxPerRow,
  );
  const widest = Math.max(...rows.map((row) => rowWidth(row, ROOT_GAP)));
  const cards: PlacedCard[] = [];
  const segments: Segment[] = [];
  let rowTop = 0;

  for (const row of rows) {
    let x = (widest - rowWidth(row, ROOT_GAP)) / 2;
    for (const block of row) {
      const placed = translate(block, x, rowTop);
      cards.push(...placed.cards);
      segments.push(...placed.segments);
      x += block.width + ROOT_GAP;
    }
    rowTop += Math.max(...row.map((block) => block.height)) + ROOT_GAP;
  }

  return enclose(finalize(cards, segments, 0));
}

/** Makes the reported box include every card and line, including ones above or left of 0. */
function enclose(layout: OrganogramLayout): OrganogramLayout {
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;

  for (const card of layout.cards) {
    minX = Math.min(minX, card.x);
    minY = Math.min(minY, card.y);
    maxX = Math.max(maxX, card.x + ORG_CARD_WIDTH);
    maxY = Math.max(maxY, card.y + ORG_CARD_HEIGHT);
  }
  for (const segment of layout.segments) {
    minX = Math.min(minX, segment.x1, segment.x2);
    minY = Math.min(minY, segment.y1, segment.y2);
    maxX = Math.max(maxX, segment.x1, segment.x2);
    maxY = Math.max(maxY, segment.y1, segment.y2);
  }

  const shifted = translate(layout, -minX, -minY);
  return {
    cards: shifted.cards,
    segments: shifted.segments,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/** Every arrangement worth trying. Independent of screen size. */
export function organogramLayoutCandidates(
  roots: OrganogramNode[],
): OrganogramLayout[] {
  if (roots.length === 0) return [];
  return ROW_LIMITS.flatMap((maxPerRow) =>
    [true, false].map((stackLeaves) =>
      layoutForest(roots, { maxPerRow, stackLeaves }),
    ),
  );
}

/** The arrangement that renders largest inside the viewport, never above 1x. */
export function pickBestFit(
  candidates: OrganogramLayout[],
  viewport: Viewport,
): OrganogramFit | null {
  let best: OrganogramFit | null = null;
  for (const layout of candidates) {
    const scale = Math.min(
      viewport.width / layout.width,
      viewport.height / layout.height,
      1,
    );
    if (!best || scale > best.scale) {
      best = { layout, scale };
    }
  }
  return best;
}

export function segmentsToPath(segments: Segment[]): string {
  return segments
    .map(({ x1, y1, x2, y2 }) => `M${x1} ${y1}L${x2} ${y2}`)
    .join("");
}
