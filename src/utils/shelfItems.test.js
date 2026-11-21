import test from "node:test";
import assert from "node:assert/strict";
import {
  assignShelfSections,
  canFitItemsInShelfSegments,
  getAvailableWidth,
  getNextBookOrientations,
  getShelfSegmentLayout,
} from "./shelfItems.js";

const makeBooks = (count, pages = 800) => {
  const items = Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    type: "book",
    bookId: `book-${index}`,
    orientation: "vertical",
  }));
  const bookMap = Object.fromEntries(
    items.map((item) => [item.bookId, { pages }]),
  );
  return { items, bookMap };
};

test("orientation cycling skips blocked orientations and continues around the cycle", () => {
  assert.deepEqual(
    getNextBookOrientations("vertical"),
    ["cover", "horizontal", "vertical"],
  );
  assert.deepEqual(
    getNextBookOrientations("cover"),
    ["horizontal", "vertical", "cover"],
  );
  assert.deepEqual(
    getNextBookOrientations("horizontal"),
    ["vertical", "cover", "horizontal"],
  );
});

test("divider layout keeps every item and moves items into the next section", () => {
  const { items, bookMap } = makeBooks(5);
  const layout = getShelfSegmentLayout(items, bookMap, 432, 1);

  assert.equal(layout.fits, true);
  assert.deepEqual(layout.segments.map((segment) => segment.length), [4, 1]);
  assert.deepEqual(
    layout.segments.flat().map(({ item }) => item.id),
    items.map((item) => item.id),
  );
  assert.equal(
    layout.segmentWidths.reduce((sum, width) => sum + width, 0) + 8,
    getAvailableWidth(432),
  );
  const sectioned = assignShelfSections(
    [{ id: "shelf-1", items }],
    bookMap,
    432,
    1,
  );
  assert.deepEqual(
    sectioned[0].items.map((item) => item.sectionIndex),
    [0, 0, 0, 0, 1],
  );
});

test("capacity validation rejects additions that exceed fixed section widths", () => {
  const { items, bookMap } = makeBooks(10);
  const layout = getShelfSegmentLayout(items, bookMap, 432, 1);

  assert.equal(layout.fits, false);
  assert.equal(canFitItemsInShelfSegments(items, bookMap, 432, 1), false);
  assert.equal(layout.segments.flat().length, items.length);
});

test("assigned books stay in their section instead of shifting into an open section", () => {
  const { items, bookMap } = makeBooks(5);
  const assignedItems = items.map((item, index) => ({
    ...item,
    sectionIndex: index < 4 ? 0 : 1,
  }));
  const moved = [assignedItems[0], assignedItems[4], ...assignedItems.slice(1, 4)];
  const layout = getShelfSegmentLayout(moved, bookMap, 432, 1);

  assert.deepEqual(layout.itemSections, [0, 1, 0, 0, 0]);

  const overfilledSection = [
    ...assignedItems.slice(0, 4),
    { ...items[4], id: "extra", bookId: "extra", sectionIndex: 0 },
  ];
  assert.equal(
    canFitItemsInShelfSegments(
      overfilledSection,
      { ...bookMap, extra: { pages: 800 } },
      432,
      1,
    ),
    false,
  );

  const allInFirstSection = items.map((item) => ({ ...item, sectionIndex: 0 }));
  const reassigned = assignShelfSections(
    [{ id: "shelf-1", items: allInFirstSection }],
    bookMap,
    432,
    1,
    true,
  );
  assert.deepEqual(
    reassigned[0].items.map((item) => item.sectionIndex),
    [0, 0, 0, 0, 1],
  );
});
