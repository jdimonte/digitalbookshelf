import { Info } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

export default function InfoButton() {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="text-muted-foreground hover:text-foreground"
      >
        <Info className="h-4 w-4" />
      </Button>

      {isVisible && (
        <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-popover border border-border rounded-lg shadow-lg z-50">
          <div className="text-sm">
            <p className="font-medium mb-1">How to use:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Right-click books to change orientation</li>
              <li>• Hover over shelves to see empty slots</li>
              <li>• Click empty slots to add new books</li>
              <li>• Drag books out of the Shelf to Remove</li>
            </ul>
          </div>
          {/* Arrow pointing down */}
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-border"></div>
        </div>
      )}
    </div>
  );
}
