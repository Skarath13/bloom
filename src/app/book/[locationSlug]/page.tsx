import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingSteps } from "@/components/booking/booking-steps";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

// Fetch services for a location, grouped by category
async function getServicesByCategory(locationId: string) {
  // Fetch services available at this location via junction table
  const { data, error } = await supabase
    .from(tables.serviceLocations)
    .select(`
      serviceId,
      bloom_services (*)
    `)
    .eq("locationId", locationId);

  if (error) {
    console.error("Failed to fetch services:", error);
    return {};
  }

  // Extract services and filter active ones
  const services = (data || [])
    .map((sl: { bloom_services: { id: string; name: string; description: string | null; category: string; durationMinutes: number; price: number; depositAmount: number; isActive: boolean; sortOrder: number } }) => sl.bloom_services)
    .filter((s): s is NonNullable<typeof s> => s !== null && s.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Group by category
  const grouped: Record<string, typeof services> = {};
  for (const service of services) {
    if (!grouped[service.category]) {
      grouped[service.category] = [];
    }
    grouped[service.category].push(service);
  }

  return grouped;
}

interface PageProps {
  params: Promise<{ locationSlug: string }>;
}

export default async function ServiceSelectionPage({ params }: PageProps) {
  const { locationSlug } = await params;
  const location = await getLocation(locationSlug);

  if (!location) {
    notFound();
  }

  const servicesByCategory = await getServicesByCategory(location.id);
  const categories = Object.keys(servicesByCategory);

  return (
    <>
      <BookingSteps currentStep={2} />

      {/* Back button and location info */}
      <div className="mb-6">
        <Link href="/book">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Change Location
          </Button>
        </Link>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{location.name}</Badge>
          <span>{location.address}</span>
        </div>
      </div>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-foreground">Select a Service</h2>
        <p className="text-muted-foreground mt-1">Choose the service you&apos;d like to book</p>
      </div>

      <Tabs defaultValue={categories[0]} className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {categories.map((category) => (
            <TabsTrigger
              key={category}
              value={category}
              className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {category}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category} value={category} className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {servicesByCategory[category].map((service) => (
                <Link
                  key={service.id}
                  href={`/book/${locationSlug}/${service.id}`}
                >
                  <Card className="h-full cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] hover:border-primary bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                      <CardDescription>{service.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {service.durationMinutes} min
                          </span>
                          <span className="flex items-center gap-1 font-semibold text-primary">
                            <DollarSign className="h-4 w-4" />
                            {service.price}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          ${service.depositAmount} deposit
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
