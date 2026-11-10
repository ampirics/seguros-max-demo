"use client"
import React, { useEffect, useState } from 'react';
import { frontLabelApi } from '@/lib/frontlabel-api';
import type { FrontLabel, FrontLabelCreate, FrontLabelUpdate } from '@/lib/frontlabel-types';

const PAGE_SIZE = 20;

export default function FrontLabelAdmin() {
  const [items, setItems] = useState<FrontLabel[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<FrontLabel | null>(null);
  const [form, setForm] = useState<Partial<FrontLabelCreate>>({});
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [parents, setParents] = useState<FrontLabel[]>([]);

  const fetchPage = async (page = 0) => {
    setLoading(true);
    setError(null);
    try {
      const res = await frontLabelApi.list(page * PAGE_SIZE, PAGE_SIZE);
      setItems(res.items);
      setTotal(res.total);
      setSkip(res.skip);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch a larger set to populate parent select and basic client-side search
  const fetchParents = async () => {
    try {
      const res = await frontLabelApi.list(0, PAGE_SIZE * 20);
      setParents(res.items || []);
    } catch (e) {
      // ignore silently, parents optional
    }
  };

  useEffect(() => {
    fetchPage(0);
    fetchParents();
  }, []);

  const startCreate = () => {
    setEditing(null);
    setForm({});
  };

  const handleEdit = (item: FrontLabel) => {
    setEditing(item);
    setForm({
      code: item.code,
      value1: item.value1,
      description: item.description,
      group_id: item.group_id,
      idparent: item.idparent,
      value2: item.value2,
      value3: item.value3,
      value4: item.value4,
      value5: item.value5,
    });
    // ensure parents list includes current parent
    if (item.idparent && !parents.find(p => p.id === item.idparent)) fetchParents();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar este frontlabel?')) return;
    setLoading(true);
    try {
      await frontLabelApi.delete(id);
      fetchPage(Math.floor(skip / PAGE_SIZE));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await frontLabelApi.list(0, PAGE_SIZE * 10);
      const q = query.trim().toLowerCase();
      if (!q) {
        setItems(res.items || []);
        setTotal(res.total || 0);
        setSkip(0);
      } else {
        const filtered = (res.items || []).filter(it =>
          (String(it.value1 || '').toLowerCase().includes(q)) || (String(it.code || '').toLowerCase().includes(q)) || (String(it.group_id || '').toLowerCase().includes(q))
        );
        setItems(filtered.slice(0, PAGE_SIZE));
        setTotal(filtered.length);
        setSkip(0);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target as HTMLInputElement;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (editing) {
        await frontLabelApi.update(editing.id, form as FrontLabelUpdate);
      } else {
        await frontLabelApi.create(form as FrontLabelCreate);
      }
      setEditing(null);
      setForm({});
      fetchPage(Math.floor(skip / PAGE_SIZE));
      fetchParents();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // helper: children count from currently loaded parents array
  const childrenCount = (id: number) => {
    return (parents || []).filter(p => p.idparent === id).length;
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">FrontLabels</h1>
        <div className="flex items-center gap-2">
          <input
            placeholder="Buscar por nombre, código o grupo..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="border p-2 rounded w-64"
          />
          <button onClick={handleSearch} className="px-3 py-2 bg-gray-200 rounded">Buscar</button>
          <button onClick={startCreate} className="px-3 py-2 bg-primary text-primary-foreground rounded">Nuevo</button>
        </div>
      </div>

      {error && <div className="text-red-500 mb-2">{error}</div>}

      <div className="grid grid-cols-12 gap-4">
        {/* Left: list */}
        <div className="col-span-7">
          <div className="bg-white rounded shadow overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div>Total: <strong>{total}</strong></div>
              <div className="text-sm text-gray-500">Mostrando {items.length} items</div>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">ID</th>
                  <th className="border p-2 text-left">Código</th>
                  <th className="border p-2 text-left">Nombre</th>
                  <th className="border p-2 text-left">Grupo</th>
                  <th className="border p-2 text-left">Padre</th>
                  <th className="border p-2 text-left">Valores</th>
                  <th className="border p-2 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 align-top">{item.id}</td>
                    <td className="p-2 align-top">{item.code}</td>
                    <td className="p-2 align-top">{item.value1 || '-'}</td>
                    <td className="p-2 align-top">{item.group_id || '-'}</td>
                    <td className="p-2 align-top">{item.idparent ? (parents.find(p => p.id === item.idparent)?.code || item.idparent) : '-'}</td>
                    <td className="p-2 align-top">
                      <div className="text-xs text-gray-600">
                        {item.value1 || item.value2 || item.value3 ? (
                          <>{[item.value1, item.value2, item.value3, item.value4, item.value5].filter(Boolean).join(' · ')}</>
                        ) : <span className="text-gray-300">—</span>}
                      </div>
                    </td>
                    <td className="p-2 align-top flex gap-2">
                      <button onClick={() => handleEdit(item)} className="text-blue-600">Editar</button>
                      <button onClick={() => handleDelete(item.id)} className="text-red-600">Eliminar</button>
                      <button onClick={() => {
                        const children = childrenCount(item.id);
                        if (children > 0) alert(`${children} hijo(s) en el conjunto cargado`);
                        else alert('No se encontraron hijos en el conjunto cargado');
                      }} className="text-gray-600">Hijos</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          <div className="flex justify-between items-center mt-4">
            <button
              onClick={() => fetchPage(Math.max(0, Math.floor(skip / PAGE_SIZE) - 1))}
              disabled={skip === 0 || loading}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Anterior
            </button>
            <span>
              Página {Math.floor(skip / PAGE_SIZE) + 1} de {Math.ceil(total / PAGE_SIZE) || 1}
            </span>
            <button
              onClick={() => fetchPage(Math.floor(skip / PAGE_SIZE) + 1)}
              disabled={skip + PAGE_SIZE >= total || loading}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>

        {/* Right: form panel */}
        <div className="col-span-5">
          <div className="bg-white rounded shadow p-4">
            <h2 className="text-lg font-medium mb-3">{editing ? 'Editar FrontLabel' : 'Crear FrontLabel'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">Código</label>
                  <input name="code" required disabled={!!editing} value={form.code || ''} onChange={handleFormChange} className="border p-2 rounded w-full" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Value1 (Título)</label>
                  <input name="value1" required value={form.value1 || ''} onChange={handleFormChange} className="border p-2 rounded w-full" />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600">Descripción</label>
                <textarea name="description" value={form.description || ''} onChange={handleFormChange} className="border p-2 rounded w-full" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">Grupo</label>
                  <input name="group_id" value={form.group_id || ''} onChange={handleFormChange} className="border p-2 rounded w-full" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Padre</label>
                  <select name="idparent" value={form.idparent || ''} onChange={handleFormChange} className="border p-2 rounded w-full">
                    <option value="">-- Ninguno --</option>
                    {parents.map(p => (
                      <option key={p.id} value={p.id}>{p.code} — {p.value1 || ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">Value1</label>
                  <input name="value1" value={form.value1 || ''} onChange={handleFormChange} className="border p-2 rounded w-full" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Value2</label>
                  <input name="value2" value={form.value2 || ''} onChange={handleFormChange} className="border p-2 rounded w-full" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Value3</label>
                  <input name="value3" value={form.value3 || ''} onChange={handleFormChange} className="border p-2 rounded w-full" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Value4</label>
                  <input name="value4" value={form.value4 || ''} onChange={handleFormChange} className="border p-2 rounded w-full" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-600">Value5</label>
                  <input name="value5" value={form.value5 || ''} onChange={handleFormChange} className="border p-2 rounded w-full" />
                </div>
              </div>

              <div className="flex gap-2">
                <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded">{editing ? 'Actualizar' : 'Crear'}</button>
                <button type="button" onClick={() => { setEditing(null); setForm({}); }} className="bg-gray-200 px-4 py-2 rounded">Limpiar</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
