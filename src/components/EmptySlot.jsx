import { Plus } from "lucide-react";

export default function EmptySlot({ onClick, isVisible, compact = false, fill = false }) {
  if (!isVisible) return null;

  if (compact) {
    return (
      <div
        onClick={onClick}
        className="w-3 h-[160px] flex items-center justify-center flex-none cursor-pointer group"
      >
        <Plus className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 group-hover:text-primary/70 transition-colors" />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`
        ${fill ? "w-full" : "w-8"}
        h-[160px]
        border-2
        border-dashed
        border-transparent
        bg-transparent
        flex
        items-center
        justify-center
        flex-none
        hover:border-primary/50
        hover:bg-primary/10
        transition-all
        cursor-pointer
        rounded-sm
        group
      `}
    >
      <Plus className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 group-hover:text-primary/70 transition-colors" />
    </div>
  );
}
