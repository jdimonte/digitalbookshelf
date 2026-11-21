import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Star } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { playHoverSound, playGrabSound, safePlay } from "../utils/sounds";
import { getSpineColor } from "../utils/spineColors";
import { useFitFontSize } from "../hooks/useFitFontSize";

export default function BookItem({
  book,
  orientation,
  theme,
  isDragging,
  isDropTarget,
  dropTargetSide,
  onDragStart,
  onDragOver,
  onDragHover,
  onDrop,
  onDragEnd,
  onContextMenu,
  onAddBook,
}) {
  const coverUrl = `https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg`;
  const bookRef = useRef(null);
  const [badgeAnchor, setBadgeAnchor] = useState(null);

  const getBookWidth = () => {
    const pages =
      typeof book.pages === "number" ? book.pages : parseInt(book.pages) || 200;
    const minWidth = 16;
    const maxWidth = 40;
    const minPages = 100;
    const maxPages = 800;

    if (pages <= minPages) return minWidth;
    if (pages >= maxPages) return maxWidth;

    const ratio = (pages - minPages) / (maxPages - minPages);
    return Math.round(minWidth + (maxWidth - minWidth) * ratio);
  };

  const bookWidth = getBookWidth();

  const HORIZONTAL_INNER_WIDTH = 160 - 16; // container width minus px-2 padding
  const HORIZONTAL_MIN_FONT_SIZE = 5;
  const HORIZONTAL_MAX_FONT_SIZE = 11;

  const VERTICAL_MIN_FONT_SIZE = 7;
  const VERTICAL_MAX_FONT_SIZE = 11;
  const VERTICAL_HEIGHT_MARGIN = 12;

  const { ref: verticalTextRef, fontSize: verticalFontSize } = useFitFontSize({
    maxSize: VERTICAL_MAX_FONT_SIZE,
    minSize: VERTICAL_MIN_FONT_SIZE,
    maxWidth: book.height - VERTICAL_HEIGHT_MARGIN,
    deps: [book.title, book.height],
  });

  const { ref: horizontalTextRef, fontSize: horizontalFontSize } = useFitFontSize({
    maxSize: HORIZONTAL_MAX_FONT_SIZE,
    minSize: HORIZONTAL_MIN_FONT_SIZE,
    maxWidth: HORIZONTAL_INNER_WIDTH,
    deps: [book.title],
  });

  const handleDragStartWithSound = (e) => {
    safePlay(playGrabSound);
    if (onDragStart) onDragStart(e);
  };

  const handleDragOverWithHover = (e) => {
    if (onDragOver) onDragOver(e);
    if (onDragHover) {
      const rect = e.currentTarget.getBoundingClientRect();
      onDragHover(e.clientX - rect.left < rect.width / 2 ? 'left' : 'right');
    }
  };

  const dropIndicator = isDropTarget ? (
    <div
      className="absolute top-0 bottom-0 w-[3px] bg-primary z-20 pointer-events-none rounded-full"
      style={{ [dropTargetSide === 'left' ? 'left' : 'right']: '-2px' }}
    />
  ) : null;

  const handleHoverEnter = () => {
    safePlay(playHoverSound);
    if (book.rating && bookRef.current) {
      const rect = bookRef.current.getBoundingClientRect();
      setBadgeAnchor({ top: rect.top, left: rect.left + rect.width / 2 });
    }
  };

  const handleHoverLeave = () => setBadgeAnchor(null);

  // Dragging (this book, or any reorder that relocates it without unmounting it —
  // it keeps the same React key) can leave a stale badgeAnchor pointing at the
  // pre-drag screen position, since no mouseleave fires during a native drag.
  // Adjusted during render (not an effect) to avoid a cascading re-render.
  const [prevIsDragging, setPrevIsDragging] = useState(isDragging);
  if (isDragging !== prevIsDragging) {
    setPrevIsDragging(isDragging);
    if (isDragging) setBadgeAnchor(null);
  }

  const ratingBadge = book.rating && badgeAnchor
    ? createPortal(
        <div
          className="fixed z-[9999] pointer-events-none whitespace-nowrap flex items-center gap-0.5 rounded bg-black/80 px-1.5 py-0.5"
          style={{
            top: badgeAnchor.top - 8,
            left: badgeAnchor.left,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div
            className="flex items-center gap-0.5"
            role="img"
            aria-label={`Rating: ${book.rating} out of 5`}
          >
            {Array.from({ length: 5 }, (_, i) => {
              const fill = Math.min(1, Math.max(0, book.rating - i));
              return (
                <span key={i} className="relative block h-2.5 w-2.5">
                  <Star className="absolute inset-0 h-2.5 w-2.5 text-white" />
                  {fill > 0 && (
                    <span
                      className="absolute inset-y-0 left-0 overflow-hidden"
                      style={{ width: `${fill * 100}%` }}
                    >
                      <Star
                        className="h-2.5 w-2.5 text-white"
                        fill="currentColor"
                      />
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>,
        document.body,
      )
    : null;

  // Drop handler: insert before (left half) or after (right half)
  const handleBookDrop = (e) => {
    if (!onDrop) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = e.clientX - rect.left < rect.width / 2;
    onDrop(e, isLeftHalf ? "before" : "after");
  };

  if (orientation === "vertical") {
    return (
      <div
        ref={bookRef}
        draggable
        onMouseEnter={handleHoverEnter}
        onMouseLeave={handleHoverLeave}
        onDragStart={handleDragStartWithSound}
        onDragOver={handleDragOverWithHover}
        onDrop={handleBookDrop}
        onDragEnd={onDragEnd}
        onContextMenu={onContextMenu}
        className={`
          border-x
          border-black/30
          flex
          items-center
          justify-center
          flex-none
          transition-all
          duration-300
          cursor-grab active:cursor-grabbing
          relative
          z-10
          hover:z-40
          ${isDragging ? "opacity-20" : "opacity-100"}
          ${theme?.perspective3D ? "hover:-translate-y-2 hover:rotate-1" : "hover:-translate-y-1"}
        `}
        style={{
          width: `${bookWidth}px`,
          height: `${book.height}px`,
          backgroundColor:
            theme?.lighting === "bw"
              ? "#ffffff"
              : getSpineColor(theme, book.coverId),
          border: theme?.lighting === "bw" ? "1.5px solid #333333" : undefined,
          boxShadow:
            theme?.lighting === "bw"
              ? "1px 1px 0 #333333"
              : theme?.perspective3D
                ? "0 8px 16px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)"
                : "0 4px 8px rgba(0,0,0,0.2)",
          transform: theme?.perspective3D ? "rotateY(-2deg)" : "none",
        }}
      >
        {dropIndicator}
        {ratingBadge}
        <span
          ref={verticalTextRef}
          className={`
            rotate-90
            font-bold
            whitespace-nowrap
            overflow-hidden
            text-ellipsis
            shrink-0
            ${theme?.lighting === "bw" ? "text-black" : "text-white"}
          `}
          style={{
            fontSize: `${verticalFontSize}px`,
            lineHeight: 1,
            letterSpacing: "normal",
            maxWidth: `${book.height - VERTICAL_HEIGHT_MARGIN}px`,
          }}
        >
          {book.title}
        </span>
      </div>
    );
  }

  if (orientation === "horizontal") {
    return (
      <div
        ref={bookRef}
        draggable
        onMouseEnter={handleHoverEnter}
        onMouseLeave={handleHoverLeave}
        onDragStart={handleDragStartWithSound}
        onDragOver={onDragOver}
        onDrop={handleBookDrop}
        onDragEnd={onDragEnd}
        onContextMenu={onContextMenu}
        className={`
          h-6
          flex
          items-center
          justify-center
          px-2
          flex-none
          border-y
          border-black/20
          transition-all
          duration-300
          cursor-grab active:cursor-grabbing
          relative
          z-10
          hover:z-40
          ${isDragging ? "opacity-20" : "opacity-100"}
          ${theme?.perspective3D ? "hover:-translate-y-2 hover:rotate-1" : "hover:-translate-y-1"}
        `}
        style={{
          width: `160px`,
          backgroundColor:
            theme?.lighting === "bw"
              ? "#ffffff"
              : getSpineColor(theme, book.coverId),
          border: theme?.lighting === "bw" ? "1.5px solid #333333" : undefined,
          boxShadow:
            theme?.lighting === "bw"
              ? "1px 1px 0 #333333"
              : theme?.perspective3D
                ? "0 4px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)"
                : "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        {ratingBadge}
        <span
          ref={horizontalTextRef}
          className={`font-medium leading-tight text-center whitespace-nowrap overflow-hidden text-ellipsis ${theme?.lighting === "bw" ? "text-black" : "text-white"}`}
          style={{
            fontSize: `${horizontalFontSize}px`,
            letterSpacing: "normal",
            maxWidth: `${HORIZONTAL_INNER_WIDTH}px`,
          }}
        >
          {book.title}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={bookRef}
      className="relative flex-none z-10 hover:z-40"
      onMouseEnter={handleHoverEnter}
      onMouseLeave={handleHoverLeave}
    >
      {dropIndicator}
      {ratingBadge}
      <Card
        draggable
        onDragStart={handleDragStartWithSound}
        onDragOver={handleDragOverWithHover}
        onDrop={handleBookDrop}
        onDragEnd={onDragEnd}
        onContextMenu={onContextMenu}
        className={`
          overflow-hidden
          flex-none
          transition-all
          duration-300
          p-0
          mx-1
          rounded-none
          cursor-grab active:cursor-grabbing
          ${isDragging ? "opacity-20" : "opacity-100"}
          ${theme?.perspective3D ? "hover:-translate-y-3 hover:rotate-2 hover:scale-105" : "hover:-translate-y-2"}
        `}
        style={{
          width: `96px`,
          height: `144px`,
          boxShadow: theme?.lighting === "bw"
            ? "1px 1px 0 #333333"
            : theme?.perspective3D
              ? "0 12px 24px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.2)"
              : "0 6px 12px rgba(0,0,0,0.3)",
          transform: theme?.perspective3D
            ? "rotateY(-5deg) rotateX(2deg)"
            : "none",
          ...(theme?.lighting === "bw" && {
            backgroundColor: "#ffffff",
            border: "1.5px solid #333333",
          }),
        }}
      >
        <CardContent className="p-0 h-full">
          {theme?.lighting === "bw" ? (
            <div className="w-full h-full flex items-center justify-center p-2">
              <span className="text-[9px] font-medium text-black text-center leading-tight break-words">
                {book.title}
              </span>
            </div>
          ) : (
            <img
              src={coverUrl}
              alt={book.title}
              className="w-full h-full object-contain"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
