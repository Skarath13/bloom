"use client";

import * as React from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  className?: string;
  placeholder?: string;
  formatStr?: string;
  minDate?: Date;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function DatePicker({
  date,
  onDateChange,
  className,
  placeholder = "Select date",
  formatStr = "M/d/yy",
  minDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState<Date>(date || new Date());
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);

  // Update viewDate when date prop changes
  React.useEffect(() => {
    if (date) {
      setViewDate(date);
    }
  }, [date]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Get days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  // Generate calendar grid
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleSelectDate = (day: number) => {
    const newDate = new Date(year, month, day);
    onDateChange(newDate);
    setOpen(false);
  };

  const handleSelectMonth = (monthIndex: number) => {
    setViewDate(new Date(year, monthIndex, 1));
    setShowMonthPicker(false);
  };

  const handleSelectYear = (newYear: number) => {
    setViewDate(new Date(newYear, month, 1));
  };

  const isSelected = (day: number) => {
    if (!date) return false;
    return (
      date.getDate() === day &&
      date.getMonth() === month &&
      date.getFullYear() === year
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  const isDisabled = (day: number) => {
    if (!minDate) return false;
    const checkDate = new Date(year, month, day);
    return checkDate < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
  };

  // Generate year options (10 years before and after current)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "text-sm text-gray-900 hover:text-gray-600 cursor-pointer text-left",
            !date && "text-gray-400",
            className
          )}
        >
          {date ? format(date, formatStr) : placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowMonthPicker(!showMonthPicker)}
              className="flex items-center gap-1 text-base font-semibold hover:bg-gray-100 px-2 py-1 rounded cursor-pointer"
            >
              {MONTHS[month]} {year}
              <ChevronRight className={cn("h-4 w-4 transition-transform", showMonthPicker && "rotate-90")} />
            </button>

            <button
              type="button"
              onClick={handleNextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {showMonthPicker ? (
            /* Month/Year Picker */
            <div className="space-y-4">
              {/* Year selector */}
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectYear(year - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-lg font-semibold w-16 text-center">{year}</span>
                <button
                  type="button"
                  onClick={() => handleSelectYear(year + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Month grid */}
              <div className="grid grid-cols-3 gap-2">
                {MONTHS.map((m, i) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectMonth(i)}
                    className={cn(
                      "px-3 py-2 text-sm rounded-lg hover:bg-gray-100 cursor-pointer",
                      i === month && "bg-gray-900 text-white hover:bg-gray-800"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Calendar Grid */
            <>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-2">
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="h-8 flex items-center justify-center text-xs font-medium text-gray-500"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, index) => (
                  <div key={index} className="h-9 flex items-center justify-center">
                    {day !== null && (
                      <button
                        type="button"
                        onClick={() => !isDisabled(day) && handleSelectDate(day)}
                        disabled={isDisabled(day)}
                        className={cn(
                          "w-8 h-8 flex items-center justify-center text-sm rounded-full cursor-pointer transition-colors",
                          isSelected(day)
                            ? "bg-gray-900 text-white"
                            : isToday(day)
                            ? "bg-gray-100 font-semibold"
                            : "hover:bg-gray-100",
                          isDisabled(day) && "text-gray-300 cursor-not-allowed hover:bg-transparent"
                        )}
                      >
                        {day}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
