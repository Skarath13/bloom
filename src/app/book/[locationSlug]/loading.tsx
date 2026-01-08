import { BookingLayoutWrapper } from "@/components/booking/booking-layout-wrapper";
import { Skeleton } from "@/components/ui/skeleton";

export default function ServiceSelectionLoading() {
  return (
    <BookingLayoutWrapper currentStep={2}>
      <div className="space-y-3">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-16 rounded-full" />
          <Skeleton className="h-6 w-36" />
        </div>

        {/* Category pills skeleton */}
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
          <div className="flex gap-1.5 w-max py-1">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
        </div>

        {/* Service cards skeleton */}
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-gray-100"
            >
              {/* Image placeholder */}
              <Skeleton className="w-14 h-14 rounded-lg flex-shrink-0" />

              {/* Service info */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>

              {/* Price */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </BookingLayoutWrapper>
  );
}
