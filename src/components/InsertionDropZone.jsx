export default function InsertionDropZone({ isVisible, onDragOver, onDrop }) {
  if (!isVisible) return null;

  return (
    <div
      className="
        w-1
        h-full
        bg-primary/60
        border-2
        border-primary
        border-dashed
        flex-shrink-0
        transition-all
        duration-200
        animate-pulse
        rounded-sm
        min-h-[160px]
        flex
        items-center
        justify-center
      "
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{ zIndex: 10 }}
    >
      <div className="w-0.5 h-8 bg-primary rounded-full opacity-80" />
    </div>
  );
}
