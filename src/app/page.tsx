"use client";

import { useState, useEffect, useTransition } from "react";
import { getDashboardMetrics } from "@/app/actions/dashboard";
import {
  LayoutDashboard, TrendingUp, AlertTriangle, BadgeDollarSign,
  Wallet, Settings, Receipt, Package, ArrowRight, Loader2, Check
} from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function DashboardPage() {
  const [isPending, startTransition] = useTransition();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // === MOTOR DE PERSONALIZACIÓN DE WIDGETS ===
  const [showConfig, setShowConfig] = useState(false);
  const [widgets, setWidgets] = useState({
    kpis: true,          // Las 4 tarjetas de arriba
    alertasStock: true,  // Panel de bajo stock
    ultimasVentas: true, // Feed de ventas recientes
    accesos: true        // Botones rápidos
  });

  // Cargar preferencias guardadas en el navegador
  useEffect(() => {
    const saved = localStorage.getItem("tendeco_dashboard_prefs");
    if (saved) {
      setWidgets(JSON.parse(saved));
    }

    // Cargar datos del backend
    setLoading(true);
    startTransition(async () => {
      const res = await getDashboardMetrics();
      if (res.success) setMetrics(res.data);
      setLoading(false);
    });
  }, []);

  // Guardar preferencias
  const toggleWidget = (key: keyof typeof widgets) => {
    const newWidgets = { ...widgets, [key]: !widgets[key] };
    setWidgets(newWidgets);
    localStorage.setItem("tendeco_dashboard_prefs", JSON.stringify(newWidgets));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="text-slate-500 font-medium animate-pulse">Cargando tu centro de mando...</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <p className="text-slate-500 font-medium">Error de conexión con la base de datos o métricas no disponibles.</p>
        <Button onClick={() => window.location.reload()} variant="outline">Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto min-h-[calc(100vh-6rem)]">

      {/* HEADER Y BOTÓN DE CONFIGURACIÓN */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl">
            <LayoutDashboard className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Panel Principal</h2>
            <p className="text-sm text-slate-500 mt-0.5">Resumen operativo de tu negocio al día de hoy.</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowConfig(!showConfig)}
          className={`h-10 border-slate-200 font-medium transition-colors ${showConfig ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <Settings className="h-4 w-4 mr-2" /> Configurar Vista
        </Button>
      </div>

      {/* PANEL DE CONFIGURACIÓN DESPLEGABLE */}
      {showConfig && (
        <Card className="border-indigo-100 bg-indigo-50/30 dark:bg-indigo-500/5 shadow-sm animate-in slide-in-from-top-4 fade-in duration-200">
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-4">Personalizar Dashboard</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-3 rounded-lg border border-slate-200 dark:border-zinc-800">
                <Label className="font-semibold text-sm cursor-pointer" onClick={() => toggleWidget('kpis')}>Métricas (KPIs)</Label>
                <Switch checked={widgets.kpis} onCheckedChange={() => toggleWidget('kpis')} />
              </div>
              <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-3 rounded-lg border border-slate-200 dark:border-zinc-800">
                <Label className="font-semibold text-sm cursor-pointer" onClick={() => toggleWidget('alertasStock')}>Alertas de Stock</Label>
                <Switch checked={widgets.alertasStock} onCheckedChange={() => toggleWidget('alertasStock')} />
              </div>
              <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-3 rounded-lg border border-slate-200 dark:border-zinc-800">
                <Label className="font-semibold text-sm cursor-pointer" onClick={() => toggleWidget('ultimasVentas')}>Últimas Ventas</Label>
                <Switch checked={widgets.ultimasVentas} onCheckedChange={() => toggleWidget('ultimasVentas')} />
              </div>
              <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-3 rounded-lg border border-slate-200 dark:border-zinc-800">
                <Label className="font-semibold text-sm cursor-pointer" onClick={() => toggleWidget('accesos')}>Accesos Rápidos</Label>
                <Switch checked={widgets.accesos} onCheckedChange={() => toggleWidget('accesos')} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 1. MÓDULO: MÉTRICAS PRINCIPALES (KPIs) */}
      {widgets.kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          <Card className="shadow-sm border-emerald-100 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold uppercase text-emerald-600/80 tracking-wider">Ingresos Hoy</p>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">${metrics.ventasHoy.toFixed(2)}</h3>
                </div>
                <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg text-emerald-600"><TrendingUp className="h-5 w-5" /></div>
              </div>
              <p className="text-xs font-medium text-emerald-600/70 mt-3">{metrics.cantidadVentasHoy} comprobantes emitidos</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Efectivo en Caja</p>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {metrics.cajaAbierta ? `$${metrics.efectivoEnCaja.toFixed(2)}` : 'CERRADA'}
                  </h3>
                </div>
                <div className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-slate-600"><Wallet className="h-5 w-5" /></div>
              </div>
              <p className="text-xs font-medium text-slate-400 mt-3">
                {metrics.cajaAbierta ? "Turno actual operando" : "Abrí el turno para operar"}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-orange-100 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/5">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold uppercase text-orange-600/80 tracking-wider">Cuentas por Cobrar</p>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">${metrics.deudaTotal.toFixed(2)}</h3>
                </div>
                <div className="p-2 bg-orange-100 dark:bg-orange-500/20 rounded-lg text-orange-600"><BadgeDollarSign className="h-5 w-5" /></div>
              </div>
              <p className="text-xs font-medium text-orange-600/70 mt-3">Capital en la calle</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-red-100 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold uppercase text-red-600/80 tracking-wider">Alertas de Inventario</p>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{metrics.totalBajoStock}</h3>
                </div>
                <div className="p-2 bg-red-100 dark:bg-red-500/20 rounded-lg text-red-600"><AlertTriangle className="h-5 w-5" /></div>
              </div>
              <p className="text-xs font-medium text-red-600/70 mt-3">Productos debajo del mínimo</p>
            </CardContent>
          </Card>

        </div>
      )}

      {/* BLOQUE INFERIOR: TABLAS Y ACCESOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 2. MÓDULO: ÚLTIMAS VENTAS (Ocupa 2 columnas en desktop) */}
        {widgets.ultimasVentas && (
          <Card className="lg:col-span-2 shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col">
            <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-5 flex flex-row justify-between items-center">
              <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Receipt className="h-4 w-4 text-slate-400" /> Últimas Operaciones
              </CardTitle>
              <Link href="/historial">
                <Button variant="ghost" size="sm" className="h-8 text-xs text-indigo-600 hover:bg-indigo-50 font-semibold">Ver todas <ArrowRight className="h-3 w-3 ml-1" /></Button>
              </Link>
            </CardHeader>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase tracking-wider bg-slate-50 dark:bg-zinc-800/50 text-slate-500 border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Cliente</th>
                    <th className="px-5 py-3 font-semibold">Comprobante</th>
                    <th className="px-5 py-3 font-semibold text-center">Estado</th>
                    <th className="px-5 py-3 font-semibold text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {metrics.ultimasVentas.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-slate-400">No hay ventas registradas.</td></tr>
                  ) : (
                    metrics.ultimasVentas.map((v: any) => (
                      <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white truncate max-w-[150px]">{v.cliente.nombre_razon_social}</td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{v.tipo_comprobante.replace('_', ' ')} 000{v.punto_venta}-{v.numero_comprobante}</td>
                        <td className="px-5 py-3 text-center">
                          <Badge variant="outline" className={`text-[9px] uppercase font-bold ${v.estado_pago === 'PAGADO' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-orange-600 bg-orange-50 border-orange-200'}`}>
                            {v.estado_pago}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right font-black text-slate-900 dark:text-white">${v.total.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* COLUMNA DERECHA (Stock y Accesos) */}
        <div className="flex flex-col gap-6">

          {/* 3. MÓDULO: ALERTAS DE STOCK */}
          {widgets.alertasStock && (
            <Card className="shadow-sm border-red-100 dark:border-red-500/20 bg-white dark:bg-zinc-900 flex flex-col">
              <CardHeader className="bg-red-50/50 dark:bg-red-500/5 border-b border-red-100 dark:border-red-500/10 p-4">
                <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-4 w-4" /> Reposición Urgente
                </CardTitle>
              </CardHeader>
              <div className="p-0">
                <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {metrics.productosBajoStock.length === 0 ? (
                    <div className="text-center py-6 text-emerald-600 font-medium text-sm flex flex-col items-center">
                      <div className="bg-emerald-50 p-2 rounded-full mb-2"><Check className="h-5 w-5" /></div>
                      Stock en orden
                    </div>
                  ) : (
                    metrics.productosBajoStock.map((p: any) => (
                      <div key={p.id} className="p-3 px-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                        <p className="font-semibold text-xs text-slate-700 dark:text-slate-300 truncate max-w-[180px]" title={p.nombre_producto}>{p.nombre_producto}</p>
                        <Badge variant="destructive" className="font-mono text-[10px] px-1.5 py-0 h-5">Quedan {p.stock_actual}</Badge>
                      </div>
                    ))
                  )}
                </div>
                {metrics.totalBajoStock > 5 && (
                  <Link href="/inventario" className="block text-center text-xs font-semibold text-indigo-600 p-3 bg-slate-50 hover:bg-indigo-50 transition-colors border-t border-slate-100">
                    Ver los {metrics.totalBajoStock} productos
                  </Link>
                )}
              </div>
            </Card>
          )}

          {/* 4. MÓDULO: ACCESOS RÁPIDOS */}
          {widgets.accesos && (
            <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <CardContent className="p-4 space-y-2">
                <Link href="/ventas">
                  <Button className="w-full justify-start h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm">
                    <Receipt className="h-4 w-4 mr-3 opacity-70" /> Ir a Facturar
                  </Button>
                </Link>
                <Link href="/inventario/nuevo">
                  <Button variant="outline" className="w-full justify-start h-11 border-slate-200 text-slate-700 hover:bg-slate-50 font-medium">
                    <Package className="h-4 w-4 mr-3 text-slate-400" /> Cargar Producto
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}