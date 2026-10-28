import React, { useState, useEffect, useRef } from 'react';
import { SearchResultItem } from '../types/navigation';
import { searchPlaces } from '../services/geocoding';

interface TopSearchBarProps {
  userLocation: { lat: number; lng: number } | null;
  onSelectDestination: (lat: number, lng: number, name: string) => void;
  isPinMode?: boolean;
  nightMode?: boolean;
  gpsLocked?: boolean;
  openSignal?: number;
  onStartPinMode?: () => void;
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
  gpsLocked = true,
  openSignal = 0,
  onStartPinMode,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (openSignal > 0) {
      setIsFocused(true);
      inputRef.current?.focus();
    }
  }, [openSignal]);

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
        setResults(await searchPlaces(val, userLocation));
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

  const rowCls = nightMode
    ? 'active:bg-blue-950/60 border-neutral-800/80 text-white'
    : 'active:bg-blue-50 border-slate-200 text-slate-900';
  const subCls = nightMode ? 'text-neutral-400' : 'text-slate-500';

  const row = (key: string | number, name: string, sub: string, lat: number, lng: number, right: React.ReactNode) => (
    <button
      key={key}
      onMouseDown={() => handleSelect(lat, lng, name)}
      className={`w-full text-left p-3.5 sm:p-4 flex items-center justify-between gap-3 border-b ${rowCls}`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-lg sm:text-xl font-bold truncate">{name}</div>
        <div className={`text-xs sm:text-sm truncate mt-0.5 ${subCls}`}>{sub}</div>
      </div>
      {right}
    </button>
  );

  return (
    <div ref={containerRef} className="fixed top-3 left-16 sm:left-48 right-3 sm:right-6 max-w-xl mx-auto z-1000 select-none">
      <div
        className={`relative flex items-center border-2 rounded-2xl ${
          nightMode
            ? 'bg-neutral-950/95 text-white border-neutral-700 focus-within:border-blue-500'
            : 'bg-white/95 text-slate-900 border-slate-300 focus-within:border-blue-600'
        }`}
      >
        <div className={`pl-4 pr-2 text-xl font-bold flex items-center justify-center ${nightMode ? 'text-neutral-400' : 'text-slate-500'}`}>
          🔍
        </div>
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
          className={`w-full h-16 bg-transparent text-base sm:text-lg font-bold px-2 focus:outline-none ${
            nightMode ? 'text-white placeholder-neutral-500' : 'text-slate-900 placeholder-slate-400'
          }`}
        />
        {query.length > 0 && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            aria-label="Clear destination search"
            className={`w-12 h-12 mr-2 rounded-full font-bold flex items-center justify-center text-sm shrink-0 ${
              nightMode ? 'bg-neutral-800 text-neutral-300' : 'bg-slate-200 text-slate-700'
            }`}
          >
            ✕
          </button>
        )}
        {isLoading && <div className="pr-4 text-blue-500 text-xs font-bold uppercase">Searching...</div>}
      </div>

      {isFocused && (
        <div
          className={`mt-2 border-2 rounded-2xl overflow-hidden max-h-[60vh] overflow-y-auto divide-y ${
            nightMode
              ? 'bg-neutral-950/95 border-neutral-700 divide-neutral-800 text-white'
              : 'bg-white/95 border-slate-300 divide-slate-200 text-slate-900'
          }`}
        >
          <div
            className={`px-4 py-2.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider ${
              nightMode ? 'bg-neutral-900/90 text-neutral-400' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <span>{query.trim().length >= 2 ? 'Matching Destinations' : 'Popular Destinations (Quick Drive)'}</span>
            <span className={`font-mono ${gpsLocked ? (nightMode ? 'text-emerald-400' : 'text-emerald-600') : 'text-amber-500'}`}>
              {gpsLocked ? 'GPS START: LOCKED' : 'WAITING FOR GPS'}
            </span>
          </div>

          {onStartPinMode && (
            <button
              onMouseDown={() => {
                setIsFocused(false);
                onStartPinMode();
              }}
              className={`w-full text-left p-4 text-lg sm:text-xl font-bold border-b ${nightMode ? 'text-blue-400 border-neutral-800/80' : 'text-blue-600 border-slate-200'}`}
              style={{ minHeight: 64 }}
            >
              📍 Drop a pin on the map instead
            </button>
          )}

          {results.map((item) =>
            row(
              item.id,
              item.name,
              item.subtitle,
              item.lat,
              item.lng,
              item.distanceKm !== undefined && (
                <div className="text-right shrink-0">
                  <span className={`text-base sm:text-lg font-bold font-mono ${nightMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    {item.distanceKm} km
                  </span>
                  <div className={`text-[10px] uppercase ${subCls}`}>away</div>
                </div>
              )
            )
          )}

          {query.trim().length >= 2 && results.length === 0 && !isLoading && (
            <div className={`p-5 text-center font-medium ${subCls}`}>
              No places found for &quot;{query}&quot;. Try another name or drop a PIN below.
            </div>
          )}

          {query.trim().length < 2 &&
            PRESET_DESTINATIONS.map((p, idx) =>
              row(
                idx,
                p.name,
                p.sub,
                p.lat,
                p.lng,
                <div className={`font-bold text-xl px-2 ${nightMode ? 'text-neutral-500' : 'text-slate-400'}`}>›</div>
              )
            )}
        </div>
      )}
    </div>
  );
};
