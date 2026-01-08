"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, addDays, startOfDay, isBefore, isSameDay } from "date-fns";
import { ArrowLeft, Clock, ChevronDown, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BookingLayoutWrapper } from "@/components/booking/booking-layout-wrapper";
import { useBooking } from "@/components/booking/booking-context";
import { cn } from "@/lib/utils";

interface TimeSlot {
  time: string;
  available: boolean;
  technicianId?: string;
}

interface BookingData {
  location: { id: string; name: string } | null;
  service: { id: string; name: string; price: number; durationMinutes: number } | null;
  technician: { id: string; firstName: string; lastName: string } | null;
}

// Generate quick dates: next 7 days for fast initial load
const generateQuickDates = () => {
  const dates: Date[] = [];
  const today = new Date();
  // OPTIMIZATION: Only show 7 days initially for faster loading
  for (let i = 0; i < 7; i++) {
    dates.push(addDays(today, i));
  }
  return dates;
};

// Generate next 30 days for calendar
const generateAvailableDates = () => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    dates.push(addDays(today, i));
  }
  return dates;
};

interface PageProps {
  params: Promise<{ locationSlug: string; serviceId: string; technicianId: string }>;
}

export default function DateTimeSelectionPage({ params }: PageProps) {
  const router = useRouter();
  const { setTechnician, setDateTime } = useBooking();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(null);
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [paramsData, setParamsData] = useState<{
    locationSlug: string;
    serviceId: string;
    technicianId: string;
  } | null>(null);
  const [bookingData, setBookingData] = useState<BookingData>({
    location: null,
    service: null,
    technician: null,
  });
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Track which dates have availability (for graying out unavailable dates)
  const [dateAvailability, setDateAvailability] = useState<Record<string, boolean>>({});
  const [isCheckingDates, setIsCheckingDates] = useState(true);

  // Abort controller ref for cancelling in-flight availability requests
  const abortControllerRef = useRef<AbortController | null>(null);

  const quickDates = generateQuickDates();
  const availableDates = generateAvailableDates();

  // Resolve params
  useEffect(() => {
    params.then(setParamsData);
  }, [params]);

  // OPTIMIZATION: Fetch booking data AND check availability in parallel
  useEffect(() => {
    if (!paramsData) return;

    const fetchAllData = async () => {
      setIsLoadingData(true);
      setIsCheckingDates(true);

      try {
        // OPTIMIZATION: Fetch all data in parallel
        const [locRes, svcRes, techRes] = await Promise.all([
          fetch(`/api/locations`),
          fetch(`/api/services/${paramsData.serviceId}`),
          paramsData.technicianId !== "any"
            ? fetch(`/api/technicians/${paramsData.technicianId}`)
            : Promise.resolve(null),
        ]);

        const [{ locations }, { service }, techData] = await Promise.all([
          locRes.json(),
          svcRes.json(),
          techRes ? techRes.json() : Promise.resolve({ technician: null }),
        ]);

        const location = locations?.find((l: { slug: string }) => l.slug === paramsData.locationSlug);
        const technician = techData?.technician || null;

        setBookingData({ location, service, technician });
        setIsLoadingData(false);

        // Update booking context
        if (technician) {
          setTechnician(technician.id, `${technician.firstName} ${technician.lastName[0]}`, false);
        } else {
          setTechnician(null, null, true);
        }

        // Now check availability using batch endpoint
        if (location && service) {
          const techId = paramsData.technicianId === "any" ? "any" : paramsData.technicianId;
          const dateStrings = quickDates.map(d => format(d, "yyyy-MM-dd"));

          const availRes = await fetch("/api/availability/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              locationId: location.id,
              serviceId: service.id,
              technicianId: techId,
              dates: dateStrings,
            }),
          });

          const availData = await availRes.json();
          const availability: Record<string, boolean> = {};
          let firstAvailableDate: Date | null = null;

          for (const item of availData.availability || []) {
            availability[item.date] = item.hasAvailability;
            if (item.hasAvailability && !firstAvailableDate) {
              firstAvailableDate = quickDates.find(d => format(d, "yyyy-MM-dd") === item.date) || null;
            }
          }

          setDateAvailability(availability);

          // Auto-select first available date, or fall back to today
          if (firstAvailableDate) {
            setSelectedDate(firstAvailableDate);
          } else {
            setSelectedDate(new Date());
          }
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setSelectedDate(new Date());
      } finally {
        setIsLoadingData(false);
        setIsCheckingDates(false);
      }
    };

    fetchAllData();
  }, [paramsData, setTechnician]);

  // Fetch availability when date or booking data changes
  const fetchAvailability = useCallback(async (date: Date) => {
    if (!bookingData.location || !bookingData.service || !paramsData) return;

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoadingSlots(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const techId = paramsData.technicianId === "any" ? "any" : paramsData.technicianId;

      const res = await fetch(
        `/api/availability?locationId=${bookingData.location.id}&serviceId=${bookingData.service.id}&technicianId=${techId}&date=${dateStr}`,
        { signal: controller.signal }
      );
      const data = await res.json();

      setTimeSlots(data.slots || []);
    } catch (error) {
      // Ignore abort errors - they're expected when cancelling requests
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Failed to fetch availability:", error);
      setTimeSlots([]);
    } finally {
      // Only set loading false if this is still the current request
      if (abortControllerRef.current === controller) {
        setIsLoadingSlots(false);
      }
    }
  }, [bookingData.location, bookingData.service, paramsData]);

  useEffect(() => {
    if (bookingData.location && bookingData.service && selectedDate) {
      fetchAvailability(selectedDate);
    }
  }, [selectedDate, bookingData.location, bookingData.service, fetchAvailability]);

  const locationName = bookingData.location?.name || "Location";
  const serviceName = bookingData.service?.name || "Service";
  const techName = paramsData?.technicianId === "any"
    ? "Any Available"
    : bookingData.technician
      ? `${bookingData.technician.firstName} ${bookingData.technician.lastName[0]}.`
      : "Technician";

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
    setShowFullCalendar(false);
  };

  const handleTimeSelect = (slot: TimeSlot) => {
    setSelectedTime(slot.time);
    if (paramsData?.technicianId === "any" && slot.technicianId) {
      setSelectedTechnicianId(slot.technicianId);
    }
  };

  const handleContinue = () => {
    if (!selectedTime || !paramsData || !selectedDate) return;

    // Save to booking context
    setDateTime(selectedDate, selectedTime);

    const techId = paramsData.technicianId === "any" && selectedTechnicianId
      ? selectedTechnicianId
      : paramsData.technicianId;

    const checkoutUrl = `/book/${paramsData.locationSlug}/${paramsData.serviceId}/${techId}/checkout?date=${format(selectedDate, "yyyy-MM-dd")}&time=${encodeURIComponent(selectedTime)}`;
    router.push(checkoutUrl);
  };

  if (!paramsData || isLoadingData || isCheckingDates || !selectedDate) {
    return (
      <BookingLayoutWrapper currentStep={4}>
        <div className="space-y-3">
          {/* Header skeleton */}
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-11 w-16 rounded-full" />
            <Skeleton className="h-6 w-28" />
          </div>

          {/* Date pills skeleton */}
          <div className="mb-2">
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
              <div className="flex gap-1.5 w-max pb-1">
                {[...Array(7)].map((_, i) => (
                  <Skeleton key={i} className="min-h-[44px] min-w-[44px] rounded-lg" />
                ))}
              </div>
            </div>
            {/* Calendar button skeleton */}
            <Skeleton className="w-full mt-2 h-11 rounded-md" />
          </div>

          {/* Time slots card skeleton */}
          <Card className="py-0 gap-0">
            <CardContent className="p-3">
              {/* Date header skeleton */}
              <div className="flex items-center gap-1.5 mb-2">
                <Skeleton className="h-3.5 w-3.5 rounded" />
                <Skeleton className="h-4 w-24" />
              </div>

              {/* Time slots grid skeleton - 3 rows of 4 */}
              <div className="grid grid-cols-4 gap-1.5">
                {[...Array(12)].map((_, i) => (
                  <Skeleton key={i} className="h-11 rounded-md" />
                ))}
              </div>

              {/* Continue button skeleton */}
              <div className="pt-3 mt-3 border-t">
                <Skeleton className="w-full h-12 rounded-md" />
              </div>
            </CardContent>
          </Card>
        </div>
      </BookingLayoutWrapper>
    );
  }

  return (
    <BookingLayoutWrapper currentStep={4}>
      <div className="space-y-3">
        {/* Compact header with back button and title inline */}
        <div className="flex items-center gap-3 mb-3">
          <Link
            href={`/book/${paramsData.locationSlug}/${paramsData.serviceId}`}
            className="flex items-center gap-1.5 h-11 px-3 -ml-3 rounded-full hover:bg-muted active:scale-95 transition-all text-sm text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Link>
          <h1 className="text-lg font-semibold leading-tight">Pick a Time</h1>
        </div>

        {/* Quick Date Pills - Horizontal Scroll */}
        <div className="mb-2">
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
            <div className="flex gap-1.5 w-max pb-1">
              {quickDates.map((date) => {
                const dateStr = format(date, "yyyy-MM-dd");
                const isSelected = isSameDay(date, selectedDate);
                const isToday = isSameDay(date, new Date());
                const isUnavailable = dateAvailability[dateStr] === false;

                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => handleDateSelect(date)}
                    className={cn(
                      "flex flex-col items-center justify-center min-h-[44px] min-w-[44px] px-2 rounded-lg transition-all active:scale-95",
                      "border",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : isUnavailable
                        ? "bg-muted/50 border-border text-muted-foreground/60"
                        : "bg-card border-border hover:border-primary/50"
                    )}
                  >
                    <span className="text-[10px] uppercase tracking-wide font-medium leading-none">
                      {format(date, "EEE")}
                    </span>
                    <span className={cn(
                      "text-base font-bold leading-tight",
                      isUnavailable && !isSelected && "line-through decoration-1"
                    )}>
                      {format(date, "d")}
                    </span>
                    {isToday && (
                      <span className="text-[8px] uppercase leading-none">Today</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Full Calendar Toggle */}
          <Collapsible open={showFullCalendar} onOpenChange={setShowFullCalendar}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="w-full mt-2 h-11 text-sm font-medium border-dashed border-2 hover:border-solid hover:bg-muted/50 active:scale-[0.98]"
              >
                <CalendarIcon className="h-4 w-4 mr-1.5" />
                {showFullCalendar ? "Hide calendar" : "View full calendar"}
                <ChevronDown className={cn("h-4 w-4 ml-1.5 transition-transform", showFullCalendar && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-1.5 py-0 gap-0">
                <CardContent className="p-2">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && handleDateSelect(date)}
                    disabled={(date) => {
                      const today = startOfDay(new Date());
                      return isBefore(date, today) || !availableDates.some(d =>
                        startOfDay(d).getTime() === startOfDay(date).getTime()
                      );
                    }}
                    className="mx-auto !p-0 [&_button]:min-h-[44px] [&_button]:min-w-[44px]"
                  />
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Time Slots */}
        <Card className="py-0 gap-0">
          <CardContent className="p-3">
            <div className="text-sm font-medium flex items-center gap-1.5 mb-2">
              <Clock className="h-3.5 w-3.5" />
              {format(selectedDate, "EEE, MMM d")}
            </div>
            {isLoadingSlots ? (
              <div className="grid grid-cols-4 gap-1.5">
                {[...Array(12)].map((_, i) => (
                  <Skeleton key={i} className="h-11 rounded-md" />
                ))}
              </div>
            ) : timeSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No available times. Try another date.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {timeSlots.map((slot) => (
                  <Button
                    key={slot.time}
                    variant={selectedTime === slot.time ? "default" : "outline"}
                    disabled={!slot.available}
                    onClick={() => handleTimeSelect(slot)}
                    className={cn(
                      "text-xs h-11 active:scale-95",
                      !slot.available && "opacity-40",
                      selectedTime === slot.time && "ring-2 ring-offset-1 ring-primary"
                    )}
                  >
                    {slot.time}
                  </Button>
                ))}
              </div>
            )}

            {/* Continue Button */}
            <div className="pt-3 mt-3 border-t">
              {selectedTime ? (
                <Button className="w-full h-12 text-base active:scale-[0.98]" onClick={handleContinue}>
                  Continue · {format(selectedDate, "EEE, MMM d")} at {selectedTime}
                </Button>
              ) : (
                <Button className="w-full h-12 text-base" disabled>
                  Select a time to continue
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </BookingLayoutWrapper>
  );
}
