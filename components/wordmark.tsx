/** The "Guidoo" wordmark — rounded, light, gold. Matches every Figma header. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-brand font-normal tracking-wide text-brand select-none ${className}`}
    >
      Guidoo
    </span>
  );
}
