import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BookingSteps } from "@/components/booking/booking-steps";

// Mock data
const locationData: Record<string, { name: string }> = {
  irvine: { name: "Irvine" },
  tustin: { name: "Tustin" },
  "santa-ana": { name: "Santa Ana" },
  "costa-mesa": { name: "Costa Mesa" },
  "newport-beach": { name: "Newport Beach" },
};

const servicesData: Record<string, { name: string; price: number; duration: number }> = {
  "1": { name: "Natural Wet Set (New Client)", price: 75, duration: 90 },
  "2": { name: "Natural Hybrid Set (New Client)", price: 75, duration: 90 },
  "3": { name: "Natural Set (Hybrid)", price: 95, duration: 90 },
  "4": { name: "Elegant Volume Set", price: 105, duration: 120 },
  "5": { name: "Mega Volume Set", price: 125, duration: 150 },
  "6": { name: "Super Mega Volume Set", price: 135, duration: 180 },
  "7": { name: "Wispy Wet Set", price: 105, duration: 120 },
  "8": { name: "Wispy Elegant Set", price: 115, duration: 120 },
  "9": { name: "Anime/Manga Set", price: 125, duration: 150 },
  "10": { name: "Natural/Elegant Fill (2 weeks)", price: 60, duration: 60 },
  "11": { name: "Natural/Elegant Fill (3 weeks)", price: 70, duration: 75 },
  "12": { name: "Natural/Elegant Fill (4 weeks)", price: 80, duration: 90 },
  "13": { name: "Mega Volume Fill (2 weeks)", price: 70, duration: 75 },
  "14": { name: "Mega Volume Fill (3 weeks)", price: 80, duration: 90 },
  "15": { name: "Mega Volume Fill (4 weeks)", price: 90, duration: 105 },
  "16": { name: "Lash Lift", price: 65, duration: 45 },
  "17": { name: "Lash Lift + Tint", price: 75, duration: 60 },
  "18": { name: "Brow Lamination + Tint", price: 75, duration: 60 },
  "19": { name: "Brow Shaping", price: 35, duration: 30 },
  "20": { name: "Permanent Eyeliner", price: 350, duration: 120 },
  "21": { name: "Microblading Brows", price: 450, duration: 150 },
  "22": { name: "Lip Blush", price: 500, duration: 150 },
  "23": { name: "Lash Removal", price: 25, duration: 30 },
};

// Technicians by location
const techniciansByLocation: Record<string, Array<{
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  color: string;
}>> = {
  irvine: [
    { id: "tech-irvine-0", firstName: "Angela", lastName: "L", specialty: "Volume & Mega Volume", color: "#E91E63" },
    { id: "tech-irvine-1", firstName: "Celine", lastName: "T", specialty: "Natural & Wispy", color: "#9C27B0" },
    { id: "tech-irvine-2", firstName: "Elena", lastName: "M", specialty: "Hybrid Sets", color: "#673AB7" },
    { id: "tech-irvine-3", firstName: "Tammy", lastName: "N", specialty: "Lash Lifts", color: "#3F51B5" },
    { id: "tech-irvine-4", firstName: "Fiona", lastName: "K", specialty: "All Styles", color: "#2196F3" },
    { id: "tech-irvine-5", firstName: "Brenda", lastName: "S", specialty: "Volume Expert", color: "#00BCD4" },
  ],
  tustin: [
    { id: "tech-tustin-0", firstName: "Alice", lastName: "W", specialty: "Natural Sets", color: "#009688" },
    { id: "tech-tustin-1", firstName: "Amy", lastName: "C", specialty: "Wispy Styles", color: "#4CAF50" },
    { id: "tech-tustin-2", firstName: "Helen", lastName: "L", specialty: "Volume", color: "#8BC34A" },
    { id: "tech-tustin-3", firstName: "Emma", lastName: "R", specialty: "Mega Volume", color: "#CDDC39" },
    { id: "tech-tustin-4", firstName: "Sandy", lastName: "P", specialty: "All Styles", color: "#FFC107" },
    { id: "tech-tustin-5", firstName: "Maria", lastName: "G", specialty: "Fills Expert", color: "#FF9800" },
    { id: "tech-tustin-6", firstName: "Wendy", lastName: "H", specialty: "Natural Look", color: "#FF5722" },
    { id: "tech-tustin-7", firstName: "Katie", lastName: "Owner", specialty: "All Styles", color: "#1E1B4B" },
    { id: "tech-tustin-8", firstName: "Gabby", lastName: "M", specialty: "Volume Sets", color: "#795548" },
  ],
  "santa-ana": [
    { id: "tech-santa-ana-0", firstName: "Giana", lastName: "V", specialty: "Volume", color: "#E91E63" },
    { id: "tech-santa-ana-1", firstName: "Macy", lastName: "L", specialty: "Natural Sets", color: "#9C27B0" },
    { id: "tech-santa-ana-2", firstName: "Nancy", lastName: "T", specialty: "Wispy", color: "#673AB7" },
    { id: "tech-santa-ana-3", firstName: "Rosy", lastName: "C", specialty: "All Styles", color: "#3F51B5" },
    { id: "tech-santa-ana-4", firstName: "Zara", lastName: "K", specialty: "Mega Volume", color: "#2196F3" },
    { id: "tech-santa-ana-5", firstName: "Mayra", lastName: "S", specialty: "Fills", color: "#00BCD4" },
  ],
  "costa-mesa": [
    { id: "tech-costa-mesa-0", firstName: "Chloe", lastName: "A", specialty: "Natural", color: "#009688" },
    { id: "tech-costa-mesa-1", firstName: "Lucy", lastName: "B", specialty: "Volume", color: "#4CAF50" },
    { id: "tech-costa-mesa-2", firstName: "Melissa", lastName: "D", specialty: "Wispy", color: "#8BC34A" },
    { id: "tech-costa-mesa-3", firstName: "Natalie", lastName: "F", specialty: "All Styles", color: "#CDDC39" },
    { id: "tech-costa-mesa-4", firstName: "Trish", lastName: "J", specialty: "Mega Volume", color: "#FFC107" },
    { id: "tech-costa-mesa-5", firstName: "Vivian", lastName: "Q", specialty: "Lash Lifts", color: "#FF9800" },
  ],
  "newport-beach": [
    { id: "tech-newport-beach-0", firstName: "Katie", lastName: "Owner", specialty: "All Styles", color: "#1E1B4B" },
    { id: "tech-newport-beach-1", firstName: "Katelyn", lastName: "R", specialty: "Volume & Natural", color: "#8B687A" },
  ],
};

interface PageProps {
  params: Promise<{ locationSlug: string; serviceId: string }>;
}

export default async function TechnicianSelectionPage({ params }: PageProps) {
  const { locationSlug, serviceId } = await params;
  const location = locationData[locationSlug];
  const service = servicesData[serviceId];
  const technicians = techniciansByLocation[locationSlug] || [];

  if (!location || !service) {
    notFound();
  }

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
                      {tech.firstName} {tech.lastName}.
                    </CardTitle>
                    <CardDescription>{tech.specialty}</CardDescription>
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
