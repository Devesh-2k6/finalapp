"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MapPin,
  Search,
  Locate,
  X,
  Loader2,
  Navigation,
  Sparkles,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CustomerLocation,
  POPULAR_CITIES,
  searchNominatimLocations,
  setStoredLocation,
} from "@/lib/customer-location";
import { fetchIpGeolocation } from "@/lib/geolocation";

interface CustomerLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCity?: string | null;
  currentLat?: number;
  currentLng?: number;
  onSelectLocation: (loc: CustomerLocation) => void;
}

export function CustomerLocationModal({
  isOpen,
  onClose,
  currentCity,
  currentLat,
  currentLng,
  onSelectLocation,
}: CustomerLocationModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [gpsStatusMessage, setGpsStatusMessage] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear transient status message when modal reopens
  useEffect(() => {
    if (isOpen) {
      setGpsStatusMessage(null);
    }
  }, [isOpen]);

  // Listen for real-time location changes injected from native Expo Go
  useEffect(() => {
    const handler = (e: any) => {
      const loc = e.detail as CustomerLocation;
      if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
        setIsLocatingGps(false);
        if (loc.source === "gps") {
          handleSelect(loc);
        }
      }
    };
    window.addEventListener("EXPIRYGO_LOCATION_CHANGED", handler);
    return () => window.removeEventListener("EXPIRYGO_LOCATION_CHANGED", handler);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchNominatimLocations(searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 320);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  const handleSelect = (loc: CustomerLocation) => {
    setStoredLocation(loc);
    onSelectLocation(loc);
    onClose();
  };

  const handleDetectGps = () => {
    setGpsStatusMessage(null);
    setIsLocatingGps(true);

    // If running inside React Native WebView (Expo Go), trigger native hardware GPS directly
    if (typeof window !== "undefined" && (window as any).ReactNativeWebView) {
      try {
        (window as any).ReactNativeWebView.postMessage(
          JSON.stringify({ type: "REQUEST_DEVICE_LOCATION" })
        );
      } catch {}
    }

    const safetyTimer = setTimeout(() => {
      setIsLocatingGps(false);
      setGpsStatusMessage("GPS detection timed out. Please choose your city below or search your area.");
    }, 6500);

    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          clearTimeout(safetyTimer);
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          let city = "My Current Location";
          let address = `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            );
            if (res.ok) {
              const data = await res.json();
              if (data && data.address) {
                const sub =
                  data.address.suburb ||
                  data.address.neighbourhood ||
                  data.address.residential ||
                  data.address.village;
                const c =
                  data.address.city ||
                  data.address.town ||
                  data.address.county ||
                  data.address.state_district;
                city = sub && c ? `${sub}, ${c}` : c || sub || "Live GPS Location";
                address = data.display_name || address;
              }
            }
          } catch {
            // fallback to default
          }

          setIsLocatingGps(false);
          handleSelect({
            lat,
            lng,
            city,
            address,
            source: "gps",
          });
        },
        (err) => {
          clearTimeout(safetyTimer);
          setIsLocatingGps(false);
          console.warn("GPS error:", err);
          setGpsStatusMessage("GPS permission not granted or location unavailable. Please select your city below.");
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
      );
    } else {
      clearTimeout(safetyTimer);
      setIsLocatingGps(false);
      setGpsStatusMessage("Geolocation is not supported. Please select your city below.");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl shadow-2xl p-5 sm:p-6 overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                <MapPin size={20} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                  Change Location
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Find surplus grocery deals & live bakeries near you
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search Box */}
          <div className="mt-4 relative">
            <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 focus-within:border-purple-600 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
              <Search size={18} className="text-zinc-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search area, landmark, pincode, or city..."
                className="w-full bg-transparent text-sm font-semibold text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400"
                autoFocus
              />
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Use Live Device Location Button */}
          <button
            type="button"
            onClick={handleDetectGps}
            disabled={isLocatingGps}
            className="mt-3 w-full flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50/70 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-200/80 dark:border-purple-800/60 text-purple-900 dark:text-purple-200 hover:border-purple-400 transition-all active:scale-[0.99] cursor-pointer group shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/30 group-hover:scale-105 transition-transform">
                {isLocatingGps ? (
                  <Loader2 size={16} className="animate-spin text-white" />
                ) : (
                  <Locate size={16} />
                )}
              </div>
              <div className="text-left">
                <span className="text-xs sm:text-sm font-black block">
                  {isLocatingGps ? "Detecting Live Coordinates..." : "Use Current Location"}
                </span>
                <span className="text-[11px] text-purple-700/80 dark:text-purple-300 font-medium">
                  Using device GPS or local network
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-zinc-800 border border-purple-200/50 dark:border-purple-800/40">
              Detect GPS
            </span>
          </button>

          {/* GPS Status / Guidance Message */}
          {gpsStatusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2 shadow-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Navigation size={14} className="text-amber-600 shrink-0" />
                <span className="font-semibold text-[11px] leading-snug">{gpsStatusMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setGpsStatusMessage(null)}
                className="p-1 hover:bg-amber-200/50 dark:hover:bg-amber-800/50 rounded-lg shrink-0 text-amber-700 dark:text-amber-300"
                aria-label="Dismiss message"
              >
                <X size={13} />
              </button>
            </motion.div>
          )}

          {/* Search Results List or Popular Cities */}
          <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-3.5 scrollbar-thin">
            {isSearching && (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-zinc-400">
                <Loader2 size={24} className="animate-spin text-purple-600" />
                <span className="text-xs font-medium">Searching matching locations...</span>
              </div>
            )}

            {!isSearching && searchResults.length > 0 && (
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-2 block">
                  Search Results ({searchResults.length})
                </span>
                <div className="space-y-1.5">
                  {searchResults.map((res, i) => (
                    <button
                      key={`${res.lat}_${res.lng}_${i}`}
                      type="button"
                      onClick={() => handleSelect(res)}
                      className="w-full flex items-start gap-3 p-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800/70 border border-transparent hover:border-zinc-200/80 dark:hover:border-zinc-700 text-left transition cursor-pointer group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <MapPin size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white block truncate">
                          {res.city}
                        </span>
                        {res.address && (
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block truncate">
                            {res.address}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isSearching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
              <div className="py-6 text-center text-zinc-400 space-y-1">
                <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                  No matching locations found for "{searchQuery}"
                </p>
                <p className="text-[11px]">
                  Try searching by your city name (e.g. "Chennai", "Bengaluru", "Mumbai") or pick a popular city below.
                </p>
              </div>
            )}

            {/* Popular Cities Grid */}
            {(!searchQuery || searchResults.length === 0) && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                    Popular Cities & Neighborhoods
                  </span>
                  <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                    1-Tap Teleport
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {POPULAR_CITIES.map((city) => {
                    const isCurrent =
                      (currentCity && currentCity.toLowerCase().includes(city.city.toLowerCase().split(" ")[0])) ||
                      (currentLat &&
                        currentLng &&
                        Math.abs(currentLat - city.lat) < 0.05 &&
                        Math.abs(currentLng - city.lng) < 0.05);

                    return (
                      <button
                        key={city.city}
                        type="button"
                        onClick={() => handleSelect(city)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition cursor-pointer active:scale-95 ${
                          isCurrent
                            ? "bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-600/30"
                            : "bg-zinc-50 hover:bg-zinc-100/90 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 border-zinc-200/70 dark:border-zinc-700/60 text-zinc-800 dark:text-zinc-200 hover:border-purple-300 dark:hover:border-purple-600"
                        }`}
                      >
                        <Building2
                          size={14}
                          className={isCurrent ? "text-white shrink-0" : "text-purple-600 dark:text-purple-400 shrink-0"}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-bold block truncate leading-tight">
                            {city.city}
                          </span>
                        </div>
                        {isCurrent && (
                          <CheckCircle2 size={12} className="text-white shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
