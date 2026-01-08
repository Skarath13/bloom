import { BookingLayoutWrapper } from "@/components/booking/booking-layout-wrapper";
import { Skeleton } from "@/components/ui/skeleton";

export default function TechnicianSelectionLoading() {
  return (
    <BookingLayoutWrapper currentStep={3}>
      <div className="space-y-3">
        {/* Header skeleton */}
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="h-11 w-16 rounded-full" />
          <Skeleton className="h-6 w-40" />
        </div>

        {/* "Any Available" card skeleton */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-200/80">
          <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-gray-200" />
          <Skeleton className="h-3 w-16" />
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Technician cards skeleton */}
        <div className="space-y-2.5">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-200/80"
            >
              <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-4 w-14 rounded-full" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
              </div>
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </BookingLayoutWrapper>
  );
}
