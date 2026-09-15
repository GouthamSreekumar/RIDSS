"use client";

import React from "react";
import * as Flags from "country-flag-icons/react/3x2";
import { Flag as FallbackIcon } from "lucide-react";
import { getCountryIsoCode } from "@/lib/flags";

interface CountryFlagProps {
  country?: string;
  location?: string;
  className?: string;
}

export function CountryFlag({
  country,
  location,
  className = "w-7 h-5 rounded shadow-sm overflow-hidden shrink-0 border border-slate-700/80 inline-block align-middle",
}: CountryFlagProps) {
  const isoCode = getCountryIsoCode(country, location);

  if (isoCode && Flags[isoCode as keyof typeof Flags]) {
    const FlagComponent = Flags[isoCode as keyof typeof Flags];
    return (
      <span className={className} title={country || location || isoCode}>
        <FlagComponent className="w-full h-full object-cover" />
      </span>
    );
  }

  // Flag unmapped edge case for review in dev environment
  if (typeof window !== "undefined") {
    console.warn(`[Flag Component Warning] Unmapped flag asset: country="${country}", location="${location}", isoCode="${isoCode}"`);
  }

  return (
    <span
      className={`inline-flex items-center justify-center bg-slate-800 text-slate-400 ${className}`}
      title={country || location || "Unknown Location"}
    >
      <FallbackIcon size={12} />
    </span>
  );
}
