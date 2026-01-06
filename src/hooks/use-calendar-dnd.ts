"use client";

import { useState, useCallback, RefObject } from "react";
import { DragStartEvent, DragMoveEvent, DragEndEvent } from "@dnd-kit/core";

// Calendar configuration (should match resource-calendar.tsx)
const PIXELS_PER_HOUR = 80;
const PIXELS_PER_15_MIN = 20;
const TIME_COLUMN_WIDTH = 56;
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

interface DragState {
  activeId: string | null;
  activeAppointment: Appointment | null;
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

interface PendingBlock {
  technicianId: string;
  technicianName: string;
  startTime: Date;
  endTime: Date;
}

interface UseCalendarDndOptions {
  appointments: Appointment[];
  selectedDate: Date;
  visibleTechnicians: Technician[];
  gridRef: RefObject<HTMLDivElement | null>;
  onConflictCheck?: (
    technicianId: string,
    startTime: Date,
    endTime: Date,
    excludeId?: string
  ) => Promise<boolean>;
}

const initialDragState: DragState = {
  activeId: null,
  activeAppointment: null,
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
  selectedDate,
  visibleTechnicians,
  gridRef,
}: UseCalendarDndOptions) {
  const [dragState, setDragState] = useState<DragState>(initialDragState);
  const [selection, setSelection] = useState<SelectionState>(initialSelectionState);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [pendingBlock, setPendingBlock] = useState<PendingBlock | null>(null);

  // Calculate time from Y position
  const getTimeFromY = useCallback(
    (clientY: number): Date | null => {
      const gridElement = gridRef.current;
      if (!gridElement) return null;

      const rect = gridElement.getBoundingClientRect();
      const scrollTop = gridElement.scrollTop;
      const relativeY = clientY - rect.top + scrollTop;

      // Snap to 15-minute increments
      const minutes = Math.round(relativeY / PIXELS_PER_15_MIN) * 15;
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
    [gridRef, selectedDate]
  );

  // Calculate technician from X position
  const getTechnicianFromX = useCallback(
    (clientX: number): Technician | null => {
      const gridElement = gridRef.current;
      if (!gridElement || visibleTechnicians.length === 0) return null;

      const rect = gridElement.getBoundingClientRect();
      const relativeX = clientX - rect.left - TIME_COLUMN_WIDTH;

      if (relativeX < 0) return null;

      const contentWidth = rect.width - TIME_COLUMN_WIDTH;
      const columnWidth = contentWidth / visibleTechnicians.length;
      const techIndex = Math.floor(relativeX / columnWidth);

      return visibleTechnicians[techIndex] || null;
    },
    [gridRef, visibleTechnicians]
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
      const appointment = appointments.find((apt) => apt.id === active.id);

      if (!appointment) return;

      // Capture initial pointer Y for delta calculation
      const initialY = activatorEvent instanceof PointerEvent ? activatorEvent.clientY : null;

      setDragState({
        activeId: active.id as string,
        activeAppointment: appointment,
        currentTechId: appointment.technicianId,
        currentTime: new Date(appointment.startTime),
        originalTechId: appointment.technicianId,
        originalStartTime: new Date(appointment.startTime),
        initialPointerY: initialY,
        hasConflict: false,
      });
    },
    [appointments]
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      if (!dragState.activeAppointment || dragState.initialPointerY === null) return;

      // Get position from the pointer coordinates
      const { activatorEvent } = event;
      if (!(activatorEvent instanceof PointerEvent)) return;

      // Calculate current pointer position
      const pointerX = activatorEvent.clientX + (event.delta?.x || 0);
      const pointerY = activatorEvent.clientY + (event.delta?.y || 0);

      // Calculate delta Y from initial position and convert to minutes
      const deltaY = pointerY - dragState.initialPointerY;
      const deltaMinutes = Math.round(deltaY / PIXELS_PER_15_MIN) * 15;

      // Calculate new time by adding delta to original start time
      const newTime = new Date(dragState.originalStartTime.getTime() + deltaMinutes * 60 * 1000);

      // Clamp to calendar bounds
      const minTime = new Date(dragState.originalStartTime);
      minTime.setHours(CALENDAR_START_HOUR, 0, 0, 0);
      const maxTime = new Date(dragState.originalStartTime);
      maxTime.setHours(CALENDAR_END_HOUR - 1, 45, 0, 0); // Leave room for appointment

      const clampedTime = new Date(Math.max(minTime.getTime(), Math.min(newTime.getTime(), maxTime.getTime())));

      const newTech = getTechnicianFromX(pointerX);
      if (!newTech) return;

      // Calculate new end time based on original duration
      const duration =
        dragState.activeAppointment.endTime.getTime() -
        dragState.activeAppointment.startTime.getTime();
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
    [dragState.activeAppointment, dragState.activeId, dragState.initialPointerY, dragState.originalStartTime, getTechnicianFromX, checkLocalConflict]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!dragState.activeAppointment || !dragState.currentTime || !dragState.currentTechId) {
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

      // Set pending move for confirmation (allow even with conflicts)
      setPendingMove({
        appointment: dragState.activeAppointment,
        originalTime: dragState.originalStartTime,
        newTime: dragState.currentTime,
        originalTechId: dragState.originalTechId,
        newTechId: dragState.currentTechId,
      });

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

      setSelection({
        isSelecting: true,
        technicianId,
        startTime: time,
        endTime,
      });
    },
    [getTimeFromY]
  );

  const handleSelectionMove = useCallback(
    (e: React.MouseEvent) => {
      if (!selection.isSelecting || !selection.startTime) return;

      const currentTime = getTimeFromY(e.clientY);
      if (!currentTime) return;

      // Ensure minimum 15-minute selection
      const minEndTime = new Date(selection.startTime.getTime() + 15 * 60 * 1000);

      // Allow dragging both directions
      if (currentTime.getTime() >= selection.startTime.getTime()) {
        // Dragging down - extend end time
        const newEndTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
        setSelection((prev) => ({
          ...prev,
          endTime: newEndTime.getTime() > minEndTime.getTime() ? newEndTime : minEndTime,
        }));
      } else {
        // Dragging up - keep original start as end, use current as start
        setSelection((prev) => ({
          ...prev,
          startTime: currentTime,
          endTime: prev.startTime,
        }));
      }
    },
    [selection.isSelecting, selection.startTime, getTimeFromY]
  );

  const handleSelectionEnd = useCallback(() => {
    if (selection.isSelecting && selection.technicianId && selection.startTime && selection.endTime) {
      const tech = visibleTechnicians.find((t) => t.id === selection.technicianId);

      // Ensure start is before end
      const finalStartTime =
        selection.startTime.getTime() < selection.endTime.getTime()
          ? selection.startTime
          : selection.endTime;
      const finalEndTime =
        selection.startTime.getTime() < selection.endTime.getTime()
          ? selection.endTime
          : selection.startTime;

      setPendingBlock({
        technicianId: selection.technicianId,
        technicianName: tech?.firstName || "Unknown",
        startTime: finalStartTime,
        endTime: finalEndTime,
      });
    }

    setSelection(initialSelectionState);
  }, [selection, visibleTechnicians]);

  const handleSelectionCancel = useCallback(() => {
    setSelection(initialSelectionState);
  }, []);

  // Clear pending states
  const clearPendingMove = useCallback(() => {
    setPendingMove(null);
  }, []);

  const clearPendingBlock = useCallback(() => {
    setPendingBlock(null);
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
    const top = minMinutes * (PIXELS_PER_HOUR / 60);
    const height = (maxMinutes - minMinutes) * (PIXELS_PER_HOUR / 60);

    return {
      top: `${top}px`,
      height: `${Math.max(height, PIXELS_PER_15_MIN)}px`,
      left: `${techIndex * columnWidth}%`,
      width: `${columnWidth}%`,
    };
  }, [selection, visibleTechnicians]);

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
    const top = startMinutes * (PIXELS_PER_HOUR / 60);
    const height = durationMinutes * (PIXELS_PER_HOUR / 60);

    return {
      top: `${top}px`,
      height: `${Math.max(height, PIXELS_PER_15_MIN)}px`,
      left: `${techIndex * columnWidth}%`,
      width: `${columnWidth}%`,
    };
  }, [dragState.activeAppointment, dragState.currentTime, dragState.currentTechId, visibleTechnicians]);

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
    pendingBlock,
    clearPendingMove,
    clearPendingBlock,

    // Helpers
    getDragOverlayTechColor,
    getLandingZoneStyle,
  };
}
