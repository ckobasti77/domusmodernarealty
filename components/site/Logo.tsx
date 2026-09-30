import { cn } from "@/lib/utils";

/**
 * The wordmark and the monogram, both hand-drawn as SVG so the mark never waits
 * for a webfont and never reflows. Letterforms follow Cormorant Garamond at
 * weight 500 with 0.24em tracking (docs/03-DESIGN-SYSTEM.md §4) — but they are
 * paths, not text, so the outline is identical on every device.
 *
 * `tone` picks the two-colour split: "MIHAJLO" in the surface's text colour and
 * "ESTATE" in bronze, with a hairline rule under both.
 */

type Tone = "light" | "dark" | "current";

const INK = "#0E0D0B";
const IVORY = "#F4EFE6";

function colours(tone: Tone) {
  if (tone === "current") {
    return { primary: "currentColor", accent: "currentColor", rule: "currentColor" };
  }
  // "dark" = the mark sits on a dark surface, so the letters are ivory.
  return tone === "dark"
    ? { primary: IVORY, accent: "#B08D57", rule: "#B08D57" }
    : { primary: INK, accent: "#7A623C", rule: "#7A623C" };
}

export type LogoProps = {
  /** Which surface the mark sits on. */
  tone?: Tone;
  /** Draws the bronze hairline under the wordmark (DESIGN §4). */
  rule?: boolean;
  className?: string;
  /** Screen-reader name. Pass "" when a parent link already names the mark. */
  title?: string;
};

/**
 * Full wordmark, 1000×92 viewBox. Set a width (or a height) via className; the
 * aspect ratio holds.
 */
export function Logo({
  tone = "current",
  rule = true,
  className,
  title = "Mihajlo Estate",
}: LogoProps) {
  const c = colours(tone);
  const labelled = title.length > 0;

  return (
    <svg
      viewBox="0 0 1000 92"
      className={cn("block h-auto w-full", className)}
      role={labelled ? "img" : "presentation"}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : "true"}
      focusable="false"
    >
      <g fill={c.primary}>
        {/* M I H A J L O */}
        <path d="M0 62V6h9.7l18.6 38.4L46.8 6h9.7v56h-7.2V19.6L31.6 56h-6.6L7.2 19.6V62H0Z" />
        <path d="M76 62V6h7.3v56H76Z" />
        <path d="M103 62V6h7.3v24.2h31V6h7.3v56h-7.3V36.6h-31V62H103Z" />
        <path d="M167 62 191.4 6h7.6L223.4 62h-7.9l-7.2-17h-26.4l-7.1 17H167Zm17.7-23.3h21.2l-10.6-25-10.6 25Z" />
        <path d="M252.7 62.9c-9.9 0-16.1-5-17.4-14.3l7-1.1c1 6.3 4.6 9.2 10.4 9.2 6.6 0 10-3.6 10-11.1V6h7.3v39.8c0 11.2-6 17.1-17.3 17.1Z" />
        <path d="M297 62V6h7.3v49.6h30.4V62H297Z" />
        <path d="M377.8 62.9c-16.6 0-27.6-11.6-27.6-28.9C350.2 16.7 361.2 5.1 377.8 5.1s27.6 11.6 27.6 28.9c0 17.3-11 28.9-27.6 28.9Zm0-6.4c12.2 0 20.1-8.9 20.1-22.5S390 11.5 377.8 11.5s-20.1 8.9-20.1 22.5S365.6 56.5 377.8 56.5Z" />
      </g>
      <g fill={c.accent}>
        {/* E S T A T E */}
        <path d="M478 62V6h39.7v6.4h-32.4v17.4h29.3v6.4h-29.3v19.4H518V62h-40Z" />
        <path d="M563.2 62.9c-12.6 0-20.4-6.1-21.6-16.6l7.1-1.2c1 7.6 6.1 11.4 14.7 11.4 8 0 12.9-3.4 12.9-9.3 0-4.9-3.2-7.3-11.1-9.1l-8.1-1.8c-9.7-2.2-14.4-6.7-14.4-14.5 0-9.8 8-16.7 20.1-16.7 11.9 0 19.5 6 20.7 16.1l-7.1 1.2c-1-7.2-5.9-10.9-13.8-10.9-7.5 0-12.4 3.7-12.4 9.5 0 4.6 3 7 10.3 8.6l8.1 1.8c10.4 2.3 15.3 6.8 15.3 15 0 10.1-8.2 16.5-20.7 16.5Z" />
        <path d="M623.3 62V12.4h-19.9V6h47.2v6.4h-20V62h-7.3Z" />
        <path d="M661 62 685.4 6h7.6L717.4 62h-7.9l-7.2-17h-26.4l-7.1 17H661Zm17.7-23.3h21.2l-10.6-25-10.6 25Z" />
        <path d="M748.3 62V12.4h-19.9V6h47.2v6.4h-20V62h-7.3Z" />
        <path d="M795 62V6h39.7v6.4h-32.4v17.4h29.3v6.4h-29.3v19.4H835V62h-40Z" />
      </g>
      {rule ? <rect x="0" y="86" width="835" height="1.5" fill={c.rule} opacity="0.8" /> : null}
    </svg>
  );
}

/**
 * The "ME" monogram — the favicon, the app icon and the avatar fallback. The
 * "E" is bronze so the mark reads the same way as the wordmark.
 */
export function Monogram({
  tone = "current",
  className,
  title = "Mihajlo Estate",
}: Omit<LogoProps, "rule">) {
  const c = colours(tone);
  const labelled = title.length > 0;

  return (
    <svg
      viewBox="0 0 120 64"
      className={cn("block h-auto", className)}
      role={labelled ? "img" : "presentation"}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : "true"}
      focusable="false"
    >
      <path
        d="M4 60V4h12.6l19.8 41.2L56.2 4h12.6v56h-8.5V18.8L42 57h-7.6L16.1 18.8V60H4Z"
        fill={c.primary}
      />
      <path d="M82 60V4h34v8.6h-25.4v14.8h23.1V36h-23.1v15.4H116V60H82Z" fill={c.accent} />
    </svg>
  );
}
