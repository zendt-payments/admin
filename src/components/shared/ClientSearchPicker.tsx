import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dataService } from "../../services/dataService";
import { dqk } from "../../lib/dashboardQueries";
import { DropdownRowsSkeleton } from "./skeletons/DashboardSkeletons";

/** Single-line dashboard field — matches client picker trigger height. */
export const DASHBOARD_INPUT_FIELD_10 =
  "w-full rounded-[10px] bg-[#1E1E1E] border border-white/10 px-4 py-3 text-body text-white placeholder:text-white/40 focus:outline-none focus:border-white/20 transition-colors min-h-[46px] box-border";

/** Multi-line dashboard field — same radius/border as {@link DASHBOARD_INPUT_FIELD_10}, vertically resizable. */
export const DASHBOARD_TEXTAREA_FIELD_10 =
  "w-full rounded-[10px] bg-[#1E1E1E] border border-white/10 px-4 py-3 text-body text-white placeholder:text-white/40 focus:outline-none focus:border-white/20 transition-colors resize-y min-h-[80px] box-border";

/** Locks read-only / option rows to the same 46px height as single-line inputs. */
export const DASHBOARD_FIELD_FIXED_HEIGHT = "h-[46px] min-h-[46px] max-h-[46px] !py-0 leading-normal";

export type ClientPickerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  country?: string;
  purpose_code?: string;
  address?: string;
  company?: string;
  company_website?: string;
};

type Props = {
  value: string;
  onChange: (clientId: string, client: ClientPickerRow | null) => void;
  placeholder?: string;
  /** When false, dropdown lists only clients (no “clear selection” row). */
  showClearOption?: boolean;
  className?: string;
};

export default function ClientSearchPicker({
  value,
  onChange,
  placeholder = "Select Client",
  showClearOption = false,
  className = "",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isPending: loading } = useQuery({
    queryKey: dqk.clientsSearch(debouncedSearch),
    queryFn: () =>
      dataService.getClientsPage({
        search: debouncedSearch.trim() || undefined,
        limit: 20,
      }),
    staleTime: 30_000,
    enabled: isOpen,
  });

  const clients = (data?.items ?? []) as ClientPickerRow[];

  useEffect(() => {
    if (!value) {
      setSelectedLabel("");
      return;
    }
    const match = clients.find((c) => c.id === value);
    if (match) {
      setSelectedLabel(match.name);
    }
  }, [value, clients]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchChange = (term: string) => {
    setSearch(term);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(term);
    }, 300);
  };

  const handleToggle = useCallback(() => {
    setIsOpen((open) => {
      const next = !open;
      if (next) {
        setSearch("");
        setDebouncedSearch("");
      }
      return next;
    });
  }, []);

  const handleSelect = (client: ClientPickerRow | null) => {
    if (!client) {
      onChange("", null);
      setSelectedLabel("");
    } else {
      onChange(client.id, client);
      setSelectedLabel(client.name);
    }
    setIsOpen(false);
    setSearch("");
    setDebouncedSearch("");
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        className={`${DASHBOARD_INPUT_FIELD_10} text-left flex items-center justify-between`}
      >
        <span className={selectedLabel ? "text-white" : "text-white/40"}>
          {selectedLabel || placeholder}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 rounded-[10px] bg-[#1E1E1E] border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="p-2 border-b border-white/10">
            <input
              type="search"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search clients…"
              className="w-full rounded-[8px] bg-[#141414] px-3 py-2 text-caption text-white placeholder:text-white/40 focus:outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {showClearOption && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`w-full px-4 py-3 text-body text-left transition-colors ${
                  !value ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
                }`}
              >
                {placeholder}
              </button>
            )}
            {loading && <DropdownRowsSkeleton rows={3} />}
            {!loading &&
              clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelect(client)}
                  className={`w-full px-4 py-3 text-body text-left transition-colors ${
                    client.id === value
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="block">{client.name}</span>
                  {client.email ? (
                    <span className="block text-caption text-white/40 truncate">{client.email}</span>
                  ) : null}
                </button>
              ))}
            {!loading && clients.length === 0 && (
              <p className="px-4 py-3 text-caption text-white/40">No clients found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
