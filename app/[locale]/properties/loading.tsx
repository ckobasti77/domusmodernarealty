import { Container } from "@/components/site/Container";

/**
 * The search page's shape while its first page is fetched: the ink band, the
 * filter bar and four card placeholders in the list/map split, so nothing
 * jumps when the real page streams in. CSS pulse only, stopped under reduced
 * motion.
 */
export default function Loading() {
  const block = "animate-pulse motion-reduce:animate-none";
  return (
    <div aria-busy="true">
      <div className="bg-ink">
        <Container width="bleed" className="pb-10 pt-28 md:pb-12 md:pt-32">
          <div className={`h-3 w-40 bg-ink-3 ${block}`} />
          <div className={`mt-8 h-14 w-3/4 max-w-2xl bg-ink-3 ${block}`} />
          <div className={`mt-4 h-5 w-1/2 max-w-xl bg-ink-3 ${block}`} />
        </Container>
      </div>
      <div className="h-16 border-b border-hairline-light bg-paper lg:h-18" />
      <div className="lg:flex">
        <div className="grid gap-x-8 gap-y-14 px-gutter pb-24 pt-8 md:grid-cols-2 md:px-gutter-md lg:w-[55%] lg:px-gutter-lg">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-4">
              <div className={`aspect-[3/2] bg-ivory-2 ${block}`} />
              <div className={`h-6 w-4/5 bg-ivory-2 ${block}`} />
              <div className={`h-4 w-2/5 bg-ivory-2 ${block}`} />
            </div>
          ))}
        </div>
        <div className="hidden bg-ivory-2 lg:block lg:h-[calc(100svh-var(--header-h,85px)-4.5rem)] lg:w-[45%]" />
      </div>
    </div>
  );
}
