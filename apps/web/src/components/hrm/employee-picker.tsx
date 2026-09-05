"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { employeeInitials, type EmployeeListItem } from "@/lib/api/employees";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function EmployeePicker({
  employees,
  onSelect,
  placeholder = "Find an employee…",
}: {
  employees: EmployeeListItem[];
  onSelect: (employee: EmployeeListItem) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees.slice(0, 20);
    return employees
      .filter(
        (e) =>
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          e.employeeCode.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [employees, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start font-normal sm:w-64">
          <Search className="text-muted-foreground" />
          {placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2">
          <Input
            autoFocus
            placeholder="Search by name or code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-72 overflow-y-auto border-t">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground p-3 text-xs">No employees found.</p>
          ) : (
            filtered.map((e) => (
              <button
                key={e.id}
                type="button"
                className="hover:bg-accent flex w-full items-center gap-2.5 px-3 py-2 text-left"
                onClick={() => {
                  onSelect(e);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <Avatar className="size-6 shrink-0">
                  <AvatarFallback className="text-[10px]">{employeeInitials(e)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {e.firstName} {e.lastName}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {e.employeeCode} · {e.department?.name ?? "—"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
