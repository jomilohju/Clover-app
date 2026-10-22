import React, { useState, useEffect, useRef } from 'react';
import { SearchResultItem } from '../types/navigation';
import { searchPlaces } from '../services/geocoding';

interface TopSearchBarProps {
  userLocation: { lat: number; lng: number } | null;
  onSelectDestination: (lat: number, lng: number, name: string) => void;
  isPinMode?: boolean;
  nightMode?: boolean;
}

const PRESET_DESTINATIONS = [
  { name: 'Ikeja City Mall', lat: 6.6198, lng: 3.3582, sub: 'Alausa, Ikeja, Lagos' },
  { name: 'Eko Hotel & Suites', lat: 6.4283, lng: 3.4219, sub: 'Adetokunbo Ademola, Victoria Island' },
  { name: 'Lekki Phase 1 Gate', lat: 6.4389, lng: 3.4735, sub: 'Admiralty Way, Lekki' },
  { name: 'Murtala Muhammed Airport (MMA2)', lat: 6.5772, lng: 3.3211, sub: 'Ikeja, Lagos' },
  { name: 'National Stadium', lat: 6.4957, lng: 3.3644, sub: 'Surulere, Lagos' },
  { name: 'Marina Terminal & CMS', lat: 6.4528, lng: 3.3892, sub: 'Lagos Island' },
];

export const TopSearchBar: React.FC<TopSearchBarProps> = ({
  userLocation,
  onSelectDestination,
  isPinMode = false,
  nightMode = true,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const items = await searchPlaces(val, userLocation);
        setResults(items);
      } catch (err) {
        console.warn('Top search query error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 350);
  };

  const handleSelect = (lat: number, lng: number, name: string) => {
    setQuery('');
    setResults([]);
    setIsFocused(false);
    inputRef.current?.blur();
    onSelectDestination(lat, lng, name);
  };

  if (isPinMode) return null;

  return (
    <div
      ref={containerRef}
      className="fixed top-3 left-3 right-3 sm:left-6 sm:right-6 max-w-2xl mx-auto z-1000 select-none"
    >
      {/* Search Input Box */}
      <div
        className={`relative flex items-center backdrop-blur-md border-2 rounded-2xl shadow-xl transition-all ${
          nightMode
            ? 'bg-neutral-950/95 text-white border-neutral-700 focus-within:border-blue-500'
            : 'bg-white/95 text-slate-900 border-slate-300 focus-within:border-blue-600 shadow-lg'
        }`}
      >
        {/* Search Icon */}
        <div
          className={`pl-4 pr-2 text-xl font-bold flex items-center justify-center ${
            nightMode ? 'text-neutral-400' : 'text-slate-500'
          }`}
        >
          🔍
        </div>

        {/* Input for Destination (reduced height by ~20%) */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsFocused(true)}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Where to? Enter destination..."
          aria-label="Enter destination"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className={`w-full h-11 sm:h-13 bg-transparent text-base sm:text-lg font-bold px-2 focus:outline-none ${
            nightMode
              ? 'text-white placeholder-neutral-500'
              : 'text-slate-900 placeholder-slate-400'
          }`}
        />

        {/* Clear Button */}
        {query.length > 0 && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            aria-label="Clear destination search"
            className={`w-8 h-8 mr-2 rounded-full font-bold flex items-center justify-center text-sm shrink-0 transition-colors ${
              nightMode
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            ✕
          </button>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="pr-4 text-blue-500 text-xs font-bold uppercase animate-pulse">
            Searching...
          </div>
        )}
      </div>

      {/* Dropdown Suggestions & Results */}
      {isFocused && (
        <div
          className={`mt-2 backdrop-blur-xl border-2 rounded-2xl shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto divide-y transition-colors ${
            nightMode
              ? 'bg-neutral-950/98 border-neutral-700 divide-neutral-800 text-white'
              : 'bg-white/98 border-slate-300 divide-slate-200 text-slate-900'
          }`}
        >
          {/* Header indicator */}
          <div
            className={`px-4 py-2.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider ${
              nightMode ? 'bg-neutral-900/90 text-neutral-400' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <span>{query.trim().length >= 2 ? 'Matching Destinations' : 'Popular Destinations (Quick Drive)'}</span>
            <span className={nightMode ? 'text-emerald-400 font-mono' : 'text-emerald-600 font-mono'}>
              GPS START: LOCKED
            </span>
          </div>

          {/* Live Search Results */}
          {results.length > 0 &&
            results.map((item) => (
              <button
                key={item.id}
                onMouseDown={() => handleSelect(item.lat, item.lng, item.name)}
                className={`w-full text-left p-3.5 sm:p-4 transition-colors flex items-center justify-between gap-3 border-b ${
                  nightMode
                    ? 'hover:bg-neutral-900 active:bg-blue-950/60 border-neutral-800/80 text-white'
                    : 'hover:bg-slate-50 active:bg-blue-50 border-slate-200 text-slate-900'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-lg sm:text-xl font-bold truncate">
                    {item.name}
                  </div>
                  <div
                    className={`text-xs sm:text-sm truncate mt-0.5 ${
                      nightMode ? 'text-neutral-400' : 'text-slate-500'
                    }`}
                  >
                    {item.subtitle}
                  </div>
                </div>
                {item.distanceKm !== undefined && (
                  <div className="text-right shrink-0">
                    <span
                      className={`text-base sm:text-lg font-bold font-mono ${
                        nightMode ? 'text-blue-400' : 'text-blue-600'
                      }`}
                    >
                      {item.distanceKm} km
                    </span>
                    <div
                      className={`text-[10px] uppercase ${
                        nightMode ? 'text-neutral-400' : 'text-slate-500'
                      }`}
                    >
                      away
                    </div>
                  </div>
                )}
              </button>
            ))}

          {/* Empty Search Notice */}
          {query.trim().length >= 2 && results.length === 0 && !isLoading && (
            <div
              className={`p-5 text-center font-medium ${
                nightMode ? 'text-neutral-400' : 'text-slate-500'
              }`}
            >
              No places found for &quot;{query}&quot;. Try another name or drop a PIN below.
            </div>
          )}

          {/* Popular Presets when query is short */}
          {query.trim().length < 2 &&
            PRESET_DESTINATIONS.map((preset, idx) => (
              <button
                key={idx}
                onMouseDown={() => handleSelect(preset.lat, preset.lng, preset.name)}
                className={`w-full text-left p-3.5 sm:p-4 transition-colors flex items-center justify-between gap-3 border-b ${
                  nightMode
                    ? 'hover:bg-neutral-900 active:bg-blue-950/60 border-neutral-800/80 text-white'
                    : 'hover:bg-slate-50 active:bg-blue-50 border-slate-200 text-slate-900'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-lg sm:text-xl font-bold truncate">
                    {preset.name}
                  </div>
                  <div
                    className={`text-xs sm:text-sm truncate mt-0.5 ${
                      nightMode ? 'text-neutral-400' : 'text-slate-500'
                    }`}
                  >
                    {preset.sub}
                  </div>
                </div>
                <div
                  className={`font-bold text-xl px-2 ${
                    nightMode ? 'text-neutral-500' : 'text-slate-400'
                  }`}
                >
                  ›
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
};
