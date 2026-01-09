"use client";

import { useState, useCallback, useRef, RefObject } from "react";
import { DragStartEvent, DragMoveEvent, DragEndEvent } from "@dnd-kit/core";

// Static calendar constants (same for mobile/desktop)
const CALENDAR_START_HOUR = 0;
const CALENDAR_END_HOUR = 24;

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
}

interface Appointment {
  id: string;
  startTime: Date;
  endTime: Date;
  clientName: string;
  serviceName: string;
  technicianId: string;
  status: string;
  client?: {
    phone?: string;
  };
}

interface TechnicianBlock {
  id: string;
  technicianId: string;
  title: string;
  blockType: string;
  startTime: Date;
  endTime: Date;
}

type DragItemType = "appointment" | "block" | null;

interface DragState {
  activeId: string | null;
  dragType: DragItemType;
  activeAppointment: Appointment | null;
  activeBlock: TechnicianBlock | null;
  currentTechId: string | null;
  currentTime: Date | null;
  originalTechId: string;
  originalStartTime: Date;
  initialPointerY: number | null;
  hasConflict: boolean;
}

interface SelectionState {
  isSelecting: boolean;
  technicianId: string | null;
  startTime: Date | null;
  endTime: Date | null;
}

interface PendingMove {
  appointment: Appointment;
  originalTime: Date;
  newTime: Date;
  originalTechId: string;
  newTechId: string;
}

interface PendingBlockMove {
  block: TechnicianBlock;
  originalTime: Date;
  newTime: Date;
  originalTechId: string;
  newTechId: string;
}

interface UseCalendarDndOptions {
  appointments: Appointment[];
  blocks: TechnicianBlock[];
  selectedDate: Date;
  visibleTechnicians: Technician[];
  gridRef: RefObject<HTMLDivElement | null>;
  onSlotSelect?: (technicianId: string, time: Date) => void;
  onConflictCheck?: (
    technicianId: string,
    startTime: Date,
    endTime: Date,
    excludeId?: string
  ) => Promise<boolean>;
  // Responsive config values (from CalendarConfigProvider)
  pixelsPerHour: number;
  pixelsPerFifteenMin: number;
  timeColumnWidth: number;
  headerHeight: number;
}

const initialDragState: DragState = {
  activeId: null,
  dragType: null,
  activeAppointment: null,
  activeBlock: null,
  currentTechId: null,
  currentTime: null,
  originalTechId: "",
  originalStartTime: new Date(),
  initialPointerY: null,
  hasConflict: false,
};

const initialSelectionState: SelectionState = {
  isSelecting: false,
  technicianId: null,
  startTime: null,
  endTime: null,
};

