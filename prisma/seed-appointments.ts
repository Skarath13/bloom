import { PrismaClient, AppointmentStatus, BlockType } from "@prisma/client";

const prisma = new PrismaClient();

// Sample client names
const clientNames = [
  { firstName: "Sarah", lastName: "Johnson" },
  { firstName: "Emily", lastName: "Chen" },
  { firstName: "Jessica", lastName: "Williams" },
  { firstName: "Ashley", lastName: "Martinez" },
  { firstName: "Samantha", lastName: "Brown" },
  { firstName: "Megan", lastName: "Davis" },
  { firstName: "Lauren", lastName: "Garcia" },
  { firstName: "Amanda", lastName: "Rodriguez" },
  { firstName: "Stephanie", lastName: "Wilson" },
  { firstName: "Nicole", lastName: "Anderson" },
  { firstName: "Rachel", lastName: "Taylor" },
  { firstName: "Brittany", lastName: "Thomas" },
  { firstName: "Christina", lastName: "Lee" },
  { firstName: "Jennifer", lastName: "White" },
  { firstName: "Heather", lastName: "Harris" },
  { firstName: "Michelle", lastName: "Clark" },
  { firstName: "Tiffany", lastName: "Lewis" },
  { firstName: "Amber", lastName: "Young" },
  { firstName: "Danielle", lastName: "Hall" },
  { firstName: "Vanessa", lastName: "Allen" },
];

// Generate random phone number
function randomPhone(): string {
  const area = Math.floor(Math.random() * 900) + 100;
  const prefix = Math.floor(Math.random() * 900) + 100;
  const line = Math.floor(Math.random() * 9000) + 1000;
  return `${area}${prefix}${line}`;
}

// Random element from array
function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Random time slot (returns hour and minute)
function randomTimeSlot(minHour: number, maxHour: number): { hour: number; minute: number } {
  const hour = Math.floor(Math.random() * (maxHour - minHour)) + minHour;
  const minute = randomFrom([0, 15, 30, 45]);
  return { hour, minute };
}

async function main() {
  console.log("Seeding appointments for Tustin location on Jan 4, 2026...");

  // Get Tustin location
  const tustinLocation = await prisma.location.findFirst({
    where: { slug: "tustin" },
  });

  if (!tustinLocation) {
    throw new Error("Tustin location not found. Run the main seed first.");
  }

  console.log(`Found location: ${tustinLocation.name} (${tustinLocation.id})`);

  // Get all technicians at Tustin
  const technicians = await prisma.technician.findMany({
    where: { locationId: tustinLocation.id, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  console.log(`Found ${technicians.length} technicians`);

  // Get services
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  console.log(`Found ${services.length} services`);

  // Target date: Jan 4, 2026
  const targetDate = new Date("2026-01-04T00:00:00-08:00"); // PST

  // Create clients first
  const clients: { id: string; firstName: string; lastName: string }[] = [];
  for (const name of clientNames) {
    const client = await prisma.client.upsert({
      where: { phone: randomPhone() },
      update: {},
      create: {
        firstName: name.firstName,
        lastName: name.lastName,
        phone: randomPhone(),
        phoneVerified: true,
      },
    });
    clients.push(client);
  }
  console.log(`Created/found ${clients.length} clients`);

  // Create appointments for each technician
  const statuses: AppointmentStatus[] = ["CONFIRMED", "CONFIRMED", "CONFIRMED", "PENDING", "CHECKED_IN"];
  let appointmentCount = 0;

  for (const tech of technicians) {
    // Each tech gets 2-5 appointments throughout the day
    const numAppointments = Math.floor(Math.random() * 4) + 2;
    const usedSlots: number[] = []; // Track used start times to avoid exact overlaps

    for (let i = 0; i < numAppointments; i++) {
      // Pick random time between 9 AM and 5 PM (leaving room for duration)
      let slot = randomTimeSlot(9, 17);
      let slotMinutes = slot.hour * 60 + slot.minute;

      // Try to avoid exact overlaps (allow some overlap since durations vary)
      let attempts = 0;
      while (usedSlots.some(s => Math.abs(s - slotMinutes) < 30) && attempts < 10) {
        slot = randomTimeSlot(9, 17);
        slotMinutes = slot.hour * 60 + slot.minute;
        attempts++;
      }
      usedSlots.push(slotMinutes);

      const service = randomFrom(services);
      const client = randomFrom(clients);
      const status = randomFrom(statuses);

      const startTime = new Date(targetDate);
      startTime.setHours(slot.hour, slot.minute, 0, 0);

      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + service.durationMinutes);

      await prisma.appointment.create({
        data: {
          clientId: client.id,
          technicianId: tech.id,
          locationId: tustinLocation.id,
          serviceId: service.id,
          startTime,
          endTime,
          status,
          depositAmount: service.depositAmount,
          depositPaidAt: status !== "PENDING" ? new Date() : null,
        },
      });

      appointmentCount++;
      console.log(
        `  ${tech.firstName}: ${client.firstName} ${client.lastName} - ${service.name} at ${slot.hour}:${slot.minute.toString().padStart(2, "0")}`
      );
    }
  }

  console.log(`\nCreated ${appointmentCount} appointments`);

  // Create some personal blocks for a few technicians
  console.log("\nCreating personal time blocks...");

  const blockTypes: { type: BlockType; title: string }[] = [
    { type: "LUNCH", title: "Lunch Break" },
    { type: "PERSONAL", title: "Personal Time" },
    { type: "BREAK", title: "Quick Break" },
    { type: "TRAINING", title: "Training Session" },
  ];

  // Add blocks to 4-5 random technicians
  const techsWithBlocks = technicians.slice(0, 5);

  for (const tech of techsWithBlocks) {
    const block = randomFrom(blockTypes);
    const slot = randomTimeSlot(11, 15); // Blocks between 11 AM and 3 PM

    const startTime = new Date(targetDate);
    startTime.setHours(slot.hour, slot.minute, 0, 0);

    const endTime = new Date(startTime);
    const duration = block.type === "LUNCH" ? 60 : block.type === "BREAK" ? 15 : 30;
    endTime.setMinutes(endTime.getMinutes() + duration);

    await prisma.technicianBlock.create({
      data: {
        technicianId: tech.id,
        blockType: block.type,
        title: block.title,
        startTime,
        endTime,
        isActive: true,
      },
    });

    console.log(
      `  ${tech.firstName}: ${block.title} at ${slot.hour}:${slot.minute.toString().padStart(2, "0")} (${duration}min)`
    );
  }

  console.log("\nSeed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
