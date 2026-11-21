import { ChevronDown, ChevronUp, Palette, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import {
  DEFAULT_SHELF_HEIGHT,
  getShelfMinHeight,
  MAX_SHELF_HEIGHT,
  MAX_SHELF_WIDTH,
  SHELF_BORDER_HEIGHT,
} from "../utils/shelfItems";
import { DEFAULT_SPINE_COLORS } from "../utils/spineColors";
import { BOOKCASE_STYLES } from "../utils/bookcaseStyles";

function Stepper({ label, value, unit = "", min, max, step = 1, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="group flex items-center gap-1">
        <span className="w-12 text-right text-sm tabular-nums">
          {value}
          {unit}
        </span>
        <div className="flex flex-col opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onChange(Math.min(max, value + step))}
            disabled={value >= max}
            aria-label={`Increase ${label}`}
            className="flex h-3 w-4 items-center justify-center text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onChange(Math.max(min, value - step))}
            disabled={value <= min}
            aria-label={`Decrease ${label}`}
            className="flex h-3 w-4 items-center justify-center text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ThemeCustomizer({
  theme,
  onThemeChange,
  shelfCount,
  onShelfCountChange,
  shelves,
  onShelfWidthChange,
  bookMap,
  onShelfHeightChange,
  triggerClassName,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  useEffect(() => {
    const handleResize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const isSimpleLayout = theme.name === "bw";
  const bookshelfCount = Math.max(2, shelfCount);
  const totalShelfWidth = theme.shelfWidth || 850;
  const defaultBookshelfWidth = totalShelfWidth / bookshelfCount;
  const maxShelfHeight = Math.max(MAX_SHELF_HEIGHT, viewport.height - 32);
  const maxBookshelfWidth = Math.min(
    MAX_SHELF_WIDTH,
    Math.max(1200, viewport.width - 32),
  );
  const bookcaseStyle =
    BOOKCASE_STYLES[theme.bookcaseStyle] || BOOKCASE_STYLES.modern;
  const innerWidth =
    bookcaseStyle.IMG_W - bookcaseStyle.INNER_L - bookcaseStyle.INNER_R;
  const contentHeight =
    shelves.reduce(
      (sum, shelf) => sum + (shelf.height || DEFAULT_SHELF_HEIGHT),
      0,
    ) + Math.max(0, shelves.length - 1) * SHELF_BORDER_HEIGHT;
  const frameHeight = Math.round(
    contentHeight *
      (bookcaseStyle.IMG_H /
        (bookcaseStyle.IMG_H - bookcaseStyle.INNER_T - bookcaseStyle.INNER_B)),
  );
  const heightScale = Math.min(
    1,
    Math.max(0.01, (viewport.height - 32) / Math.max(1, frameHeight)),
  );
  const maxShelfWidth = Math.min(
    MAX_SHELF_WIDTH,
    Math.max(
      1200,
      Math.ceil(
        (viewport.width - 32) /
          (heightScale * (bookcaseStyle.IMG_W / innerWidth)),
      ),
    ),
  );
  const combinedBookshelfWidth = shelves.reduce(
    (sum, shelf) => sum + (shelf.width || defaultBookshelfWidth),
    0,
  );

  const presetThemes = {
    vintage: {
      name: "vintage",
      displayName: "Vintage",
      shelfColor: "#654321",
      backgroundColor: "#DEB887",
      lighting: "warm",
      decorations: true,
      perspective3D: false,
      shelfWidth: 850,
      dividerCount: 1,
      gradientTopColor: "#8B5A2B",
      gradientBottomColor: "#654321",
      spineColors: DEFAULT_SPINE_COLORS,
    },
    modern: {
      name: "modern",
      displayName: "Modern",
      shelfColor: "#2C3E50",
      backgroundColor: "#ECF0F1",
      lighting: "cool",
      decorations: false,
      perspective3D: true,
      shelfWidth: 850,
      dividerCount: 0,
      gradientTopColor: "#34495e",
      gradientBottomColor: "#2c3e50",
      spineColors: DEFAULT_SPINE_COLORS,
    },
    bw: {
      name: "bw",
      displayName: "2D Black and White",
      shelfColor: "#e0e0e0",
      backgroundColor: "#ffffff",
      lighting: "bw",
      decorations: false,
      perspective3D: false,
      shelfWidth: 850,
      dividerCount: 0,
      gradientTopColor: "#ffffff",
      gradientBottomColor: "#ffffff",
      spineColors: DEFAULT_SPINE_COLORS,
    },
  };

  const handleThemeSelect = (themeName) => {
    onThemeChange({
      ...presetThemes[themeName],
      shelfWidth: theme.shelfWidth,
      dividerCount: theme.dividerCount,
      spineColors: theme.spineColors,
      bookcaseStyle: theme.bookcaseStyle,
    });
  };

  const handleBookcaseStyleChange = (bookcaseStyle) => {
    onThemeChange({
      ...theme,
      bookcaseStyle,
    });
  };

  const handleSpineColorChange = (index, color) => {
    const spineColors = [...(theme.spineColors || DEFAULT_SPINE_COLORS)];
    spineColors[index] = color;
    onThemeChange({
      ...theme,
      spineColors,
    });
  };

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={triggerClassName}
      >
        <Palette className="h-4 w-4" />
        Customize bookshelf
      </Button>
    );
  }

  return (
    createPortal(
      <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[80] bg-black/50"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <Card className="fixed left-1/2 top-1/2 z-[90] max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[500px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Customize Your Library
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            ✕
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Theme Presets */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Theme Presets
            </Label>
            <RadioGroup
              value={theme.name}
              onValueChange={handleThemeSelect}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            >
              {Object.entries(presetThemes).map(([key, preset]) => (
                <div key={key} className="flex items-center space-x-2">
                  <RadioGroupItem value={key} id={key} />
                  <Label htmlFor={key} className="text-sm cursor-pointer">
                    {preset.displayName}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Bookcase Style */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Bookcase Style
            </Label>
            <RadioGroup
              value={theme.bookcaseStyle || "modern"}
              onValueChange={handleBookcaseStyleChange}
              className="grid grid-cols-2 gap-3"
            >
              {Object.entries(BOOKCASE_STYLES).map(([key, style]) => (
                <div key={key} className="flex items-center space-x-2">
                  <RadioGroupItem value={key} id={`bookcase-${key}`} />
                  <Label
                    htmlFor={`bookcase-${key}`}
                    className="text-sm cursor-pointer"
                  >
                    {style.displayName}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Background Color / Bookcase Color / Shelf Gradient */}
          <div className="flex flex-wrap gap-6">
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Background Color
              </Label>
              <input
                type="color"
                value={theme.backgroundColor}
                onChange={(e) =>
                  onThemeChange({ ...theme, backgroundColor: e.target.value })
                }
                className="h-8 w-8 cursor-pointer rounded border border-input p-0"
                aria-label="Background color"
              />
            </div>

            <div>
              <Label className="text-sm font-medium mb-3 block">
                Bookcase Color
              </Label>
              <input
                type="color"
                value={theme.shelfColor}
                onChange={(e) =>
                  onThemeChange({ ...theme, shelfColor: e.target.value })
                }
                className="h-8 w-8 cursor-pointer rounded border border-input p-0"
                aria-label="Bookcase color"
              />
            </div>

            <div>
              <Label className="text-sm font-medium mb-3 block">
                Shelf Gradient
              </Label>
              <div className="flex flex-wrap gap-6">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Top
                  </Label>
                  <input
                    type="color"
                    value={theme.gradientTopColor || theme.shelfColor}
                    onChange={(e) =>
                      onThemeChange({
                        ...theme,
                        gradientTopColor: e.target.value,
                      })
                    }
                    className="h-8 w-8 cursor-pointer rounded border border-input p-0"
                    aria-label="Shelf gradient top color"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Bottom
                  </Label>
                  <input
                    type="color"
                    value={theme.gradientBottomColor || theme.shelfColor}
                    onChange={(e) =>
                      onThemeChange({
                        ...theme,
                        gradientBottomColor: e.target.value,
                      })
                    }
                    className="h-8 w-8 cursor-pointer rounded border border-input p-0"
                    aria-label="Shelf gradient bottom color"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Book Spine Colors */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Book Spine Colors
            </Label>
            <div className="flex flex-wrap gap-3">
              {(theme.spineColors || DEFAULT_SPINE_COLORS).map((color, index) => (
                <input
                  key={index}
                  type="color"
                  value={color}
                  onChange={(e) => handleSpineColorChange(index, e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-input p-0"
                  aria-label={`Book spine color ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {isSimpleLayout ? (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Bookshelf Sizes</Label>
              <div className="space-y-3">
                {shelves.map((shelf, index) => {
                  const minHeight = getShelfMinHeight(
                    shelf.items || [],
                    bookMap,
                  );
                  const shelfMaxHeight = Math.max(
                    minHeight,
                    maxShelfHeight,
                  );
                  return (
                    <div key={shelf.id || index} className="space-y-3">
                      <Stepper
                        label={`Bookshelf ${index + 1} width`}
                        unit="px"
                        value={Math.round(shelf.width || defaultBookshelfWidth)}
                        min={120}
                        max={maxBookshelfWidth}
                        step={10}
                        onChange={(value) => onShelfWidthChange(index, value)}
                      />
                      <Stepper
                        label={`Bookshelf ${index + 1} height`}
                        unit="px"
                        value={Math.round(shelf.height || DEFAULT_SHELF_HEIGHT)}
                        min={minHeight}
                        max={shelfMaxHeight}
                        step={10}
                        onChange={(value) =>
                          onShelfHeightChange(index, value, shelfMaxHeight)
                        }
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Combined width: {Math.round(combinedBookshelfWidth)}px
              </p>
              <p className="text-xs text-muted-foreground">
                Drag a bookshelf&apos;s bottom or right edge to resize it.
              </p>
            </div>
          ) : (
            <Stepper
              label="Shelf Width"
              unit="px"
              value={totalShelfWidth}
              min={500}
              max={maxShelfWidth}
              step={50}
              onChange={(value) => onThemeChange({ ...theme, shelfWidth: value })}
            />
          )}

          {/* Number of Shelves Control */}
          <Stepper
            label={theme.name === "bw" ? "Number of Bookshelves" : "Number of Shelves"}
            value={shelfCount}
            min={2}
            max={5}
            step={1}
            onChange={onShelfCountChange}
          />

          {/* Divider Count Control */}
          <Stepper
            label="Shelf Dividers"
            value={theme.dividerCount || 0}
            min={0}
            max={5}
            step={1}
            onChange={(value) =>
              onThemeChange({ ...theme, dividerCount: value })
            }
          />

        </CardContent>
      </Card>
      </>,
      document.body,
    )
  );
}
