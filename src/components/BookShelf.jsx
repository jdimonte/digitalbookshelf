import { useEffect, useRef, useState } from "react";
import BookItem from "./BookItem";
import BookSearchModal from "./BookSearchModal";
import EmptySlot from "./EmptySlot";
import HorizontalStack from "./HorizontalStack";
import { Card, CardContent } from "./ui/card";
import {
  getItemWidth,
  getShelfSegmentLayout,
  canFitItemsInShelfSegments,
  getMaxStackBooks,
  getShelfMinHeight,
  DEFAULT_SHELF_HEIGHT,
  SHELF_BORDER_HEIGHT,
  MAX_SHELF_HEIGHT,
} from "../utils/shelfItems";
import { BOOKCASE_STYLES } from "../utils/bookcaseStyles";

export default function BookShelf({
  shelves,
  bookMap,
  draggedBook,
  theme,
  onDisplayWidthChange,
  goodreadsBooks,
  onToggleOrientation,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onAddBook,
  onAddBookToStack,
  onRemoveBook,
  onResizeShelf,
  onResizeShelfWidth,
}) {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [hoveredEmptyArea, setHoveredEmptyArea] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [resizingShelf, setResizingShelf] = useState(null);
  const [resizingShelfWidth, setResizingShelfWidth] = useState(null);
  // When a drop reflows the shelf, elements can shift under a stationary cursor,
  // triggering the browser's own hover/mouseenter on whatever now sits there
  // (the "+" button, rating badge, etc.) even though the user hasn't moved.
  // Suppressing pointer events until the next real mousemove blocks that.
  const [suppressHover, setSuppressHover] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const scaleRef = useRef(1);
  const maxShelfHeight = Math.max(MAX_SHELF_HEIGHT, viewportHeight - 32);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!suppressHover) return;
    const handleMouseMove = () => setSuppressHover(false);
    window.addEventListener("mousemove", handleMouseMove, { once: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [suppressHover]);

  const handleShelfMouseMove = (shelfIndex, e) => {
    if (draggedBook) return;
    const items = shelves[shelfIndex]?.items || [];
    const layout = getShelfSegmentLayout(
      items,
      bookMap,
      getShelfWidthForShelf(shelfIndex),
      theme.dividerCount || 0,
    );
    const THRESHOLD = 8;
    const rect = e.currentTarget.getBoundingClientRect();
    const cursorX = (e.clientX - rect.left) / scaleRef.current - 16;

    let closestId = null;
    let minDist = Infinity;
    let x = 0;
    let stop = false;

    for (const [sectionIndex, sectionItems] of layout.segments.entries()) {
      for (const { item } of sectionItems) {
        if (item.type !== "empty-slot") {
          const izId = `${shelfIndex}-iz-before-${item.id}`;
          const isExpanded = hoveredEmptyArea === izId;

          if (isExpanded && cursorX >= x && cursorX <= x + 32) {
            closestId = izId;
            minDist = 0;
            break;
          }

          const dist = Math.abs(x - cursorX);
          if (dist < minDist) {
            minDist = dist;
            closestId = izId;
          }

          x += isExpanded ? 32 : 0;
        }
        x += getItemWidth(item, bookMap);
        if (x > cursorX + THRESHOLD && minDist <= THRESHOLD) {
          stop = true;
          break;
        }
      }
      if (stop) break;
      if (sectionIndex < layout.segments.length - 1) x += 8;
    }

    setHoveredEmptyArea(minDist <= THRESHOLD ? closestId : null);
  };

  const handleLocalDragEnd = () => {
    setDragOverTarget(null);
    setHoveredEmptyArea(null);
    onDragEnd();
  };

  // Belt-and-suspenders: a completed drop can unmount the dragged node before its
  // native dragend event bubbles, so handleLocalDragEnd may never fire. Tie cleanup
  // to draggedBook (owned by the parent, always nulled on drop/cancel) as well —
  // adjusted during render rather than an effect to avoid a cascading re-render.
  const [prevDraggedBook, setPrevDraggedBook] = useState(draggedBook);
  if (draggedBook !== prevDraggedBook) {
    setPrevDraggedBook(draggedBook);
    if (!draggedBook) {
      setHoveredEmptyArea(null);
      setDragOverTarget(null);
      setSuppressHover(true);
    }
  }

  const handleResizeMouseDown = (shelfIndex, startHeight, minHeight, e) => {
    e.preventDefault();
    setResizingShelf({ shelfIndex, startY: e.clientY, startHeight, minHeight });
  };

  const handleResizeWidthMouseDown = (shelfIndex, startWidth, e) => {
    e.preventDefault();
    setResizingShelfWidth({
      shelfIndex,
      startX: e.clientX,
      startWidth,
      startScale: scaleRef.current,
    });
  };

  useEffect(() => {
    if (!resizingShelfWidth) return;
    const { shelfIndex, startX, startWidth, startScale } = resizingShelfWidth;
    document.body.style.cursor = "col-resize";

    const handleMouseMove = (e) => {
      const delta = (e.clientX - startX) / startScale;
      onResizeShelfWidth(shelfIndex, startWidth + delta);
    };
    const handleMouseUp = () => setResizingShelfWidth(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
    };
  }, [resizingShelfWidth, onResizeShelfWidth]);

  useEffect(() => {
    if (!resizingShelf) return;
    const { shelfIndex, startY, startHeight, minHeight } = resizingShelf;
    document.body.style.cursor = "row-resize";

    const handleMouseMove = (e) => {
      const delta = (e.clientY - startY) / scaleRef.current;
      const shelfMaxHeight = Math.max(maxShelfHeight, minHeight);
      const newHeight = Math.min(shelfMaxHeight, Math.max(minHeight, startHeight + delta));
      onResizeShelf(shelfIndex, newHeight, shelfMaxHeight);
    };
    const handleMouseUp = () => setResizingShelf(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
    };
  }, [resizingShelf, onResizeShelf, maxShelfHeight]);

  const handleEmptySlotClick = (
    shelfIndex,
    insertIndex,
    replaceEmptySlotId = null,
    slotIndex = 0,
    maxBooks = Infinity,
    sectionIndex = 0,
  ) => {
    setSelectedPosition({
      shelfIndex,
      insertIndex,
      replaceEmptySlotId,
      slotIndex,
      maxBooks,
      sectionIndex,
    });
    setIsSearchModalOpen(true);
  };

  const handleAddToStackClick = (stackItemId, maxBooks) => {
    setSelectedPosition({ addToStackId: stackItemId, maxBooks });
    setIsSearchModalOpen(true);
  };

  const handleAddBook = (book, position) => {
    if (position?.addToStackId) {
      onAddBookToStack(position.addToStackId, book);
      setIsSearchModalOpen(false);
      setSelectedPosition(null);
      return;
    }
    onAddBook(book, position);
    setIsSearchModalOpen(false);
    setSelectedPosition(null);
  };

  const isSimpleLayout = theme.name === "bw";
  const bookcaseStyle = BOOKCASE_STYLES[theme.bookcaseStyle] || BOOKCASE_STYLES.modern;
  const {
    src: bookcaseSrc,
    IMG_W,
    IMG_H,
    INNER_L,
    INNER_R,
    INNER_T,
    INNER_B,
  } = bookcaseStyle;
  const INNER_W = IMG_W - INNER_L - INNER_R;
  const shelfWidth = theme.shelfWidth || 850;
  const getShelfWidthForShelf = (shelfIndex) =>
    isSimpleLayout
      ? shelves[shelfIndex]?.width || shelfWidth / Math.max(1, shelves.length)
      : shelfWidth;
  const simpleShelfWidth = shelves.reduce(
    (sum, shelf, shelfIndex) => sum + getShelfWidthForShelf(shelfIndex),
    0,
  );
  const shelfContentH = shelves.reduce(
    (sum, shelf) => sum + (shelf.height || DEFAULT_SHELF_HEIGHT),
    0,
  ) + Math.max(0, shelves.length - 1) * SHELF_BORDER_HEIGHT;
  const simpleContentH = maxShelfHeight;
  const cW = isSimpleLayout
    ? simpleShelfWidth
    : Math.round(shelfWidth * IMG_W / INNER_W);
  const cH = isSimpleLayout
    ? simpleContentH
    : Math.round(shelfContentH * IMG_H / (IMG_H - INNER_T - INNER_B));
  const padL = isSimpleLayout ? 0 : Math.round(cW * INNER_L / IMG_W);
  const padR = isSimpleLayout ? 0 : Math.round(cW * INNER_R / IMG_W);
  const padT = isSimpleLayout ? 0 : Math.round(cH * INNER_T / IMG_H);
  const padB = isSimpleLayout ? 0 : Math.round(cH * INNER_B / IMG_H);
  const frameHeight = Math.max(1, viewportHeight - 32);
  const scale = isSimpleLayout
    ? Math.min(1, frameHeight / cH)
    : Math.min(
        1,
        Math.max(0.1, Math.min((viewportWidth - 32) / cW, frameHeight / cH)),
      );

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    onDisplayWidthChange(
      isSimpleLayout ? Math.min(cW * scale, viewportWidth - 32) : cW * scale,
    );
  }, [cW, scale, onDisplayWidthChange, isSimpleLayout, viewportWidth]);

  return (
    <>
      <div
        className="relative"
        style={{
          width: `${cW * scale}px`,
          height: `${frameHeight}px`,
          margin: isSimpleLayout ? "0 auto" : undefined,
        }}
      >
        <div
          className={`absolute bottom-0 ${isSimpleLayout ? "left-0" : "left-1/2"}`}
          style={{
            width: `${cW}px`,
            height: `${cH}px`,
            transform: isSimpleLayout
              ? `scale(${scale})`
              : `translateX(-50%) scale(${scale})`,
            transformOrigin: isSimpleLayout ? "bottom left" : "bottom center",
          }}
        >
        {!isSimpleLayout && (
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              width: `${cW}px`,
              height: `${cH}px`,
              backgroundColor: theme.shelfColor,
              WebkitMaskImage: `url(${bookcaseSrc})`,
              maskImage: `url(${bookcaseSrc})`,
              WebkitMaskSize: "100% 100%",
              maskSize: "100% 100%",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
            }}
          />
        )}
        <div
          className="relative"
          style={{
            paddingTop: `${padT}px`,
            paddingBottom: `${padB}px`,
            paddingLeft: `${padL}px`,
            paddingRight: `${padR}px`,
          }}
        >
          <Card
            className="border-0 p-0 transition-colors duration-500 rounded-none relative"
            style={{
              width: `${isSimpleLayout ? cW : shelfWidth}px`,
              height: isSimpleLayout ? `${simpleContentH}px` : undefined,
              borderColor: theme.shelfColor,
              backgroundColor: isSimpleLayout ? "transparent" : theme.shelfColor,
              overflow: "visible",
            }}
          >
            <CardContent
              className="p-0"
              style={{
                pointerEvents: suppressHover ? "none" : "auto",
                display: isSimpleLayout ? "flex" : undefined,
                alignItems: isSimpleLayout ? "flex-end" : undefined,
                height: isSimpleLayout ? "100%" : undefined,
              }}
            >
              {shelves.map((shelf, shelfIndex) => {
                const shelfHeight = shelf.height || DEFAULT_SHELF_HEIGHT;
                const shelfMinHeight = getShelfMinHeight(shelf.items || [], bookMap);
                return (
                <div
                  key={shelf.id || shelfIndex}
                  className="relative group/shelf"
                  style={{ flexShrink: isSimpleLayout ? 0 : undefined }}
                >
                  <div
                    className="flex items-end px-4 pt-6 relative transition-colors duration-300"
                    style={{
                      width: `${getShelfWidthForShelf(shelfIndex)}px`,
                      height: `${shelfHeight}px`,
                      background: `linear-gradient(to bottom, ${theme.gradientTopColor || theme.shelfColor}, ${theme.gradientBottomColor || theme.shelfColor})`,
                      boxShadow: isSimpleLayout ? `inset 0 -8px 0 ${theme.shelfColor}` : undefined,
                      overflow: "visible",
                    }}
                    onMouseMove={(e) => handleShelfMouseMove(shelfIndex, e)}
                    onMouseLeave={() => setHoveredEmptyArea(null)}
                  >
                    {(() => {
                      const items = shelf.items || [];
                      const segCount = (theme.dividerCount || 0) + 1;
                      const segmentLayout = getShelfSegmentLayout(
                        items,
                        bookMap,
                        getShelfWidthForShelf(shelfIndex),
                        theme.dividerCount || 0,
                      );
                      const segElements = Array.from({ length: segCount }, () => []);
                      const itemSegments = [];
                      segmentLayout.segments.forEach((segmentItems, segmentIndex) => {
                        segmentItems.forEach(({ index }) => {
                          itemSegments[index] = segmentIndex;
                        });
                      });

                      const getMaxBooksAt = (
                        insertIndex,
                        slotIndex = 0,
                        replaceEmptySlotId = null,
                        sectionIndex = 0,
                      ) => {
                        const baseItems = [...items];
                        let insertionPoint = insertIndex;
                        if (replaceEmptySlotId) {
                          const replaceIndex = baseItems.findIndex(
                            (item) => item.id === replaceEmptySlotId,
                          );
                          if (replaceIndex >= 0) {
                            baseItems.splice(replaceIndex, 1, {
                              type: "book",
                              bookId: "__new-book-0__",
                              orientation: "vertical",
                              sectionIndex,
                            });
                            insertionPoint = replaceIndex + 1;
                          } else {
                            baseItems.splice(insertIndex, 0, {
                              type: "book",
                              bookId: "__new-book-0__",
                              orientation: "vertical",
                              sectionIndex,
                            });
                            insertionPoint = insertIndex + 1;
                          }
                        } else {
                          baseItems.splice(
                            insertIndex,
                            0,
                            ...Array.from({ length: slotIndex }, (_, index) => ({
                              id: `__new-slot-${index}__`,
                              type: "empty-slot",
                              sectionIndex,
                            })),
                          );
                          insertionPoint += slotIndex;
                        }

                        let maxBooks = 0;
                        for (let count = 1; count <= 100; count++) {
                          const projected = [...baseItems];
                          const addedBooks = Array.from({ length: count }, (_, index) => ({
                            type: "book",
                            bookId: `__new-book-${index}__`,
                            orientation: "vertical",
                            sectionIndex,
                          }));
                          if (replaceEmptySlotId) {
                            projected.splice(insertionPoint, 0, ...addedBooks.slice(1));
                          } else {
                            projected.splice(insertionPoint, 0, ...addedBooks);
                          }
                          const candidateMap = Object.fromEntries(
                            addedBooks.map((item) => [item.bookId, { pages: 800 }]),
                          );
                          if (!canFitItemsInShelfSegments(
                            projected,
                            { ...bookMap, ...candidateMap },
                            getShelfWidthForShelf(shelfIndex),
                            theme.dividerCount || 0,
                          )) break;
                          maxBooks = count;
                        }
                        return maxBooks;
                      };
                      const canInsertBookAt = (insertIndex, sectionIndex) => {
                        return getMaxBooksAt(insertIndex, 0, null, sectionIndex) > 0;
                      };
                      items.forEach((item, itemIndex) => {
                        const seg = itemSegments[itemIndex];
                        // Insertion zone before each non-empty-slot item (0px at rest, expands on hover)
                        if (item.type !== "empty-slot") {
                        const izSlotId = `${shelfIndex}-iz-before-${item.id}`;
                        segElements[seg].push(
                          <div
                            key={`iz-before-${item.id}`}
                            className="flex-shrink-0 h-full flex items-end justify-center min-h-[200px]"
                            style={{
                              width: hoveredEmptyArea === izSlotId ? "32px" : "0px",
                              overflow: "hidden",
                              transition: "width 150ms ease",
                            }}
                            onDragEnter={() => setHoveredEmptyArea(izSlotId)}
                            onDragLeave={(e) => {
                              if (e.currentTarget.contains(e.relatedTarget)) return;
                              setHoveredEmptyArea(null);
                            }}
                            onDragOver={onDragOver}
                            onDrop={() => onDrop(shelfIndex, item.id, "before", null, 0, seg)}
                          >
                            {hoveredEmptyArea === izSlotId &&
                              segmentLayout.fits &&
                              canInsertBookAt(itemIndex, seg) && (
                              <EmptySlot
                                isVisible
                                onClick={() =>
                                  handleEmptySlotClick(
                                    shelfIndex,
                                    itemIndex,
                                    null,
                                    0,
                                    getMaxBooksAt(itemIndex, 0, null, seg),
                                    seg,
                                  )
                                }
                              />
                            )}
                          </div>,
                        );
                        }

                        // The item itself
                        if (item.type === "empty-slot") {
                          const emptySlotId = `${shelfIndex}-empty-${item.id}`;
                          segElements[seg].push(
                            <div
                              key={item.id}
                              draggable
                              className="w-[60px] h-full flex items-end justify-center flex-shrink-0 relative"
                              onDragStart={() => onDragStart(shelfIndex, itemIndex)}
                              onDragOver={(e) => {
                                onDragOver(e);
                                setDragOverTarget({ shelfIndex, itemId: item.id, side: "center" });
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                onDrop(shelfIndex, item.id, "replace", null, 0, seg);
                              }}
                              onDragEnd={handleLocalDragEnd}
                              onMouseEnter={() => setHoveredEmptyArea(emptySlotId)}
                              onMouseLeave={() => setHoveredEmptyArea(null)}
                            >
                              {draggedBook &&
                              dragOverTarget?.shelfIndex === shelfIndex &&
                              dragOverTarget?.itemId === item.id ? (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <div className="w-[3px] h-3/4 bg-primary rounded-full" />
                                </div>
                              ) : (
                                <EmptySlot
                                  isVisible={getMaxBooksAt(itemIndex, 0, item.id, seg) > 0}
                                  fill
                                  onClick={() =>
                                    handleEmptySlotClick(
                                      shelfIndex,
                                      itemIndex,
                                      item.id,
                                      0,
                                      getMaxBooksAt(itemIndex, 0, item.id, seg),
                                      seg,
                                    )
                                  }
                                />
                              )}
                            </div>,
                          );
                        } else if (item.type === "horizontal-stack") {
                          const stackBooks = item.bookIds
                            .map((id) => bookMap[id])
                            .filter(Boolean);
                          const stackFull = item.bookIds.length >= getMaxStackBooks(shelfHeight);
                          const draggingFromThisStack =
                            draggedBook?.stackBookId != null &&
                            draggedBook.shelfIndex === shelfIndex &&
                            draggedBook.itemIndex === itemIndex;
                          segElements[seg].push(
                            <HorizontalStack
                              key={item.id}
                              item={item}
                              books={stackBooks}
                              shelfIndex={shelfIndex}
                              itemIndex={itemIndex}
                              draggedBook={draggedBook}
                              theme={theme}
                              bookMap={bookMap}
                              stackFull={stackFull}
                              onToggleOrientation={onToggleOrientation}
                              onDragStart={onDragStart}
                              onDragOver={onDragOver}
                              onDropIntoStack={
                                stackFull && !draggingFromThisStack
                                  ? null
                                  : (insertBeforeId) =>
                                      onDrop(shelfIndex, item.id, "into-stack", insertBeforeId, 0, seg)
                              }
                              onDragEnd={handleLocalDragEnd}
                              onRemoveBook={onRemoveBook}
                              onAddBook={() =>
                                handleAddToStackClick(
                                  item.id,
                                  getMaxStackBooks(shelfHeight) - item.bookIds.length,
                                )
                              }
                            />,
                          );
                        } else {
                          // type === 'book'
                          const book = bookMap[item.bookId];
                          segElements[seg].push(
                            <BookItem
                              key={item.id}
                              book={book}
                              orientation={item.orientation}
                              theme={theme}
                              isDragging={
                                draggedBook?.shelfIndex === shelfIndex &&
                                draggedBook?.itemIndex === itemIndex &&
                                !draggedBook?.stackBookId
                              }
                              isDropTarget={
                                !!draggedBook &&
                                dragOverTarget?.shelfIndex === shelfIndex &&
                                dragOverTarget?.itemId === item.id &&
                                dragOverTarget?.side !== "center"
                              }
                              dropTargetSide={dragOverTarget?.side}
                              onContextMenu={(e) =>
                                onToggleOrientation(e, shelfIndex, itemIndex)
                              }
                              onDragStart={() => onDragStart(shelfIndex, itemIndex)}
                              onDragOver={onDragOver}
                              onDragHover={(side) =>
                                setDragOverTarget({
                                  shelfIndex,
                                  itemId: item.id,
                                  side,
                                })
                              }
                              onDrop={(e, side) =>
                                onDrop(
                                  shelfIndex,
                                  item.id,
                                  side === "before" ? "before" : "after",
                                  null,
                                  0,
                                  seg,
                                )
                              }
                              onDragEnd={handleLocalDragEnd}
                              onAddBook={() =>
                                handleEmptySlotClick(
                                  shelfIndex,
                                  itemIndex + 1,
                                  null,
                                  0,
                                  getMaxBooksAt(itemIndex + 1, 0, null, seg),
                                  seg,
                                )
                              }
                              onRemove={() => onRemoveBook(shelfIndex, itemIndex)}
                            />,
                          );
                        }
                      });

                      // Trail zones per segment
                      return Array.from({ length: segCount }, (_, s) => {
                        const lastSectionItem =
                          segmentLayout.segments[s].at(-1);
                        const nextSectionItem = segmentLayout.segments
                          .slice(s + 1)
                          .flat()[0];
                        const insertIndex = lastSectionItem
                          ? lastSectionItem.index + 1
                          : nextSectionItem?.index ?? items.length;
                        const trailW = segmentLayout.segmentWidths[s] - segmentLayout.usedWidths[s];
                        const numSlots =
                          segmentLayout.fits && trailW >= 60
                            ? Math.floor(trailW / 60)
                            : 0;
                        const segment = (
                          <div
                            key={`seg-${s}`}
                            className="flex-none flex items-end h-full"
                            style={{ width: `${segmentLayout.segmentWidths[s]}px` }}
                          >
                            {segElements[s]}
                            <div
                              className="flex-1 h-full flex items-end min-h-[200px] min-w-0 relative"
                              onDragOver={(e) => {
                                onDragOver(e);
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = Math.max(0, e.clientX - rect.left);
                                setDragOverTarget({ shelfIndex, itemId: "trail", side: "center", trailX: x });
                              }}
                              onDrop={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const slotOffset = Math.floor(
                                  Math.max(0, e.clientX - rect.left) / (60 * scale),
                                );
                                onDrop(shelfIndex, null, "after", null, slotOffset, s);
                              }}
                            >
                              {numSlots > 0 ? (
                                <div className="flex">
                                  {Array.from({ length: numSlots }, (_, i) => {
                                    const isDragTargetSlot =
                                      draggedBook &&
                                      dragOverTarget?.shelfIndex === shelfIndex &&
                                      dragOverTarget?.itemId === "trail" &&
                                      Math.floor((dragOverTarget.trailX ?? 0) / 60) === i;
                                    return (
                                      <div
                                        key={i}
                                        className="w-[60px] h-full flex items-end justify-center flex-shrink-0 relative"
                                      >
                                        {isDragTargetSlot ? (
                                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-[3px] h-3/4 bg-primary rounded-full" />
                                          </div>
                                        ) : (
                                          <EmptySlot
                                            isVisible
                                            fill
                                            onClick={() => handleEmptySlotClick(
                                              shelfIndex,
                                              insertIndex,
                                              null,
                                              i,
                                              getMaxBooksAt(insertIndex, i, null, s),
                                              s,
                                            )}
                                          />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                        if (s === 0) return segment;
                        return [
                          <div
                            key={`divider-${s - 1}`}
                            className="flex-none self-stretch -mt-6 w-2"
                            style={{
                              backgroundColor: theme.shelfColor,
                              boxShadow: theme.perspective3D
                                ? "0 0 10px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.1)"
                                : "0 0 5px rgba(0,0,0,0.2)",
                            }}
                          />,
                          segment,
                        ];
                      }).flat();
                    })()}
                  </div>
                  {isSimpleLayout ? (
                    <>
                      <div
                        className="absolute inset-x-0 bottom-[-4px] z-30 h-3 cursor-row-resize"
                        onMouseDown={(e) =>
                          handleResizeMouseDown(shelfIndex, shelfHeight, shelfMinHeight, e)
                        }
                      />
                      <div
                        className="absolute inset-y-0 right-[-4px] z-30 w-3 cursor-col-resize"
                        onMouseDown={(e) =>
                          handleResizeWidthMouseDown(
                            shelfIndex,
                            getShelfWidthForShelf(shelfIndex),
                            e,
                          )
                        }
                      />
                    </>
                  ) : shelfIndex < shelves.length - 1 && (
                    <div className="relative" style={{ height: `${SHELF_BORDER_HEIGHT}px` }}>
                      <div
                        className="absolute inset-x-0 top-0 h-[2px]"
                        style={{ backgroundColor: theme.shelfColor }}
                      />
                      <div
                        className="absolute left-0 right-0 cursor-row-resize z-30"
                        style={{ top: "-8px", height: "16px" }}
                        onMouseDown={(e) =>
                          handleResizeMouseDown(shelfIndex, shelfHeight, shelfMinHeight, e)
                        }
                      />
                    </div>
                  )}
                </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
        </div>
      </div>

      <BookSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => {
          setIsSearchModalOpen(false);
          setSelectedPosition(null);
        }}
        onAddBook={handleAddBook}
        position={selectedPosition}
        previewOrientation={selectedPosition?.addToStackId ? "horizontal" : "vertical"}
        goodreadsBooks={goodreadsBooks}
      />
    </>
  );
}
