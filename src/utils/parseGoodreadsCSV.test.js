import test from "node:test";
import assert from "node:assert/strict";
import {
  parseGoodreadsCSV,
  updateShelvedBooksFromGoodreads,
} from "./parseGoodreadsCSV.js";

const csv = (rating, review) =>
  [
    "Title,Author,Number of Pages,ISBN,ISBN13,Exclusive Shelf,Year Published,My Rating,My Review",
    `A Novel,An Author,300,,,read,2024,${rating},"${review}"`,
  ].join("\n");

test("Goodreads import preserves fractional ratings and review text", () => {
  for (const rating of ["3.5", "3.25", "3.75"]) {
    const [book] = parseGoodreadsCSV(csv(rating, "Updated review"));
    assert.equal(book.rating, Number(rating));
    assert.equal(book.review, "Updated review");
  }
});

test("re-import updates matched book ratings and reviews without replacing book records", () => {
  const existing = {
    "openlibrary:/works/OL1W": {
      id: "openlibrary:/works/OL1W",
      title: "A Novel (Series, #1)",
      author: "An Author",
      coverId: 123,
      rating: 2,
      review: "Old review",
    },
    "openlibrary:/works/OL2W": {
      id: "openlibrary:/works/OL2W",
      title: "Another Novel",
      author: "Someone Else",
      rating: 4,
      review: "Keep this",
    },
  };
  const imported = parseGoodreadsCSV(csv("4.25", ""));
  const updated = updateShelvedBooksFromGoodreads(existing, imported);

  assert.deepEqual(Object.keys(updated), Object.keys(existing));
  assert.deepEqual(updated["openlibrary:/works/OL1W"], {
    ...existing["openlibrary:/works/OL1W"],
    rating: 4.25,
    review: "",
  });
  assert.deepEqual(updated["openlibrary:/works/OL2W"], existing["openlibrary:/works/OL2W"]);
  assert.equal(existing["openlibrary:/works/OL1W"].review, "Old review");
});
