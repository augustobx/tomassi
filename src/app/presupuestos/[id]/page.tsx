"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { use } from "react";
import {
    ClipboardList, ArrowLeft, Loader2, Printer, ArrowRightLeft, Ban,
    User, Calendar, DollarSign, FileText, CheckCircle2, Package
} from "lucide-react";
import Link from "next/link";

import { getPresupuestoById, convertirPresupuestoAVenta, cancelarPresupuesto } from "@/app/actions/presupuestos";
import { getClientSession } from "@/app/actions/auth";
import { getSucursales } from "@/app/actions/configuracion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";

const ESTADO_BADGES: Record<string, { label: string; color: string }> = {
    PENDIENTE: { label: "Pendiente", color: "bg-amber-100 text-amber-700 border-amber-200" },
    CONVERTIDO: { label: "Convertido a Venta", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    CANCELADO: { label: "Cancelado", color: "bg-red-100 text-red-700 border-red-200" },
};

export default function PresupuestoDetallePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [isPending, startTransition] = useTransition();
    const [presupuesto, setPresupuesto] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    const [sucursalActivaId, setSucursalActivaId] = useState<number | null>(null);
    const [depositoActivoId, setDepositoActivoId] = useState<number | null>(null);

    useEffect(() => {
        const initSession = async () => {
            const session = await getClientSession();
            if (session?.sucursalId) {
                setSucursalActivaId(Number(session.sucursalId));
                const sucs = await getSucursales();
                const sucursal = sucs.find((s:any) => s.id === Number(session.sucursalId));
                if (sucursal && sucursal.depositos.length > 0) {
                    setDepositoActivoId(sucursal.depositos[0].id);
                }
            }
        };
        initSession();

        startTransition(async () => {
            const res = await getPresupuestoById(parseInt(id, 10));
            if (res.success) setPresupuesto(res.data);
            else toast.error(res.error);
            setLoading(false);
        });
    }, [id]);

    const handleConvertir = () => {
        if (!presupuesto) return;
        if (!sucursalActivaId || !depositoActivoId) return toast.error("Debe tener una sucursal y depósito activos en la configuración para vender.");
        if (!confirm(`¿Convertir este presupuesto a venta por $${presupuesto.total.toFixed(2)}? Se descontará el stock.`)) return;

        startTransition(async () => {
            const res = await convertirPresupuestoAVenta(presupuesto.id, {
                clienteId: presupuesto.clienteId,
                listaPrecioId: presupuesto.listaPrecioId,
                tipo_comprobante: "COMPROBANTE_X",
                pagos: [{ metodo_pago: "CONTADO", monto: presupuesto.total }],
                subtotal: presupuesto.subtotal,
                descuento_global: presupuesto.descuento_global,
                total: presupuesto.total,
                sucursalId: sucursalActivaId as number,
                depositoId: depositoActivoId as number,
                carrito: presupuesto.detalles.map((d: any) => ({
                    productoId: d.productoId,
                    cantidad: d.cantidad,
                    precio_unitario: d.precio_unitario,
                    descuento_individual: d.descuento_individual || 0,
                    precio_final: d.precio_final,
                    subtotal: d.subtotal,
                }))
            });
            if (res.success) {
                toast.success("¡Presupuesto convertido a venta exitosamente!");
                // Reload
                const res2 = await getPresupuestoById(presupuesto.id);
                if (res2.success) setPresupuesto(res2.data);
            } else {
                toast.error(res.error);
            }
        });
    };

    const handleCancelar = () => {
        if (!confirm("¿Cancelar este presupuesto?")) return;
        startTransition(async () => {
            const res = await cancelarPresupuesto(presupuesto.id);
            if (res.success) {
                toast.success("Presupuesto cancelado.");
                const res2 = await getPresupuestoById(presupuesto.id);
                if (res2.success) setPresupuesto(res2.data);
            } else toast.error(res.error);
        });
    };

    if (loading) return <div className="flex justify-center mt-32"><Loader2 className="animate-spin h-8 w-8 text-emerald-600" /></div>;
    if (!presupuesto) return <div className="text-center mt-32 text-slate-400">Presupuesto no encontrado.</div>;

    const estado = ESTADO_BADGES[presupuesto.estado] || ESTADO_BADGES.PENDIENTE;
    const fecha = new Date(presupuesto.fecha).toLocaleDateString('es-AR');
    const vigenciaFin = new Date(presupuesto.fecha);
    vigenciaFin.setDate(vigenciaFin.getDate() + (presupuesto.vigencia_dias || 15));

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto min-h-[calc(100vh-6rem)] pb-12">

            {/* HEADER */}
            <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4">
                    <Link href="/presupuestos">
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Presupuesto Nº {String(presupuesto.numero).padStart(6, '0')}</h2>
                            <Badge variant="outline" className={`text-xs font-bold ${estado.color}`}>{estado.label}</Badge>
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">Emitido: {fecha} — Vigencia hasta: {vigenciaFin.toLocaleDateString('es-AR')}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="flex gap-2 mb-2 w-full md:w-auto">
                        <Link href={`/imprimir/presupuesto/ticket/${presupuesto.id}?descuentos=true`} target="_blank" className="flex-1">
                            <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium px-4">
                                <Printer className="h-4 w-4 mr-2" /> Ticket 80mm
                            </Button>
                        </Link>
                        <Link href={`/imprimir/presupuesto/${presupuesto.id}`} target="_blank" className="flex-1">
                            <Button variant="outline" className="w-full border-slate-200 text-slate-700 font-medium hover:bg-slate-50 px-4">
                                <FileText className="h-4 w-4 mr-2" /> Hoja A4
                            </Button>
                        </Link>
                    </div>
                    {presupuesto.estado === 'PENDIENTE' && (
                        <>
                            <Button onClick={handleConvertir} disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm">
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
                                Convertir a Venta
                            </Button>
                            <Button variant="outline" onClick={handleCancelar} disabled={isPending} className="text-orange-600 border-orange-200 hover:bg-orange-50">
                                <Ban className="h-4 w-4 mr-1" /> Cancelar
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* INFO */}
                <Card className="shadow-sm border-slate-200 bg-white">
                    <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-slate-400" /><span className="font-bold text-slate-700">{presupuesto.cliente?.nombre_razon_social}</span></div>
                        <div className="flex items-center gap-2 text-sm"><DollarSign className="h-4 w-4 text-slate-400" /><span className="text-slate-600">{presupuesto.listaPrecio?.nombre || 'N/A'}</span></div>
                        <div className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-slate-400" /><span className="text-slate-600">Vigencia: {presupuesto.vigencia_dias} días</span></div>
                        {presupuesto.notas && (
                            <div className="pt-2 border-t border-slate-100">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Notas</p>
                                <p className="text-xs text-slate-600">{presupuesto.notas}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* TOTALES */}
                <Card className="md:col-span-2 shadow-sm border-slate-200 bg-white">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-sm text-slate-500">Subtotal</span>
                            <span className="font-mono font-medium">${presupuesto.subtotal.toFixed(2)}</span>
                        </div>
                        {presupuesto.descuento_global > 0 && (
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-sm text-emerald-600 font-medium">Descuento Global</span>
                                <span className="font-mono font-medium text-emerald-600">- ${presupuesto.descuento_global.toFixed(2)}</span>
                            </div>
                        )}
                        <Separator className="my-3" />
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-slate-900">Total</span>
                            <span className="text-3xl font-black text-emerald-600">${presupuesto.total.toFixed(2)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* DETALLE */}
            <Card className="shadow-sm border-slate-200 bg-white overflow-hidden">
                <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4 text-emerald-600" /> Ítems del Presupuesto ({presupuesto.detalles?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 tracking-wider border-b">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold">Producto</th>
                                <th className="px-4 py-3 text-center font-semibold">Cantidad</th>
                                <th className="px-4 py-3 text-right font-semibold">P. Unitario</th>
                                <th className="px-4 py-3 text-center font-semibold">Desc. %</th>
                                <th className="px-4 py-3 text-right font-semibold">P. Final</th>
                                <th className="px-4 py-3 text-right font-semibold">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {presupuesto.detalles?.map((det: any) => (
                                <tr key={det.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-slate-900">{det.producto?.nombre_producto || 'Producto eliminado'}</p>
                                        <p className="text-[11px] text-slate-400 font-mono">{det.producto?.codigo_articulo}</p>
                                    </td>
                                    <td className="px-4 py-3 text-center font-medium">{det.cantidad}</td>
                                    <td className="px-4 py-3 text-right font-mono">${det.precio_unitario.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-center">{det.descuento_individual > 0 ? `${det.descuento_individual}%` : '-'}</td>
                                    <td className="px-4 py-3 text-right font-bold">${det.precio_final.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right font-black text-slate-900">${det.subtotal.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    );
}
