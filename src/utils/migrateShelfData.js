import { makeItemId } from "./shelfItems";

// Detects old format: array of arrays (each shelf is an array of book objects with gridPosition)
export function isOldFormat(data) {
  return Array.isArray(data);
}

export function migrateToV2(oldShelves, oldStackTopShelves = {}) {
  const bookMap = {};
  // Maps old book.id → new horizontal-stack item.id (for stackTopShelves re-keying)
  const stackKeyMap = {};

  const shelves = oldShelves.map((shelfBooks, shelfIdx) => {
    const sorted = (Array.isArray(shelfBooks) ? shelfBooks : [])
      .filter((b) => b.gridPosition !== null && b.gridPosition !== undefined)
      .sort((a, b) => a.gridPosition - b.gridPosition);

    const items = [];
    let lastPos = -1;

    for (const book of sorted) {
      // Each missing integer position → one empty-slot item
      const gapCount = book.gridPosition - lastPos - 1;
      for (let g = 0; g < gapCount; g++) {
        items.push({ id: makeItemId(), type: "empty-slot" });
      }

      if (book.orientation === "empty") {
        items.push({ id: makeItemId(), type: "empty-slot" });
      } else if (book.orientation === "horizontal") {
        const prev = items[items.length - 1];
        if (prev && prev.type === "horizontal-stack") {
          prev.bookIds.push(book.id);
          stackKeyMap[book.id] = prev.id;
        } else {
          const newItem = {
            id: makeItemId(),
            type: "horizontal-stack",
            bookIds: [book.id],
          };
          items.push(newItem);
          stackKeyMap[book.id] = newItem.id;
        }
        bookMap[book.id] = stripPlacementFields(book);
      } else {
        items.push({
          id: makeItemId(),
          type: "book",
          bookId: book.id,
          orientation: book.orientation === "cover" ? "cover" : "vertical",
        });
        bookMap[book.id] = stripPlacementFields(book);
      }

      lastPos = book.gridPosition;
    }

    return { id: `shelf-${shelfIdx}`, items };
  });

  // Re-key stackTopShelves: old book.id → new item.id
  const newStackTopShelves = {};
  for (const [oldBookId, topBooks] of Object.entries(oldStackTopShelves)) {
    const newItemId = stackKeyMap[oldBookId];
    if (newItemId) newStackTopShelves[newItemId] = topBooks;
  }

  return { shelves, bookMap, newStackTopShelves };
}

function stripPlacementFields(book) {
  // eslint-disable-next-line no-unused-vars
  const { gridPosition, shelfId, orientation, ...rest } = book;
  return rest;
}

// Folds books from the old "mini top shelf" feature (keyed by horizontal-stack
// item.id) into that stack's own bookIds, so books already added via the old
// "+" button keep showing up once that separate shelf concept is removed.
export function mergeTopShelvesIntoShelves(shelves, bookMap, topShelves) {
  if (!topShelves || Object.keys(topShelves).length === 0) {
    return { shelves, bookMap };
  }
  const nextBookMap = { ...bookMap };
  const nextShelves = shelves.map((shelf) => ({
    ...shelf,
    items: shelf.items.map((item) => {
      const topBooks = topShelves[item.id];
      if (item.type !== "horizontal-stack" || !topBooks?.length) return item;
      topBooks.forEach((b) => {
        // eslint-disable-next-line no-unused-vars
        const { orientation, ...rest } = b;
        nextBookMap[b.id] = rest;
      });
      return { ...item, bookIds: [...item.bookIds, ...topBooks.map((b) => b.id)] };
    }),
  }));
  return { shelves: nextShelves, bookMap: nextBookMap };
}
