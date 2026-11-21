import { useState } from "react";
import BookItem from "./BookItem";

export default function HorizontalStack({
  item,
  books,
  shelfIndex,
  itemIndex,
  draggedBook,
  theme,
  bookMap,
  stackFull,
  onToggleOrientation,
  onDragStart,
  onDragOver,
  onDropIntoStack,
  onDragEnd,
  onRemoveBook,
  onAddBook,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [dropTarget, setDropTarget] = useState(null); // { bookId, isTopHalf }

  const handleContainerDrop = (e) => {
    e.preventDefault();
    if (draggedBook && onDropIntoStack) {
      onDropIntoStack(null);
      setDropTarget(null);
    }
  };

  const handleDragEnd = (e) => {
    setDropTarget(null);
    onDragEnd(e);
  };

  // Per-book dragover: track which book and which half (top = insert above, bottom = insert below)
  const makeBookDragOver = (bookId) => (e) => {
    onDragOver(e);
    const rect = e.currentTarget.getBoundingClientRect();
    setDropTarget({ bookId, isTopHalf: e.clientY - rect.top < rect.height / 2 });
  };

  // Per-book drop: use stored dropTarget to determine insertion point
  const makeBookDrop = (bookId, bookIndex) => (e) => {
    e.stopPropagation();
    if (!draggedBook || !onDropIntoStack) return;
    // isTopHalf = insert above (after in array, since flex-col-reverse renders last item at top)
    // bottom half = insert before this book in the array
    const isTopHalf = dropTarget?.bookId === bookId ? dropTarget.isTopHalf : false;
    const insertBeforeId = isTopHalf
      ? (item.bookIds[bookIndex + 1] || null)
      : item.bookIds[bookIndex];
    onDropIntoStack(insertBeforeId);
    setDropTarget(null);
  };

  return (
    <div
      className="flex flex-col-reverse mb-1 min-h-[24px] relative"
      onDragOver={onDragOver}
      onDrop={handleContainerDrop}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {books.map((book, bookIndexInStack) => {
        const bookId = item.bookIds[bookIndexInStack];
        const isTarget = dropTarget?.bookId === bookId;
        return (
          <div key={`${bookId}-${shelfIndex}-${itemIndex}-${bookIndexInStack}`} className="relative">
            {isTarget && (
              <div
                className="absolute left-0 right-0 h-[2px] bg-primary z-20 pointer-events-none rounded-full"
                style={{ [dropTarget.isTopHalf ? "top" : "bottom"]: "0px" }}
              />
            )}
            <BookItem
              book={book}
              orientation="horizontal"
              theme={theme}
              isDragging={
                draggedBook?.shelfIndex === shelfIndex &&
                draggedBook?.itemIndex === itemIndex &&
                draggedBook?.stackBookId === bookId
              }
              onContextMenu={(e) =>
                onToggleOrientation(e, shelfIndex, itemIndex, bookId)
              }
              onDragStart={() => onDragStart(shelfIndex, itemIndex, bookId)}
              onDragOver={makeBookDragOver(bookId)}
              onDrop={makeBookDrop(bookId, bookIndexInStack)}
              onDragEnd={handleDragEnd}
              onRemove={() => onRemoveBook(shelfIndex, itemIndex, bookId)}
            />
          </div>
        );
      })}

      {/* Drop zone for empty stack */}
      {books.length === 0 && (
        <div
          className="w-32 h-6 border-2 border-dashed border-muted-foreground/30 bg-muted/10 flex items-center justify-center text-xs text-muted-foreground/50"
          onDragOver={onDragOver}
          onDrop={handleContainerDrop}
        >
          Drop here
        </div>
      )}

      {/* Add-book affordance: appends directly into this stack, same as a drag-drop */}
      {isHovered && !stackFull && (
        <div
          className="flex-shrink-0 h-6 border border-dashed border-muted-foreground/40 flex items-center justify-center cursor-pointer hover:bg-muted/20 transition-colors"
          style={{ width: "160px" }}
          onClick={onAddBook}
          title="Add book to stack"
        >
          <span className="text-muted-foreground/60 text-[10px]">+</span>
        </div>
      )}
    </div>
  );
}
