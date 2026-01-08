"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, addDays, startOfDay, isBefore, isSameDay } from "date-fns";
import { ArrowLeft, Clock, Loader2, ChevronDown, Calendar as CalendarIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const { setTechnician, setDateTime, resetBooking } = useBooking();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(null);
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [showStartOverDialog, setShowStartOverDialog] = useState(false);
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
    if (bookingData.location && bookingData.service) {
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
    if (!selectedTime || !paramsData) return;

    // Save to booking context
    setDateTime(selectedDate, selectedTime);

    const techId = paramsData.technicianId === "any" && selectedTechnicianId
      ? selectedTechnicianId
      : paramsData.technicianId;

    const checkoutUrl = `/book/${paramsData.locationSlug}/${paramsData.serviceId}/${techId}/checkout?date=${format(selectedDate, "yyyy-MM-dd")}&time=${encodeURIComponent(selectedTime)}`;
    router.push(checkoutUrl);
  };

  const handleStartOver = () => {
    resetBooking();
    router.push("/book");
  };

  if (!paramsData || isLoadingData) {
    return (
      <BookingLayoutWrapper currentStep={4}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </BookingLayoutWrapper>
    );
  }

  const availableCount = timeSlots.filter((s) => s.available).length;

  return (
    <BookingLayoutWrapper currentStep={4} showFooter={false}>
      <div className="pb-36">
        {/* Back button and selection info */}
        <div className="mb-4">
          <Link href={`/book/${paramsData.locationSlug}/${paramsData.serviceId}`}>
            <Button variant="ghost" size="sm" className="-ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
            <Badge variant="secondary" className="text-xs">{locationName}</Badge>
            <Badge variant="outline" className="text-xs">{serviceName}</Badge>
            <Badge variant="outline" className="text-xs">{techName}</Badge>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="text-xl font-semibold text-foreground">Pick a Time</h2>
          <p className="text-sm text-muted-foreground mt-1">Select your preferred date and time</p>
        </div>

        {/* Quick Date Pills - Horizontal Scroll */}
        <div className="mb-4">
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
            <div className="flex gap-2 w-max pb-2">
              {quickDates.map((date) => {
                const isSelected = isSameDay(date, selectedDate);
                const isToday = isSameDay(date, new Date());
                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => handleDateSelect(date)}
                    className={cn(
                      "flex flex-col items-center py-2 px-3 rounded-xl transition-all min-w-[56px]",
                      "border-2",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border hover:border-primary/50"
                    )}
                  >
                    <span className="text-[10px] uppercase tracking-wide font-medium">
                      {format(date, "EEE")}
                    </span>
                    <span className="text-lg font-bold">
                      {format(date, "d")}
                    </span>
                    {isToday && (
                      <span className="text-[8px] uppercase">Today</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Full Calendar Toggle */}
          <Collapsible open={showFullCalendar} onOpenChange={setShowFullCalendar}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-muted-foreground">
                <CalendarIcon className="h-3 w-3 mr-1" />
                {showFullCalendar ? "Hide calendar" : "Show full calendar"}
                <ChevronDown className={cn("h-3 w-3 ml-1 transition-transform", showFullCalendar && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-2">
                <CardContent className="p-3">
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
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {format(selectedDate, "EEEE, MMM d")}
              </span>
              {!isLoadingSlots && availableCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {availableCount} available
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSlots ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : timeSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No available times. Try another date.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map((slot) => (
                  <Button
                    key={slot.time}
                    variant={selectedTime === slot.time ? "default" : "outline"}
                    size="sm"
                    disabled={!slot.available}
                    onClick={() => handleTimeSelect(slot)}
                    className={cn(
                      "text-xs h-10",
                      !slot.available && "opacity-40",
                      selectedTime === slot.time && "ring-2 ring-offset-1 ring-primary"
                    )}
                  >
                    {slot.time}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t safe-area-inset-bottom">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {selectedTime ? (
            <>
              <p className="text-xs text-center text-muted-foreground mb-1.5">
                {format(selectedDate, "EEE, MMM d")} at {selectedTime}
              </p>
              <Button className="w-full h-11" onClick={handleContinue}>
                Continue to Checkout
              </Button>
            </>
          ) : (
            <Button className="w-full h-11" disabled>
              Select a time to continue
            </Button>
          )}
          <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-muted-foreground/70">
            <span>Questions? Text 657-334-9919</span>
            <span>·</span>
            <button
              onClick={() => setShowStartOverDialog(true)}
              className="hover:text-muted-foreground transition-colors inline-flex items-center gap-1"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Start over
            </button>
          </div>
        </div>
      </div>

      {/* Start Over Confirmation Dialog */}
      <AlertDialog open={showStartOverDialog} onOpenChange={setShowStartOverDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start over?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear your current booking selections and take you back to the beginning.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartOver}>Yes, start over</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BookingLayoutWrapper>
  );
}
