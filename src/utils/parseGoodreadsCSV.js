// Tokenizes the entire CSV text at once (not line-by-line) so quoted fields
// containing embedded newlines — common in Goodreads "My Review" exports —
// don't get split into bogus rows.
function parseCSVRows(text) {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(current);
      current = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(current);
      current = "";
      rows.push(row);
      row = [];
    } else {
      current += ch;
    }
  }

  if (current !== "" || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

// Goodreads appends a series annotation like "(Off-Campus, #3)" to titles;
// OpenLibrary stores the bare title, so searches need this stripped off.
export function stripSeriesSuffix(title) {
  return title.replace(/\s*\([^()]*#\d+[^()]*\)\s*$/, "").trim();
}

export function parseGoodreadsCSV(text) {
  const rows = parseCSVRows(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const idx = (name) => headers.indexOf(name.toLowerCase());

  const titleIdx = idx("title");
  const authorIdx = idx("author");
  const pagesIdx = idx("number of pages");
  const isbn13Idx = idx("isbn13");
  const isbn10Idx = idx("isbn");
  const shelfIdx = idx("exclusive shelf");
  const yearIdx = idx("year published");
  const ratingIdx = idx("my rating");
  const reviewIdx = idx("my review");

  const books = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const title = cols[titleIdx]?.trim();
    if (!title) continue;

    const shelf = cols[shelfIdx]?.trim() || "read";
    if (!["read", "to-read", "currently-reading"].includes(shelf)) continue;

    const rawIsbn13 = cols[isbn13Idx]?.replace(/[^0-9]/g, "") || "";
    const rawIsbn10 = cols[isbn10Idx]?.replace(/[^0-9]/g, "") || "";

    books.push({
      title,
      author: cols[authorIdx]?.trim() || "",
      pages: parseInt(cols[pagesIdx]) || null,
      isbn: rawIsbn13 || rawIsbn10,
      shelf,
      year: cols[yearIdx]?.trim() || "",
      rating: Number.isFinite(Number(cols[ratingIdx]))
        ? Math.min(5, Math.max(0, Number(cols[ratingIdx])))
        : 0,
      review: cols[reviewIdx]?.trim() || "",
    });
  }

  return books;
}

export function updateShelvedBooksFromGoodreads(bookMap, books) {
  const next = { ...bookMap };
  for (const [id, shelved] of Object.entries(bookMap)) {
    const match = books.find(
      (book) =>
        stripSeriesSuffix(book.title).toLowerCase() ===
          stripSeriesSuffix(shelved.title || "").toLowerCase() &&
        book.author.toLowerCase() === shelved.author?.toLowerCase(),
    );
    if (match) {
      next[id] = { ...shelved, rating: match.rating, review: match.review };
    }
  }
  return next;
}
