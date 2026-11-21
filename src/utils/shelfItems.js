export const DEFAULT_SHELF_HEIGHT = 240;
export const MAX_SHELF_HEIGHT = 500;
export const SHELF_TOP_PADDING = 24;
export const SHELF_BORDER_HEIGHT = 8;
export const COVER_ORIENTATION_HEIGHT = 144;
export const HORIZONTAL_BOOK_HEIGHT = 24;
export const BOOK_HEIGHT_MIN = 140;
export const BOOK_HEIGHT_RANGE = 50;
export const MAX_BOOK_HEIGHT = BOOK_HEIGHT_MIN + BOOK_HEIGHT_RANGE;

export function getItemWidth(item, bookMap) {
  if (item.type === "empty-slot") return 60;
  if (item.type === "horizontal-stack") return 160;
  const book = bookMap[item.bookId];
  if (item.orientation === "cover") return 104; // 96px + mx-1 (8px margin)
  const pages =
    typeof book?.pages === "number" ? book.pages : parseInt(book?.pages) || 200;
  if (pages <= 100) return 16;
  if (pages >= 800) return 40;
  return Math.round(16 + 24 * ((pages - 100) / 700));
}

export function getAvailableWidth(shelfWidth) {
  return shelfWidth - 32; // 16px padding each side
}

export function getShelfSegmentLayout(items, bookMap, shelfWidth, dividerCount = 0) {
  const contentWidth = getAvailableWidth(shelfWidth);
  const segmentCount = Math.max(1, dividerCount + 1);
  const dividerWidth = 8;
  const baseSegmentWidth = contentWidth / segmentCount;
  const segmentWidths = Array.from({ length: segmentCount }, (_, index) => {
    if (segmentCount === 1) return contentWidth;
    return baseSegmentWidth - (index === 0 || index === segmentCount - 1
      ? dividerWidth / 2
      : dividerWidth);
  });
  const segments = segmentWidths.map(() => []);
  const usedWidths = segmentWidths.map(() => 0);
  const itemSections = [];
  let segmentIndex = 0;

  items.forEach((item, index) => {
    const itemWidth = getItemWidth(item, bookMap);
    if (Number.isInteger(item.sectionIndex)) {
      segmentIndex = Math.max(0, Math.min(segmentWidths.length - 1, item.sectionIndex));
    } else {
      while (
        segmentIndex < segmentWidths.length - 1 &&
        usedWidths[segmentIndex] + itemWidth > segmentWidths[segmentIndex]
      ) {
        segmentIndex++;
      }
    }
    segments[segmentIndex].push({ item, index });
    usedWidths[segmentIndex] += itemWidth;
    itemSections[index] = segmentIndex;
  });

  return {
    segments,
    segmentWidths,
    usedWidths,
    itemSections,
    fits: usedWidths.every((usedWidth, index) => usedWidth <= segmentWidths[index]),
  };
}

export function assignShelfSections(
  shelves,
  bookMap,
  shelfWidth,
  dividerCount = 0,
  reassign = false,
) {
  return shelves.map((shelf) => {
    const items = shelf.items || [];
    const itemsToLayout = reassign
      ? items.map((item) => {
          const copy = { ...item };
          delete copy.sectionIndex;
          return copy;
        })
      : items;
    const { itemSections } = getShelfSegmentLayout(
      itemsToLayout,
      bookMap,
      shelfWidth,
      dividerCount,
    );
    return {
      ...shelf,
      items: items.map((item, index) => ({
        ...item,
        sectionIndex: itemSections[index],
      })),
    };
  });
}

export function canFitItemsInShelfSegments(items, bookMap, shelfWidth, dividerCount = 0) {
  return getShelfSegmentLayout(items, bookMap, shelfWidth, dividerCount).fits;
}

export function getNextBookOrientations(currentOrientation) {
  if (currentOrientation === "vertical") {
    return ["cover", "horizontal", "vertical"];
  }
  if (currentOrientation === "cover") {
    return ["horizontal", "vertical", "cover"];
  }
  return ["vertical", "cover", "horizontal"];
}

export function getShelfMinHeight(items, bookMap) {
  let tallest = 0;
  for (const item of items) {
    if (item.type === "empty-slot") continue;
    if (item.type === "horizontal-stack") {
      tallest = Math.max(tallest, item.bookIds.length * HORIZONTAL_BOOK_HEIGHT);
    } else if (item.orientation === "cover") {
      tallest = Math.max(tallest, COVER_ORIENTATION_HEIGHT);
    } else {
      tallest = Math.max(tallest, bookMap[item.bookId]?.height || 0);
    }
  }
  return Math.max(MAX_BOOK_HEIGHT, tallest) + SHELF_TOP_PADDING;
}

export function getMaxStackBooks(shelfHeight) {
  const usable = (shelfHeight ?? DEFAULT_SHELF_HEIGHT) - SHELF_TOP_PADDING;
  return Math.max(1, Math.floor(usable / HORIZONTAL_BOOK_HEIGHT));
}

export function makeItemId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
