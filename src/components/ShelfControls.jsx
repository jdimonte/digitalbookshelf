import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";

export default function ShelfControls({
  shelfCount,
  onShelfCountChange,
  dividerCount,
  onDividerCountChange,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Library</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-6 max-w-sm">
          <div className="space-y-3">
            <Label>Shelves: {shelfCount}</Label>
            <Slider
              value={[shelfCount]}
              onValueChange={(value) => onShelfCountChange(value[0])}
              min={1}
              max={10}
              step={1}
            />
          </div>

          <div className="space-y-3">
            <Label>Dividers: {dividerCount}</Label>
            <Slider
              value={[dividerCount]}
              onValueChange={(value) => onDividerCountChange(value[0])}
              min={0}
              max={5}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Add vertical dividers to create separate bookshelf sections
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
