"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Save, ArrowLeft, Search, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { registrarCompra, getUltimaCompra } from "@/app/actions/compras";

type Producto = {
  id: number;
  nombre_producto: string;
  codigo_articulo: string;
  precio_costo: number;
  proveedor?: { id: number; nombre: string } | null;
  marca?: { id: number; nombre: string } | null;
  categoria?: { id: number; nombre: string } | null;
};

type ItemFiltro = { id: number; nombre: string };

type ImpuestoRow = {
  id: string;
  nombre: string;
  esPorcentaje: boolean;
  valor: number;
};

export function CompraForm({ 
  productos,
  proveedores = [],
  marcas = [],
  categorias = [],
  depositos = []
}: { 
  productos: Producto[],
  proveedores?: ItemFiltro[],
  marcas?: ItemFiltro[],
  categorias?: ItemFiltro[],
  depositos?: ItemFiltro[]
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form states
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [productoId, setProductoId] = useState("");
  const [costoBase, setCostoBase] = useState<number>(0);
  const [cantidad, setCantidad] = useState<number>(1);
  const [depositoId, setDepositoId] = useState<string>(depositos.length > 0 ? depositos[0].id.toString() : "");
  const [notas, setNotas] = useState("");
  const [impuestos, setImpuestos] = useState<ImpuestoRow[]>([]);

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [proveedorFilter, setProveedorFilter] = useState("");
  const [marcaFilter, setMarcaFilter] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("");

  const filteredProductos = useMemo(() => {
    let filtrados = productos;
    
    if (proveedorFilter) {
      filtrados = filtrados.filter(p => p.proveedor?.id.toString() === proveedorFilter);
    }
    if (marcaFilter) {
      filtrados = filtrados.filter(p => p.marca?.id.toString() === marcaFilter);
    }
    if (categoriaFilter) {
      filtrados = filtrados.filter(p => p.categoria?.id.toString() === categoriaFilter);
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtrados = filtrados.filter(
        (p) =>
          p.nombre_producto.toLowerCase().includes(lower) ||
          p.codigo_articulo.toLowerCase().includes(lower)
      );
    }
    
    return filtrados.slice(0, 100); // Limit to 100 for performance
  }, [productos, searchTerm, proveedorFilter, marcaFilter, categoriaFilter]);

  const selectedProduct = productos.find(p => p.id.toString() === productoId);

  // Handlers
  const addImpuesto = () => {
    setImpuestos([
      ...impuestos,
      { id: Math.random().toString(36).substr(2, 9), nombre: "", esPorcentaje: true, valor: 0 },
    ]);
  };

  const updateImpuesto = (id: string, field: keyof ImpuestoRow, value: any) => {
    setImpuestos(
      impuestos.map((imp) => (imp.id === id ? { ...imp, [field]: value } : imp))
    );
  };

  const removeImpuesto = (id: string) => {
    setImpuestos(impuestos.filter((imp) => imp.id !== id));
  };

  const handleProductSelect = async (id: string) => {
    setProductoId(id);
    const ultima = await getUltimaCompra(parseInt(id));
    
    if (ultima) {
      setCostoBase(ultima.costo_base);
      setImpuestos(ultima.impuestos.map((imp: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        nombre: imp.nombre,
        esPorcentaje: imp.porcentaje !== null && imp.porcentaje !== undefined,
        valor: imp.porcentaje !== null && imp.porcentaje !== undefined ? imp.porcentaje : imp.monto,
      })));
      toast.info("Costo e impuestos de la última compra cargados automáticamente.");
    } else {
      // Si no tiene compras previas, pre-cargamos el precio costo actual como sugerencia (aunque esté con impuestos, es una guía) y dejamos impuestos vacíos
      const prod = productos.find(p => p.id.toString() === id);
      setCostoBase(prod ? prod.precio_costo : 0);
      setImpuestos([]);
    }
  };

  // Calculations
  const calculatedImpuestos = useMemo(() => {
    return impuestos.map(imp => {
      let monto = 0;
      if (imp.esPorcentaje) {
        monto = costoBase * (imp.valor / 100);
      } else {
        monto = imp.valor;
      }
      return { ...imp, montoCalculado: monto };
    });
  }, [costoBase, impuestos]);

  const totalImpuestos = calculatedImpuestos.reduce((acc, imp) => acc + imp.montoCalculado, 0);
  const costoFinal = costoBase + totalImpuestos;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productoId) {
      toast.error("Selecciona un producto");
      return;
    }
    if (costoBase <= 0) {
      toast.error("El costo base debe ser mayor a 0");
      return;
    }

    setLoading(true);

    const payload = {
      fecha,
      productoId: parseInt(productoId),
      costo_base: costoBase,
      costo_final: costoFinal,
      cantidad,
      depositoId: depositoId ? parseInt(depositoId) : undefined,
      notas,
      impuestos: calculatedImpuestos.map(imp => ({
        nombre: imp.nombre,
        porcentaje: imp.esPorcentaje ? imp.valor : undefined,
        monto: imp.montoCalculado
      }))
    };

    const res = await registrarCompra(payload);
    
    setLoading(false);

    if (res.success) {
      toast.success("Compra registrada con éxito y costo actualizado");
      router.push("/compras");
    } else {
      toast.error(res.error || "Error al registrar compra");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Columna Principal: Datos y Producto */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-0 shadow-lg shadow-slate-200/50">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg font-bold text-slate-700">Datos Principales</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2 md:col-span-2 flex flex-col md:flex-row gap-4">
                  <div className="space-y-2 flex-1">
                    <Label>Fecha de Compra</Label>
                    <Input 
                      type="date" 
                      value={fecha} 
                      onChange={(e) => setFecha(e.target.value)}
                      required
                      className="border-slate-200 focus-visible:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label>Costo Base (Sin Impuestos)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                      <Input 
                        type="number" 
                        step="0.01"
                        min="0"
                        value={costoBase || ""} 
                        onChange={(e) => setCostoBase(parseFloat(e.target.value) || 0)}
                        required
                        className="pl-8 border-slate-200 focus-visible:ring-indigo-500 font-bold text-lg"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cantidad (Stock)</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={cantidad || ""} 
                    onChange={(e) => setCantidad(parseFloat(e.target.value) || 0)}
                    className="border-slate-200 focus-visible:ring-indigo-500"
                    placeholder="Ej: 10"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Depósito Destino</Label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={depositoId}
                    onChange={(e) => setDepositoId(e.target.value)}
                  >
                    <option value="">No ingresar stock</option>
                    {depositos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Seleccionar Producto</Label>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
                  <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar producto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 border-slate-200"
                    />
                  </div>
                  
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={proveedorFilter}
                    onChange={(e) => setProveedorFilter(e.target.value)}
                  >
                    <option value="">Todos los Proveedores</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>

                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={marcaFilter}
                    onChange={(e) => setMarcaFilter(e.target.value)}
                  >
                    <option value="">Todas las Marcas</option>
                    {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>

                  {/* Opcional: Filtro Categoria si se quisiera 
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={categoriaFilter}
                    onChange={(e) => setCategoriaFilter(e.target.value)}
                  >
                    <option value="">Categorías</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  */}
                </div>
                
                <div className="border border-slate-200 rounded-lg h-96 overflow-y-auto bg-slate-50/50">
                  {filteredProductos.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      <p className="font-medium">No se encontraron productos</p>
                      <p className="text-xs">Intenta cambiar los filtros de búsqueda</p>
                    </div>
                  ) : (
                    <div className="p-1 space-y-1">
                      {filteredProductos.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => handleProductSelect(p.id.toString())}
                          className={`p-3 rounded-md cursor-pointer transition-colors flex justify-between items-center ${
                            productoId === p.id.toString() 
                              ? "bg-indigo-100 border-indigo-200 text-indigo-900 font-medium" 
                              : "hover:bg-slate-100 bg-white border border-transparent"
                          }`}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800">{p.nombre_producto}</p>
                            <div className="flex gap-2 text-xs text-slate-500 mt-0.5">
                              <span>Cód: {p.codigo_articulo}</span>
                              {p.proveedor && <span>• Prov: {p.proveedor.nombre}</span>}
                              {p.marca && <span>• Marca: {p.marca.nombre}</span>}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <span className="text-sm font-bold text-slate-600 block">
                              Costo actual
                            </span>
                            <span className="text-sm font-black text-emerald-600">
                              ${p.precio_costo.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Impuestos / Percepciones */}
          <Card className="border-0 shadow-lg shadow-slate-200/50">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-700">Impuestos y Percepciones</CardTitle>
              <Button type="button" onClick={addImpuesto} variant="outline" size="sm" className="gap-2 bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                <Plus className="h-4 w-4" /> Agregar Línea
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              {impuestos.length === 0 ? (
                <div className="text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-500">No se han agregado impuestos.</p>
                  <p className="text-xs text-slate-400 mt-1">El costo final será igual al costo base.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {impuestos.map((imp, index) => (
                    <div key={imp.id} className="flex flex-wrap md:flex-nowrap items-end gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="w-full md:w-2/5 space-y-1">
                        <Label className="text-xs">Concepto</Label>
                        <Input 
                          placeholder="Ej: IVA 21%, Percepción IIBB..." 
                          value={imp.nombre} 
                          onChange={(e) => updateImpuesto(imp.id, "nombre", e.target.value)}
                          required
                          className="bg-white"
                        />
                      </div>
                      
                      <div className="w-1/2 md:w-1/5 space-y-1">
                        <Label className="text-xs">Tipo</Label>
                        <select 
                          className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                          value={imp.esPorcentaje ? "percent" : "fixed"}
                          onChange={(e) => updateImpuesto(imp.id, "esPorcentaje", e.target.value === "percent")}
                        >
                          <option value="percent">Porcentaje (%)</option>
                          <option value="fixed">Monto Fijo ($)</option>
                        </select>
                      </div>

                      <div className="w-1/2 md:w-1/5 space-y-1">
                        <Label className="text-xs">Valor</Label>
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0"
                          value={imp.valor || ""} 
                          onChange={(e) => updateImpuesto(imp.id, "valor", parseFloat(e.target.value) || 0)}
                          required
                          className="bg-white"
                        />
                      </div>

                      <div className="w-full md:w-1/5 flex items-center justify-between pt-2 md:pt-0">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 font-medium uppercase">Monto</span>
                          <span className="font-bold text-slate-700">
                            ${calculatedImpuestos[index].montoCalculado.toFixed(2)}
                          </span>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeImpuesto(imp.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Columna Lateral: Resumen */}
        <div className="md:col-span-1 space-y-6">
          <Card className="border-0 shadow-xl shadow-slate-200/50 sticky top-6 bg-indigo-600 text-white overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Calculator className="w-32 h-32" />
            </div>
            
            <CardHeader className="relative z-10 border-b border-indigo-500/50 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                Resumen de Costos
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 p-6 space-y-6">
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-indigo-200 font-medium">Costo Base</span>
                  <span className="font-bold text-lg">${costoBase.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-indigo-200 font-medium">Impuestos</span>
                  <span className="font-bold text-lg">+ ${totalImpuestos.toFixed(2)}</span>
                </div>
                
                <div className="pt-4 border-t border-indigo-500/50 flex flex-col items-center text-center">
                  <span className="text-indigo-200 font-bold uppercase tracking-wider text-xs mb-1">Costo Final Unitario</span>
                  <span className="text-4xl font-black">${costoFinal.toFixed(2)}</span>
                </div>
              </div>

              {selectedProduct && (
                <div className="mt-6 bg-indigo-700/50 p-4 rounded-xl space-y-2">
                  <p className="text-xs text-indigo-300 uppercase font-bold text-center">Impacto en Producto</p>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-indigo-200">Costo Anterior:</span>
                    <span className="line-through opacity-70">${selectedProduct.precio_costo.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-white">Nuevo Costo:</span>
                    <span className="text-emerald-300">${costoFinal.toFixed(2)}</span>
                  </div>
                </div>
              )}

            </CardContent>
            <CardFooter className="relative z-10 bg-indigo-950/20 p-6">
              <Button 
                type="submit" 
                disabled={loading || !productoId || costoBase <= 0} 
                className="w-full bg-white text-indigo-600 hover:bg-slate-100 font-black h-12 text-lg shadow-lg"
              >
                {loading ? "Guardando..." : "Confirmar Compra"}
              </Button>
            </CardFooter>
          </Card>

          <Button type="button" variant="outline" className="w-full gap-2 font-bold" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> Volver al Historial
          </Button>
        </div>
      </div>
    </form>
  );
}
