/**
 * A credit line such as "„Living Room and Kitchen”, ethan3111 (CC BY 4.0),
 * https://superspl.at/scene/9917211a": the trailing https URL becomes the
 * link target, the rest is the visible label (CC BY asks for title, author,
 * licence and source).
 */
export function Credits({ text, label }: { text: string; label: (name: string) => string }) {
  // A licence name never breaks across lines ("CC BY 4.0", "CC BY-SA 4.0").
  const tidy = text.trim().replace(/\bCC (BY[\w-]*) (\d\.\d)/g, "CC $1 $2");
  const match = /^(.*?),?\s*(https:\/\/\S+)$/.exec(tidy);
  if (match === null) return <>{label(tidy)}</>;
  return (
    <a
      href={match[2]}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-ivory/30 underline-offset-2 transition-colors duration-200 pointer-fine:hover:text-ivory"
    >
      {label(match[1])}
    </a>
  );
}
