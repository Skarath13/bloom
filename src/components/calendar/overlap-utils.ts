// Square/Cascade Style Algorithm for Calendar Event Overlaps
// Based on: React-Big-Calendar, Calendar Puzzle, Square Appointments
// Sources:
// - https://github.com/jquense/react-big-calendar
// - https://github.com/taterbase/calendar-puzzle
// - https://www.compasscalendar.com/blog/gcal-secret-weapon

export interface Appointment {
  id: string;
  startTime: Date;
  endTime: Date;
  clientName: string;
  serviceName: string;
  serviceCategory?: string;
  technicianId: string;
  status: string;
}

export interface TechnicianBlock {
  id: string;
  technicianId: string;
  title: string;
  blockType: string;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
}

export interface CalendarEvent {
  id: string;
  type: "appointment" | "block";
  startTime: Date;
  endTime: Date;
  technicianId: string;
  duration: number; // milliseconds
  originalData: Appointment | TechnicianBlock;
}

export interface OverlapPosition {
  left: number;       // 0-100%
  width: number;      // 0-100%
  zIndex: number;     // layering order
  isDominant: boolean;
  column: number;     // assigned column (0-based)
  totalColumns: number; // total columns in this group
}

// Convert an appointment to unified CalendarEvent
export function appointmentToCalendarEvent(apt: Appointment): CalendarEvent {
  const startTime = new Date(apt.startTime);
  const endTime = new Date(apt.endTime);
  return {
    id: apt.id,
    type: "appointment",
    startTime,
    endTime,
    technicianId: apt.technicianId,
    duration: endTime.getTime() - startTime.getTime(),
    originalData: apt,
  };
}

// Convert a block to unified CalendarEvent
export function blockToCalendarEvent(block: TechnicianBlock): CalendarEvent {
  const startTime = new Date(block.startTime);
  const endTime = new Date(block.endTime);
  return {
    id: `block-${block.id}`,
    type: "block",
    startTime,
    endTime,
    technicianId: block.technicianId,
    duration: endTime.getTime() - startTime.getTime(),
    originalData: block,
  };
}

// Check if two events overlap in time
function eventsOverlap(a: CalendarEvent, b: CalendarEvent): boolean {
  return a.startTime < b.endTime && a.endTime > b.startTime;
}

