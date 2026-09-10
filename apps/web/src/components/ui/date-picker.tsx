"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal sm:w-[240px]",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon />
          {value ? format(value, "PPP") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange?.(date);
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

interface DateRangePickerProps {
  value?: { from?: Date; to?: Date };
  onChange?: (range: { from?: Date; to?: Date } | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date range",
  className,
}: DateRangePickerProps) {
  const label = value?.from
    ? value.to
      ? `${format(value.from, "LLL d, y")} – ${format(value.to, "LLL d, y")}`
      : format(value.from, "LLL d, y")
    : placeholder;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal sm:w-[280px]",
            !value?.from && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value as { from: Date; to?: Date } | undefined}
          onSelect={onChange}
          numberOfMonths={1}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

interface DropdownDatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
  /** Defaults to 100 years before the current year. */
  fromYear?: number;
  /** Defaults to the current year. */
  toYear?: number;
}

/**
 * Three plain dropdowns (day/month/year) instead of a calendar popup -
 * for a date that's decades away in either direction (birth dates,
 * document expiry, employment history), "navigate a calendar back/forward
 * N years" is far more tedious than picking three known numbers directly.
 * Used for that kind of field; a near-term date (this week's expense, an
 * upcoming leave request) stays on the calendar-based DatePicker above,
 * where "click today, or a day close to it" is the common case and a
 * calendar's spatial layout is actually the faster interaction.
 *
 * Keeps its own day/month/year state rather than deriving purely from
 * `value`, so a partial selection (e.g. day + month, no year yet) stays
 * visible instead of reverting to placeholders on every keystroke - only
 * safe because every call site mounts this fresh each time its dialog
 * opens (see e.g. EditProfileDialog's own comment on the same pattern), so
 * there's no case where `value` changes out from under an already-mounted
 * instance. Don't reuse this in a context that stays mounted across a
 * `value` change from outside (e.g. a filter bound to URL state) without
 * adding that sync back.
 */
export function DropdownDatePicker({
  value,
  onChange,
  disabled,
  className,
  fromYear,
  toYear,
}: DropdownDatePickerProps) {
  const currentYear = new Date().getFullYear();
  const minYear = fromYear ?? currentYear - 100;
  const maxYear = toYear ?? currentYear;

  const [day, setDay] = React.useState<number | undefined>(() => value?.getDate());
  const [month, setMonth] = React.useState<number | undefined>(() =>
    value ? value.getMonth() + 1 : undefined,
  );
  const [year, setYear] = React.useState<number | undefined>(() => value?.getFullYear());

  function commit(d: number | undefined, m: number | undefined, y: number | undefined) {
    if (d && m && y) {
      onChange?.(new Date(y, m - 1, d));
    } else {
      onChange?.(undefined);
    }
  }

  function clampDay(d: number | undefined, m: number | undefined, y: number | undefined) {
    if (!d || !m) return d;
    const maxDay = daysInMonth(y ?? maxYear, m);
    return d > maxDay ? maxDay : d;
  }

  function handleDayChange(v: string) {
    const d = Number(v);
    setDay(d);
    commit(d, month, year);
  }

  function handleMonthChange(v: string) {
    const m = Number(v);
    const d = clampDay(day, m, year);
    setMonth(m);
    if (d !== day) setDay(d);
    commit(d, m, year);
  }

  function handleYearChange(v: string) {
    const y = Number(v);
    const d = clampDay(day, month, y);
    setYear(y);
    if (d !== day) setDay(d);
    commit(d, month, y);
  }

  const maxDayForMonth = month ? daysInMonth(year ?? maxYear, month) : 31;
  const days = Array.from({ length: maxDayForMonth }, (_, i) => i + 1);
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      <Select value={day ? String(day) : undefined} onValueChange={handleDayChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Day" />
        </SelectTrigger>
        <SelectContent>
          {days.map((d) => (
            <SelectItem key={d} value={String(d)}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={month ? String(month) : undefined} onValueChange={handleMonthChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          {MONTH_NAMES.map((name, i) => (
            <SelectItem key={name} value={String(i + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={year ? String(year) : undefined} onValueChange={handleYearChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
