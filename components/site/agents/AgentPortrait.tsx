import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * An agent's real photograph, or their initials set large in the display
 * serif. Never a stock face (CLAUDE.md): a profile without a photo stays a
 * monogram, and the monogram is `aria-hidden` because the name is always
 * printed beside it.
 */
export function AgentPortrait({
  monogram,
  photoUrl,
  alt = "",
  tone = "light",
  sizes,
  priority = false,
  className,
}: {
  monogram: string;
  photoUrl?: string;
  /** `""` inside a card whose link already names the agent. */
  alt?: string;
  /** `light` sits on ivory (an ink tile); `dark` sits on the ink band. */
  tone?: "light" | "dark";
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (photoUrl !== undefined) {
    return (
      <div className={cn("relative overflow-hidden bg-ivory-2", className)}>
        <Image
          src={photoUrl}
          alt={alt}
          fill
          sizes={sizes}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          className="object-cover object-[50%_25%] transition-[scale] duration-300 ease-out pointer-fine:group-hover/agent:scale-[1.03]"
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex items-center justify-center overflow-hidden",
        tone === "light" ? "bg-ink" : "bg-ink-2",
        className,
      )}
    >
      <span
        className={cn(
          "absolute inset-3 border transition-colors duration-300 ease-out",
          tone === "light" ? "border-hairline-dark" : "border-ivory/15",
          "pointer-fine:group-hover/agent:border-bronze/60",
        )}
      />
      <span className="flex flex-col items-center gap-5">
        <span className="font-display text-[clamp(3.5rem,7vw,6.5rem)] font-normal leading-none tracking-[0.06em] text-ivory">
          {monogram}
        </span>
        <span className="h-px w-16 scale-x-[0.625] bg-bronze transition-[scale] duration-300 ease-out pointer-fine:group-hover/agent:scale-x-100" />
      </span>
    </div>
  );
}
