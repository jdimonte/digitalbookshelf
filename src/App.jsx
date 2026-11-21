import { useCallback, useEffect, useRef, useState } from "react";
import AuthModal from "./components/AuthModal";
import BookShelf from "./components/BookShelf";
import BookshelfHeader from "./components/BookshelfHeader";
import LoadingState from "./components/LoadingState";
import TrashZone from "./components/TrashZone";
import { playDropSound, safePlay } from "./utils/sounds";
import {
  assignShelfSections,
  canFitItemsInShelfSegments,
  getMaxStackBooks,
  getNextBookOrientations,
  getShelfMinHeight,
  makeItemId,
  DEFAULT_SHELF_HEIGHT,
  MAX_SHELF_HEIGHT,
  MAX_SHELF_WIDTH,
} from "./utils/shelfItems";
import { isOldFormat, migrateToV2, mergeTopShelvesIntoShelves } from "./utils/migrateShelfData";
import {
  parseGoodreadsCSV,
  updateShelvedBooksFromGoodreads,
} from "./utils/parseGoodreadsCSV";
import { DEFAULT_SPINE_COLORS } from "./utils/spineColors";

const DEFAULT_THEME = {
  name: "vintage",
  shelfColor: "#654321",
  backgroundColor: "#DEB887",
  lighting: "warm",
  decorations: true,
  perspective3D: false,
  shelfWidth: 850,
  dividerCount: 1,
  bookcaseStyle: "vintage",
  gradientTopColor: "#8B5A2B",
  gradientBottomColor: "#654321",
  spineColors: DEFAULT_SPINE_COLORS,
};

