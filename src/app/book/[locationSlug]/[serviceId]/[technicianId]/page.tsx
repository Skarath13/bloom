"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, addDays, startOfDay, isBefore } from "date-fns";
import { ArrowLeft, Calendar as CalendarIcon, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { BookingSteps } from "@/components/booking/booking-steps";
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

// Generate next 30 days
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(null);
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
        // Fetch location by slug
        const locRes = await fetch(`/api/locations`);
        const { locations } = await locRes.json();
        const location = locations?.find((l: { slug: string }) => l.slug === paramsData.locationSlug);

        // Fetch service
        const svcRes = await fetch(`/api/services/${paramsData.serviceId}`);
        const { service } = await svcRes.json();

        // Fetch technician if not "any"
        let technician = null;
        if (paramsData.technicianId !== "any") {
          const techRes = await fetch(`/api/technicians/${paramsData.technicianId}`);
          const techData = await techRes.json();
          technician = techData.technician;
        }

        setBookingData({ location, service, technician });
      } catch (error) {
        console.error("Failed to fetch booking data:", error);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchBookingData();
  }, [paramsData]);

  // Fetch availability when date or booking data changes
  const fetchAvailability = useCallback(async (date: Date) => {
    if (!bookingData.location || !bookingData.service || !paramsData) return;

    setIsLoadingSlots(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const techId = paramsData.technicianId === "any" ? "any" : paramsData.technicianId;

      const res = await fetch(
        `/api/availability?locationId=${bookingData.location.id}&serviceId=${bookingData.service.id}&technicianId=${techId}&date=${dateStr}`
      );
      const data = await res.json();

      setTimeSlots(data.slots || []);
    } catch (error) {
      console.error("Failed to fetch availability:", error);
      setTimeSlots([]);
    } finally {
      setIsLoadingSlots(false);
    }
  }, [bookingData.location, bookingData.service, paramsData]);

  // Fetch availability when date changes or data loads
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

  const handleTimeSelect = (slot: TimeSlot) => {
    setSelectedTime(slot.time);
    // Store the technician ID for "any" selections
    if (paramsData?.technicianId === "any" && slot.technicianId) {
      setSelectedTechnicianId(slot.technicianId);
    }
  };

  const handleContinue = () => {
    if (!selectedTime || !paramsData) return;

    // Use the assigned technician ID if "any" was selected
    const techId = paramsData.technicianId === "any" && selectedTechnicianId
      ? selectedTechnicianId
      : paramsData.technicianId;

    const checkoutUrl = `/book/${paramsData.locationSlug}/${paramsData.serviceId}/${techId}/checkout?date=${format(selectedDate, "yyyy-MM-dd")}&time=${encodeURIComponent(selectedTime)}`;
    router.push(checkoutUrl);
  };

  if (!paramsData || isLoadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <BookingSteps currentStep={4} />

      {/* Back button and selection info */}
      <div className="mb-6">
        <Link href={`/book/${paramsData.locationSlug}/${paramsData.serviceId}`}>
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Change Technician
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{locationName}</Badge>
          <Badge variant="outline">{serviceName}</Badge>
          <Badge variant="outline">{techName}</Badge>
        </div>
      </div>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-foreground">Select Date & Time</h2>
        <p className="text-muted-foreground mt-1">Choose your preferred appointment time</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Select Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date);
                  setSelectedTime(null); // Reset time when date changes
                }
              }}
              disabled={(date) => {
                const today = startOfDay(new Date());
                return isBefore(date, today) || !availableDates.some(d =>
                  startOfDay(d).getTime() === startOfDay(date).getTime()
                );
              }}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        {/* Time Slots */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Available Times for {format(selectedDate, "MMM d")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSlots ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : timeSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No available times for this date. Please select another date.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                {timeSlots.map((slot) => (
                  <Button
                    key={slot.time}
                    variant={selectedTime === slot.time ? "default" : "outline"}
                    size="sm"
                    disabled={!slot.available}
                    onClick={() => handleTimeSelect(slot)}
                    className={cn(
                      "text-xs",
                      !slot.available && "opacity-50 cursor-not-allowed",
                      selectedTime === slot.time && "ring-2 ring-primary ring-offset-2"
                    )}
                  >
                    {slot.time}
                  </Button>
                ))}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded border bg-card"></div>
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-primary"></div>
                <span>Selected</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded border opacity-50"></div>
                <span>Unavailable</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Continue Button */}
      <div className="mt-8 flex justify-end">
        <Button
          size="lg"
          disabled={!selectedTime}
          onClick={handleContinue}
          className="px-8"
        >
          Continue to Checkout
        </Button>
      </div>

      {/* Selection Summary */}
      {selectedTime && (
        <div className="mt-6 p-4 bg-card rounded-lg border text-center">
          <p className="text-sm text-muted-foreground">Your appointment</p>
          <p className="text-lg font-semibold">
            {format(selectedDate, "EEEE, MMMM d, yyyy")} at {selectedTime}
          </p>
        </div>
      )}
    </>
  );
}
