import { Skeleton } from "@/components/ui/skeleton";

/** The editor's layout while `listingsAdmin.get` loads. */
export function EditorSkeleton() {
  return (
    <div aria-busy="true" aria-label="Učitavanje nekretnine" className="mx-auto max-w-[1600px]">
      <div className="-mx-4 -mt-6 flex items-center gap-3 border-b px-4 py-3 md:-mx-8 md:-mt-8 md:px-8">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-6 w-72 max-w-[50vw]" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4 xl:order-1">
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 9 }, (_, index) => (
              <Skeleton key={index} className="h-8 w-24 shrink-0" />
            ))}
          </div>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="rounded-xl border p-5">
              <Skeleton className="mb-4 h-4 w-40" />
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {Array.from({ length: 3 }, (_, field) => (
                  <div key={field} className="flex flex-col gap-2">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border p-4 xl:order-2">
          <Skeleton className="mb-4 h-4 w-24" />
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
          <Skeleton className="mt-5 h-8 w-28" />
        </div>
      </div>
    </div>
  );
}
