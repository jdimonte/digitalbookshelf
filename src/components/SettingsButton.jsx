import { Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";

export default function SettingsButton({ actionClassName }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={actionClassName}
      >
        <Settings className="h-4 w-4" />
        How to use
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Settings Panel */}
          <Card className="absolute right-0 top-full z-[60] mt-2 w-80 max-w-[calc(100vw-2rem)] shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg">Bookshelf Settings</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="pt-2 border-t">
                <div className="mb-3">
                  <Label className="text-sm font-medium">How to use:</Label>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• Right-click books to change orientation</li>
                    <li>• Hover over shelves to see empty slots</li>
                    <li>• Click empty slots to add new books</li>
                    <li>• Drag books out of the Shelf to Remove</li>
                  </ul>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="w-full"
                >
                  Done
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
