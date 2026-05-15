"use client";

import { useState, useEffect, useTransition } from "react";
import { getHistorialCompras } from "@/app/actions/compras";
import { PlusCircle, Search, Wallet, Loader2, ArrowRight, X, FileText } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ComprasPage() {
  const [isPending, startTransition] = useTransition();
  const [compras, setCompras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [termino, setTermino] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [compraSeleccionada, setCompraSeleccionada] = useState<any | null>(null);

  const cargarHistorial = () => {
    setLoading(true);
    startTransition(async () => {
      // Usaremos getHistorialCompras pero agregaremos soporte para 'termino' en el backend o filtramos acá
      const res = await getHistorialCompras({ desde: fechaDesde, hasta: fechaHasta });
      
      // Filtrado local por término (nombre o código de producto)
      let filtradas = res;
      if (termino) {
        const t = termino.toLowerCase();
        filtradas = res.filter((c: any) => 
          c.producto.nombre_producto.toLowerCase().includes(t) || 
          c.producto.codigo_articulo.toLowerCase().includes(t) ||
          (c.notas && c.notas.toLowerCase().includes(t))
        );
      }

      setCompras(filtradas);
      setLoading(false);
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => { cargarHistorial(); }, 400);
    return () => clearTimeout(timer);
  }, [termino, fechaDesde, fechaHasta]);

  return (
    <div className="flex flex-col gap-6 w-full mx-auto min-h-[calc(100vh-6rem)]">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl">
            <Wallet className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Historial de Compras y Gastos</h2>
            <p className="text-sm text-slate-500 mt-0.5">Control de costos, facturas de compras e impuestos pagados.</p>
          </div>
        </div>
        <Link href="/compras/nueva">
          <Button className="bg-indigo-600 hover:bg-indigo-700 font-bold gap-2">
            <PlusCircle className="h-5 w-5" /> Registrar Compra
          </Button>
        </Link>
      </div>

      {/* FILTROS */}
      <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <CardContent className="p-4 flex flex-col lg:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-1.5">
            <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Buscar Producto / Notas</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input placeholder="Nombre de producto, código..." value={termino} onChange={(e) => setTermino(e.target.value)} className="pl-9 h-10 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700" />
            </div>
          </div>
          <div className="w-full lg:w-[160px] space-y-1.5">
            <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Fecha Desde</Label>
            <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="h-10 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700" />
          </div>
          <div className="w-full lg:w-[160px] space-y-1.5">
            <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Fecha Hasta</Label>
            <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="h-10 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700" />
          </div>
          <Button variant="outline" onClick={() => { setTermino(""); setFechaDesde(""); setFechaHasta(""); }} className="w-full lg:w-auto h-10 border-slate-200 text-slate-600 hover:bg-slate-50">Limpiar</Button>
        </CardContent>
      </Card>

      {/* TABLA */}
      <Card className="flex-1 shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] uppercase tracking-wider bg-slate-50 dark:bg-zinc-800/50 sticky top-0 z-10 text-slate-500 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Fecha y Hora</th>
                <th className="px-6 py-4 font-semibold">Producto</th>
                <th className="px-6 py-4 font-semibold">Costo Base</th>
                <th className="px-6 py-4 font-semibold">Impuestos</th>
                <th className="px-6 py-4 font-semibold text-right">Costo Final</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-16"><Loader2 className="animate-spin h-8 w-8 text-indigo-500 mx-auto" /></td></tr>
              ) : compras.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-400">
                    <Wallet className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-base font-medium">No se encontraron registros.</p>
                  </td>
                </tr>
              ) : (
                compras.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white">
                        {new Date(v.fecha).toLocaleDateString("es-AR")}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(v.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{v.producto.nombre_producto}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Cód: {v.producto.codigo_articulo}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-700">${v.costo_base.toFixed(2)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {v.impuestos.length > 0 ? (
                          <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                            {v.impuestos.length} impuestos
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="font-black text-lg text-emerald-600">${v.costo_final.toFixed(2)}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button
                        onClick={() => setCompraSeleccionada(v)}
                        variant="ghost" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-semibold text-xs"
                      >
                        Ver Detalles <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL DETALLE */}
      {compraSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-900">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <FileText className="h-5 w-5 text-indigo-500" /> Detalle de Compra #{compraSeleccionada.id}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setCompraSeleccionada(null)} className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-200">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="mb-6 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Producto Adquirido</p>
                <p className="text-lg font-black text-slate-800">{compraSeleccionada.producto.nombre_producto}</p>
                <p className="text-sm text-slate-500">Cód: {compraSeleccionada.producto.codigo_articulo}</p>
                {compraSeleccionada.notas && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-sm text-slate-600 whitespace-pre-wrap"><strong>Notas:</strong> {compraSeleccionada.notas}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-sm text-slate-700">Desglose de Costos</h4>
                
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Costo Base</span>
                  <span className="font-semibold">${compraSeleccionada.costo_base.toFixed(2)}</span>
                </div>
                
                {compraSeleccionada.impuestos.map((imp: any) => (
                  <div key={imp.id} className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-slate-500 flex items-center gap-2">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Impuesto</span>
                      {imp.nombre} {imp.porcentaje ? `(${imp.porcentaje}%)` : ""}
                    </span>
                    <span className="font-medium text-slate-700">${imp.monto.toFixed(2)}</span>
                  </div>
                ))}

                <div className="flex justify-between items-center py-4 bg-emerald-50 px-4 rounded-xl mt-4">
                  <span className="font-bold text-emerald-800 uppercase tracking-wider text-xs">Costo Final Impactado</span>
                  <span className="font-black text-2xl text-emerald-600">${compraSeleccionada.costo_final.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
