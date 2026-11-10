import React, { useState } from "react";
import { Input } from "./input";
import { Badge } from "./badge";

export interface MultiComboboxOption {
  value: string;
  label: string;
}

interface MultiComboboxProps {
  options: MultiComboboxOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
}

export const MultiCombobox: React.FC<MultiComboboxProps> = ({
  options,
  value,
  onChange,
  placeholder = "Buscar...",
  label,
}) => {
  const [search, setSearch] = useState("");
  const filtered = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(search.toLowerCase()) &&
      !value.includes(opt.value)
  );

  return (
    <div>
      {label && <label className="block mb-1 font-medium">{label}</label>}
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((val) => {
          const opt = options.find((o) => o.value === val);
          if (!opt) return null;
          return (
            <Badge
              key={val}
              className="bg-blue-100 text-blue-800 px-2 py-1 rounded flex items-center gap-1"
            >
              {opt.label}
              <button
                type="button"
                className="ml-1 text-xs text-red-500 hover:text-red-700"
                onClick={() => onChange(value.filter((v) => v !== val))}
                aria-label="Quitar"
              >
                ×
              </button>
            </Badge>
          );
        })}
      </div>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        className="mb-2"
      />
      <div className="max-h-40 overflow-y-auto border rounded bg-white shadow">
        {filtered.length === 0 && (
          <div className="p-2 text-gray-400 text-sm">Sin resultados</div>
        )}
        {filtered.map((opt) => (
          <div
            key={opt.value}
            className="p-2 hover:bg-blue-50 cursor-pointer text-sm"
            onClick={() => onChange([...value, opt.value])}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
};
