"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, addDays, startOfDay, setHours, setMinutes, isBefore, isToday } from "date-fns";
import { ArrowLeft, Calendar as CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { BookingSteps } from "@/components/booking/booking-steps";
import { cn } from "@/lib/utils";

// Generate available time slots (9 AM - 6 PM, every 30 minutes)
const generateTimeSlots = (date: Date) => {
  const slots = [];
  const now = new Date();

  for (let hour = 9; hour <= 18; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === 18 && minute > 0) break; // Last appointment at 6 PM
      const time = setMinutes(setHours(startOfDay(date), hour), minute);

      // Skip times that have already passed today
      if (isToday(date) && isBefore(time, now)) continue;

      // Randomly mark some as unavailable for demo
      const isAvailable = Math.random() > 0.3;

      slots.push({
        time,
        label: format(time, "h:mm a"),
        available: isAvailable,
      });
    }
  }
  return slots;
};

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
  const [paramsData, setParamsData] = useState<{
    locationSlug: string;
    serviceId: string;
    technicianId: string;
  } | null>(null);

  // Resolve params
  useState(() => {
    params.then(setParamsData);
  });

  const timeSlots = useMemo(() => generateTimeSlots(selectedDate), [selectedDate]);
  const availableDates = useMemo(() => generateAvailableDates(), []);

  // Mock data
  const location = paramsData?.locationSlug === "irvine" ? "Irvine" :
    paramsData?.locationSlug === "tustin" ? "Tustin" :
    paramsData?.locationSlug === "santa-ana" ? "Santa Ana" :
    paramsData?.locationSlug === "costa-mesa" ? "Costa Mesa" :
    paramsData?.locationSlug === "newport-beach" ? "Newport Beach" : "Location";

  const service = "Elegant Volume Set";
  const techName = paramsData?.technicianId === "any" ? "Any Available" : "Angela L.";

  const handleContinue = () => {
    if (!selectedTime || !paramsData) return;

    // In a real app, this would save to context/state and navigate to checkout
    const checkoutUrl = `/book/${paramsData.locationSlug}/${paramsData.serviceId}/${paramsData.technicianId}/checkout?date=${format(selectedDate, "yyyy-MM-dd")}&time=${encodeURIComponent(selectedTime)}`;
    router.push(checkoutUrl);
  };

  if (!paramsData) {
    return <div className="text-center py-12">Loading...</div>;
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
          <Badge variant="secondary">{location}</Badge>
          <Badge variant="outline">{service}</Badge>
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
            {timeSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No available times for this date. Please select another date.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                {timeSlots.map((slot) => (
                  <Button
                    key={slot.label}
                    variant={selectedTime === slot.label ? "default" : "outline"}
                    size="sm"
                    disabled={!slot.available}
                    onClick={() => setSelectedTime(slot.label)}
                    className={cn(
                      "text-xs",
                      !slot.available && "opacity-50 cursor-not-allowed",
                      selectedTime === slot.label && "ring-2 ring-primary ring-offset-2"
                    )}
                  >
                    {slot.label}
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