function clearLocalBookshelf() {
  for (const key of [
    "bookshelf-shelves",
    "bookshelf-stack-tops",
    "bookshelf-shelfCount",
    "bookshelf-theme",
    "bookshelf-goodreads",
  ]) {
    localStorage.removeItem(key);
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [registrationData, setRegistrationData] = useState(null);

  useEffect(() => {
    const messages = {
      account_exists: "An account with this email already exists. Log in with that account first.",
      email_required: "The provider did not share an email address. Allow email access and try again.",
      provider_error: "Social sign-in was canceled or could not be completed.",
    };
    const errorCode = new URLSearchParams(window.location.search).get("authError");
    if (errorCode) {
      setAuthError(messages[errorCode] || messages.provider_error);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not check the sign-in status.");
        return response.json();
      })
      .then(({ user: currentUser }) => {
        if (!cancelled) setUser(currentUser);
      })
      .catch((error) => {
        console.error("Could not check the sign-in status:", error);
        if (!cancelled) {
          setAuthError("Could not connect to the account service. You can still use the local bookshelf.");
        }
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenAuth = (data) => {
    setRegistrationData(data);
    setAuthError("");
    setAuthModalOpen(true);
  };

  const handleAuthenticated = (authenticatedUser) => {
    clearLocalBookshelf();
    setUser(authenticatedUser);
    setAuthError("");
    setAuthModalOpen(false);
  };

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Could not sign out.");
      }
      clearLocalBookshelf();
      setUser(null);
      setAuthError("");
    } catch (error) {
      console.error("Could not sign out:", error);
      setAuthError(error.message || "Could not sign out. Please try again.");
    }
  };

  if (!authChecked) return <LoadingState />;

  return (
    <>
      {authError && (
        <div
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-red-700 px-4 py-2 text-sm text-white shadow-lg"
          role="alert"
        >
          {authError}
        </div>
      )}
      <BookshelfApp
        key={user?.id || "anonymous"}
        user={user}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
      />
      {authModalOpen && (
        <AuthModal
          initialData={registrationData}
          onClose={() => setAuthModalOpen(false)}
          onAuthenticated={handleAuthenticated}
        />
      )}
    </>
  );
}

function BookshelfApp({ user, onOpenAuth, onLogout }) {
  const userId = user?.id;
  const isAuthenticated = Boolean(userId);

  const saveToLocalStorage = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn("Failed to save to localStorage:", error);
    }
  };

  const loadFromLocalStorage = (key, defaultValue) => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (error) {
      console.warn("Failed to load from localStorage:", error);
      return defaultValue;
    }
  };

  // shelves: Shelf[] — each shelf has { id, items: ShelfItem[] }
  // bookMap: { [bookId]: BookRecord } — book data without placement fields
  const [shelves, setShelves] = useState([]);
  const [bookMap, setBookMap] = useState({});
  const [shelfCount, setShelfCount] = useState(() =>
    Math.max(2, Math.min(5, loadFromLocalStorage("bookshelf-shelfCount", 3))),
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveError, setSaveError] = useState("");
  const [draggedBook, setDraggedBook] = useState(null);
  const saveQueue = useRef(Promise.resolve());
  const saveTimer = useRef(null);
  const pendingSave = useRef(null);

  const [theme, setTheme] = useState(() =>
    loadFromLocalStorage("bookshelf-theme", DEFAULT_THEME),
  );
  const [displayShelfWidth, setDisplayShelfWidth] = useState(
    theme.shelfWidth || DEFAULT_THEME.shelfWidth,
  );

  const [goodreadsBooks, setGoodreadsBooks] = useState(() =>
    loadFromLocalStorage("bookshelf-goodreads", []),
  );

  const enqueueSave = useCallback((data) => {
    const request = saveQueue.current
      .catch(() => {})
      .then(async () => {
        const response = await fetch("/api/bookshelf", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || "Could not save your bookshelf.");
        }
      });
    saveQueue.current = request;
    request.then(
      () => setSaveError(""),
      (error) => {
        console.error("Could not save the bookshelf:", error);
        setSaveError(error.message || "Could not save your bookshelf.");
      },
    );
    return request;
  }, []);

  const handleRequestLogout = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const dataToSave = pendingSave.current;
    pendingSave.current = null;

    try {
      if (dataToSave) await enqueueSave(dataToSave);
      else if (isAuthenticated) await saveQueue.current;
      await onLogout();
    } catch (error) {
      setSaveError(error.message || "Your bookshelf could not be saved. You are still signed in.");
    }
  }, [isAuthenticated, enqueueSave, onLogout]);

  useEffect(() => {
    let cancelled = false;

    const initializeBookshelf = async () => {
      setLoadError("");
      let loadedTheme = loadFromLocalStorage("bookshelf-theme", DEFAULT_THEME);
      let savedRaw = loadFromLocalStorage("bookshelf-shelves", null);
      let oldStackTops = loadFromLocalStorage("bookshelf-stack-tops", {});

      try {
        if (userId) {
          const response = await fetch("/api/bookshelf");
          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || "Could not load your saved bookshelf.");
          }
          const data = result.data || {};
          savedRaw = data.shelves ?? null;
          oldStackTops = data.stackTops ?? {};
          setShelfCount(Math.max(2, Math.min(5, data.shelfCount ?? 3)));
          loadedTheme = data.theme || DEFAULT_THEME;
          setTheme(loadedTheme);
          setGoodreadsBooks(data.goodreadsBooks || []);
        }

        if (savedRaw && isOldFormat(savedRaw)) {
          const {
            shelves: migratedShelves,
            bookMap: migratedBookMap,
            newStackTopShelves,
          } = migrateToV2(savedRaw, oldStackTops);
          const { shelves: mergedShelves, bookMap: mergedBookMap } =
            mergeTopShelvesIntoShelves(migratedShelves, migratedBookMap, newStackTopShelves);
          if (!cancelled) {
            setShelves(assignShelfSections(
              mergedShelves,
              mergedBookMap,
              loadedTheme.shelfWidth || 1200,
              loadedTheme.dividerCount || 0,
            ));
            setBookMap(mergedBookMap);
          }
        } else if (savedRaw && savedRaw.shelves) {
          const { shelves: mergedShelves, bookMap: mergedBookMap } =
            mergeTopShelvesIntoShelves(savedRaw.shelves, savedRaw.bookMap || {}, oldStackTops);
          if (!cancelled) {
            setShelves(assignShelfSections(
              mergedShelves,
              mergedBookMap,
              loadedTheme.shelfWidth || 1200,
              loadedTheme.dividerCount || 0,
            ));
            setBookMap(mergedBookMap);
          }
        } else {
          const newBookMap = {
            "shelf-test-book": {
              id: "shelf-test-book",
              title: "Shelf Test",
              pages: 300,
              height: 180,
            },
          };
          const newShelves = [
            {
              id: "shelf-0",
              height: DEFAULT_SHELF_HEIGHT,
              items: [{
                id: makeItemId(),
                type: "book",
                bookId: "shelf-test-book",
                orientation: "vertical",
              }],
            },
            { id: "shelf-1", height: DEFAULT_SHELF_HEIGHT, items: [] },
            { id: "shelf-2", height: DEFAULT_SHELF_HEIGHT, items: [] },
          ];

          if (!cancelled) {
            setShelves(assignShelfSections(
              newShelves,
              newBookMap,
              loadedTheme.shelfWidth || 1200,
              loadedTheme.dividerCount || 0,
            ));
            setBookMap(newBookMap);
          }
        }
      } catch (error) {
        console.error("Could not initialize the bookshelf:", error);
        if (!cancelled) setLoadError(error.message || "Could not load the bookshelf.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initializeBookshelf();
    return () => {
      cancelled = true;
    };
  }, [userId, loadAttempt]);

  useEffect(() => {
    if (loading) return undefined;

    if (!isAuthenticated) {
      if (shelves.length > 0) {
        saveToLocalStorage("bookshelf-shelves", { shelves, bookMap });
      }
      saveToLocalStorage("bookshelf-theme", theme);
      saveToLocalStorage("bookshelf-shelfCount", shelfCount);
      saveToLocalStorage("bookshelf-goodreads", goodreadsBooks);
      return undefined;
    }

    if (shelves.length === 0) return undefined;
    const data = {
      shelves: { shelves, bookMap },
      stackTops: {},
      shelfCount,
      theme,
      goodreadsBooks,
    };
    pendingSave.current = data;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      const dataToSave = pendingSave.current;
      pendingSave.current = null;
      if (dataToSave) enqueueSave(dataToSave).catch(() => {});
    }, 400);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
    };
  }, [userId, isAuthenticated, loading, shelves, bookMap, shelfCount, theme, goodreadsBooks, enqueueSave]);

  // Keep shelf count in sync
  useEffect(() => {
    if (shelves.length === 0) return;
    setShelves((prev) => {
      const defaultWidth =
        (theme.shelfWidth || DEFAULT_THEME.shelfWidth) /
        Math.max(shelfCount, prev.length, 1);
      let next = prev;
      if (theme.name === "bw" && prev.some((shelf) => !Number.isFinite(shelf.width))) {
        next = prev.map((shelf) =>
          Number.isFinite(shelf.width) ? shelf : { ...shelf, width: defaultWidth },
        );
      }
      if (next.length === shelfCount && next === prev) return prev;
      next = [...next];
      while (next.length < shelfCount) {
        const existingWidths = next
          .map((shelf) => shelf.width)
          .filter(Number.isFinite);
        const width = existingWidths.length
          ? existingWidths.reduce((sum, value) => sum + value, 0) / existingWidths.length
          : defaultWidth;
        next.push({
          id: makeItemId(),
          items: [],
          height: DEFAULT_SHELF_HEIGHT,
          ...(theme.name === "bw" ? { width } : {}),
        });
      }
      if (next.length > shelfCount) next.splice(shelfCount);
      return next;
    });
  }, [shelfCount, shelves.length, theme.name, theme.shelfWidth]);

  const getShelfContentWidth = (shelfIndex) => {
    const totalWidth = theme.shelfWidth || DEFAULT_THEME.shelfWidth;
    return theme.name === "bw"
      ? shelves[shelfIndex]?.width || totalWidth / Math.max(1, shelves.length)
      : totalWidth;
  };

  const handleDragStart = (shelfIndex, itemIndex, stackBookId = null) => {
    setDraggedBook({ shelfIndex, itemIndex, stackBookId });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (
    targetShelfIndex,
    targetItemId,
    dropMode,
    stackInsertBeforeId = null,
    slotOffset = 0,
    targetSectionIndex = null,
  ) => {
    if (!draggedBook) return;

    setShelves((prev) => {
      // Deep copy shelves so we can mutate safely
      const next = prev.map((s) => ({
        ...s,
        items: s.items.map((i) =>
          i.type === "horizontal-stack"
            ? { ...i, bookIds: [...i.bookIds] }
            : { ...i },
        ),
      }));

      const { shelfIndex: srcShelfIdx, itemIndex: srcItemIdx, stackBookId } = draggedBook;
      const targetItemsBeforeDrop = next[targetShelfIndex]?.items || [];
      const targetItemBeforeDrop = targetItemsBeforeDrop.find(
        (item) => item.id === targetItemId,
      );
      const destinationSectionIndex =
        targetSectionIndex ??
        targetItemBeforeDrop?.sectionIndex ??
        targetItemsBeforeDrop.at(-1)?.sectionIndex ??
        0;

      // Determine the item to insert
      let itemToInsert;
      if (stackBookId) {
        // Dragging a book out of a horizontal-stack — use a plain book temporarily
        // (the into-stack path needs .bookId; the before/after path converts it below)
        itemToInsert = {
          id: makeItemId(),
          type: "book",
          bookId: stackBookId,
          orientation: "vertical",
        };
      } else {
        itemToInsert = next[srcShelfIdx]?.items[srcItemIdx];
        if (!itemToInsert) return prev;
        if (targetItemId === itemToInsert.id) return prev; // dropped on itself
      }

      // Handle into-stack drops
      if (dropMode === "into-stack") {
        const bookIdToAdd = stackBookId || (itemToInsert.type === "book" ? itemToInsert.bookId : null);
        if (!bookIdToAdd) return prev; // can't add non-books to a stack

        const targetStack = next[targetShelfIndex].items.find(
          (i) => i.id === targetItemId,
        );
        if (!targetStack || targetStack.type !== "horizontal-stack") return prev;

        // Block cross-source drops onto a full stack; same-stack reorders always allowed
        const isSameStackDrag =
          stackBookId != null &&
          next[srcShelfIdx]?.items[srcItemIdx]?.id === targetItemId;
        const targetShelfHeight = next[targetShelfIndex]?.height ?? DEFAULT_SHELF_HEIGHT;
        if (!isSameStackDrag && targetStack.bookIds.length >= getMaxStackBooks(targetShelfHeight)) {
          return prev;
        }

        // Remove from source first — enables same-stack reordering
        removeFromSource(next, srcShelfIdx, srcItemIdx, stackBookId);

        // Insert at the specified position or append
        const insertIdx = stackInsertBeforeId
          ? targetStack.bookIds.indexOf(stackInsertBeforeId)
          : -1;
        if (insertIdx >= 0) {
          targetStack.bookIds.splice(insertIdx, 0, bookIdToAdd);
        } else {
          targetStack.bookIds.push(bookIdToAdd);
        }
        return next;
      }

      // before / after / append (targetItemId === null)
      // Remove from source first — for same-shelf drops, we find target by ID after removal
      removeFromSource(next, srcShelfIdx, srcItemIdx, stackBookId);

      // Preserve horizontal orientation: books dragged out of a stack stay as a single-book stack
      if (stackBookId) {
        itemToInsert = {
          id: makeItemId(),
          type: "horizontal-stack",
          bookIds: [stackBookId],
          sectionIndex: destinationSectionIndex,
        };
      } else {
        itemToInsert = { ...itemToInsert, sectionIndex: destinationSectionIndex };
      }

      const tShelf = next[targetShelfIndex].items;
      let insertAt;
      let spacers = [];
      if (targetItemId === null) {
        insertAt = tShelf.length;
        if (slotOffset > 0) {
          spacers = Array.from({ length: slotOffset }, () => ({
            id: makeItemId(),
            type: "empty-slot",
            sectionIndex: destinationSectionIndex,
          }));
        }
      } else if (dropMode === "replace") {
        const targetIdx = tShelf.findIndex((i) => i.id === targetItemId);
        if (targetIdx < 0) return prev;
        tShelf.splice(targetIdx, 1); // remove the empty slot
        insertAt = targetIdx;
      } else {
        const targetIdx = tShelf.findIndex((i) => i.id === targetItemId);
        if (targetIdx < 0) return prev;
        insertAt = dropMode === "before" ? targetIdx : targetIdx + 1;
      }

      // Overflow check (include any spacers for positional trail drops)
      const testItems = [...tShelf];
      testItems.splice(insertAt, 0, ...spacers, itemToInsert);
      if (!canFitItemsInShelfSegments(
        testItems,
        bookMap,
        getShelfContentWidth(targetShelfIndex),
        theme.dividerCount || 0,
      )) {
        if (spacers.length > 0) {
          // Retry without spacers — still place the book at end
          const testNoSlots = [...tShelf];
          testNoSlots.splice(insertAt, 0, itemToInsert);
          if (!canFitItemsInShelfSegments(
            testNoSlots,
            bookMap,
            getShelfContentWidth(targetShelfIndex),
            theme.dividerCount || 0,
          )) {
            return prev;
          }
          spacers = [];
        } else {
          return prev;
        }
      }

      tShelf.splice(insertAt, 0, ...spacers, itemToInsert);
      return next;
    });

    setDraggedBook(null);
    safePlay(playDropSound);
  };

  const handleDragEnd = () => {
    setDraggedBook(null);
  };

  const handleTrashZoneDrop = () => {
    if (draggedBook) {
      const { shelfIndex, itemIndex, stackBookId } = draggedBook;
      setShelves((prev) => {
        const next = prev.map((s) => ({
          ...s,
          items: s.items.map((i) =>
            i.type === "horizontal-stack"
              ? { ...i, bookIds: [...i.bookIds] }
              : { ...i },
          ),
        }));
        removeFromSource(next, shelfIndex, itemIndex, stackBookId);
        return next;
      });
      setDraggedBook(null);
    }
  };

  const handleToggleOrientation = (e, shelfIndex, itemIndex, stackBookId = null) => {
    e.preventDefault();
    setShelves((prev) => {
      if (stackBookId) {
        for (const orientation of getNextBookOrientations("horizontal")) {
          if (orientation === "horizontal") continue;

          const next = prev.map((s) => ({
            ...s,
            items: s.items.map((i) =>
              i.type === "horizontal-stack"
                ? { ...i, bookIds: [...i.bookIds] }
                : { ...i },
            ),
          }));
          const shelf = next[shelfIndex];
          const stackItem = shelf.items[itemIndex];
          if (!stackItem || stackItem.type !== "horizontal-stack") return prev;

          stackItem.bookIds = stackItem.bookIds.filter((id) => id !== stackBookId);
          const newBookItem = {
            id: makeItemId(),
            type: "book",
            bookId: stackBookId,
            orientation,
            sectionIndex: stackItem.sectionIndex,
          };
          if (stackItem.bookIds.length === 0) {
            shelf.items[itemIndex] = newBookItem;
          } else {
            shelf.items.splice(itemIndex + 1, 0, newBookItem);
          }

          if (canFitItemsInShelfSegments(
            shelf.items,
            bookMap,
            getShelfContentWidth(shelfIndex),
            theme.dividerCount || 0,
          )) return next;
        }
        return prev;
      }

      const nextBase = prev.map((s) => ({
        ...s,
        items: s.items.map((i) =>
          i.type === "horizontal-stack"
            ? { ...i, bookIds: [...i.bookIds] }
            : { ...i },
        ),
      }));
      const shelf = nextBase[shelfIndex];
      const item = shelf.items[itemIndex];
      if (!item || item.type !== "book") return prev;

      for (const orientation of getNextBookOrientations(item.orientation)) {
        const next = prev.map((s) => ({
          ...s,
          items: s.items.map((i) =>
            i.type === "horizontal-stack"
              ? { ...i, bookIds: [...i.bookIds] }
              : { ...i },
          ),
        }));
        const candidateShelf = next[shelfIndex];
        const candidateItem = candidateShelf.items[itemIndex];

        if (orientation === "horizontal") {
          candidateShelf.items[itemIndex] = {
            id: makeItemId(),
            type: "horizontal-stack",
            bookIds: [candidateItem.bookId],
            sectionIndex: candidateItem.sectionIndex,
          };
        } else {
          candidateItem.orientation = orientation;
        }

        if (canFitItemsInShelfSegments(
          candidateShelf.items,
          bookMap,
          getShelfContentWidth(shelfIndex),
          theme.dividerCount || 0,
        )) return next;
      }
      return prev;
    });
  };

  const handleResizeShelf = (
    shelfIndex,
    newHeight,
    maxHeight = MAX_SHELF_HEIGHT,
  ) => {
    setShelves((prev) => {
      const shelf = prev[shelfIndex];
      if (!shelf) return prev;
      const minHeight = getShelfMinHeight(shelf.items || [], bookMap);
      const clamped = Math.min(
        Math.max(maxHeight, minHeight),
        Math.max(minHeight, newHeight),
      );
      if (clamped === (shelf.height || DEFAULT_SHELF_HEIGHT)) return prev;
      const next = [...prev];
      next[shelfIndex] = { ...shelf, height: clamped };
      return next;
    });
  };

  const handleResizeShelfWidth = (shelfIndex, newWidth) => {
    setShelves((prev) => {
      const shelf = prev[shelfIndex];
      if (!shelf) return prev;
      const width = Math.min(MAX_SHELF_WIDTH, Math.max(120, Math.round(newWidth)));
      if (width === (shelf.width || 0)) return prev;
      const next = [...prev];
      next[shelfIndex] = { ...shelf, width };
      return next;
    });
  };

  const handleAddBook = (book, position) => {
    if (position?.addToStackId) {
      handleAddBookToStack(position.addToStackId, book);
      return;
    }

    const { shelfIndex, insertIndex, replaceEmptySlotId, slotIndex = 0 } = position;
    const bookRecord = {
      id: book.id,
      title: book.title,
      coverId: book.coverId,
      author: book.author,
      pages: book.pages,
      height: book.height,
      rating: book.rating,
      review: book.review,
    };
    const currentItems = shelves[shelfIndex]?.items || [];
    const sectionIndex =
      position.sectionIndex ??
      currentItems[insertIndex]?.sectionIndex ??
      currentItems[insertIndex - 1]?.sectionIndex ??
      0;
    const newItem = {
      id: makeItemId(),
      type: "book",
      bookId: book.id,
      orientation: "vertical",
      sectionIndex,
    };
    const newBookMap = { ...bookMap, [book.id]: bookRecord };
    const testItems = [...currentItems];
    if (replaceEmptySlotId) {
      const replaceIdx = testItems.findIndex((i) => i.id === replaceEmptySlotId);
      if (replaceIdx >= 0) {
        testItems.splice(replaceIdx, 1, newItem);
      } else {
        testItems.splice(insertIndex, 0, newItem);
      }
    } else {
      const spacers = Array.from({ length: slotIndex }, () => ({
        id: makeItemId(),
        type: "empty-slot",
        sectionIndex,
      }));
      testItems.splice(insertIndex, 0, ...spacers, newItem);
    }
    if (!canFitItemsInShelfSegments(
      testItems,
      newBookMap,
      getShelfContentWidth(shelfIndex),
      theme.dividerCount || 0,
    )) {
      return;
    }

    setBookMap((prev) => ({ ...prev, [book.id]: bookRecord }));
    setShelves((prev) => {
      const next = prev.map((s) => ({ ...s, items: [...s.items] }));
      if (replaceEmptySlotId) {
        const replaceIdx = next[shelfIndex].items.findIndex((i) => i.id === replaceEmptySlotId);
        if (replaceIdx >= 0) {
          next[shelfIndex].items.splice(replaceIdx, 1, newItem);
          return next;
        }
      }
      const spacers = Array.from({ length: slotIndex }, () => ({
        id: makeItemId(),
        type: "empty-slot",
        sectionIndex,
      }));
      next[shelfIndex].items.splice(insertIndex, 0, ...spacers, newItem);
      return next;
    });
  };

  const handleInsertEmptySlot = (shelfIndex, insertIndex, sectionIndex = null) => {
    setShelves((prev) => {
      const next = prev.map((s) => ({ ...s, items: [...s.items] }));
      const tShelf = next[shelfIndex].items;
      const resolvedSectionIndex =
        sectionIndex ??
        tShelf[insertIndex]?.sectionIndex ??
        tShelf[insertIndex - 1]?.sectionIndex ??
        0;
      const newItem = {
        id: makeItemId(),
        type: "empty-slot",
        sectionIndex: resolvedSectionIndex,
      };
      const projected = [...tShelf];
      projected.splice(insertIndex, 0, newItem);
      if (!canFitItemsInShelfSegments(
        projected,
        bookMap,
        getShelfContentWidth(shelfIndex),
        theme.dividerCount || 0,
      )) {
        return prev;
      }
      tShelf.splice(insertIndex, 0, newItem);
      return next;
    });
  };

  const handleRemoveBook = (shelfIndex, itemIndex, stackBookId = null) => {
    setShelves((prev) => {
      const next = prev.map((s) => ({
        ...s,
        items: s.items.map((i) =>
          i.type === "horizontal-stack"
            ? { ...i, bookIds: [...i.bookIds] }
            : { ...i },
        ),
      }));
      removeFromSource(next, shelfIndex, itemIndex, stackBookId);
      return next;
    });
  };


  const handleAddBookToStack = (stackItemId, book) => {
    const bookRecord = {
      id: book.id,
      title: book.title,
      coverId: book.coverId,
      author: book.author,
      pages: book.pages,
      height: book.height,
      rating: book.rating,
      review: book.review,
    };
    setBookMap((prev) => ({ ...prev, [book.id]: bookRecord }));
    setShelves((prev) => {
      const next = prev.map((s) => ({
        ...s,
        items: s.items.map((i) =>
          i.type === "horizontal-stack"
            ? { ...i, bookIds: [...i.bookIds] }
            : { ...i },
        ),
      }));
      for (const shelf of next) {
        const stack = shelf.items.find(
          (i) => i.id === stackItemId && i.type === "horizontal-stack",
        );
        if (stack) {
          const shelfHeight = shelf.height || DEFAULT_SHELF_HEIGHT;
          if (stack.bookIds.length < getMaxStackBooks(shelfHeight)) {
            stack.bookIds.push(book.id);
          }
          break;
        }
      }
      return next;
    });
  };

  const handleGoodreadsImport = (csvText) => {
    const books = parseGoodreadsCSV(csvText);
    setGoodreadsBooks(books);
    setBookMap((prev) => updateShelvedBooksFromGoodreads(prev, books));
    return books.length;
  };

  const handleThemeChange = (newTheme) => {
    if ((theme.dividerCount || 0) !== (newTheme.dividerCount || 0)) {
      setShelves((prev) =>
        assignShelfSections(
          prev,
          bookMap,
          newTheme.shelfWidth || 1200,
          newTheme.dividerCount || 0,
          true,
        ),
      );
    }
    setTheme(newTheme);
  };

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-lg bg-white p-6 text-center shadow-lg">
          <p className="mb-4 text-red-700" role="alert">{loadError}</p>
          <button
            className="mr-3 rounded bg-stone-800 px-4 py-2 text-white hover:bg-stone-700"
            onClick={() => {
              setLoading(true);
              setLoadAttempt((attempt) => attempt + 1);
            }}
          >
            Try again
          </button>
          {user && (
            <button
              className="rounded border border-stone-400 px-4 py-2 text-stone-700 hover:bg-stone-100"
              onClick={handleRequestLogout}
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-6 pt-0 transition-all duration-500"
      style={{
        background: `linear-gradient(135deg, ${theme.backgroundColor} 0%, ${theme.backgroundColor}dd 100%)`,
      }}
    >
      <div className="max-w-7xl mx-auto space-y-0 relative">
        <BookshelfHeader
          shelfCount={shelfCount}
          onShelfCountChange={setShelfCount}
          shelves={shelves}
          onShelfWidthChange={handleResizeShelfWidth}
          bookMap={bookMap}
          onShelfHeightChange={handleResizeShelf}
          theme={theme}
          onThemeChange={handleThemeChange}
          goodreadsBooks={goodreadsBooks}
          onGoodreadsImport={handleGoodreadsImport}
          user={user}
          onLoginClick={() =>
            onOpenAuth({
              shelves: { shelves, bookMap },
              stackTops: {},
              shelfCount,
              theme,
              goodreadsBooks,
            })
          }
          onLogout={handleRequestLogout}
          accountDisabled={loading}
        />

        {loading ? (
          <LoadingState />
        ) : (
          <div
            className={`perspective-1000 ${theme.name === "bw" ? "w-full min-w-0 overflow-x-auto" : "flex justify-center"}`}
            style={{
              perspective: theme.perspective3D ? "1000px" : "none",
              transformStyle: "preserve-3d",
            }}
          >
            <BookShelf
              shelves={shelves}
              bookMap={bookMap}
              draggedBook={draggedBook}
              theme={theme}
              onDisplayWidthChange={setDisplayShelfWidth}
              goodreadsBooks={goodreadsBooks}
              onToggleOrientation={handleToggleOrientation}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onAddBook={handleAddBook}
              onAddBookToStack={handleAddBookToStack}
              onRemoveBook={handleRemoveBook}
              onInsertEmptySlot={handleInsertEmptySlot}
              onResizeShelf={handleResizeShelf}
              onResizeShelfWidth={handleResizeShelfWidth}
            />
          </div>
        )}
        {saveError && (
          <div
            className="fixed bottom-4 right-4 z-40 rounded-md bg-red-700 px-4 py-2 text-sm text-white shadow-lg"
            role="alert"
          >
            {saveError}
          </div>
        )}

        <TrashZone
          isVisible={!!draggedBook}
          onDrop={handleTrashZoneDrop}
          side="left"
          shelfWidth={displayShelfWidth}
        />
        <TrashZone
          isVisible={!!draggedBook}
          onDrop={handleTrashZoneDrop}
          side="right"
          shelfWidth={displayShelfWidth}
        />
      </div>
    </div>
  );
}

// Module-level helper: mutates `next` (deep-copied shelves) to remove the dragged item
function removeFromSource(next, srcShelfIdx, srcItemIdx, stackBookId) {
  if (stackBookId) {
    const srcStack = next[srcShelfIdx]?.items[srcItemIdx];
    if (srcStack?.type === "horizontal-stack") {
      srcStack.bookIds = srcStack.bookIds.filter((id) => id !== stackBookId);
      if (srcStack.bookIds.length === 0) {
        next[srcShelfIdx].items.splice(srcItemIdx, 1);
      }
    }
  } else {
    next[srcShelfIdx]?.items.splice(srcItemIdx, 1);
  }
}
