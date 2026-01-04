import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingSteps } from "@/components/booking/booking-steps";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Mock data - will come from API
const locationData: Record<string, { name: string; address: string }> = {
  irvine: { name: "Irvine", address: "15333 Culver Dr #220" },
  tustin: { name: "Tustin", address: "13112 Newport Ave #K" },
  "santa-ana": { name: "Santa Ana", address: "3740 S Bristol St" },
  "costa-mesa": { name: "Costa Mesa", address: "435 E 17th St #3" },
  "newport-beach": { name: "Newport Beach", address: "359 San Miguel Dr #107" },
};

// Services grouped by category
const servicesByCategory = {
  "Lash Extensions": [
    { id: "1", name: "Natural Wet Set (New Client)", price: 75, duration: 90, deposit: 25, description: "Perfect for first-timers" },
    { id: "2", name: "Natural Hybrid Set (New Client)", price: 75, duration: 90, deposit: 25, description: "Mix of classic and volume" },
    { id: "3", name: "Natural Set (Hybrid)", price: 95, duration: 90, deposit: 25, description: "Natural everyday look" },
    { id: "4", name: "Elegant Volume Set", price: 105, duration: 120, deposit: 25, description: "Fuller, fluffy look" },
    { id: "5", name: "Mega Volume Set", price: 125, duration: 150, deposit: 25, description: "Bold and dramatic" },
    { id: "6", name: "Super Mega Volume Set", price: 135, duration: 180, deposit: 25, description: "Maximum fullness" },
    { id: "7", name: "Wispy Wet Set", price: 105, duration: 120, deposit: 25, description: "Textured wispy style" },
    { id: "8", name: "Wispy Elegant Set", price: 115, duration: 120, deposit: 25, description: "Elegant wispy look" },
    { id: "9", name: "Anime/Manga Set", price: 125, duration: 150, deposit: 25, description: "Dramatic anime-inspired" },
  ],
  "Lash Fills": [
    { id: "10", name: "Natural/Elegant Fill (2 weeks)", price: 60, duration: 60, deposit: 25, description: "Maintain your look" },
    { id: "11", name: "Natural/Elegant Fill (3 weeks)", price: 70, duration: 75, deposit: 25, description: "3-week touch up" },
    { id: "12", name: "Natural/Elegant Fill (4 weeks)", price: 80, duration: 90, deposit: 25, description: "4-week refresh" },
    { id: "13", name: "Mega Volume Fill (2 weeks)", price: 70, duration: 75, deposit: 25, description: "Volume maintenance" },
    { id: "14", name: "Mega Volume Fill (3 weeks)", price: 80, duration: 90, deposit: 25, description: "3-week volume fill" },
    { id: "15", name: "Mega Volume Fill (4 weeks)", price: 90, duration: 105, deposit: 25, description: "4-week volume refresh" },
  ],
  "Lash Lift & Brows": [
    { id: "16", name: "Lash Lift", price: 65, duration: 45, deposit: 25, description: "Natural curl enhancement" },
    { id: "17", name: "Lash Lift + Tint", price: 75, duration: 60, deposit: 25, description: "Lift with color boost" },
    { id: "18", name: "Brow Lamination + Tint", price: 75, duration: 60, deposit: 25, description: "Fluffy, shaped brows" },
    { id: "19", name: "Brow Shaping", price: 35, duration: 30, deposit: 25, description: "Perfect arch design" },
  ],
  "Permanent Makeup": [
    { id: "20", name: "Permanent Eyeliner", price: 350, duration: 120, deposit: 50, description: "Long-lasting liner" },
    { id: "21", name: "Microblading Brows", price: 450, duration: 150, deposit: 50, description: "Natural hair strokes" },
    { id: "22", name: "Lip Blush", price: 500, duration: 150, deposit: 50, description: "Enhanced lip color" },
  ],
  "Other": [
    { id: "23", name: "Lash Removal", price: 25, duration: 30, deposit: 25, description: "Safe extension removal" },
  ],
};

interface PageProps {
  params: Promise<{ locationSlug: string }>;
}

export default async function ServiceSelectionPage({ params }: PageProps) {
  const { locationSlug } = await params;
  const location = locationData[locationSlug];

  if (!location) {
    notFound();
  }

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
              {servicesByCategory[category as keyof typeof servicesByCategory].map((service) => (
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
                            {service.duration} min
                          </span>
                          <span className="flex items-center gap-1 font-semibold text-primary">
                            <DollarSign className="h-4 w-4" />
                            {service.price}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          ${service.deposit} deposit
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
