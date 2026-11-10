"use client";
import { fetchCategoriesMock } from "@/app/api/categories-mock";
import { CategoryCodeAutocomplete } from "./CategoryCodeAutocomplete";
import { apiClient } from "@/lib/api-client";
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useAdmin } from "@/contexts/admin-context";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/admin-layout";
import Link from "next/link";

interface ProductAutocompleteProps {
  selected: any[];
  onChange: (prods: any[]) => void;
}

interface DraggableProductListProps {
  products: any[];
  onReorder: (prods: any[]) => void;
}

// --- Autocompletado visual de productos destacados ---
function ProductAutocomplete({ selected, onChange }: ProductAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  useEffect(() => {
    if (!query) { setResults([]); return; }
    let active = true;
  // Endpoint de admin (JWT + empresa activa). getProducts usa la x-api-key de la tienda,
  // que es de UNA empresa fija: por eso el selector ofrecía productos de otra empresa.
  apiClient.getAdminProducts({ search: query, limit: 8 }).then(res => {
      if (active) setResults(res || []);
    });
    return () => { active = false; };
  }, [query]);
  const addProduct = (prod: any) => {
    if (!selected.find(p => p.id === prod.id)) onChange([...selected, prod]);
    setQuery("");
    setResults([]);
  };
  const removeProduct = (id: string) => onChange(selected.filter(p => p.id !== id));
  return (
    <div>
      <input
        className="w-full border rounded px-3 py-2 mb-2"
        placeholder="Buscar por nombre o SKU"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      {results.length > 0 && (
        <div className="bg-white border rounded shadow absolute z-20 w-full max-h-60 overflow-y-auto">
          {results.map(prod => (
            <div key={prod.id} className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50 cursor-pointer" onClick={() => addProduct(prod)}>
              <img src={prod.image || "/placeholder.svg"} alt={prod.name} className="w-10 h-10 object-cover rounded" />
              <div className="flex-1">
                <div className="font-medium text-sm">{prod.name}</div>
                <div className="text-xs text-gray-500">SKU: {prod.sku}</div>
              </div>
              <div className="text-xs font-bold text-primary">${prod.price}</div>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-2">
        {selected.map(prod => (
          <div key={prod.id} className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded text-xs">
            <img src={prod.image || "/placeholder.svg"} alt={prod.name} className="w-5 h-5 object-cover rounded" />
            {prod.name}
            <button className="ml-1 text-red-500" onClick={() => removeProduct(prod.id)}>&times;</button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface DraggableProductListProps {
  products: any[];
  onReorder: (prods: any[]) => void;
  badgeColorDefault?: string;
  badgeTextColorDefault?: string;
}

// --- Drag & drop visual para reordenar productos destacados ---
function DraggableProductList({ products, onReorder, badgeColorDefault = '#4273c4', badgeTextColorDefault = '#fff' }: DraggableProductListProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) return;
    const reordered = [...products];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    setDragIdx(idx);
    onReorder(reordered);
  };
  const handleDragEnd = () => setDragIdx(null);
  if (!products.length) return <div className="text-gray-400 text-center py-8">Agrega productos destacados para ver la vista previa</div>;
  const handleBadgeChange = (idx: number, value: string) => {
    const updated = products.map((p, i) => i === idx ? { ...p, badge: value } : p);
    onReorder(updated);
  };
  const handleBadgeColorChange = (idx: number, color: string) => {
    const updated = products.map((p, i) => i === idx ? { ...p, badgeColor: color } : p);
    onReorder(updated);
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {products.map((product, idx) => (
        <div
          key={product.id}
          className={`relative group bg-white rounded-lg shadow p-2 transition-all ${dragIdx === idx ? 'ring-2 ring-primary' : ''}`}
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragOver={e => { e.preventDefault(); handleDragOver(idx); }}
          onDragEnd={handleDragEnd}
        >
          <div className="relative overflow-hidden rounded-t-lg">
            <img
              src={product.image || "/placeholder.svg"}
              alt={product.name}
              className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <input
              className="absolute top-3 left-3 text-xs px-2 py-1 rounded outline-none border-none w-24"
              style={{
                zIndex: 10,
                background: (product.badgeColor !== undefined && product.badgeColor !== "") ? product.badgeColor : badgeColorDefault,
                color: (product.badgeTextColor !== undefined && product.badgeTextColor !== "") ? product.badgeTextColor : badgeTextColorDefault
              }}
              value={product.badge || ""}
              placeholder="Badge"
              onChange={e => handleBadgeChange(idx, e.target.value)}
            />
            <input
              type="color"
              className="absolute top-3 left-28 w-6 h-6 p-0 border-0 outline-none cursor-pointer"
              style={{ zIndex: 11, background: 'transparent' }}
              value={product.badgeColor || badgeColorDefault}
              onChange={e => handleBadgeColorChange(idx, e.target.value)}
              title="Color del badge"
            />
            <input
              type="color"
              className="absolute top-3 left-36 w-6 h-6 p-0 border-0 outline-none cursor-pointer"
              style={{ zIndex: 12, background: 'transparent' }}
              value={product.badgeTextColor || badgeTextColorDefault}
              onChange={e => {
                const updated = products.map((p, i) => i === idx ? { ...p, badgeTextColor: e.target.value } : p);
                onReorder(updated);
              }}
              title="Color del texto"
            />
          </div>
          <div className="p-2">
            <h4 className="font-bold text-base mb-1 text-gray-900">{product.name}</h4>
            <div className="flex items-center mb-2">
              <span className="flex items-center text-yellow-500 mr-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.178c.969 0 1.371 1.24.588 1.81l-3.385 2.46a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.386-2.46a1 1 0 00-1.175 0l-3.386 2.46c-.784.57-1.838-.196-1.539-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.045 9.394c-.783-.57-.38-1.81.588-1.81h4.178a1 1 0 00.95-.69l1.286-3.967z"/></svg>
                <span className="ml-1 text-sm font-medium">{product.rating || 5}</span>
              </span>
              <span className="ml-2 text-xs text-gray-500">({product.reviews || 0} reviews)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-primary">${product.price}</span>
              {product.originalPrice && (
                <span className="text-xs text-gray-500 line-through ml-2">${product.originalPrice}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
// --- Componente de vista previa tipo slider ---
const HeroSliderPreview = ({ slides }: { slides: any[] }) => {
  const [current, setCurrent] = useState(0);
  if (!slides.length) {
    return <div className="text-gray-400 text-center py-12">Agrega slides para ver la vista previa</div>;
  }
  const slide = slides[current];
  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="relative w-full h-56 md:h-64 rounded-2xl overflow-hidden bg-gradient-to-r from-primary to-[#6fa8ff] flex items-center justify-center">
        <img
          src={slide?.image || "/placeholder.jpg"}
          alt="Slide Hero Preview"
          className="object-cover w-full h-full absolute inset-0 opacity-60"
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 text-center w-full px-8">
          <div className="text-2xl md:text-3xl font-extrabold text-white drop-shadow mb-2">{slide?.title || 'Título del Slide'}</div>
          <div className="text-lg md:text-xl text-white/90 mb-4">{slide?.subtitle || 'Subtítulo del Slide'}</div>
          {slide?.cta?.text && (
            <a
              href={slide?.cta?.link || "#"}
              className="inline-block bg-white text-primary font-bold px-6 py-2 rounded-full shadow hover:bg-blue-50 transition"
              target="_blank"
              rel="noopener noreferrer"
            >
              {slide?.cta?.text}
            </a>
          )}
        </div>
        {/* Flechas navegación */}
        {slides.length > 1 && (
          <>
            <button onClick={() => setCurrent((c) => (c === 0 ? slides.length - 1 : c - 1))} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-primary rounded-full p-2 shadow transition"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" stroke="#4273c4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
            <button onClick={() => setCurrent((c) => (c === slides.length - 1 ? 0 : c + 1))} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-primary rounded-full p-2 shadow transition"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="#4273c4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          </>
        )}
      </div>
      {/* Indicadores */}
      {slides.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {slides.map((_: any, i: number) => (
            <button
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${i === current ? 'bg-primary' : 'bg-gray-300'}`}
              onClick={() => setCurrent(i)}
              aria-label={`Ir al slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
// Utilidad para tooltips
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useStoreConfig } from "@/hooks/use-store-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Settings, Layout, Layers, List, Info, Plus, Trash2, Star, Store, Link2, Eye, RefreshCw, CreditCard, CheckCircle, XCircle, AlertCircle, MessageCircle, Palette } from "lucide-react";
import { MARCA_BASE } from "@/lib/marca";

const TABS = [
  { key: "promotion", label: "Promoción", icon: Info },
  { key: "hero", label: "Hero", icon: Layout },
  { key: "featured", label: "Destacados", icon: Star },
  { key: "categories", label: "Categorías", icon: Layers },
  { key: "store", label: "Tienda", icon: Store },
  { key: "payment-pages", label: "Páginas de Pago", icon: CreditCard },
  { key: "footer", label: "Footer", icon: Link2 },
  { key: "cms", label: "CMS", icon: Settings },
];





function StoreConfigAdmin() {
  const { config, loading, saving: hookSaving, error, saveError, saveConfig, reload, setError, loadedCompanyId } = useStoreConfig();
  const [tab, setTab] = useState<string>(TABS[0].key);
  const [localConfig, setLocalConfig] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // Detectar cambios locales para activar el botón Guardar
  useEffect(() => {
    setIsDirty(JSON.stringify(localConfig) !== JSON.stringify(config));
  }, [localConfig, config]);

  // Avisar al salir con cambios sin guardar.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);


  // Handlers para slides Hero
  // Drag & drop y duplicar slide
  const reorderSlide = (from: number, to: number) => {
    setLocalConfig((prev: any) => {
      const slides = [...(prev.heroSlides ?? [])];
      const [moved] = slides.splice(from, 1);
      slides.splice(to, 0, moved);
      return { ...prev, heroSlides: slides };
    });
  };
  const duplicateSlide = (idx: number) => {
    setLocalConfig((prev: any) => {
      const slides = [...(prev.heroSlides ?? [])];
      slides.splice(idx + 1, 0, { ...slides[idx], title: slides[idx].title + ' (Copia)' });
      return { ...prev, heroSlides: slides };
    });
  };
  const updateHeroSlide = (idx: number, value: any) => {
    setLocalConfig((prev: any) => ({
      ...prev,
      heroSlides: (prev.heroSlides ?? []).map((slide: any, i: number) => (i === idx ? { ...slide, ...value } : slide)),
    }));
  };
  const addHeroSlide = () => {
    setLocalConfig((prev: any) => ({
      ...prev,
      heroSlides: [
        ...(prev.heroSlides ?? []),
        { image: '', title: '', subtitle: '', cta: { text: '', link: '' } },
      ],
    }));
  };
  const removeHeroSlide = (idx: number) => {
    if (window.confirm('¿Eliminar este slide?')) {
      setLocalConfig((prev: any) => ({
        ...prev,
        heroSlides: (prev.heroSlides ?? []).filter((_: any, i: number) => i !== idx),
      }));
    }
  };

  // Handlers para categorías



  // Drag & drop y duplicar slide
  const updateCategory = (idx: number, value: any) => {
    setLocalConfig((prev: any) => ({
      ...prev,
      categories: (prev.categories ?? []).map((cat: any, i: number) => (i === idx ? { ...cat, ...value } : cat)),
    }));
  };
  const addCategory = () => {
    setLocalConfig((prev: any) => ({
      ...prev,
      categories: [
        ...(prev.categories ?? []),
        { name: '', image: '', count: '' },
      ],
    }));
  };
  const removeCategory = (idx: number) => {
    if (window.confirm('¿Eliminar esta categoría?')) {
      setLocalConfig((prev: any) => ({
        ...prev,
        categories: (prev.categories ?? []).filter((_: any, i: number) => i !== idx),
      }));
    }
  };

  if (loading) return <div className="p-8 text-blue-500" role="status">Cargando configuración...</div>;
  if (error) return (
    <div className="p-8 text-red-600" role="alert">
      <p>{error}</p>
      <Button variant="outline" className="mt-3" onClick={reload}>Reintentar</Button>
    </div>
  );
  if (!localConfig) return <div className="p-8 text-gray-500">Sin datos de configuración</div>;
  // Header superior premium
  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      <header className="bg-white shadow flex items-center px-8 py-4 gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="bg-primary rounded-xl p-2 flex items-center justify-center">
            <img src={MARCA_BASE.logo} alt={MARCA_BASE.nombre} className="h-9 w-auto" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary leading-none">{MARCA_BASE.nombre}</div>
            <div className="text-sm text-gray-500">Configuración de Homepage</div>
          </div>
        </div>
        <div className="flex-1" />
        {isDirty && (
          <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-4 py-1 rounded-full text-sm font-medium mr-2">
            <Info className="w-4 h-4" /> Cambios sin guardar
          </div>
        )}
        {/* Sin «Vista Previa»: no hacía nada. «Descartar» vuelve a lo guardado
            (antes «Resetear» no cambiaba nada en pantalla). */}
        <Button variant="ghost" className="flex items-center gap-2" onClick={() => {
          if (confirm("¿Descartar los cambios sin guardar?")) setLocalConfig(config);
        }} disabled={!isDirty || hookSaving}><RefreshCw className="w-5 h-5" />Descartar</Button>
        <Button className="bg-primary hover:bg-primary/90 text-white font-bold px-6 py-2 ml-2" onClick={async () => {
          setSaving(true);
          const ok = await saveConfig(localConfig);
          setSaving(false);
          if (!ok) toast.error("No se pudo guardar. Revisa el aviso en la parte superior.");
          if (ok) {
            setSuccess(true);
            toast.success("¡Configuración guardada correctamente!");
            setTimeout(() => setSuccess(false), 2000);
            setError(null);
          }
        }} disabled={saving || hookSaving || !isDirty || !loadedCompanyId}><span className="flex items-center gap-2"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M5 12.5V17a2 2 0 002 2h10a2 2 0 002-2v-4.5M12 15V5m0 0l-3.5 3.5M12 5l3.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Guardar Cambios</span></Button>
      </header>

      {/* Tabs premium */}
      <nav className="flex justify-center gap-2 bg-transparent py-4 px-2 sticky top-[72px] z-20">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`flex items-center gap-2 px-6 py-2 rounded-full font-semibold text-base shadow-sm transition-all duration-150 border-2 ${tab === t.key ? 'bg-gradient-to-r from-primary to-[#6fa8ff] text-white border-primary' : 'bg-white text-primary border-transparent hover:bg-blue-50'}`}
            onClick={() => setTab(t.key)}
            type="button"
          >
            <t.icon className="w-5 h-5" />
            {t.label}
          </button>
        ))}
      </nav>

      <main className="max-w-6xl mx-auto py-8 px-4">
        {saveError && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>{saveError}</span>
            <Button variant="outline" size="sm" onClick={() => {
              if (!isDirty || confirm("Recargar descarta tus cambios sin guardar. ¿Continuar?")) reload();
            }}>Recargar</Button>
          </div>
        )}
        {/* Feedback visual */}
        {success && <div className="mb-4 text-green-600 font-semibold text-center">¡Configuración guardada!</div>}
        {/* Sección: Promoción */}
        {tab === "promotion" && (
          <section className="py-6 px-2">
            <h2 className="text-3xl font-extrabold text-primary text-center mb-2">Barra de Promoción</h2>
            <p className="text-center text-lg text-gray-500 mb-8">Configura el mensaje promocional que aparece en la parte superior de tu tienda</p>
            <div className="flex flex-col md:flex-row gap-10 w-full px-2 md:px-8 xl:px-16">
              {/* Configuración */}
              <div className="flex-[2] bg-white rounded-2xl shadow p-8">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-5 h-5 text-primary" />
                  <span className="font-bold text-lg">Configuración</span>
                </div>
                <div className="text-gray-500 text-sm mb-4">Personaliza el contenido y apariencia de la barra promocional</div>
                <div className="mb-4">
                  <label className="block font-semibold mb-1">Texto de promoción</label>
                  <Input
                    className="w-full text-base"
                    value={localConfig.promotionBanner?.text || ""}
                    onChange={e => setLocalConfig((prev: any) => ({ ...prev, promotionBanner: { ...prev.promotionBanner, text: e.target.value } }))}
                    placeholder="ENVÍOS GRATIS POR COMPRAS SUPERIORES A $50"
                  />
                </div>
                <div className="flex gap-4 mb-4">
                  <div>
                    <label className="block font-semibold mb-1">Color de fondo</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        className="w-10 h-10 rounded border border-gray-200"
                        value={localConfig.promotionBanner?.bgColor || "#3e1560"}
                        onChange={e => setLocalConfig((prev: any) => ({ ...prev, promotionBanner: { ...prev.promotionBanner, bgColor: e.target.value } }))}
                      />
                      <Input
                        className="w-24 text-center"
                        value={localConfig.promotionBanner?.bgColor || "#3e1560"}
                        onChange={e => setLocalConfig((prev: any) => ({ ...prev, promotionBanner: { ...prev.promotionBanner, bgColor: e.target.value } }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Color del texto</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        className="w-10 h-10 rounded border border-gray-200"
                        value={localConfig.promotionBanner?.textColor || "#ffffff"}
                        onChange={e => setLocalConfig((prev: any) => ({ ...prev, promotionBanner: { ...prev.promotionBanner, textColor: e.target.value } }))}
                      />
                      <Input
                        className="w-24 text-center"
                        value={localConfig.promotionBanner?.textColor || "#ffffff"}
                        onChange={e => setLocalConfig((prev: any) => ({ ...prev, promotionBanner: { ...prev.promotionBanner, textColor: e.target.value } }))}
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-[#f5f7fa] rounded-xl p-4 flex items-center gap-3 mt-4">
                  <label className="font-semibold flex-1">Mostrar barra de promoción</label>
                  <button
                    type="button"
                    className={`w-12 h-7 rounded-full transition-colors duration-200 flex items-center ${localConfig.promotionBanner?.enabled ? 'bg-primary' : 'bg-gray-300'}`}
                    onClick={() => setLocalConfig((prev: any) => ({ ...prev, promotionBanner: { ...prev.promotionBanner, enabled: !prev.promotionBanner?.enabled } }))}
                  >
                    <span className={`block w-6 h-6 bg-white rounded-full shadow transform transition-transform duration-200 ${localConfig.promotionBanner?.enabled ? 'translate-x-5' : 'translate-x-0'}`}></span>
                  </button>
                  <span className="ml-2 text-sm text-gray-500">Activa o desactiva la barra promocional</span>
                </div>
              </div>
              {/* Vista Previa */}
              <div className="flex-1 bg-white rounded-2xl shadow p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-5 h-5 text-green-600" />
                  <span className="font-bold text-lg text-green-700">Vista Previa</span>
                </div>
                <div className="text-gray-500 text-sm mb-4">Así se verá tu barra de promoción</div>
                <div className="mt-6">
                  {localConfig.promotionBanner?.enabled !== false && (
                    <div
                      className="rounded-xl px-6 py-4 text-center font-bold text-xl mb-2"
                      style={{
                        background: localConfig.promotionBanner?.bgColor || '#3e1560',
                        color: localConfig.promotionBanner?.textColor || '#fff',
                        transition: 'all 0.2s',
                      }}
                    >
                      {localConfig.promotionBanner?.text || 'ENVÍOS GRATIS POR COMPRAS SUPERIORES A $50'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Sección: Hero */}
        {tab === "hero" && (
          <section className="py-16 px-2">
            <h2 className="text-3xl font-extrabold text-primary text-center mb-2">Slides Hero</h2>
            <p className="text-center text-lg text-gray-500 mb-8">Configura los slides principales del homepage</p>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 max-w-[1800px] mx-auto items-start">
              {/* Edición de slides: acordeón amigable */}
              <div className="xl:col-span-2 bg-white py-8 rounded-2xl shadow px-8">
                <div className="flex items-center gap-2 mb-2">
                  <Layout className="w-5 h-5 text-primary" />
                  <span className="font-bold text-lg">Configuración de Slides</span>
                </div>
                <div className="text-gray-500 text-sm mb-4">Agrega, edita o elimina los slides que se mostrarán en la sección principal.</div>
                <Button variant="outline" onClick={addHeroSlide} className="flex items-center gap-2 w-fit mb-6 sticky top-0 z-10"><Plus className="w-4 h-4" />Agregar Slide</Button>
                <TooltipProvider>
                  <div className="flex flex-col gap-4">
                    {(localConfig.heroSlides ?? []).map((slide: any, idx: number) => {
                      const isActive = activeSlide === idx;
                      return (
                        <Card key={idx} className={`bg-white border border-blue-100 relative shadow-lg transition-all duration-200 ${isActive ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-blue-200'} group flex flex-col`}>
                          <div>
                            {/* Header del slide: título y acciones */}
                            <div className="flex items-center justify-between px-6 py-4 cursor-pointer select-none" onClick={() => setActiveSlide(idx)}>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xl">Slide {idx + 1}</span>
                                {isActive && <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 font-semibold">Editando</span>}
                              </div>
                              <div className="flex gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="hover:bg-blue-50" title="Mover arriba" onClick={e => {e.stopPropagation(); idx > 0 && reorderSlide(idx, idx-1);}} disabled={idx === 0}>
                                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6" stroke="#4273c4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Mover arriba</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="hover:bg-blue-50" title="Mover abajo" onClick={e => {e.stopPropagation(); idx < localConfig.heroSlides.length-1 && reorderSlide(idx, idx+1);}} disabled={idx === localConfig.heroSlides.length-1}>
                                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="#4273c4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Mover abajo</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="hover:bg-blue-50" title="Duplicar slide" onClick={e => {e.stopPropagation(); duplicateSlide(idx);}}>
                                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke="#4273c4" strokeWidth="2"/><rect x="2" y="2" width="13" height="13" rx="2" stroke="#4273c4" strokeWidth="2"/></svg>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Duplicar slide</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-100" onClick={e => {e.stopPropagation(); removeHeroSlide(idx);}} title="Eliminar slide">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Eliminar slide</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                            {/* Contenido expandido solo si está activo */}
                            {isActive && (
                              <CardContent className="flex flex-col gap-2 px-6 pb-6">
                                <div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center mb-2 overflow-hidden border border-gray-200">
                                  {slide.image ? (
                                    <img src={slide.image} alt="preview" className="object-cover w-full h-full" />
                                  ) : (
                                    <span className="text-gray-400 text-xs">Sin imagen</span>
                                  )}
                                </div>
                                <label className="block text-sm font-semibold">Imagen <span className="text-red-500">*</span></label>
                                <Input className={`w-full ${!slide.image ? 'border-red-400' : ''}`} value={slide.image} onChange={e => updateHeroSlide(idx, { image: e.target.value })} placeholder="URL de la imagen" />
                                <label className="block text-sm font-semibold">Título <span className="text-red-500">*</span></label>
                                <Input className={`w-full ${!slide.title ? 'border-red-400' : ''}`} value={slide.title} onChange={e => updateHeroSlide(idx, { title: e.target.value })} />
                                <label className="block text-sm font-semibold">Subtítulo</label>
                                <Input className="w-full" value={slide.subtitle} onChange={e => updateHeroSlide(idx, { subtitle: e.target.value })} />
                                <label className="block text-sm font-semibold">Texto CTA</label>
                                <Input className="w-full" value={slide.cta?.text || ""} onChange={e => updateHeroSlide(idx, { cta: { text: e.target.value, link: slide.cta?.link } })} />
                                <label className="block text-sm font-semibold">Link CTA</label>
                                <Input className="w-full" value={slide.cta?.link || ""} onChange={e => updateHeroSlide(idx, { cta: { text: slide.cta?.text || "", link: e.target.value } })} />
                              </CardContent>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </div>
              {/* Vista previa sticky a la derecha, sincronizada con el slide activo */}
              <div className="bg-white rounded-2xl shadow p-10 flex flex-col md:sticky md:top-28 h-fit self-start min-w-[420px] xl:min-w-[540px]">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-5 h-5 text-green-600" />
                  <span className="font-bold text-lg text-green-700">Vista Previa</span>
                </div>
                <div className="text-gray-500 text-sm mb-4">Así se verá tu sección Hero</div>
                <HeroSliderPreview slides={localConfig.heroSlides ? [localConfig.heroSlides[activeSlide]] : []} />
              </div>
            </div>
          </section>
        )}





        {/* Sección: Destacados */}
        {tab === "featured" && (
          <section className="grid gap-6 max-w-3xl mx-auto">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><Star className="w-5 h-5 text-primary" /> Sección Destacados</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">Título de la sección</label>
                    <Input
                      className="w-full"
                      value={localConfig.featuredSection?.title || ""}
                      onChange={e => setLocalConfig((prev: any) => ({ ...prev, featuredSection: { ...prev.featuredSection, title: e.target.value } }))}
                      placeholder="Ej: Productos Destacados"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Subtítulo</label>
                    <Input
                      className="w-full"
                      value={localConfig.featuredSection?.subtitle || ""}
                      onChange={e => setLocalConfig((prev: any) => ({ ...prev, featuredSection: { ...prev.featuredSection, subtitle: e.target.value } }))}
                      placeholder="Breve subtítulo de la sección"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">Ordenar productos por</label>
                    <select
                      className="w-full border rounded px-3 py-2"
                      value={localConfig.featuredSection?.orderBy || "featured"}
                      onChange={e => setLocalConfig((prev: any) => ({ ...prev, featuredSection: { ...prev.featuredSection, orderBy: e.target.value } }))}
                    >
                      <option value="featured">Destacados</option>
                      <option value="price">Precio</option>
                      <option value="new">Más nuevos</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Buscar y agregar productos</label>
                    <ProductAutocomplete
                      selected={localConfig.featuredProducts || []}
                      onChange={(prods: any[]) => setLocalConfig((prev: any) => ({ ...prev, featuredProducts: prods }))}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-500">Esta sección resalta productos seleccionados en la homepage.</span>
                {/* Vista previa de productos destacados con drag & drop */}
                <div className="mt-6">
                  <div className="font-semibold mb-2 text-primary">Vista previa de productos destacados</div>
                  {/* Controles generales de color para los badges */}
                  <div className="flex items-center gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Color fondo badge (general)</label>
                      <input
                        type="color"
                        value={localConfig.featuredBadgeColor || '#4273c4'}
                        onChange={e => setLocalConfig((prev: any) => ({ ...prev, featuredBadgeColor: e.target.value }))}
                        className="w-8 h-8 p-0 border-0 outline-none cursor-pointer"
                        title="Color fondo badge general"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Color texto badge (general)</label>
                      <input
                        type="color"
                        value={localConfig.featuredBadgeTextColor || '#fff'}
                        onChange={e => setLocalConfig((prev: any) => ({ ...prev, featuredBadgeTextColor: e.target.value }))}
                        className="w-8 h-8 p-0 border-0 outline-none cursor-pointer"
                        title="Color texto badge general"
                      />
                    </div>
                  </div>
                  <DraggableProductList
                    products={localConfig.featuredProducts || []}
                    onReorder={(prods: any[]) => setLocalConfig((prev: any) => ({ ...prev, featuredProducts: prods }))}
                    badgeColorDefault={localConfig.featuredBadgeColor || '#4273c4'}
                    badgeTextColorDefault={localConfig.featuredBadgeTextColor || '#fff'}
                  />
                </div>
              </CardContent>
            </Card>
          </section>


        )}

        {/* Sección: Categorías */}
        {tab === "categories" && (
          <section className="grid gap-6 max-w-3xl mx-auto">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><Layers className="w-5 h-5 text-primary" /> Categorías</CardTitle>
                <div className="text-sm text-gray-500">Gestiona las categorías principales de la tienda.</div>
              </CardHeader>
              <CardContent className="grid gap-6">
                <Button variant="outline" onClick={addCategory} className="flex items-center gap-2 w-fit"><Plus className="w-4 h-4" />Agregar Categoría</Button>
                <div className="grid gap-4">
                  {(localConfig.categories ?? []).map((cat: any, idx: number) => (
                    <Card key={idx} className="bg-white border border-blue-100 relative shadow-sm">
                      <Button size="icon" variant="ghost" className="absolute top-2 right-2 text-red-500 hover:bg-red-100" onClick={() => removeCategory(idx)} title="Eliminar categoría"><Trash2 className="w-4 h-4" /></Button>
                      <CardHeader>
                        <CardTitle>Categoría {idx + 1}</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-2">
                        <label className="block text-sm font-semibold">Nombre <span className="text-red-500">*</span></label>
                        <Input className={`w-full ${!cat.name ? 'border-red-400' : ''}`} value={cat.name} onChange={e => updateCategory(idx, { name: e.target.value })} />
                        <label className="block text-sm font-semibold">Código de categoría</label>
                        <CategoryCodeAutocomplete
                          value={cat.code || ''}
                          onChange={code => updateCategory(idx, { code })}
                        />
                        <label className="block text-sm font-semibold">Imagen</label>
                        <Input className="w-full" value={cat.image || ""} onChange={e => updateCategory(idx, { image: e.target.value })} />
                        <label className="block text-sm font-semibold">Contador</label>

                        {/* Vista previa visual de la categoría */}
                        <div className="mt-4 p-3 rounded-lg border bg-blue-50/40 flex items-center gap-4">
                          <img
                            src={cat.image || "/placeholder.svg"}
                            alt={cat.name || "Categoría"}
                            className="w-16 h-16 object-cover rounded border bg-white"
                          />
                          <div className="flex-1">
                            <div className="font-bold text-lg text-blue-900 flex items-center gap-2">
                              {cat.name || <span className="italic text-gray-400">Sin nombre</span>}
                              {cat.code && (
                                <span className="ml-2 px-2 py-0.5 rounded bg-blue-200 text-xs text-blue-800 font-mono">{cat.code}</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              <span className="font-semibold">Contador:</span> {cat.count || <span className="italic text-gray-400">0</span>}
                            </div>
                          </div>
                        </div>

                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Sección: Tienda */}
        {tab === "store" && (
          <section className="grid gap-6 max-w-2xl mx-auto">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><Store className="w-5 h-5 text-primary" /> Información de la Tienda</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <label className="block font-semibold mb-1">Nombre de la tienda</label>
                <Input
                  className="w-full"
                  value={localConfig.storeInfo?.name || ""}
                  onChange={e => setLocalConfig((prev: any) => ({ ...prev, storeInfo: { ...prev.storeInfo, name: e.target.value } }))}
                  placeholder="Ej: Repuestos La Casa del Colt"
                />
                <label className="block font-semibold mb-1">Descripción</label>
                <Input
                  className="w-full"
                  value={localConfig.storeInfo?.description || ""}
                  onChange={e => setLocalConfig((prev: any) => ({ ...prev, storeInfo: { ...prev.storeInfo, description: e.target.value } }))}
                  placeholder="Breve descripción de la tienda"
                />

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-4 mt-2">
                  <label className="block font-semibold text-emerald-950 mb-1 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    Número de WhatsApp para Pedidos
                  </label>
                  <Input
                    className="w-full bg-white border-emerald-300 focus:border-emerald-500"
                    value={localConfig.whatsapp_phone || localConfig.storeInfo?.whatsapp || localConfig.footer?.contact || ""}
                    onChange={e => {
                      const val = e.target.value;
                      setLocalConfig((prev: any) => ({
                        ...prev,
                        whatsapp_phone: val,
                        storeInfo: { ...(prev.storeInfo || {}), whatsapp: val },
                        footer: { ...(prev.footer || {}), contact: val }
                      }));
                    }}
                    placeholder="Ej: 809-684-1243 o 18096841243"
                  />
                  <p className="text-xs text-emerald-700 mt-1">
                    Número al que los clientes serán dirigidos con el mensaje de su orden desde el carrito de compras.
                  </p>
                </div>

                <label className="block font-semibold mb-1">Logo principal (grande, URL)</label>
                <Input
                  className="w-full"
                  value={localConfig.storeInfo?.logo || ""}
                  onChange={e => setLocalConfig((prev: any) => ({ ...prev, storeInfo: { ...prev.storeInfo, logo: e.target.value } }))}
                  placeholder="URL del logo grande"
                />
                <label className="block font-semibold mb-1">Logo secundario (pequeño, URL)</label>
                <Input
                  className="w-full"
                  value={localConfig.storeInfo?.logoSmall || ""}
                  onChange={e => setLocalConfig((prev: any) => ({ ...prev, storeInfo: { ...prev.storeInfo, logoSmall: e.target.value } }))}
                  placeholder="URL del logo pequeño"
                />

                {/* Vista previa visual de la tienda */}
                <div className="mt-6 p-5 rounded-lg border bg-gray-50 flex items-center gap-6">
                  <img
                    src={localConfig.storeInfo?.logo || "/placeholder.svg"}
                    alt="Logo grande"
                    className="w-24 h-24 object-contain rounded bg-white border"
                  />
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="flex items-center gap-3">
                      <img
                        src={localConfig.storeInfo?.logoSmall || "/placeholder.svg"}
                        alt="Logo pequeño"
                        className="w-10 h-10 object-contain rounded bg-white border"
                      />
                      <span className="text-2xl font-bold text-blue-900">{localConfig.storeInfo?.name || <span className="italic text-gray-400">Nombre de la tienda</span>}</span>
                    </div>
                    <div className="text-gray-700">{localConfig.storeInfo?.description || <span className="italic text-gray-400">Descripción de la tienda</span>}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tarjeta: Colores de Marca y Enlaces de Pago (Theme) */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Palette className="w-5 h-5 text-primary" />
                  Colores de Marca y Enlaces de Pago (Theme)
                </CardTitle>
                <p className="text-gray-500 text-sm">
                  Define los colores corporativos y datos de contacto para la tienda web y las páginas de enlaces de pago por WhatsApp.
                </p>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Color Primario */}
                  <div className="border rounded-xl p-4 bg-background shadow-xs">
                    <label className="block font-semibold text-sm mb-1">Color Primario</label>
                    <p className="text-xs text-muted-foreground mb-3">Botones principales, encabezados y elementos destacados.</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                        value={localConfig.theme?.primary_color || localConfig.theme?.primary || "#0056B3"}
                        onChange={e => setLocalConfig((prev: any) => ({
                          ...prev,
                          theme: { ...(prev.theme || {}), primary_color: e.target.value, primary: e.target.value }
                        }))}
                      />
                      <Input
                        className="w-32 text-center uppercase font-mono"
                        value={localConfig.theme?.primary_color || localConfig.theme?.primary || "#0056B3"}
                        onChange={e => setLocalConfig((prev: any) => ({
                          ...prev,
                          theme: { ...(prev.theme || {}), primary_color: e.target.value, primary: e.target.value }
                        }))}
                      />
                    </div>
                  </div>

                  {/* Color de Acento */}
                  <div className="border rounded-xl p-4 bg-background shadow-xs">
                    <label className="block font-semibold text-sm mb-1">Color de Acento</label>
                    <p className="text-xs text-muted-foreground mb-3">Insignias, ofertas y elementos secundarios.</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                        value={localConfig.theme?.accent_color || localConfig.theme?.accent || "#FFC107"}
                        onChange={e => setLocalConfig((prev: any) => ({
                          ...prev,
                          theme: { ...(prev.theme || {}), accent_color: e.target.value, accent: e.target.value }
                        }))}
                      />
                      <Input
                        className="w-32 text-center uppercase font-mono"
                        value={localConfig.theme?.accent_color || localConfig.theme?.accent || "#FFC107"}
                        onChange={e => setLocalConfig((prev: any) => ({
                          ...prev,
                          theme: { ...(prev.theme || {}), accent_color: e.target.value, accent: e.target.value }
                        }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Datos de Soporte en Enlaces de Pago */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <label className="block font-semibold text-sm mb-1">WhatsApp / Teléfono de Soporte</label>
                    <Input
                      className="w-full"
                      value={localConfig.theme?.support_phone || localConfig.whatsapp_phone || localConfig.storeInfo?.whatsapp || ""}
                      onChange={e => {
                        const val = e.target.value;
                        setLocalConfig((prev: any) => ({
                          ...prev,
                          theme: { ...(prev.theme || {}), support_phone: val },
                          whatsapp_phone: val,
                          storeInfo: { ...(prev.storeInfo || {}), whatsapp: val }
                        }));
                      }}
                      placeholder="Ej: +1 (809) 830-1176"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Se mostrará como canal de ayuda en la pantalla de pago.</p>
                  </div>

                  <div>
                    <label className="block font-semibold text-sm mb-1">Email de Soporte</label>
                    <Input
                      className="w-full"
                      value={localConfig.theme?.support_email || localConfig.footer?.email || ""}
                      onChange={e => setLocalConfig((prev: any) => ({
                        ...prev,
                        theme: { ...(prev.theme || {}), support_email: e.target.value }
                      }))}
                      placeholder="Ej: ventas@casadelcolt.com"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Correo para atención de clientes y reclamos.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Sección: Páginas de Pago */}
        {tab === "payment-pages" && (
          <section className="grid gap-6 max-w-4xl mx-auto">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Páginas de Pago
                </CardTitle>
                <p className="text-gray-600 mt-2">
                  Configura las páginas que ven los clientes después de realizar un pago
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Pago Exitoso */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h3 className="font-semibold text-green-800">Pago Exitoso</h3>
                    </div>
                    <p className="text-sm text-green-700 mb-4">
                      Página que se muestra cuando el pago es aprobado exitosamente
                    </p>
                    <Link
                      href="/admin/payment-pages?tab=approved"
                      className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      <Settings className="w-4 h-4" />
                      Configurar
                    </Link>
                  </div>

                  {/* Pago Declinado */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <h3 className="font-semibold text-red-800">Pago Declinado</h3>
                    </div>
                    <p className="text-sm text-red-700 mb-4">
                      Página que se muestra cuando el pago es rechazado o falla
                    </p>
                    <Link
                      href="/admin/payment-pages?tab=declined"
                      className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                      <Settings className="w-4 h-4" />
                      Configurar
                    </Link>
                  </div>

                  {/* Pago Cancelado */}
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="w-5 h-5 text-orange-600" />
                      <h3 className="font-semibold text-orange-800">Pago Cancelado</h3>
                    </div>
                    <p className="text-sm text-orange-700 mb-4">
                      Página que se muestra cuando el cliente cancela el pago
                    </p>
                    <Link
                      href="/admin/payment-pages?tab=cancelled"
                      className="inline-flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                    >
                      <Settings className="w-4 h-4" />
                      Configurar
                    </Link>
                  </div>
                </div>

                {/* Vista previa de URLs */}
                <div className="bg-gray-50 border rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    URLs de las Páginas
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-green-600">Pago Exitoso:</span>
                      <code className="bg-white px-2 py-1 rounded border text-xs">
                        {typeof window !== 'undefined' ? window.location.origin : 'https://tu-dominio.com'}/payment/result/approved
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-red-600">Pago Declinado:</span>
                      <code className="bg-white px-2 py-1 rounded border text-xs">
                        {typeof window !== 'undefined' ? window.location.origin : 'https://tu-dominio.com'}/payment/result/declined
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-orange-600">Pago Cancelado:</span>
                      <code className="bg-white px-2 py-1 rounded border text-xs">
                        {typeof window !== 'undefined' ? window.location.origin : 'https://tu-dominio.com'}/payment/result/cancelled
                      </code>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    ℹ️ Estas URLs se configuran automáticamente en los proveedores de pago (Azul, etc.)
                  </p>
                </div>

                {/* Acceso directo al editor completo */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-blue-800 mb-1">Editor Avanzado</h4>
                      <p className="text-sm text-blue-700">
                        Accede al editor completo para personalizar contenido, CSS y más opciones
                      </p>
                    </div>
                    <Link
                      href="/admin/payment-pages"
                      className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/85 transition-colors font-medium"
                    >
                      <Layout className="w-4 h-4" />
                      Ir al Editor
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Sección: Footer */}
        {tab === "footer" && (
          <section className="grid gap-6 max-w-2xl mx-auto">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><Link2 className="w-5 h-5 text-primary" /> Footer</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <label className="block font-semibold mb-1">Nombre de la tienda</label>
                <Input className="w-full" value={localConfig.footer?.storeName || ""} onChange={e => setLocalConfig((prev: any) => ({ ...prev, footer: { ...prev.footer, storeName: e.target.value } }))} />
                <label className="block font-semibold mb-1">Descripción</label>
                <Input className="w-full" value={localConfig.footer?.description || ""} onChange={e => setLocalConfig((prev: any) => ({ ...prev, footer: { ...prev.footer, description: e.target.value } }))} />
                <label className="block font-semibold mb-1">Newsletter</label>
                <Input className="w-full" value={localConfig.footer?.newsletterText || ""} onChange={e => setLocalConfig((prev: any) => ({ ...prev, footer: { ...prev.footer, newsletterText: e.target.value } }))} />
                {/* Sección de Social Links con URLs */}
                <div className="border-t pt-4 mt-2">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block font-semibold">Redes Sociales (con enlaces)</label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLocalConfig((prev: any) => ({
                        ...prev,
                        footer: {
                          ...prev.footer,
                          social_links: [...(prev.footer?.social_links || []), { name: '', url: '' }]
                        }
                      }))}
                      className="flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Agregar Red Social
                    </Button>
                  </div>

                  {(localConfig.footer?.social_links || []).length === 0 && (
                    <p className="text-gray-500 text-sm italic mb-2">No hay redes sociales configuradas. Haz clic en "Agregar Red Social" para comenzar.</p>
                  )}

                  <div className="space-y-3">
                    {(localConfig.footer?.social_links || []).map((link: { name: string; url: string }, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Nombre (ej: Facebook)"
                            value={link.name || ''}
                            onChange={e => {
                              const updated = [...(localConfig.footer?.social_links || [])];
                              updated[idx] = { ...updated[idx], name: e.target.value };
                              setLocalConfig((prev: any) => ({
                                ...prev,
                                footer: { ...prev.footer, social_links: updated }
                              }));
                            }}
                          />
                          <Input
                            placeholder="URL (ej: https://facebook.com/mitienda)"
                            value={link.url || ''}
                            onChange={e => {
                              const updated = [...(localConfig.footer?.social_links || [])];
                              updated[idx] = { ...updated[idx], url: e.target.value };
                              setLocalConfig((prev: any) => ({
                                ...prev,
                                footer: { ...prev.footer, social_links: updated }
                              }));
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            const updated = (localConfig.footer?.social_links || []).filter((_: any, i: number) => i !== idx);
                            setLocalConfig((prev: any) => ({
                              ...prev,
                              footer: { ...prev.footer, social_links: updated }
                            }));
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <label className="block font-semibold mb-1 mt-4">Contacto (email o teléfono)</label>
                <Input className="w-full" value={localConfig.footer?.contact || ""} onChange={e => setLocalConfig((prev: any) => ({ ...prev, footer: { ...prev.footer, contact: e.target.value } }))} placeholder="contacto@tienda.com / +1 234 567 890" />
                <label className="block font-semibold mb-1">Copyright</label>
                <Input className="w-full" value={localConfig.footer?.copyright || ""} onChange={e => setLocalConfig((prev: any) => ({ ...prev, footer: { ...prev.footer, copyright: e.target.value } }))} />

                {/* Sección de Páginas de Políticas */}
                <div className="border-t pt-6 mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-primary">Páginas de Políticas y Legales</h3>
                      <p className="text-sm text-gray-500">Configura las páginas legales que aparecerán en el footer</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLocalConfig((prev: any) => ({
                        ...prev,
                        footer: {
                          ...prev.footer,
                          policy_pages: [...(prev.footer?.policy_pages || []), {
                            id: `policy_${Date.now()}`,
                            title: '',
                            slug: '',
                            content: '',
                            enabled: true
                          }]
                        }
                      }))}
                      className="flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Agregar Página
                    </Button>
                  </div>

                  {/* Páginas predefinidas si no hay ninguna */}
                  {(!localConfig.footer?.policy_pages || localConfig.footer.policy_pages.length === 0) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                      <p className="text-amber-800 text-sm mb-3">No hay páginas de políticas configuradas. Puedes agregar las páginas predefinidas:</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="bg-white"
                        onClick={() => setLocalConfig((prev: any) => ({
                          ...prev,
                          footer: {
                            ...prev.footer,
                            policy_pages: [
                              { id: 'policy_returns', title: 'Cambios y Devoluciones', slug: 'cambios-devoluciones', content: '<h2>Política de Cambios y Devoluciones</h2>\n<p>Contenido de la política...</p>', enabled: true },
                              { id: 'policy_terms', title: 'Términos y Condiciones', slug: 'terminos-condiciones', content: '<h2>Términos y Condiciones</h2>\n<p>Contenido de los términos...</p>', enabled: true },
                              { id: 'policy_privacy', title: 'Políticas de Privacidad', slug: 'privacidad', content: '<h2>Política de Privacidad y Uso de Datos</h2>\n<p>Contenido de la política de privacidad...</p>', enabled: true },
                            ]
                          }
                        }))}
                      >
                        Cargar Páginas Predefinidas
                      </Button>
                    </div>
                  )}

                  {/* Lista de páginas de políticas */}
                  <div className="space-y-4">
                    {(localConfig.footer?.policy_pages || []).map((page: { id: string; title: string; slug: string; content: string; enabled: boolean }, idx: number) => (
                      <div key={page.id || idx} className="bg-gray-50 border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={page.enabled}
                              onChange={e => {
                                const updated = [...(localConfig.footer?.policy_pages || [])];
                                updated[idx] = { ...updated[idx], enabled: e.target.checked };
                                setLocalConfig((prev: any) => ({
                                  ...prev,
                                  footer: { ...prev.footer, policy_pages: updated }
                                }));
                              }}
                              className="w-5 h-5 cursor-pointer"
                              title="Activar/Desactivar página"
                            />
                            <span className={`text-sm font-medium ${page.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                              {page.enabled ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              if (window.confirm('¿Eliminar esta página de política?')) {
                                const updated = (localConfig.footer?.policy_pages || []).filter((_: any, i: number) => i !== idx);
                                setLocalConfig((prev: any) => ({
                                  ...prev,
                                  footer: { ...prev.footer, policy_pages: updated }
                                }));
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-sm font-medium mb-1">Título</label>
                            <Input
                              placeholder="Ej: Términos y Condiciones"
                              value={page.title || ''}
                              onChange={e => {
                                const updated = [...(localConfig.footer?.policy_pages || [])];
                                updated[idx] = { ...updated[idx], title: e.target.value };
                                setLocalConfig((prev: any) => ({
                                  ...prev,
                                  footer: { ...prev.footer, policy_pages: updated }
                                }));
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Slug (URL)</label>
                            <div className="flex items-center">
                              <span className="text-gray-400 text-sm mr-1">/politicas/</span>
                              <Input
                                placeholder="terminos-condiciones"
                                value={page.slug || ''}
                                onChange={e => {
                                  const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
                                  const updated = [...(localConfig.footer?.policy_pages || [])];
                                  updated[idx] = { ...updated[idx], slug };
                                  setLocalConfig((prev: any) => ({
                                    ...prev,
                                    footer: { ...prev.footer, policy_pages: updated }
                                  }));
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1">Contenido (HTML)</label>
                          <textarea
                            className="w-full border rounded-lg p-3 min-h-[150px] text-sm font-mono"
                            placeholder="<h2>Título</h2>\n<p>Contenido de la página...</p>"
                            value={page.content || ''}
                            onChange={e => {
                              const updated = [...(localConfig.footer?.policy_pages || [])];
                              updated[idx] = { ...updated[idx], content: e.target.value };
                              setLocalConfig((prev: any) => ({
                                ...prev,
                                footer: { ...prev.footer, policy_pages: updated }
                              }));
                            }}
                          />
                          <p className="text-xs text-gray-500 mt-1">Puedes usar HTML básico: &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;, &lt;a&gt;</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vista previa visual del footer */}
                <div className="mt-6 p-5 rounded-lg border bg-gray-50">
                  <div className="text-xl font-bold text-blue-900 mb-1 flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-primary" />
                    {localConfig.footer?.storeName || <span className="italic text-gray-400">Nombre de la tienda</span>}
                  </div>
                  <div className="text-gray-700 mb-2">{localConfig.footer?.description || <span className="italic text-gray-400">Descripción del footer</span>}</div>
                  {localConfig.footer?.newsletterText && (
                    <div className="mb-2 text-blue-800 bg-blue-100 rounded px-3 py-1 text-sm">{localConfig.footer.newsletterText}</div>
                  )}
                  {/* Social links con URLs clickeables */}
                  {(localConfig.footer?.social_links || []).length > 0 && (
                    <div className="flex gap-3 items-center mb-2 flex-wrap">
                      {localConfig.footer.social_links.map((link: { name: string; url: string }, i: number) => (
                        link.name && (
                          <a
                            key={i}
                            href={link.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-blue-200 text-blue-800 rounded px-2 py-0.5 text-xs font-semibold hover:bg-blue-300 transition-colors"
                          >
                            {link.name}
                            {link.url && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>}
                          </a>
                        )
                      ))}
                    </div>
                  )}
                  {localConfig.footer?.contact && (
                    <div className="mb-2 text-sm text-gray-600 flex items-center gap-2">
                      <span className="font-semibold">Contacto:</span> {localConfig.footer.contact}
                    </div>
                  )}
                  {/* Vista previa de páginas de políticas */}
                  {(localConfig.footer?.policy_pages || []).filter((p: any) => p.enabled && p.title).length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs font-semibold text-gray-600">Legal:</span>
                      <div className="flex gap-2 flex-wrap mt-1">
                        {localConfig.footer.policy_pages.filter((p: any) => p.enabled && p.title).map((page: any, i: number) => (
                          <span key={i} className="text-xs text-blue-600 hover:underline cursor-pointer">
                            {page.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 border-t pt-2 mt-2">{localConfig.footer?.copyright || '© 2025 Tu Tienda. Todos los derechos reservados.'}</div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {tab === "cms" && (
          <section className="grid gap-6 max-w-2xl mx-auto">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><Settings className="w-5 h-5 text-primary" /> Configuración CMS</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6">
                {/* Toggle para Botón de Reportar Error */}
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex-1">
                    <label className="block font-semibold text-foreground mb-1">Botón "Reportar Error"</label>
                    <p className="text-sm text-gray-600">Mostrar pestaña lateral para que los clientes reporten errores y sugerencias</p>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={localConfig.enable_bug_report_button ?? true}
                      onChange={(e) => setLocalConfig((prev: any) => ({
                        ...prev,
                        enable_bug_report_button: e.target.checked
                      }))}
                      className="w-6 h-6 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Descripción */}
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm text-gray-700">
                    <strong>Estado:</strong> {localConfig.enable_bug_report_button ?? true ? (
                      <span className="text-green-600 font-semibold"> ✓ Habilitado</span>
                    ) : (
                      <span className="text-red-600 font-semibold"> ✗ Deshabilitado</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Cuando está habilitado, aparecerá un botón en la parte derecha de la pantalla (solo en escritorio) que permite a los clientes reportar errores, sugerencias y hacer preguntas.
                  </p>
                </div>

                {/* Divider */}
                <div className="border-t pt-6"></div>

                {/* Toggle para Validación SAP */}
                <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex-1">
                    <label className="block font-semibold text-foreground mb-1">Validación de Inventario (SAP)</label>
                    <p className="text-sm text-gray-600">Verificar disponibilidad de stock en SAP al agregar productos al carrito</p>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={!localConfig.disable_sap_validation}
                      onChange={(e) => setLocalConfig((prev: any) => ({
                        ...prev,
                        disable_sap_validation: !e.target.checked
                      }))}
                      className="w-6 h-6 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Descripción SAP */}
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm text-gray-700">
                    <strong>Estado:</strong> {!localConfig.disable_sap_validation ? (
                      <span className="text-green-600 font-semibold"> ✓ Habilitado</span>
                    ) : (
                      <span className="text-red-600 font-semibold"> ✗ Deshabilitado</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Cuando está habilitado, el sistema verificará el inventario en SAP en tiempo real. Si está deshabilitado, los clientes podrán agregar productos sin validación de stock (útil si SAP no está disponible).
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}

export default function StoreConfigPage() {
  const { user, isLoading } = useAdmin();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/admin/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-blue-500">Cargando...</div>;
  }

  return (
    <AdminLayout title="Configuración de Tienda">
      <StoreConfigAdmin />
    </AdminLayout>
  );
}
