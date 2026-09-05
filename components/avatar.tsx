/** Circular initial badge used for people throughout the app. */
export function Avatar({
  initial,
  size = "md",
  tone = "slate",
}: {
  initial: string;
  size?: "sm" | "md" | "lg";
  tone?: "slate" | "brand";
}) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };
  const tones = {
    slate: "bg-slate-500 text-white",
    brand: "bg-brand text-white",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium ${sizes[size]} ${tones[tone]}`}
    >
      {initial}
    </span>
  );
}
