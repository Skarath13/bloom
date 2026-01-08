"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, addDays, startOfDay, isBefore, isSameDay } from "date-fns";
import { ArrowLeft, Clock, Loader2, ChevronDown, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// Generate next 7 days for quick selection pills
const generateQuickDates = () => {
  const dates = [];
  const today = new Date();
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

  // Fetch booking data (location, service, technician)
  useEffect(() => {
    if (!paramsData) return;

    const fetchBookingData = async () => {
      setIsLoadingData(true);
      try {
        const locRes = await fetch(`/api/locations`);
        const { locations } = await locRes.json();
        const location = locations?.find((l: { slug: string }) => l.slug === paramsData.locationSlug);

        const svcRes = await fetch(`/api/services/${paramsData.serviceId}`);
        const { service } = await svcRes.json();

        let technician = null;
        if (paramsData.technicianId !== "any") {
          const techRes = await fetch(`/api/technicians/${paramsData.technicianId}`);
          const techData = await techRes.json();
          technician = techData.technician;
        }

        setBookingData({ location, service, technician });

        // Update booking context
        if (technician) {
          setTechnician(technician.id, `${technician.firstName} ${technician.lastName[0]}`, false);
        } else {
          setTechnician(null, null, true);
        }
      } catch (error) {
        console.error("Failed to fetch booking data:", error);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchBookingData();
  }, [paramsData, setTechnician]);

  // Check availability for all quick dates and auto-select first available
  useEffect(() => {
    if (!bookingData.location || !bookingData.service || !paramsData) return;

    const checkAllDates = async () => {
      setIsCheckingDates(true);
      const techId = paramsData.technicianId === "any" ? "any" : paramsData.technicianId;
      const availability: Record<string, boolean> = {};
      let firstAvailableDate: Date | null = null;

      // Check all 7 quick dates in parallel
      const checks = quickDates.map(async (date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        try {
          const res = await fetch(
            `/api/availability?locationId=${bookingData.location!.id}&serviceId=${bookingData.service!.id}&technicianId=${techId}&date=${dateStr}`
          );
          const data = await res.json();
          const hasAvailability = (data.slots || []).some((s: TimeSlot) => s.available);
          return { dateStr, hasAvailability, date };
        } catch {
          return { dateStr, hasAvailability: false, date };
        }
      });

      const results = await Promise.all(checks);

      // Process results
      for (const { dateStr, hasAvailability, date } of results) {
        availability[dateStr] = hasAvailability;
        if (hasAvailability && !firstAvailableDate) {
          firstAvailableDate = date;
        }
      }

      setDateAvailability(availability);

      // Auto-select first available date, or fall back to today if none available
      if (firstAvailableDate) {
        setSelectedDate(firstAvailableDate);
      } else {
        setSelectedDate(new Date());
      }

      setIsCheckingDates(false);
    };

    checkAllDates();
  }, [bookingData.location, bookingData.service, paramsData]);

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
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Finding available times...</p>
        </div>
      </BookingLayoutWrapper>
    );
  }

  const availableCount = timeSlots.filter((s) => s.available).length;

  return (
    <BookingLayoutWrapper currentStep={4}>
      <div className="space-y-3">
        {/* Compact header with back button and title inline */}
        <div className="flex items-center gap-3 mb-3">
          <Link href={`/book/${paramsData.locationSlug}/${paramsData.serviceId}`}>
            <Button variant="ghost" size="sm" className="h-8 px-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold leading-tight">Pick a Time</h1>
        </div>

        {/* Quick Date Pills - Horizontal Scroll */}
        <div className="mb-3">
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
                      "flex flex-col items-center py-1.5 px-2.5 rounded-lg transition-all min-w-[50px]",
                      "border",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : isUnavailable
                        ? "bg-muted/50 border-border text-muted-foreground/60"
                        : "bg-card border-border hover:border-primary/50"
                    )}
                  >
                    <span className="text-[9px] uppercase tracking-wide font-medium">
                      {format(date, "EEE")}
                    </span>
                    <span className={cn(
                      "text-base font-bold leading-tight",
                      isUnavailable && !isSelected && "line-through decoration-1"
                    )}>
                      {format(date, "d")}
                    </span>
                    {isToday && (
                      <span className="text-[7px] uppercase leading-tight">Today</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Full Calendar Toggle */}
          <Collapsible open={showFullCalendar} onOpenChange={setShowFullCalendar}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs text-muted-foreground">
                <CalendarIcon className="h-3 w-3 mr-1" />
                {showFullCalendar ? "Hide" : "More dates"}
                <ChevronDown className={cn("h-3 w-3 ml-1 transition-transform", showFullCalendar && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-2">
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
                    className="mx-auto"
                  />
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Time Slots */}
        <Card>
          <CardHeader className="py-2.5 px-4">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {format(selectedDate, "EEE, MMM d")}
              </span>
              {!isLoadingSlots && availableCount > 0 && (
                <Badge variant="secondary" className="text-[10px] py-0 h-5">
                  {availableCount} slots
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            {isLoadingSlots ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
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
                    size="sm"
                    disabled={!slot.available}
                    onClick={() => handleTimeSelect(slot)}
                    className={cn(
                      "text-xs h-9",
                      !slot.available && "opacity-40",
                      selectedTime === slot.time && "ring-2 ring-offset-1 ring-primary"
                    )}
                  >
                    {slot.time}
                  </Button>
                ))}
              </div>
            )}

            {/* Continue Button - integrated in card */}
            <div className="pt-3 mt-3 border-t">
              {selectedTime ? (
                <Button className="w-full h-10" onClick={handleContinue}>
                  Continue · {format(selectedDate, "EEE, MMM d")} at {selectedTime}
                </Button>
              ) : (
                <Button className="w-full h-10" disabled>
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
