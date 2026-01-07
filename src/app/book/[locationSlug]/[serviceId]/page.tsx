import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BookingSteps } from "@/components/booking/booking-steps";
import { supabase, tables } from "@/lib/supabase";

// Fetch location by slug
async function getLocation(slug: string) {
  const { data: location, error } = await supabase
    .from(tables.locations)
    .select("*")
    .eq("slug", slug)
    .eq("isActive", true)
    .single();

  if (error || !location) {
    return null;
  }

  return location;
}

// Fetch service by ID
async function getService(serviceId: string) {
  const { data: service, error } = await supabase
    .from(tables.services)
    .select("*")
    .eq("id", serviceId)
    .eq("isActive", true)
    .single();

  if (error || !service) {
    return null;
  }

  return service;
}

// Fetch technicians for a location
async function getTechnicians(locationId: string) {
  // First get technician IDs that work at this location
  const { data: techLocations, error: locError } = await supabase
    .from(tables.technicianLocations)
    .select("technicianId")
    .eq("locationId", locationId);

  if (locError || !techLocations || techLocations.length === 0) {
    return [];
  }

  const techIds = techLocations.map((tl) => tl.technicianId);

  // Fetch the technicians
  const { data: technicians, error } = await supabase
    .from(tables.technicians)
    .select("*")
    .in("id", techIds)
    .eq("isActive", true)
    .order("sortOrder", { ascending: true });

  if (error) {
    console.error("Failed to fetch technicians:", error);
    return [];
  }

  return technicians || [];
}

interface PageProps {
  params: Promise<{ locationSlug: string; serviceId: string }>;
}

export default async function TechnicianSelectionPage({ params }: PageProps) {
  const { locationSlug, serviceId } = await params;
  const location = await getLocation(locationSlug);
  const service = await getService(serviceId);

  if (!location || !service) {
    notFound();
  }

  const technicians = await getTechnicians(location.id);

  return (
    <>
      <BookingSteps currentStep={3} />

      {/* Back button and selection info */}
      <div className="mb-6">
        <Link href={`/book/${locationSlug}`}>
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Change Service
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{location.name}</Badge>
          <Badge variant="outline">{service.name}</Badge>
          <span className="font-semibold text-primary">${service.price}</span>
        </div>
      </div>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-foreground">Choose Your Technician</h2>
        <p className="text-muted-foreground mt-1">Select a specific technician or let us assign you</p>
      </div>

      {/* Any Available Option */}
      <Link href={`/book/${locationSlug}/${serviceId}/any`}>
        <Card className="mb-6 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.01] hover:border-primary bg-gradient-to-r from-primary/5 to-primary/10">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center">
                <Users className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <CardTitle>Any Available Technician</CardTitle>
                <CardDescription>
                  We&apos;ll assign you to the first available tech with the earliest time slot
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Badge className="bg-primary/20 text-primary hover:bg-primary/30">
              Recommended for fastest booking
            </Badge>
          </CardContent>
        </Card>
      </Link>

      <div className="text-center mb-4">
        <span className="text-sm text-muted-foreground">— or choose a specific technician —</span>
      </div>

      {/* Technician Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {technicians.map((tech) => (
          <Link
            key={tech.id}
            href={`/book/${locationSlug}/${serviceId}/${tech.id}`}
          >
            <Card className="h-full cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] hover:border-primary bg-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12" style={{ backgroundColor: tech.color }}>
                    <AvatarFallback className="text-white font-medium">
                      {tech.firstName[0]}{tech.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">
                      {tech.firstName} {tech.lastName[0]}.
                    </CardTitle>
                    <CardDescription>{tech.description || "Lash Specialist"}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span>5.0</span>
                  <span className="text-xs">(Expert)</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
