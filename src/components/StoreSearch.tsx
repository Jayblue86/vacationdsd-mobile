import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';

export type StoreSearchResult = {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lon: number;
};

type Props = {
  onSelect: (result: StoreSearchResult) => void;
  initialValue?: string;
};

export function StoreSearch({ onSelect, initialValue = '' }: Props) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<StoreSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8`
      );
      if (!res.ok) {
        setResults([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      const mapped: StoreSearchResult[] = (data.features || [])
        .filter((f: any) => f.properties && f.properties.name)
        .map((f: any) => {
          const p = f.properties;
          const street = [p.street, p.housenumber].filter(Boolean).join(' ');
          return {
            name: p.name,
            address: street,
            city: p.city || p.town || p.village || p.county || '',
            state: p.state || '',
            zip: p.postcode || '',
            lat: f.geometry?.coordinates?.[1] ?? 0,
            lon: f.geometry?.coordinates?.[0] ?? 0,
          };
        });
      setResults(mapped);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      search(query);
      setShowResults(true);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(result: StoreSearchResult) {
    onSelect(result);
    setQuery(result.name);
    setShowResults(false);
    setHighlightedIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showResults || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setShowResults(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            if (results.length > 0) setShowResults(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search for a store name (e.g. Walmart, Kroger...)"
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900 placeholder:text-slate-400"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {results.map((result, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={`w-full flex items-start gap-3 p-3 text-left transition-colors border-b border-slate-50 last:border-0 ${
                highlightedIndex === idx ? 'bg-emerald-50' : 'hover:bg-slate-50'
              }`}
            >
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">{result.name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {result.address}
                  {result.address && (result.city || result.state) ? ', ' : ''}
                  {[result.city, result.state].filter(Boolean).join(', ')}
                  {result.zip ? ` ${result.zip}` : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && !loading && results.length === 0 && query.trim().length >= 3 && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl p-4 text-center">
          <p className="text-sm text-slate-500">No stores found. Try a different search term.</p>
        </div>
      )}
    </div>
  );
}
