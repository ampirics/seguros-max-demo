import { useState, useEffect } from "react";
import { fetchCategoriesMock } from "@/app/api/categories-mock";
import { Input } from "@/components/ui/input";

interface CategoryCodeAutocompleteProps {
  value: string;
  onChange: (code: string) => void;
}

export function CategoryCodeAutocomplete({ value, onChange }: CategoryCodeAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<{ code: string; name: string }[]>([]);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!query) { setResults([]); return; }
    fetchCategoriesMock(query).then(setResults);
  }, [query]);
  return (
    <div className="relative">
      <Input
        className="w-full"
        placeholder="Código de categoría (autocompleta)"
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setShow(true); }}
        onFocus={() => setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 150)}
      />
      {show && results.length > 0 && (
        <div className="absolute z-30 bg-white border rounded shadow w-full max-h-48 overflow-y-auto">
          {results.map(cat => (
            <div
              key={cat.code}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex justify-between"
              onMouseDown={() => { onChange(cat.code); setQuery(cat.code); setShow(false); }}
            >
              <span>{cat.name}</span>
              <span className="text-xs text-gray-500">{cat.code}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