export function useCalendarDnd({
  appointments,
  blocks,
  selectedDate,
  visibleTechnicians,
  gridRef,
  onSlotSelect,
  pixelsPerHour,
  pixelsPerFifteenMin,
  timeColumnWidth,
  headerHeight,
}: UseCalendarDndOptions) {
  const [dragState, setDragState] = useState<DragState>(initialDragState);
  const [selection, setSelection] = useState<SelectionState>(initialSelectionState);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [pendingBlockMove, setPendingBlockMove] = useState<PendingBlockMove | null>(null);

  // Ref to track latest selection - needed because handleSelectionEnd may be called
  // immediately after handleSelectionMove before React re-renders with new state
  const selectionRef = useRef<SelectionState>(initialSelectionState);

  // Calculate time from Y position
  const getTimeFromY = useCallback(
    (clientY: number): Date | null => {
      const gridElement = gridRef.current;
      if (!gridElement) return null;

      const rect = gridElement.getBoundingClientRect();
      const scrollTop = gridElement.scrollTop;
      // Account for sticky header height
      const relativeY = clientY - rect.top + scrollTop - headerHeight;

      // Use floor to match the hover highlight behavior - select the cell the cursor is IN
      const minutes = Math.floor(relativeY / pixelsPerFifteenMin) * 15;
      const clampedMinutes = Math.max(
        0,
        Math.min(minutes, (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60 - 15)
      );

      const hours = Math.floor(clampedMinutes / 60);
      const mins = clampedMinutes % 60;

      const time = new Date(selectedDate);
      time.setHours(hours + CALENDAR_START_HOUR, mins, 0, 0);
      return time;
    },
    [gridRef, selectedDate, headerHeight, pixelsPerFifteenMin]
  );

  // Calculate technician from X position
  const getTechnicianFromX = useCallback(
    (clientX: number): Technician | null => {
      const gridElement = gridRef.current;
      if (!gridElement || visibleTechnicians.length === 0) return null;

      const rect = gridElement.getBoundingClientRect();
      const relativeX = clientX - rect.left - timeColumnWidth;

      if (relativeX < 0) return null;

      const contentWidth = rect.width - timeColumnWidth;
      const columnWidth = contentWidth / visibleTechnicians.length;
      const techIndex = Math.floor(relativeX / columnWidth);

      return visibleTechnicians[techIndex] || null;
    },
    [gridRef, visibleTechnicians, timeColumnWidth]
  );

  // Check for conflicts locally (quick check against visible appointments)
  const checkLocalConflict = useCallback(
    (
      technicianId: string,
      startTime: Date,
      endTime: Date,
      excludeId?: string
    ): boolean => {
      return appointments.some((apt) => {
        if (apt.id === excludeId) return false;
        if (apt.technicianId !== technicianId) return false;
        if (apt.status === "CANCELLED" || apt.status === "NO_SHOW") return false;

        const aptStart = new Date(apt.startTime).getTime();
        const aptEnd = new Date(apt.endTime).getTime();
        const newStart = startTime.getTime();
        const newEnd = endTime.getTime();

        // Check overlap: new.start < existing.end AND new.end > existing.start
        return newStart < aptEnd && newEnd > aptStart;
      });
    },
    [appointments]
  );

  // Drag handlers
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active, activatorEvent } = event;
      const activeIdStr = active.id as string;

      // Capture initial pointer Y for delta calculation
      const initialY = activatorEvent instanceof PointerEvent ? activatorEvent.clientY : null;

      // Check if dragging a block (prefixed with "block-")
      if (activeIdStr.startsWith("block-")) {
        const blockId = activeIdStr.replace("block-", "");
        const block = blocks.find((b) => b.id === blockId);
        if (!block) return;

        setDragState({
          activeId: activeIdStr,
          dragType: "block",
          activeAppointment: null,
          activeBlock: block,
          currentTechId: block.technicianId,
          currentTime: new Date(block.startTime),
          originalTechId: block.technicianId,
          originalStartTime: new Date(block.startTime),
          initialPointerY: initialY,
          hasConflict: false,
        });
        return;
      }

      // Otherwise, it's an appointment
      const appointment = appointments.find((apt) => apt.id === activeIdStr);
      if (!appointment) return;

      setDragState({
        activeId: activeIdStr,
        dragType: "appointment",
        activeAppointment: appointment,
        activeBlock: null,
        currentTechId: appointment.technicianId,
        currentTime: new Date(appointment.startTime),
        originalTechId: appointment.technicianId,
        originalStartTime: new Date(appointment.startTime),
        initialPointerY: initialY,
        hasConflict: false,
      });
    },
    [appointments, blocks]
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const activeItem = dragState.activeAppointment || dragState.activeBlock;
      if (!activeItem || dragState.initialPointerY === null) return;

      // Get position from the pointer coordinates
      const { activatorEvent } = event;
      if (!(activatorEvent instanceof PointerEvent)) return;

      // Calculate current pointer position
      const pointerX = activatorEvent.clientX + (event.delta?.x || 0);
      const pointerY = activatorEvent.clientY + (event.delta?.y || 0);

      // Calculate delta Y from initial position and convert to minutes
      const deltaY = pointerY - dragState.initialPointerY;
      const deltaMinutes = Math.round(deltaY / pixelsPerFifteenMin) * 15;

      // Calculate new time by adding delta to original start time
      const newTime = new Date(dragState.originalStartTime.getTime() + deltaMinutes * 60 * 1000);

      // Clamp to calendar bounds
      const minTime = new Date(dragState.originalStartTime);
      minTime.setHours(CALENDAR_START_HOUR, 0, 0, 0);
      const maxTime = new Date(dragState.originalStartTime);
      maxTime.setHours(CALENDAR_END_HOUR - 1, 45, 0, 0); // Leave room for item

      const clampedTime = new Date(Math.max(minTime.getTime(), Math.min(newTime.getTime(), maxTime.getTime())));

      const newTech = getTechnicianFromX(pointerX);
      if (!newTech) return;

      // Calculate new end time based on original duration
      // Ensure we handle both Date objects and date strings
      const startMs = activeItem.startTime instanceof Date
        ? activeItem.startTime.getTime()
        : new Date(activeItem.startTime).getTime();
      const endMs = activeItem.endTime instanceof Date
        ? activeItem.endTime.getTime()
        : new Date(activeItem.endTime).getTime();
      const duration = endMs - startMs;
      const newEndTime = new Date(clampedTime.getTime() + duration);

      // Check for conflicts (informational only, doesn't block)
      const hasConflict = checkLocalConflict(
        newTech.id,
        clampedTime,
        newEndTime,
        dragState.activeId || undefined
      );

      setDragState((prev) => ({
        ...prev,
        currentTechId: newTech.id,
        currentTime: clampedTime,
        hasConflict,
      }));
    },
    [dragState.activeAppointment, dragState.activeBlock, dragState.activeId, dragState.initialPointerY, dragState.originalStartTime, getTechnicianFromX, checkLocalConflict, pixelsPerFifteenMin]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!dragState.currentTime || !dragState.currentTechId) {
        setDragState(initialDragState);
        return;
      }

      // Check if position actually changed
      const timeChanged =
        dragState.currentTime.getTime() !== dragState.originalStartTime.getTime();
      const techChanged = dragState.currentTechId !== dragState.originalTechId;

      if (!timeChanged && !techChanged) {
        // No change, just reset
        setDragState(initialDragState);
        return;
      }

      // Set pending move based on drag type
      if (dragState.dragType === "block" && dragState.activeBlock) {
        setPendingBlockMove({
          block: dragState.activeBlock,
          originalTime: dragState.originalStartTime,
          newTime: dragState.currentTime,
          originalTechId: dragState.originalTechId,
          newTechId: dragState.currentTechId,
        });
      } else if (dragState.dragType === "appointment" && dragState.activeAppointment) {
        setPendingMove({
          appointment: dragState.activeAppointment,
          originalTime: dragState.originalStartTime,
          newTime: dragState.currentTime,
          originalTechId: dragState.originalTechId,
          newTechId: dragState.currentTechId,
        });
      }

      setDragState(initialDragState);
    },
    [dragState]
  );

  const handleDragCancel = useCallback(() => {
    setDragState(initialDragState);
  }, []);

  // Selection handlers for drag-to-create blocks
  const handleSelectionStart = useCallback(
    (e: React.MouseEvent, technicianId: string) => {
      // Only start selection if clicking on empty space (not on appointments)
      const time = getTimeFromY(e.clientY);
      if (!time) return;

      // Add 15 minutes for initial selection
      const endTime = new Date(time.getTime() + 15 * 60 * 1000);

      const newSelection = {
        isSelecting: true,
        technicianId,
        startTime: time,
        endTime,
      };

      // Update both ref and state
      selectionRef.current = newSelection;
      setSelection(newSelection);
    },
    [getTimeFromY]
  );

  const handleSelectionMove = useCallback(
    (e: React.MouseEvent) => {
      // Use ref for reading to get latest values
      const currentSelection = selectionRef.current;
      if (!currentSelection.isSelecting || !currentSelection.startTime) return;

      const currentTime = getTimeFromY(e.clientY);
      if (!currentTime) return;

      // Ensure minimum 15-minute selection
      const minEndTime = new Date(currentSelection.startTime.getTime() + 15 * 60 * 1000);

      let newSelection: SelectionState;

      // Allow dragging both directions
      if (currentTime.getTime() >= currentSelection.startTime.getTime()) {
        // Dragging down - extend end time
        const newEndTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
        newSelection = {
          ...currentSelection,
          endTime: newEndTime.getTime() > minEndTime.getTime() ? newEndTime : minEndTime,
        };
      } else {
        // Dragging up - keep original start as end, use current as start
        newSelection = {
          ...currentSelection,
          startTime: currentTime,
          endTime: currentSelection.startTime,
        };
      }

      // Update both ref and state
      selectionRef.current = newSelection;
      setSelection(newSelection);
    },
    [getTimeFromY]
  );

  const handleSelectionEnd = useCallback(() => {
    // Use ref to get the latest selection values (state may be stale due to closure)
    const currentSelection = selectionRef.current;

    if (currentSelection.isSelecting && currentSelection.technicianId && currentSelection.startTime && currentSelection.endTime) {
      // Ensure start is before end
      const finalStartTime =
        currentSelection.startTime.getTime() < currentSelection.endTime.getTime()
          ? currentSelection.startTime
          : currentSelection.endTime;
      const finalEndTime =
        currentSelection.startTime.getTime() < currentSelection.endTime.getTime()
          ? currentSelection.endTime
          : currentSelection.startTime;

      // Calculate duration in minutes and save to localStorage with timestamp
      // This allows CreateEventDialog to use the dragged duration for personal events
      const durationMinutes = Math.round(
        (finalEndTime.getTime() - finalStartTime.getTime()) / (1000 * 60)
      );

      // Determine if this was a drag (multiple segments) or click (single segment)
      // A single segment is 15 minutes, so anything > 15 is a drag
      const wasDragged = durationMinutes > 15;

      try {
        localStorage.setItem(
          "bloom_calendar_selection",
          JSON.stringify({
            durationMinutes,
            wasDragged,
            timestamp: Date.now(),
          })
        );
      } catch {
        // localStorage might be unavailable, ignore
      }

      // Call the slot select callback to open the create event dialog
      if (onSlotSelect) {
        onSlotSelect(currentSelection.technicianId, finalStartTime);
      }
    }

    // Reset both ref and state
    selectionRef.current = initialSelectionState;
    setSelection(initialSelectionState);
  }, [onSlotSelect]);

  const handleSelectionCancel = useCallback(() => {
    selectionRef.current = initialSelectionState;
    setSelection(initialSelectionState);
  }, []);

  // Clear pending states
  const clearPendingMove = useCallback(() => {
    setPendingMove(null);
  }, []);

  const clearPendingBlockMove = useCallback(() => {
    setPendingBlockMove(null);
  }, []);

  // Get style for selection overlay
  const getSelectionStyle = useCallback(() => {
    if (!selection.isSelecting || !selection.startTime || !selection.endTime || !selection.technicianId) {
      return null;
    }

    const techIndex = visibleTechnicians.findIndex((t) => t.id === selection.technicianId);
    if (techIndex === -1) return null;

    const startMinutes =
      (selection.startTime.getHours() - CALENDAR_START_HOUR) * 60 +
      selection.startTime.getMinutes();
    const endMinutes =
      (selection.endTime.getHours() - CALENDAR_START_HOUR) * 60 +
      selection.endTime.getMinutes();

    const minMinutes = Math.min(startMinutes, endMinutes);
    const maxMinutes = Math.max(startMinutes, endMinutes);

    const columnWidth = 100 / visibleTechnicians.length;
    const top = minMinutes * (pixelsPerHour / 60);
    const height = (maxMinutes - minMinutes) * (pixelsPerHour / 60);

    return {
      top: `${top}px`,
      height: `${Math.max(height, pixelsPerFifteenMin)}px`,
      left: `${techIndex * columnWidth}%`,
      width: `${columnWidth}%`,
    };
  }, [selection, visibleTechnicians, pixelsPerHour, pixelsPerFifteenMin]);

  // Get technician color for drag overlay
  const getDragOverlayTechColor = useCallback(() => {
    if (!dragState.currentTechId) return "#888";
    const tech = visibleTechnicians.find((t) => t.id === dragState.currentTechId);
    return tech?.color || "#888";
  }, [dragState.currentTechId, visibleTechnicians]);

  // Get style for landing zone indicator during drag
  const getLandingZoneStyle = useCallback(() => {
    if (!dragState.activeAppointment || !dragState.currentTime || !dragState.currentTechId) {
      return null;
    }

    const techIndex = visibleTechnicians.findIndex((t) => t.id === dragState.currentTechId);
    if (techIndex === -1) return null;

    // Calculate position based on current drag time
    const startMinutes =
      (dragState.currentTime.getHours() - CALENDAR_START_HOUR) * 60 +
      dragState.currentTime.getMinutes();

    // Calculate duration from original appointment
    const duration =
      dragState.activeAppointment.endTime.getTime() -
      dragState.activeAppointment.startTime.getTime();
    const durationMinutes = duration / (1000 * 60);

    const columnWidth = 100 / visibleTechnicians.length;
    const top = startMinutes * (pixelsPerHour / 60);
    const height = durationMinutes * (pixelsPerHour / 60);

    return {
      top: `${top}px`,
      height: `${Math.max(height, pixelsPerFifteenMin)}px`,
      left: `${techIndex * columnWidth}%`,
      width: `${columnWidth}%`,
    };
  }, [dragState.activeAppointment, dragState.currentTime, dragState.currentTechId, visibleTechnicians, pixelsPerHour, pixelsPerFifteenMin]);

  return {
    // Drag state
    dragState,
    isDragging: dragState.activeId !== null,

    // Drag handlers
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,

    // Selection state
    selection,
    isSelecting: selection.isSelecting,

    // Selection handlers
    handleSelectionStart,
    handleSelectionMove,
    handleSelectionEnd,
    handleSelectionCancel,

    // Selection style
    getSelectionStyle,

    // Pending states
    pendingMove,
    clearPendingMove,
    pendingBlockMove,
    clearPendingBlockMove,

    // Helpers
    getDragOverlayTechColor,
    getLandingZoneStyle,
  };
}
