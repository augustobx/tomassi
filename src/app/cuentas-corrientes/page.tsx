"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import {
    Users, AlertTriangle, BadgeDollarSign, FileText,
    History, DollarSign, Calculator, X, Loader2, ArrowRight, Search, Landmark, MessageCircle
} from "lucide-react";

import {
    getClientesDeudores,
    getFichaCuentaCorriente,
    registrarPagoCC,
    recalcularVentaVencida
} from "@/app/actions/cuentas-corrientes";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export default function CuentasCorrientesPage() {
    const [isPending, startTransition] = useTransition();
    const [deudores, setDeudores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtros
    const [termino, setTermino] = useState("");
    const [filtroEstado, setFiltroEstado] = useState("TODOS");
    const [fechaDesde, setFechaDesde] = useState("");
    const [fechaHasta, setFechaHasta] = useState("");

    // Estado para la Ficha del Cliente
    const [fichaCliente, setFichaCliente] = useState<any | null>(null);
    const [loadingFicha, setLoadingFicha] = useState(false);

    // Estado para el Modal de Pago
    const [ventaCobrar, setVentaCobrar] = useState<any | null>(null);
    const [montoPago, setMontoPago] = useState<string>("");
    const [metodoPago, setMetodoPago] = useState("CONTADO");
    const [notasPago, setNotasPago] = useState("");
    const [descuentoPago, setDescuentoPago] = useState<string>("");

    const cargarDeudores = () => {
        setLoading(true);
        startTransition(async () => {
            const res = await getClientesDeudores({
                termino,
                estado: filtroEstado,
                fecha_desde: fechaDesde,
                fecha_hasta: fechaHasta
            });
            if (res.success && res.data) {
                setDeudores(res.data);
            }
            setLoading(false);
        });
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            cargarDeudores();
        }, 400);
        return () => clearTimeout(timer);
    }, [termino, filtroEstado, fechaDesde, fechaHasta]);

    const handleAbrirFicha = async (clienteId: number) => {
        setLoadingFicha(true);
        const res = await getFichaCuentaCorriente(clienteId);
        if (res.success && res.data) {
            setFichaCliente(res.data);
        } else {
            toast.error("Error al cargar la ficha del cliente.");
        }
        setLoadingFicha(false);
    };

    const handleRecalcular = (ventaId: number) => {
        if (!confirm("¿Estás seguro de recalcular esta deuda? Se buscarán los precios actuales de los productos en el sistema y se actualizará el saldo.")) return;

        startTransition(async () => {
            const res = await recalcularVentaVencida(ventaId);
            if (res.success && res.nuevoSaldo !== undefined) {
                toast.success("Deuda actualizada", { description: `El nuevo saldo es de $${res.nuevoSaldo.toFixed(2)}` });
                if (fichaCliente) handleAbrirFicha(fichaCliente.cliente.id);
                cargarDeudores();
            } else {
                toast.error(res.error);
            }
        });
    };

    const handleProcesarPago = () => {
        const monto = Number(montoPago);
        if (monto <= 0) return toast.error("El monto debe ser mayor a 0.");
        if (monto > ventaCobrar.saldo_pendiente) return toast.error("El monto ingresado es mayor a la deuda.");

        startTransition(async () => {
            const res = await registrarPagoCC({
                clienteId: fichaCliente.cliente.id,
                ventaId: ventaCobrar.id,
                monto: monto,
                metodo_pago: metodoPago,
                notas: notasPago,
                descuento_porcentaje: descuentoPago ? Number(descuentoPago) : undefined,
            });

            if (res.success) {
                toast.success("¡Recibo registrado exitosamente!");
                setVentaCobrar(null);
                setMontoPago("");
                setNotasPago("");
                setDescuentoPago("");
                if (fichaCliente) handleAbrirFicha(fichaCliente.cliente.id);
                cargarDeudores();
            } else {
                toast.error(res.error);
            }
        });
    };

    const totalEnLaCalle = deudores.reduce((acc, d) => acc + d.total_deuda, 0);

    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto min-h-[calc(100vh-6rem)]">

            {/* HEADER MODERNO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl gap-4 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl">
                        <Landmark className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Cuentas Corrientes</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Gestiona saldos pendientes, cobra recibos y actualiza deudas.</p>
                    </div>
                </div>
            </div>

            {/* DASHBOARD RÁPIDO & FILTROS */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">

                {/* Métricas */}
                <div className="xl:col-span-4 grid grid-cols-2 gap-4 h-full">
                    <Card className="shadow-sm border-red-100 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5 h-full">
                        <CardContent className="p-5 flex flex-col justify-center h-full">
                            <p className="text-[10px] font-bold uppercase text-red-600/80 tracking-wider">Total Filtrado</p>
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">${totalEnLaCalle.toFixed(2)}</h3>
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 h-full">
                        <CardContent className="p-5 flex flex-col justify-center h-full">
                            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Clientes con Deuda</p>
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">{deudores.length}</h3>
                        </CardContent>
                    </Card>
                </div>

                {/* Filtros */}
                <Card className="xl:col-span-8 shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 h-full">
                    <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end h-full">
                        <div className="flex-1 w-full space-y-1.5">
                            <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Buscar Cliente</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Nombre o DNI..."
                                    value={termino} onChange={(e) => setTermino(e.target.value)}
                                    className="pl-9 h-10 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700"
                                />
                            </div>
                        </div>

                        <div className="w-full md:w-[220px] space-y-1.5">
                            <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Estado de Cuenta</Label>
                            <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v || "")}>
                                <SelectTrigger className="h-10 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TODOS">Todos los saldos</SelectItem>
                                    <SelectItem value="VENCIDAS" className="text-red-600 font-bold">Solo Vencidas</SelectItem>
                                    <SelectItem value="AL_DIA">Solo al Día</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="w-full md:w-[140px] space-y-1.5">
                            <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Desde</Label>
                            <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="h-10 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700" />
                        </div>

                        <div className="w-full md:w-[140px] space-y-1.5">
                            <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Hasta</Label>
                            <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="h-10 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700" />
                        </div>

                        <Button variant="outline" onClick={() => { setTermino(""); setFiltroEstado("TODOS"); setFechaDesde(""); setFechaHasta(""); }} className="w-full md:w-auto h-10 text-slate-600 hover:bg-slate-50">
                            Limpiar
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* LISTA DE DEUDORES */}
            <Card className="flex-1 shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] uppercase tracking-wider bg-slate-50 dark:bg-zinc-800/50 sticky top-0 z-10 text-slate-500 border-b border-slate-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Cliente</th>
                                <th className="px-6 py-4 font-semibold text-center">Facturas</th>
                                <th className="px-6 py-4 font-semibold text-center">Estado</th>
                                <th className="px-6 py-4 font-semibold text-right">Deuda Total</th>
                                <th className="px-6 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-16">
                                        <Loader2 className="animate-spin h-8 w-8 text-indigo-500 mx-auto" />
                                    </td>
                                </tr>
                            ) : deudores.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-16 text-slate-400">
                                        <BadgeDollarSign className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                        <p className="text-base font-medium">No hay cuentas pendientes con estos filtros.</p>
                                    </td>
                                </tr>
                            ) : (
                                deudores.map((d) => (
                                    <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                                                    {d.nombre.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-sm text-slate-900 dark:text-white">{d.nombre}</p>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">{d.telefono ? `📞 ${d.telefono}` : "Sin teléfono registrado"}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center font-bold text-sm text-slate-700 dark:text-slate-300">
                                            {d.cantidad_facturas}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {d.ventas_vencidas > 0 ? (
                                                <Badge variant="outline" className="border-red-200 text-red-600 bg-red-50 dark:bg-red-500/10 font-bold text-[10px] uppercase tracking-wider">
                                                    <AlertTriangle className="h-3 w-3 mr-1" /> {d.ventas_vencidas} Vencida(s)
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 font-bold text-[10px] uppercase tracking-wider">
                                                    Al Día (En plazo)
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <p className="font-black text-lg text-slate-900 dark:text-white">${d.total_deuda.toFixed(2)}</p>
                                            {d.limite_credito ? (
                                                <p className={`text-[10px] font-bold mt-1 uppercase ${d.total_deuda > d.limite_credito ? 'text-red-500' : 'text-slate-400'}`}>
                                                    Límite: ${d.limite_credito.toFixed(2)}
                                                </p>
                                            ) : (
                                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Crédito Libre</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <Button
                                                    onClick={() => handleAbrirFicha(d.id)}
                                                    disabled={loadingFicha}
                                                    variant="ghost"
                                                    className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-semibold text-xs h-8"
                                                >
                                                    {loadingFicha ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                                                        <>Ver Cuenta <ArrowRight className="h-4 w-4 ml-1" /></>
                                                    )}
                                                </Button>
                                                {d.telefono && (
                                                    <a
                                                        href={`https://wa.me/${d.telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${d.nombre}, te escribimos de Tendeco POS. Te detallamos que poseés un saldo pendiente actualizado en tu cuenta corriente de $${d.total_deuda.toFixed(2)}.\n\nPor favor, contactate para coordinar el pago o acercate a la sucursal. ¡Gracias por confiar en nosotros!`)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title="Enviar recordatorio por WhatsApp"
                                                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 bg-white border border-emerald-100 dark:border-emerald-900/50 transition-colors shrink-0"
                                                    >
                                                        <MessageCircle className="h-4 w-4" />
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>


            {/* =========================================================================
          SÚPER MODAL: FICHA DEL CLIENTE
          ========================================================================= */}
            {fichaCliente && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden relative">

                        {/* Header del Modal */}
                        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-900 shrink-0">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                    <FileText className="h-5 w-5 text-indigo-500" />
                                    Ficha de Cuenta Corriente
                                </h3>
                                <p className="text-sm font-semibold text-slate-500 mt-0.5">{fichaCliente.cliente.nombre_razon_social}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setFichaCliente(null)} className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-200">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-0 flex flex-col md:flex-row">

                            {/* COLUMNA IZQUIERDA: FACTURAS PENDIENTES */}
                            <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-slate-100 dark:border-zinc-800 bg-slate-50/30">
                                <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider mb-4 flex items-center gap-1">
                                    <BadgeDollarSign className="h-3.5 w-3.5" /> Facturas por Cobrar
                                </h4>

                                {fichaCliente.ventasPendientes.length === 0 ? (
                                    <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm font-medium">Este cliente no tiene deudas pendientes.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {fichaCliente.ventasPendientes.map((venta: any) => {
                                            const estaVencida = venta.fecha_vencimiento_cc && new Date(venta.fecha_vencimiento_cc) < new Date();

                                            return (
                                                <Card key={venta.id} className={`shadow-sm overflow-hidden border ${estaVencida ? 'border-red-200 dark:border-red-500/30' : 'border-slate-200 dark:border-zinc-700'}`}>
                                                    <div className={`p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b ${estaVencida ? 'bg-red-50/50 dark:bg-red-500/5 border-red-100' : 'bg-slate-50/50 border-slate-100'}`}>
                                                        <div>
                                                            <p className="font-semibold text-sm text-slate-900 dark:text-white">Fac. {venta.tipo_comprobante.replace('_', ' ')} 000{venta.punto_venta}-{String(venta.numero_comprobante).padStart(8, '0')}</p>
                                                            <p className="text-xs text-slate-500 mt-1">Emitida: {new Date(venta.fecha_emision).toLocaleDateString('es-AR')}</p>
                                                        </div>
                                                        <div className="text-left sm:text-right">
                                                            {estaVencida ? (
                                                                <Badge variant="outline" className="border-red-200 text-red-600 bg-red-50 font-bold mb-1 text-[10px] uppercase tracking-wider">
                                                                    <AlertTriangle className="h-3 w-3 mr-1" /> Precio Vencido
                                                                </Badge>
                                                            ) : (
                                                                <p className="text-[10px] uppercase font-bold text-emerald-600 mb-1 tracking-wider">Congelado hasta: {venta.fecha_vencimiento_cc ? new Date(venta.fecha_vencimiento_cc).toLocaleDateString('es-AR') : 'N/A'}</p>
                                                            )}
                                                            <p className="text-xl font-black text-slate-900 dark:text-white">${venta.saldo_pendiente.toFixed(2)}</p>
                                                            <p className="text-[10px] text-slate-400 font-medium">Total original: ${venta.total.toFixed(2)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-3 bg-white dark:bg-zinc-900 flex justify-end gap-2 flex-wrap">
                                                        {estaVencida && (
                                                            <Button
                                                                variant="outline"
                                                                onClick={() => handleRecalcular(venta.id)}
                                                                disabled={isPending}
                                                                className="h-8 text-xs font-semibold border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                                                            >
                                                                <Calculator className="h-3.5 w-3.5 mr-1.5" /> Actualizar Inflación
                                                            </Button>
                                                        )}
                                                        <Button
                                                            onClick={() => { setVentaCobrar(venta); setMontoPago(String(venta.saldo_pendiente)); }}
                                                            className="h-8 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white"
                                                        >
                                                            <DollarSign className="h-3.5 w-3.5 mr-1" /> Cobrar
                                                        </Button>
                                                    </div>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* COLUMNA DERECHA: HISTORIAL DE PAGOS */}
                            <div className="w-full md:w-[380px] p-5">
                                <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider mb-4 flex items-center gap-1">
                                    <History className="h-3.5 w-3.5" /> Historial de Abonos
                                </h4>

                                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-100 dark:before:bg-zinc-800">
                                    {fichaCliente.movimientos.length === 0 ? (
                                        <p className="text-sm font-medium text-slate-400 text-center pt-8">No hay pagos registrados aún.</p>
                                    ) : (
                                        fichaCliente.movimientos.map((mov: any) => (
                                            <div key={mov.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full border-[3px] border-white dark:border-zinc-900 bg-emerald-500 text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 shadow-sm">
                                                    <DollarSign className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1.5rem)] p-3.5 rounded-xl border border-slate-100 bg-white dark:bg-zinc-800 shadow-sm">
                                                    <div className="flex items-start justify-between mb-1">
                                                        <div className="font-bold text-sm text-emerald-600">+${mov.monto.toFixed(2)}</div>
                                                        <time className="font-mono text-[10px] text-slate-400">{new Date(mov.fecha).toLocaleDateString('es-AR')}</time>
                                                    </div>
                                                    <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{mov.metodo_pago}</p>
                                                    {mov.notas && <p className="text-[10px] text-slate-400 mt-2 italic leading-tight">{mov.notas}</p>}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
          MINI MODAL: REGISTRAR PAGO (COMPACTO Y MODERNO)
          ========================================================================= */}
            {ventaCobrar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
                    <Card className="w-full max-w-md shadow-2xl border border-slate-200 dark:border-zinc-800 rounded-2xl flex flex-col">

                        <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-4 shrink-0 rounded-t-2xl">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg"><DollarSign className="h-4 w-4" /></div>
                                    <div>
                                        <CardTitle className="text-base text-slate-900 dark:text-white">Ingresar Abono</CardTitle>
                                        <CardDescription className="text-[11px] text-slate-500 mt-0.5">
                                            Fac. {ventaCobrar.tipo_comprobante.replace('_', ' ')} 000{ventaCobrar.punto_venta}-{ventaCobrar.numero_comprobante}
                                        </CardDescription>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setVentaCobrar(null)} className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-200">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="p-5 space-y-5">

                            {/* Deuda Actual vs Medio Pago */}
                            <div className="flex gap-4 items-center">
                                <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700 rounded-xl flex-1">
                                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Deuda Actual</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">${ventaCobrar.saldo_pendiente.toFixed(2)}</p>
                                </div>
                                <div className="flex-1 space-y-1.5">
                                    <Label className="font-bold text-[10px] uppercase text-slate-500 tracking-wider">Medio de Pago</Label>
                                    <Select value={metodoPago} onValueChange={(v) => setMetodoPago(v || "")}>
                                        <SelectTrigger className="bg-white dark:bg-zinc-900 h-10 border-slate-200 dark:border-zinc-700 font-medium text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CONTADO">Efectivo</SelectItem>
                                            <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                                            <SelectItem value="TARJETA">Tarjeta</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Input de Monto */}
                            <div className="space-y-2 p-4 bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-xl">
                                <Label className="font-bold text-[11px] uppercase text-emerald-600 tracking-wider">Entrega del cliente ($)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        autoFocus
                                        value={montoPago}
                                        onChange={(e) => setMontoPago(e.target.value)}
                                        className="h-11 text-xl font-black text-emerald-700 dark:text-emerald-400 bg-white dark:bg-zinc-900 flex-1 text-center border-emerald-200 dark:border-emerald-500/30 focus-visible:ring-emerald-500"
                                    />
                                    <Button variant="outline" className="h-11 px-4 text-xs font-semibold bg-white border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => setMontoPago(String(ventaCobrar.saldo_pendiente / 2))}>Mitad</Button>
                                    <Button variant="outline" className="h-11 px-4 text-xs font-semibold bg-white border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => setMontoPago(String(ventaCobrar.saldo_pendiente))}>Total</Button>
                                </div>
                            </div>

                            {/* Descuento por pronto pago */}
                            <div className="space-y-2 p-3 bg-purple-50/50 dark:bg-purple-500/5 border border-purple-100 dark:border-purple-500/20 rounded-xl">
                                <Label className="font-bold text-[11px] uppercase text-purple-600 tracking-wider">Descuento por pronto pago (%)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number" step="0.1" min="0" max="100"
                                        value={descuentoPago}
                                        onChange={(e) => setDescuentoPago(e.target.value)}
                                        placeholder="Ej: 5"
                                        className="h-10 text-lg font-bold text-center text-purple-700 dark:text-purple-400 bg-white dark:bg-zinc-900 border-purple-200 dark:border-purple-500/30 focus-visible:ring-purple-500 flex-1"
                                    />
                                    <Button variant="outline" className="h-10 px-3 text-xs font-semibold bg-white border-slate-200 text-slate-600" onClick={() => setDescuentoPago("5")}>5%</Button>
                                    <Button variant="outline" className="h-10 px-3 text-xs font-semibold bg-white border-slate-200 text-slate-600" onClick={() => setDescuentoPago("10")}>10%</Button>
                                </div>
                                {descuentoPago && Number(descuentoPago) > 0 && (
                                    <p className="text-xs text-purple-600 font-medium mt-1">
                                        El cliente paga ${(Number(montoPago) * (1 - Number(descuentoPago) / 100)).toFixed(2)} y se cancelan ${Number(montoPago).toFixed(2)} de deuda.
                                    </p>
                                )}
                            </div>

                            {/* Notas */}
                            <div className="space-y-1.5">
                                <Label className="font-bold text-[10px] uppercase text-slate-500 tracking-wider">Notas de Recibo (Opcional)</Label>
                                <Textarea
                                    value={notasPago}
                                    onChange={(e) => setNotasPago(e.target.value)}
                                    className="resize-none text-sm bg-slate-50 dark:bg-zinc-800/50 h-12 border-slate-200 dark:border-zinc-700"
                                    placeholder="Ej: Transf. Banco Provincia..."
                                />
                            </div>

                            {/* Botones de acción */}
                            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                                <Button variant="ghost" onClick={() => setVentaCobrar(null)} className="w-1/3 h-11 text-slate-600 font-medium">Cancelar</Button>
                                <Button onClick={handleProcesarPago} disabled={isPending || !montoPago} className="w-2/3 h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm">
                                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Recibo"}
                                </Button>
                            </div>

                        </CardContent>
                    </Card>
                </div>
            )}

        </div>
    );
}