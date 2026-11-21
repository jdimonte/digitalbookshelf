import { Loader2 } from "lucide-react";
import { Card, CardContent } from "./ui/card";

export default function LoadingState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin mb-3" />
        <p>Loading books...</p>
      </CardContent>
    </Card>
  );
}
