import { LogIn, LogOut, SlidersHorizontal, Upload } from "lucide-react";
import { useRef, useState } from "react";
import SettingsButton from "./SettingsButton";
import ThemeCustomizer from "./ThemeCustomizer";
import { Button } from "./ui/button";

export default function BookshelfHeader({
  shelfCount,
  onShelfCountChange,
  shelves,
  onShelfWidthChange,
  bookMap,
  onShelfHeightChange,
  theme,
  onThemeChange,
  goodreadsBooks,
  onGoodreadsImport,
  user,
  onLoginClick,
  onLogout,
  accountDisabled,
}) {
  const fileInputRef = useRef(null);
  const triggerRef = useRef(null);
  const [importFeedback, setImportFeedback] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isExpanded = isOpen || isHovered;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const count = onGoodreadsImport(evt.target.result);
      setImportFeedback(`Imported ${count} book${count !== 1 ? "s" : ""}`);
      setTimeout(() => setImportFeedback(null), 3000);
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.target.value = "";
  };


  const actionClassName =
    "w-full justify-start gap-3 rounded-xl px-3 py-2 text-sm font-normal text-stone-700 hover:bg-stone-100 hover:text-stone-950";

  return (
    <div
      className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={(event) => {
        if (event.target !== triggerRef.current) setIsOpen(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setIsOpen(false);
      }}
    >
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon-lg"
        className="h-12 w-12 rounded-full border border-white/70 bg-white/90 text-stone-700 shadow-lg backdrop-blur-md hover:bg-white hover:text-stone-950"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Bookshelf options"
        aria-expanded={isExpanded}
        aria-controls="bookshelf-options"
        title="Bookshelf options"
      >
        <SlidersHorizontal className="h-5 w-5" />
      </Button>

      <div
        id="bookshelf-options"
        role="group"
        aria-label="Bookshelf options"
        className={`absolute right-0 top-full mt-3 w-72 max-w-[calc(100vw-2rem)] origin-top-right rounded-2xl border border-white/70 bg-white/95 p-2 shadow-xl ring-1 ring-black/5 backdrop-blur-xl transition duration-200 ${
          isExpanded
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none invisible -translate-y-2 scale-95 opacity-0"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />

        {user && (
          <div
            className="truncate px-3 pb-2 pt-1 text-xs text-stone-500"
            title={user.email}
          >
            {user.email || user.displayName || "Signed in"}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className={`${actionClassName} text-[#654321]`}
          onClick={() => fileInputRef.current?.click()}
          title="Import your Goodreads library CSV"
        >
          <Upload className="h-4 w-4" />
          {goodreadsBooks.length > 0 ? "Re-import Goodreads" : "Import Goodreads"}
        </Button>

        <ThemeCustomizer
          theme={theme}
          onThemeChange={onThemeChange}
          shelfCount={shelfCount}
          onShelfCountChange={onShelfCountChange}
          shelves={shelves}
          onShelfWidthChange={onShelfWidthChange}
          bookMap={bookMap}
          onShelfHeightChange={onShelfHeightChange}
          triggerClassName={actionClassName}
        />
        <SettingsButton actionClassName={actionClassName} />

        <div className="my-1 border-t border-stone-100" />

        {user ? (
          <Button
            variant="ghost"
            size="sm"
            className={actionClassName}
            onClick={onLogout}
            disabled={accountDisabled}
            title="Sign out of your account"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className={actionClassName}
            onClick={onLoginClick}
            disabled={accountDisabled}
            style={{ color: "#654321" }}
          >
            <LogIn className="h-4 w-4" />
            Log in
          </Button>
        )}

        {importFeedback && (
          <p
            className="px-3 pb-1 pt-2 text-xs font-medium text-emerald-700"
            role="status"
          >
            {importFeedback}
          </p>
        )}
      </div>
    </div>
  );
}
