import { BookOpen, Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { stripSeriesSuffix } from "../utils/parseGoodreadsCSV";

const SHELF_LABELS = {
  "to-read": "To Read",
  "currently-reading": "Reading",
  read: "Read",
};

function makeBookRecord(doc, fallbackPages, extra = {}) {
  const seed = doc.cover_i;
  const height = 140 + (((seed * 9301 + 49297) % 233280) / 233280) * 50;
  return {
    id: doc.key,
    title: doc.title,
    coverId: doc.cover_i,
    author: doc.author_name?.[0] || "Unknown Author",
    pages: doc.number_of_pages_median || fallbackPages || "?",
    publishYear: doc.first_publish_year || "Unknown",
    height,
    orientation: "vertical",
    ...extra,
  };
}

function normalizeName(name) {
  return (name || "").toLowerCase().replace(/[^a-z]/g, "");
}

function authorSurname(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  return normalizeName(parts[parts.length - 1]);
}

function normalizeTitle(title) {
  return (title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// A result only counts as "verified" if BOTH the title and author line up
// with the Goodreads row — matching on author alone lets a prolific author's
// other book (e.g. a different R.F. Kuang title) pass as a false positive,
// and matching on title alone lets an unrelated book with the same title
// (e.g. a different "Yellowface") pass.
function pickBestMatch(docs, expectedTitle, expectedAuthor) {
  const withCover = docs.filter((d) => d.cover_i);
  const expectedSurname = authorSurname(expectedAuthor);
  const expectedNormTitle = normalizeTitle(stripSeriesSuffix(expectedTitle));
  const verified = withCover.find(
    (d) =>
      normalizeTitle(d.title) === expectedNormTitle &&
      expectedSurname &&
      (d.author_name || []).some((a) => authorSurname(a) === expectedSurname),
  );
  return { doc: verified || withCover[0] || null, verified: Boolean(verified) };
}

export default function BookSearchModal({
  isOpen,
  onClose,
  onAddBook,
  position,
  previewOrientation = "vertical",
  goodreadsBooks = [],
}) {
  const hasGoodreads = goodreadsBooks.length > 0;
  // tabOverride is null until the user explicitly switches tabs; derived default from hasGoodreads
  const [tabOverride, setTabOverride] = useState(null);
  const activeTab = tabOverride ?? (hasGoodreads ? "goodreads" : "search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState(new Set());
  const [goodreadsFilter, setGoodreadsFilter] = useState("");
  const [goodreadsRatingFilter, setGoodreadsRatingFilter] = useState("all");
  const [selectedGoodreadsKeys, setSelectedGoodreadsKeys] = useState(new Set());
  const [isAddingGoodreads, setIsAddingGoodreads] = useState(false);
  const [addError, setAddError] = useState(null);

  const maxBooks = position?.maxBooks ?? Infinity;

  const resetAndClose = () => {
    setTabOverride(null);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedBooks(new Set());
    setGoodreadsFilter("");
    setGoodreadsRatingFilter("all");
    setSelectedGoodreadsKeys(new Set());
    setAddError(null);
    onClose();
  };

  const grKey = (book) => `${book.title}|||${book.author}`;

  const searchBooks = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10&fields=key,title,author_name,cover_i,number_of_pages_median,first_publish_year`,
      );
      const data = await response.json();
      const formattedResults = data.docs
        .filter((doc) => doc.cover_i)
        .slice(0, 8)
        .map((doc) => makeBookRecord(doc, null));
      setSearchResults(formattedResults);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "search") return;
    const id = setTimeout(() => {
      if (searchQuery.trim().length >= 2) searchBooks(searchQuery);
      else if (!searchQuery.trim()) { setSearchResults([]); setIsSearching(false); }
    }, 500);
    return () => clearTimeout(id);
  }, [searchQuery, searchBooks, activeTab]);

  const handleManualSearch = () => {
    if (searchQuery.trim()) searchBooks(searchQuery);
  };

  const handleToggleBookSelection = (bookId) => {
    setSelectedBooks((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else if (next.size < maxBooks) {
        next.add(bookId);
      }
      return next;
    });
  };

  const handleAddSelectedBooks = () => {
    const booksToAdd = searchResults.filter((book) => selectedBooks.has(book.id));
    booksToAdd.forEach((book, index) => {
      const bookPosition = position.addToStackId
        ? { addToStackId: position.addToStackId }
        : {
            shelfIndex: position.shelfIndex,
            insertIndex: position.insertIndex + (index === 0 ? 0 : (position.slotIndex || 0) + index),
            slotIndex: index === 0 ? (position.slotIndex || 0) : 0,
            replaceEmptySlotId: index === 0 ? position.replaceEmptySlotId : null,
            sectionIndex: position.sectionIndex,
          };
      onAddBook(book, bookPosition);
    });
    resetAndClose();
  };

  const handleSelectAll = () => {
    const cap = Math.min(searchResults.length, maxBooks);
    setSelectedBooks(
      selectedBooks.size >= cap
        ? new Set()
        : new Set(searchResults.slice(0, cap).map((b) => b.id)),
    );
  };

  const handleToggleGoodreadsSelection = (book) => {
    const key = grKey(book);
    setSelectedGoodreadsKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (next.size < maxBooks) {
        next.add(key);
      }
      return next;
    });
  };

  const searchOpenLibrary = async (query, expectedTitle, expectedAuthor) => {
    const resp = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10&fields=key,title,author_name,cover_i,number_of_pages_median,first_publish_year`,
    );
    const data = await resp.json();
    return pickBestMatch(data.docs, expectedTitle, expectedAuthor);
  };

  const fetchBookFromOpenLibrary = async (grBook) => {
    let isbnResult = { doc: null, verified: false };
    if (grBook.isbn) {
      isbnResult = await searchOpenLibrary(`isbn:${grBook.isbn}`, grBook.title, grBook.author);
      if (isbnResult.verified) {
        return makeBookRecord(isbnResult.doc, grBook.pages, {
          rating: grBook.rating,
          review: grBook.review,
        });
      }
    }

    // A mismapped ISBN (a known OpenLibrary data-quality issue) can point to a
    // book with no relation at all to the actual title/author, so an
    // unverified ISBN hit is untrustworthy — a title+author search result is
    // always preferred when the ISBN alone didn't verify.
    const cleanTitle = stripSeriesSuffix(grBook.title);
    let titleResult = await searchOpenLibrary(`${cleanTitle} ${grBook.author}`, grBook.title, grBook.author);
    if (!titleResult.verified && cleanTitle !== grBook.title) {
      const rawResult = await searchOpenLibrary(`${grBook.title} ${grBook.author}`, grBook.title, grBook.author);
      if (rawResult.verified || !titleResult.doc) titleResult = rawResult;
    }

    const best = titleResult.doc ? titleResult : isbnResult;
    return best.doc
      ? makeBookRecord(best.doc, grBook.pages, {
          rating: grBook.rating,
          review: grBook.review,
        })
      : null;
  };

  const handleAddSelectedGoodreadsBooks = async () => {
    const booksToAdd = filteredGoodreads.filter((b) =>
      selectedGoodreadsKeys.has(grKey(b)),
    );
    setIsAddingGoodreads(true);
    setAddError(null);
    try {
      const results = await Promise.allSettled(
        booksToAdd.map((b) => fetchBookFromOpenLibrary(b)),
      );
      const found = results
        .map((r) => (r.status === "fulfilled" ? r.value : null))
        .filter(Boolean);
      const missed = results.filter(
        (r) => r.status === "rejected" || r.value === null,
      ).length;

      found.forEach((book, index) => {
        const bookPosition = position.addToStackId
          ? { addToStackId: position.addToStackId }
          : {
              shelfIndex: position.shelfIndex,
              insertIndex: position.insertIndex + (
                index === 0 ? 0 : (position.slotIndex || 0) + index
              ),
              slotIndex: index === 0 ? (position.slotIndex || 0) : 0,
              replaceEmptySlotId: index === 0 ? position.replaceEmptySlotId : null,
              sectionIndex: position.sectionIndex,
            };
        onAddBook(book, bookPosition);
      });

      if (found.length > 0) {
        resetAndClose();
      } else {
        setAddError("Couldn't find covers for any selected books on OpenLibrary.");
      }
      if (missed > 0 && found.length > 0) {
        // partial failure — modal already closed, nothing to show
      }
    } catch {
      setAddError("Failed to fetch book data. Try again.");
    } finally {
      setIsAddingGoodreads(false);
    }
  };

  const filteredGoodreads = goodreadsBooks.filter((b) => {
    const q = goodreadsFilter.trim().toLowerCase();
    const matchesText =
      !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
    const matchesRating = goodreadsRatingFilter === "all"
      || (goodreadsRatingFilter === "unrated"
        ? !b.rating
        : b.rating >= Number(goodreadsRatingFilter));
    return matchesText && matchesRating;
  });

  const groupedGoodreads = ["to-read", "currently-reading", "read"].reduce(
    (acc, shelf) => {
      const books = filteredGoodreads.filter((b) => b.shelf === shelf);
      if (books.length > 0) acc[shelf] = books;
      return acc;
    },
    {},
  );

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={resetAndClose} />

      <Card className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] max-h-[80vh] z-50 shadow-2xl flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between flex-shrink-0">
          <CardTitle className="text-xl">Add a Book</CardTitle>
          <Button variant="ghost" size="icon-sm" onClick={resetAndClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 overflow-hidden flex-1 min-h-0">
          {/* Tabs — only show if Goodreads books are loaded */}
          {hasGoodreads && (
            <div className="flex border-b border-border -mb-1 flex-shrink-0">
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "goodreads"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setTabOverride("goodreads")}
              >
                <span className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  My Goodreads ({goodreadsBooks.length})
                </span>
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "search"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setTabOverride("search")}
              >
                <span className="flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5" />
                  Search OpenLibrary
                </span>
              </button>
            </div>
          )}

          {/* Goodreads tab */}
          {activeTab === "goodreads" && (
            <div className="flex flex-col gap-3 overflow-hidden flex-1 min-h-0">
              <div className="flex gap-2 flex-shrink-0">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Filter your books..."
                    value={goodreadsFilter}
                    onChange={(e) => setGoodreadsFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>
                <select
                  aria-label="Filter by star rating"
                  value={goodreadsRatingFilter}
                  onChange={(e) => setGoodreadsRatingFilter(e.target.value)}
                  className="min-w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All ratings</option>
                  <option value="5">5+ stars</option>
                  <option value="4">4+ stars</option>
                  <option value="3">3+ stars</option>
                  <option value="2">2+ stars</option>
                  <option value="1">1+ stars</option>
                  <option value="unrated">Unrated</option>
                </select>
              </div>

              {filteredGoodreads.length > 0 && (
                <div className="flex items-center justify-between flex-shrink-0">
                  {isFinite(maxBooks) ? (
                    <span className="text-xs text-muted-foreground">
                      {selectedGoodreadsKeys.size}/{maxBooks} books fit here
                    </span>
                  ) : (
                    <span />
                  )}
                  {selectedGoodreadsKeys.size > 0 && (
                    <Button
                      size="sm"
                      onClick={handleAddSelectedGoodreadsBooks}
                      disabled={isAddingGoodreads}
                      className="flex items-center gap-1"
                    >
                      {isAddingGoodreads ? (
                        <div className="h-3 w-3 animate-spin border-2 border-primary-foreground border-t-transparent rounded-full" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      {isAddingGoodreads
                        ? "Adding..."
                        : `Add Selected (${selectedGoodreadsKeys.size})`}
                    </Button>
                  )}
                </div>
              )}

              {addError && (
                <p className="text-xs text-destructive flex-shrink-0">{addError}</p>
              )}

              <div className="overflow-y-auto flex-1 space-y-4 min-h-0">
                {Object.entries(groupedGoodreads).map(([shelf, books]) => {
                  const allGroupKeys = books.map(grKey);
                  const allGroupSelected = allGroupKeys.every((k) =>
                    selectedGoodreadsKeys.has(k),
                  );
                  const toggleGroup = () => {
                    setSelectedGoodreadsKeys((prev) => {
                      const next = new Set(prev);
                      if (allGroupSelected) {
                        allGroupKeys.forEach((k) => next.delete(k));
                      } else {
                        const canAdd = maxBooks - next.size;
                        allGroupKeys.slice(0, canAdd).forEach((k) => next.add(k));
                      }
                      return next;
                    });
                  };
                  return (
                  <div key={shelf}>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {SHELF_LABELS[shelf]} ({books.length})
                      </Label>
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={toggleGroup}
                      >
                        {allGroupSelected ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {books.map((book, i) => {
                        const key = grKey(book);
                        const isSelected = selectedGoodreadsKeys.has(key);
                        const atLimit = !isSelected && selectedGoodreadsKeys.size >= maxBooks;
                        return (
                          <div
                            key={`${shelf}-${i}`}
                            className={`flex items-center gap-3 p-2.5 border rounded-lg transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/5 cursor-pointer"
                                : atLimit
                                  ? "border-border opacity-50 cursor-not-allowed"
                                  : "border-border hover:bg-muted/50 cursor-pointer"
                            }`}
                            onClick={() => !atLimit && handleToggleGoodreadsSelection(book)}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={atLimit}
                              onChange={() => handleToggleGoodreadsSelection(book)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2 flex-shrink-0 disabled:cursor-not-allowed"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{book.title}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                by {book.author}
                                {book.year ? ` · ${book.year}` : ""}
                                {book.pages ? ` · ${book.pages} pages` : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  );
                })}

                {filteredGoodreads.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No books match the selected filters.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Search tab */}
          {activeTab === "search" && (
            <div className="flex flex-col gap-4 overflow-hidden flex-1 min-h-0">
              <div className="flex gap-2 flex-shrink-0">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleManualSearch()}
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleManualSearch}
                  disabled={!searchQuery.trim() || isSearching}
                  variant="outline"
                >
                  {isSearching ? "Searching..." : "Search Now"}
                </Button>
              </div>

              {isSearching && (
                <p className="text-sm text-muted-foreground flex-shrink-0">
                  Searching for "{searchQuery}"...
                </p>
              )}

              <div className="overflow-y-auto flex-1 space-y-2 min-h-0">
                {searchResults.length > 0 && (
                  <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <div className="flex flex-col gap-0.5">
                      <Label className="text-sm font-medium">Search Results:</Label>
                      {isFinite(maxBooks) && (
                        <span className="text-xs text-muted-foreground">
                          {selectedBooks.size}/{maxBooks} books fit here
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleSelectAll} className="text-xs">
                        {selectedBooks.size >= Math.min(searchResults.length, maxBooks) ? "Deselect All" : "Select All"}
                      </Button>
                      {selectedBooks.size > 0 && (
                        <Button size="sm" onClick={handleAddSelectedBooks} className="flex items-center gap-1">
                          <Plus className="h-3 w-3" />
                          Add Selected ({selectedBooks.size})
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {searchResults.map((book) => {
                  const isSelected = selectedBooks.has(book.id);
                  const atLimit = !isSelected && selectedBooks.size >= maxBooks;
                  return (
                  <div
                    key={book.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : atLimit
                          ? "border-border opacity-50 cursor-not-allowed"
                          : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleBookSelection(book.id)}
                      disabled={atLimit}
                      className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2 disabled:cursor-not-allowed"
                    />
                    <img
                      src={`https://covers.openlibrary.org/b/id/${book.coverId}-S.jpg`}
                      alt={book.title}
                      className={previewOrientation === "horizontal" ? "hidden" : "w-12 h-16 object-cover rounded"}
                    />
                    {previewOrientation === "horizontal" && (
                      <div
                        className="h-6 flex items-center justify-center px-2 rounded flex-shrink-0"
                        style={{
                          width: "120px",
                          backgroundColor: `hsl(${(book.coverId || 0) % 360}, 30%, 30%)`,
                        }}
                      >
                        <span className="text-[8px] font-medium text-white truncate w-full text-center">
                          {book.title}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{book.title}</h4>
                      <p className="text-xs text-muted-foreground">by {book.author}</p>
                      <p className="text-xs text-muted-foreground">
                        {book.publishYear} · {book.pages} pages
                      </p>
                    </div>
                  </div>
                  );
                })}

                {searchQuery && searchResults.length === 0 && !isSearching && searchQuery.length >= 2 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No books found for "{searchQuery}"</p>
                    <p className="text-sm mt-1">Try a different search term or check spelling</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