// Find collision groups - events that transitively overlap
function findCollisionGroups(events: CalendarEvent[]): CalendarEvent[][] {
  if (events.length === 0) return [];

  const groups: CalendarEvent[][] = [];
  const assigned = new Set<string>();

  for (const event of events) {
    if (assigned.has(event.id)) continue;

    // Start a new group with this event
    const group: CalendarEvent[] = [event];
    assigned.add(event.id);

    // Find all events that transitively overlap with this group
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const candidate of events) {
        if (assigned.has(candidate.id)) continue;

        // Check if candidate overlaps with ANY event in the group
        const overlapsGroup = group.some(groupEvent => eventsOverlap(groupEvent, candidate));

        if (overlapsGroup) {
          group.push(candidate);
          assigned.add(candidate.id);
          expanded = true;
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

// Minimum card width to ensure readability
const MIN_CARD_WIDTH_PERCENT = 25;

// Cascade layout for a set of events within available space
function layoutCascade(
  events: CalendarEvent[],
  positions: Map<string, OverlapPosition>,
  startLeft: number,
  availableWidth: number,
  baseZIndex: number = 5
): void {
  if (events.length === 0) return;

  // Sort by start time (earlier at back, later at front = easier to click)
  // Use ID as tiebreaker for deterministic ordering
  const sorted = [...events].sort((a, b) => {
    const timeDiff = a.startTime.getTime() - b.startTime.getTime();
    return timeDiff !== 0 ? timeDiff : a.id.localeCompare(b.id);
  });

  if (sorted.length === 1) {
    positions.set(sorted[0].id, {
      left: startLeft,
      width: availableWidth,
      zIndex: baseZIndex,
      isDominant: true,
      column: 0,
      totalColumns: 1,
    });
    return;
  }

  // Calculate cascade parameters with minimum width enforcement
  const cardCount = sorted.length;
  const offsetPercent = Math.min(15, 50 / cardCount); // Scale down offset for many cards
  const offsetAmount = (availableWidth * offsetPercent) / 100;
  const rawCardWidth = availableWidth - (offsetAmount * (cardCount - 1));
  const cardWidth = Math.max(MIN_CARD_WIDTH_PERCENT, rawCardWidth);

  // Cascade RIGHT-to-LEFT: leftmost card is at FRONT (latest start, highest z-index)
  // This matches reading direction - users look left first, that card should be clickable
  sorted.forEach((event, index) => {
    const reverseIndex = cardCount - 1 - index;
    positions.set(event.id, {
      left: startLeft + (reverseIndex * offsetAmount),
      width: cardWidth,
      zIndex: baseZIndex + index, // Earlier at back (lower z), later at front (higher z)
      isDominant: index === cardCount - 1, // Leftmost (latest start) is dominant
      column: reverseIndex,
      totalColumns: cardCount,
    });
  });
}

// Find sub-groups of events that actually overlap each other (graph-based)
// Uses adjacency list + BFS to find connected components of truly overlapping events
function findDirectOverlapGroups(events: CalendarEvent[]): CalendarEvent[][] {
  if (events.length === 0) return [];
  if (events.length === 1) return [[events[0]]];

  // Build adjacency list - only truly overlapping pairs
  const adjacent = new Map<string, Set<string>>();
  const eventMap = new Map<string, CalendarEvent>();

  for (const event of events) {
    adjacent.set(event.id, new Set());
    eventMap.set(event.id, event);
  }

  // Check every pair for DIRECT overlap (O(n²) but n is small per tech)
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      if (eventsOverlap(events[i], events[j])) {
        adjacent.get(events[i].id)!.add(events[j].id);
        adjacent.get(events[j].id)!.add(events[i].id);
      }
    }
  }

  // Find connected components via BFS
  const visited = new Set<string>();
  const groups: CalendarEvent[][] = [];

  for (const event of events) {
    if (visited.has(event.id)) continue;

    const group: CalendarEvent[] = [];
    const queue = [event.id];

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      group.push(eventMap.get(id)!);

      for (const neighborId of adjacent.get(id)!) {
        if (!visited.has(neighborId)) {
          queue.push(neighborId);
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

// Calculate positions for a collision group using Square/Cascade style
function calculateGroupPositions(
  group: CalendarEvent[],
  positions: Map<string, OverlapPosition>
): void {
  // Case: Single event - full width
  if (group.length === 1) {
    const event = group[0];
    positions.set(event.id, {
      left: 0,
      width: 100,
      zIndex: 10,
      isDominant: true,
      column: 0,
      totalColumns: 1,
    });
    return;
  }

  // Separate blocks and appointments
  const blocks = group.filter((e) => e.type === "block");
  const appointments = group.filter((e) => e.type === "appointment");

  // Only appointments (no blocks)
  if (blocks.length === 0) {
    // Find which appointments actually overlap each other
    const appointmentSubGroups = findDirectOverlapGroups(appointments);

    for (const subGroup of appointmentSubGroups) {
      if (subGroup.length === 1) {
        // Single appointment - full width
        positions.set(subGroup[0].id, {
          left: 0,
          width: 100,
          zIndex: 10,
          isDominant: true,
          column: 0,
          totalColumns: 1,
        });
      } else if (subGroup.length === 2) {
        // Two overlapping - earlier at back (full width), later at front (half width, easier to click)
        const sorted = [...subGroup].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
        positions.set(sorted[0].id, {
          left: 0, width: 100, zIndex: 5, isDominant: true, column: 0, totalColumns: 2,
        });
        positions.set(sorted[1].id, {
          left: 50, width: 50, zIndex: 15, isDominant: false, column: 1, totalColumns: 2,
        });
      } else {
        // 3+ overlapping - cascade
        layoutCascade(subGroup, positions, 0, 100, 5);
      }
    }
    return;
  }

  // Only blocks (no appointments)
  if (appointments.length === 0) {
    const blockSubGroups = findDirectOverlapGroups(blocks);
    for (const subGroup of blockSubGroups) {
      if (subGroup.length === 1) {
        positions.set(subGroup[0].id, {
          left: 0, width: 100, zIndex: 10, isDominant: true, column: 0, totalColumns: 1,
        });
      } else {
        layoutCascade(subGroup, positions, 0, 100, 5);
      }
    }
    return;
  }

  // Mixed: Blocks anchor LEFT, Appointments on RIGHT
  // Block width is DYNAMIC based on actual overlap ratio with appointments
  const blockSubGroups = findDirectOverlapGroups(blocks);

  // Calculate max overlap ratio: how much of any appointment is covered by any block
  let maxOverlapRatio = 0;
  for (const appt of appointments) {
    for (const block of blocks) {
      if (eventsOverlap(appt, block)) {
        const overlapStart = Math.max(appt.startTime.getTime(), block.startTime.getTime());
        const overlapEnd = Math.min(appt.endTime.getTime(), block.endTime.getTime());
        const overlapDuration = overlapEnd - overlapStart;
        const apptDuration = appt.endTime.getTime() - appt.startTime.getTime();
        const ratio = apptDuration > 0 ? overlapDuration / apptDuration : 0;
        maxOverlapRatio = Math.max(maxOverlapRatio, ratio);
      }
    }
  }

  // Block width: 15% minimum, scales up to 35% based on overlap ratio
  // A 15-min block overlapping 2-hour appt (12.5%) → ~18% width
  // A 1-hour block overlapping 1-hour appt (100%) → 35% width
  const blockWidth = Math.max(15, Math.min(35, 15 + (maxOverlapRatio * 20)));

  const appointmentLeft = blockWidth;
  const appointmentWidth = 100 - blockWidth;

  // Position all blocks on the left (they may not all overlap each other)
  for (const subGroup of blockSubGroups) {
    layoutCascade(subGroup, positions, 0, blockWidth, 3);
  }

  // Position appointments - but check which sub-groups ACTUALLY overlap blocks
  const appointmentSubGroups = findDirectOverlapGroups(appointments);

  for (const subGroup of appointmentSubGroups) {
    // Check if ANY appointment in this sub-group overlaps ANY block
    const subGroupOverlapsBlock = subGroup.some(appt =>
      blocks.some(block => eventsOverlap(appt, block))
    );

    // If no overlap with blocks, this sub-group gets full width
    const effectiveLeft = subGroupOverlapsBlock ? appointmentLeft : 0;
    const effectiveWidth = subGroupOverlapsBlock ? appointmentWidth : 100;

    if (subGroup.length === 1) {
      // Single appointment - full width of available area
      positions.set(subGroup[0].id, {
        left: effectiveLeft,
        width: effectiveWidth,
        zIndex: 10,
        isDominant: true,
        column: 0,
        totalColumns: 1,
      });
    } else if (subGroup.length === 2) {
      // Two overlapping - earlier at back, later at front (easier to click)
      const sorted = [...subGroup].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      positions.set(sorted[0].id, {
        left: effectiveLeft,
        width: effectiveWidth,
        zIndex: 5,
        isDominant: true,
        column: 0,
        totalColumns: 2,
      });
      positions.set(sorted[1].id, {
        left: effectiveLeft + (effectiveWidth * 0.5),
        width: effectiveWidth * 0.5,
        zIndex: 15,
        isDominant: false,
        column: 1,
        totalColumns: 2,
      });
    } else {
      // 3+ overlapping appointments - cascade within available area
      layoutCascade(subGroup, positions, effectiveLeft, effectiveWidth, 10);
    }
  }
}

// Main function: calculate overlap positions for all events
export function calculateUnifiedOverlapPositions(
  events: CalendarEvent[]
): Map<string, OverlapPosition> {
  const positions = new Map<string, OverlapPosition>();

  if (events.length === 0) {
    return positions;
  }

  // Find collision groups
  const groups = findCollisionGroups(events);

  // Process each collision group
  for (const group of groups) {
    calculateGroupPositions(group, positions);
  }

  return positions;
}
