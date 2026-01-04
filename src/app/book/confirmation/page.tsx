import Link from "next/link";
import { CheckCircle2, Calendar, Clock, MapPin, Scissors, MessageSquare, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function ConfirmationPage() {
  // In production, this would fetch the booking details from the database
  // using the booking ID from the URL params

  return (
    <div className="max-w-2xl mx-auto">
      {/* Success Icon */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Booking Confirmed!</h1>
        <p className="text-muted-foreground mt-2">
          Your appointment has been successfully booked
        </p>
      </div>

      {/* Booking Details Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Appointment Details</CardTitle>
          <CardDescription>Confirmation #EL-2024-DEMO</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Saturday, January 4, 2025</p>
              <p className="text-sm text-muted-foreground">Date</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">2:00 PM</p>
              <p className="text-sm text-muted-foreground">Time</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Irvine</p>
              <p className="text-sm text-muted-foreground">15333 Culver Dr #220, Irvine, CA 92604</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Scissors className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Elegant Volume Set</p>
              <p className="text-sm text-muted-foreground">120 minutes with Angela L.</p>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Deposit Paid</span>
            <span className="font-medium text-green-600">$25.00</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Balance Due at Appointment</span>
            <span className="font-medium">$80.00</span>
          </div>
        </CardContent>
      </Card>

      {/* What's Next Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">What&apos;s Next?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">SMS Reminders</p>
              <p className="text-sm text-muted-foreground">
                You&apos;ll receive text reminders 24 hours and 2 hours before your appointment
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <p className="font-medium mb-2">Preparation Tips:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Arrive with clean, makeup-free lashes</li>
              <li>Avoid oil-based products 24 hours before</li>
              <li>Shower before your appointment (avoid getting lashes wet for 24 hours after)</li>
              <li>Eat and hydrate before arriving</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Cancellation Policy */}
      <Card className="mb-8 bg-muted/50">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong>Cancellation Policy:</strong> Please cancel at least 6 hours before your
            appointment to receive a refund of your deposit. Late cancellations and no-shows
            will forfeit the deposit amount.
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link href="/book">
          <Button variant="outline" className="w-full sm:w-auto">
            <Calendar className="h-4 w-4 mr-2" />
            Book Another Appointment
          </Button>
        </Link>
        <Link href="/">
          <Button className="w-full sm:w-auto">
            <Home className="h-4 w-4 mr-2" />
            Return Home
          </Button>
        </Link>
      </div>

      {/* Contact */}
      <p className="text-center text-sm text-muted-foreground mt-8">
        Questions? Text us at <span className="font-medium">657-334-9919</span>
      </p>
    </div>
  );
}
