import { Skeleton } from "@/components/ui/skeleton";

export default function BookingStep1Loading() {
  return (
    <div className="min-h-screen-mobile flex flex-col safe-area-inset-top safe-area-inset-bottom">
      {/* Header with Logo and Action Cue */}
      <div className="flex-shrink-0 pt-4 pb-1 px-4">
        <div className="flex justify-center">
          <Skeleton className="w-56 h-14 rounded-lg" />
        </div>
        <div className="flex justify-center mt-1">
          <Skeleton className="h-5 w-52" />
        </div>
      </div>

      {/* 2x3 Grid */}
      <div className="flex-1 px-4 py-3">
        <div
          className="grid grid-cols-2 gap-3"
          style={{
            gridTemplateRows: "repeat(3, minmax(176px, auto))",
          }}
        >
          {/* 6 card skeletons */}
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="relative rounded-2xl overflow-hidden bg-white"
              style={{
                minHeight: "176px",
                boxShadow: `
                  0 1px 2px rgba(0, 0, 0, 0.04),
                  0 4px 8px rgba(0, 0, 0, 0.06),
                  0 8px 16px rgba(0, 0, 0, 0.06),
                  0 0 0 1px rgba(0, 0, 0, 0.04)
                `,
              }}
            >
              {/* Map area skeleton */}
              <Skeleton className="absolute inset-0 rounded-none" />

              {/* Text overlay skeleton */}
              <div className="absolute bottom-0 left-0 right-0 z-10">
                <div className="h-6" style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.5))" }} />
                <div className="px-3 py-2 bg-white/50">
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="flex-shrink-0 pb-4 px-4">
        <div className="flex justify-center gap-4 mb-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex justify-center">
          <Skeleton className="h-4 w-44" />
        </div>
      </div>
    </div>
  );
}
