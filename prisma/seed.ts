import { PrismaClient, ServiceCategory, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

// Default operating hours (9 AM - 7 PM, last appointment at 6 PM)
const defaultOperatingHours = {
  monday: { open: "09:00", close: "19:00", lastAppointment: "18:00" },
  tuesday: { open: "09:00", close: "19:00", lastAppointment: "18:00" },
  wednesday: { open: "09:00", close: "19:00", lastAppointment: "18:00" },
  thursday: { open: "09:00", close: "19:00", lastAppointment: "18:00" },
  friday: { open: "09:00", close: "19:00", lastAppointment: "18:00" },
  saturday: { open: "09:00", close: "19:00", lastAppointment: "18:00" },
  sunday: { open: "09:00", close: "19:00", lastAppointment: "18:00" },
};

// Elegant Lashes locations
const locations = [
  {
    name: "Irvine",
    slug: "irvine",
    address: "15333 Culver Dr #220",
    city: "Irvine",
    state: "CA",
    zipCode: "92604",
    phone: "657-334-9919",
    sortOrder: 0,
  },
  {
    name: "Tustin",
    slug: "tustin",
    address: "13112 Newport Ave #K",
    city: "Tustin",
    state: "CA",
    zipCode: "92780",
    phone: "657-334-9919",
    sortOrder: 1,
  },
  {
    name: "Santa Ana",
    slug: "santa-ana",
    address: "3740 S Bristol St",
    city: "Santa Ana",
    state: "CA",
    zipCode: "92704",
    phone: "657-334-9919",
    sortOrder: 2,
  },
  {
    name: "Costa Mesa",
    slug: "costa-mesa",
    address: "435 E 17th St #3",
    city: "Costa Mesa",
    state: "CA",
    zipCode: "92627",
    phone: "657-334-9919",
    sortOrder: 3,
  },
  {
    name: "Newport Beach",
    slug: "newport-beach",
    address: "359 San Miguel Dr #107",
    city: "Newport Beach",
    state: "CA",
    zipCode: "92660",
    phone: "657-334-9919",
    sortOrder: 4,
  },
];

// Services with categories, durations, and pricing
const services = [
  // Lash Extensions - New Client
  {
    name: "Natural Wet Set (New Client)",
    category: ServiceCategory.LASH_EXTENSION,
    durationMinutes: 90,
    price: 75,
    depositAmount: 25,
    sortOrder: 0,
  },
  {
    name: "Natural Hybrid Set (New Client)",
    category: ServiceCategory.LASH_EXTENSION,
    durationMinutes: 90,
    price: 75,
    depositAmount: 25,
    sortOrder: 1,
  },
  // Volume Lash Extensions
  {
    name: "Natural Set (Hybrid)",
    category: ServiceCategory.LASH_EXTENSION,
    durationMinutes: 90,
    price: 95,
    depositAmount: 25,
    sortOrder: 2,
  },
  {
    name: "Elegant Volume Set",
    category: ServiceCategory.LASH_EXTENSION,
    durationMinutes: 120,
    price: 105,
    depositAmount: 25,
    sortOrder: 3,
  },
  {
    name: "Mega Volume Set",
    category: ServiceCategory.LASH_EXTENSION,
    durationMinutes: 150,
    price: 125,
    depositAmount: 25,
    sortOrder: 4,
  },
  {
    name: "Super Mega Volume Set",
    category: ServiceCategory.LASH_EXTENSION,
    durationMinutes: 180,
    price: 135,
    depositAmount: 25,
    sortOrder: 5,
  },
  // Designer Collections
  {
    name: "Wispy Wet Set",
    category: ServiceCategory.LASH_EXTENSION,
    durationMinutes: 120,
    price: 105,
    depositAmount: 25,
    sortOrder: 6,
  },
  {
    name: "Wispy Elegant Set",
    category: ServiceCategory.LASH_EXTENSION,
    durationMinutes: 120,
    price: 115,
    depositAmount: 25,
    sortOrder: 7,
  },
  {
    name: "Anime/Manga Set",
    category: ServiceCategory.LASH_EXTENSION,
    durationMinutes: 150,
    price: 125,
    depositAmount: 25,
    sortOrder: 8,
  },
  {
    name: "Top & Bottom Lash Set",
    category: ServiceCategory.LASH_EXTENSION,
    durationMinutes: 180,
    price: 135,
    depositAmount: 25,
    sortOrder: 9,
  },
  // Fill Services
  {
    name: "Natural/Elegant Fill (2 weeks)",
    category: ServiceCategory.LASH_FILL,
    durationMinutes: 60,
    price: 60,
    depositAmount: 25,
    sortOrder: 10,
  },
  {
    name: "Natural/Elegant Fill (3 weeks)",
    category: ServiceCategory.LASH_FILL,
    durationMinutes: 75,
    price: 70,
    depositAmount: 25,
    sortOrder: 11,
  },
  {
    name: "Natural/Elegant Fill (4 weeks)",
    category: ServiceCategory.LASH_FILL,
    durationMinutes: 90,
    price: 80,
    depositAmount: 25,
    sortOrder: 12,
  },
  {
    name: "Mega Volume Fill (2 weeks)",
    category: ServiceCategory.LASH_FILL,
    durationMinutes: 75,
    price: 70,
    depositAmount: 25,
    sortOrder: 13,
  },
  {
    name: "Mega Volume Fill (3 weeks)",
    category: ServiceCategory.LASH_FILL,
    durationMinutes: 90,
    price: 80,
    depositAmount: 25,
    sortOrder: 14,
  },
  {
    name: "Mega Volume Fill (4 weeks)",
    category: ServiceCategory.LASH_FILL,
    durationMinutes: 105,
    price: 90,
    depositAmount: 25,
    sortOrder: 15,
  },
  // Lash Lift
  {
    name: "Lash Lift",
    category: ServiceCategory.LASH_LIFT,
    durationMinutes: 45,
    price: 65,
    depositAmount: 25,
    sortOrder: 16,
  },
  {
    name: "Lash Lift + Tint",
    category: ServiceCategory.LASH_LIFT,
    durationMinutes: 60,
    price: 75,
    depositAmount: 25,
    sortOrder: 17,
  },
  // Brow Services
  {
    name: "Brow Lamination + Tint",
    category: ServiceCategory.BROW,
    durationMinutes: 60,
    price: 75,
    depositAmount: 25,
    sortOrder: 18,
  },
  {
    name: "Brow Shaping",
    category: ServiceCategory.BROW,
    durationMinutes: 30,
    price: 35,
    depositAmount: 25,
    sortOrder: 19,
  },
  // Permanent Makeup
  {
    name: "Permanent Eyeliner",
    category: ServiceCategory.PERMANENT_MAKEUP,
    durationMinutes: 120,
    price: 350,
    depositAmount: 50,
    sortOrder: 20,
  },
  {
    name: "Microblading Brows",
    category: ServiceCategory.PERMANENT_MAKEUP,
    durationMinutes: 150,
    price: 450,
    depositAmount: 50,
    sortOrder: 21,
  },
  {
    name: "Lip Blush",
    category: ServiceCategory.PERMANENT_MAKEUP,
    durationMinutes: 150,
    price: 500,
    depositAmount: 50,
    sortOrder: 22,
  },
  // Other
  {
    name: "Lash Removal",
    category: ServiceCategory.OTHER,
    durationMinutes: 30,
    price: 25,
    depositAmount: 25,
    sortOrder: 23,
  },
];

// Technicians by location (based on website data)
const techniciansByLocation: Record<string, { firstName: string; lastName: string; color: string }[]> = {
  irvine: [
    { firstName: "Angela", lastName: "L", color: "#E91E63" },
    { firstName: "Celine", lastName: "T", color: "#9C27B0" },
    { firstName: "Elena", lastName: "M", color: "#673AB7" },
    { firstName: "Tammy", lastName: "N", color: "#3F51B5" },
    { firstName: "Fiona", lastName: "K", color: "#2196F3" },
    { firstName: "Brenda", lastName: "S", color: "#00BCD4" },
  ],
  tustin: [
    { firstName: "Alice", lastName: "W", color: "#009688" },
    { firstName: "Amy", lastName: "C", color: "#4CAF50" },
    { firstName: "Helen", lastName: "L", color: "#8BC34A" },
    { firstName: "Emma", lastName: "R", color: "#CDDC39" },
    { firstName: "Sandy", lastName: "P", color: "#FFC107" },
    { firstName: "Maria", lastName: "G", color: "#FF9800" },
    { firstName: "Wendy", lastName: "H", color: "#FF5722" },
    { firstName: "Katie", lastName: "Owner", color: "#1E1B4B" },
    { firstName: "Gabby", lastName: "M", color: "#795548" },
  ],
  "santa-ana": [
    { firstName: "Giana", lastName: "V", color: "#E91E63" },
    { firstName: "Macy", lastName: "L", color: "#9C27B0" },
    { firstName: "Nancy", lastName: "T", color: "#673AB7" },
    { firstName: "Rosy", lastName: "C", color: "#3F51B5" },
    { firstName: "Zara", lastName: "K", color: "#2196F3" },
    { firstName: "Mayra", lastName: "S", color: "#00BCD4" },
  ],
  "costa-mesa": [
    { firstName: "Chloe", lastName: "A", color: "#009688" },
    { firstName: "Lucy", lastName: "B", color: "#4CAF50" },
    { firstName: "Melissa", lastName: "D", color: "#8BC34A" },
    { firstName: "Natalie", lastName: "F", color: "#CDDC39" },
    { firstName: "Trish", lastName: "J", color: "#FFC107" },
    { firstName: "Vivian", lastName: "Q", color: "#FF9800" },
  ],
  "newport-beach": [
    { firstName: "Katie", lastName: "Owner", color: "#1E1B4B" },
    { firstName: "Katelyn", lastName: "R", color: "#8B687A" },
  ],
};

async function main() {
  console.log("Starting seed...");

  // Create admin user
  const hashedPassword = await hash("admin123", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@elegantlashesbykatie.com" },
    update: {},
    create: {
      email: "admin@elegantlashesbykatie.com",
      name: "Katie",
      password: hashedPassword,
      role: UserRole.OWNER,
    },
  });
  console.log(`Created admin user: ${adminUser.email}`);

  // Create locations
  const createdLocations: Record<string, string> = {};
  for (const loc of locations) {
    const location = await prisma.location.upsert({
      where: { slug: loc.slug },
      update: {},
      create: {
        ...loc,
        operatingHours: defaultOperatingHours,
      },
    });
    createdLocations[loc.slug] = location.id;
    console.log(`Created location: ${location.name}`);
  }

  // Create services
  const createdServices: string[] = [];
  for (const svc of services) {
    const service = await prisma.service.upsert({
      where: { id: `service-${svc.sortOrder}` },
      update: {},
      create: {
        id: `service-${svc.sortOrder}`,
        ...svc,
      },
    });
    createdServices.push(service.id);
    console.log(`Created service: ${service.name}`);
  }

  // Link all services to all locations
  for (const serviceId of createdServices) {
    for (const locationId of Object.values(createdLocations)) {
      await prisma.serviceLocation.upsert({
        where: {
          serviceId_locationId: { serviceId, locationId },
        },
        update: {},
        create: { serviceId, locationId },
      });
    }
  }
  console.log("Linked services to locations");

  // Create technicians
  for (const [locationSlug, techs] of Object.entries(techniciansByLocation)) {
    const locationId = createdLocations[locationSlug];
    for (let i = 0; i < techs.length; i++) {
      const tech = techs[i];
      const techId = `tech-${locationSlug}-${i}`;

      const technician = await prisma.technician.upsert({
        where: { id: techId },
        update: {},
        create: {
          id: techId,
          firstName: tech.firstName,
          lastName: tech.lastName,
          color: tech.color,
          locationId,
          sortOrder: i,
        },
      });

      // Create default schedule (working Mon-Sun, 9-7)
      for (let day = 0; day < 7; day++) {
        await prisma.technicianSchedule.upsert({
          where: {
            technicianId_dayOfWeek: { technicianId: technician.id, dayOfWeek: day },
          },
          update: {},
          create: {
            technicianId: technician.id,
            dayOfWeek: day,
            startTime: "09:00",
            endTime: "19:00",
            isWorking: true,
          },
        });
      }

      console.log(`Created technician: ${technician.firstName} ${technician.lastName} at ${locationSlug}`);
    }
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
