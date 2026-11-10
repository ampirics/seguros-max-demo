// Mock de categorías para autocompletado y selección
export const mockCategories = [
  { code: "101", name: "Electrónica" },
  { code: "102", name: "Ropa y Moda" },
  { code: "103", name: "Hogar y Cocina" },
  { code: "104", name: "Juguetes" },
  { code: "105", name: "Deportes" },
  { code: "106", name: "Belleza y Salud" },
  { code: "107", name: "Automotriz" },
  { code: "108", name: "Libros" },
  { code: "109", name: "Mascotas" },
  { code: "110", name: "Herramientas" }
];

// Simula un fetch (puedes reemplazar por fetch real a futuro)
export async function fetchCategoriesMock(query?: string) {
  if (!query) return mockCategories;
  return mockCategories.filter(cat =>
    cat.code.includes(query) || cat.name.toLowerCase().includes(query.toLowerCase())
  );
}
