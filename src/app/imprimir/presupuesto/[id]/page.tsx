"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { getDatosEmpresa } from "@/app/actions/configuracion-empresa";
import { getPresupuestoById } from "@/app/actions/presupuestos";
import { Store, Loader2 } from "lucide-react";

export default function PresupuestoA4PrintPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const presupuestoId = Number(id);

    const [presupuesto, setPresupuesto] = useState<any>(null);
    const [empresa, setEmpresa] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const cargarDatos = async () => {
            const [pRes, emp] = await Promise.all([
                getPresupuestoById(presupuestoId),
                getDatosEmpresa()
            ]);
            
            if (pRes.success) setPresupuesto(pRes.data);
            setEmpresa(emp);
            setLoading(false);

            if (pRes.success && pRes.data) {
                setTimeout(() => window.print(), 500);
            }
        };
        cargarDatos();
    }, [presupuestoId]);

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-indigo-600" /></div>;
    if (!presupuesto) return <div className="p-10 font-bold text-center">Presupuesto no encontrado.</div>;

    const letraComprobante = "X";
    const fecha = new Date(presupuesto.fecha).toLocaleDateString('es-AR');
    
    const vigenciaFin = new Date(presupuesto.fecha);
    vigenciaFin.setDate(vigenciaFin.getDate() + (presupuesto.vigencia_dias || 15));
    const vigenciaStr = vigenciaFin.toLocaleDateString('es-AR');

    return (
        <div className="w-[210mm] min-h-[297mm] bg-white text-black p-12 mx-auto shadow-xl print:shadow-none print:m-0 print:p-8">

            {/* CABECERA */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6 relative">
                {/* Recuadro Letra Central */}
                <div className="absolute left-1/2 -translate-x-1/2 top-0 bg-white px-4 border-2 border-slate-900 flex flex-col items-center">
                    <span className="text-4xl font-black">{letraComprobante}</span>
                    <span className="text-[10px] font-bold">PRESUP.</span>
                </div>

                {/* Datos Empresa */}
                <div className="w-[45%]">
                    {empresa?.logo_url ? (
                        <img src={empresa.logo_url} alt="Logo" className="max-h-20 mb-4" />
                    ) : (
                        <div className="flex items-center gap-2 mb-4">
                            <Store className="h-10 w-10 text-slate-800" />
                            <h1 className="text-2xl font-black uppercase tracking-tight">{empresa?.nombre_fantasia || "Mi Empresa"}</h1>
                        </div>
                    )}
                    <p className="font-bold text-sm uppercase">{empresa?.razon_social}</p>
                    <p className="text-sm">{empresa?.direccion}</p>
                    <p className="text-sm">Tel: {empresa?.telefono}</p>
                    <p className="text-sm">{empresa?.redes_sociales}</p>
                </div>

                {/* Datos Comprobante */}
                <div className="w-[45%] text-right space-y-1">
                    <h2 className="text-2xl font-black uppercase text-slate-800">PRESUPUESTO</h2>
                    <p className="text-lg font-bold">Nº {String(presupuesto.numero).padStart(8, '0')}</p>
                    <p className="text-sm">Fecha: <span className="font-semibold">{fecha}</span></p>
                    <p className="text-sm text-amber-600 font-bold">Válido hasta: {vigenciaStr}</p>
                    <div className="mt-4 pt-4 border-t border-slate-200 text-sm text-slate-600">
                        <p>CUIT: {empresa?.cuit}</p>
                        <p>Documento No Válido como Factura</p>
                    </div>
                </div>
            </div>

            {/* DATOS DEL CLIENTE */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg mb-8 flex flex-wrap gap-x-12 gap-y-2">
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Cliente / Razón Social</p>
                    <p className="font-bold text-lg">{presupuesto.cliente?.nombre_razon_social || "Consumidor Final"}</p>
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">CUIT / DNI</p>
                    <p className="font-semibold text-base">{presupuesto.cliente?.dni_cuit || "---"}</p>
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Tarifa</p>
                    <p className="font-semibold text-base">{presupuesto.listaPrecio?.nombre || "N/A"}</p>
                </div>
                {presupuesto.notas && (
                    <div className="w-full mt-2 pt-2 border-t border-slate-200">
                        <p className="text-xs font-bold text-slate-500 uppercase">Notas y Acuerdos</p>
                        <p className="font-semibold text-sm">{presupuesto.notas}</p>
                    </div>
                )}
            </div>

            {/* CUERPO DEL PRESUPUESTO */}
            <div className="min-h-[400px]">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-800 text-white">
                            <th className="py-2 px-3 font-semibold text-sm w-[10%] text-center">Cant.</th>
                            <th className="py-2 px-3 font-semibold text-sm w-[50%]">Descripción del Artículo</th>
                            <th className="py-2 px-3 font-semibold text-sm w-[20%] text-right">P. Unitario</th>
                            <th className="py-2 px-3 font-semibold text-sm w-[20%] text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 border-b border-slate-300">
                        {presupuesto.detalles?.map((det: any) => (
                            <tr key={det.id} className="align-top">
                                <td className="py-3 px-3 text-center font-medium">{det.cantidad}</td>
                                <td className="py-3 px-3">
                                    <span className="font-semibold text-slate-800">{det.producto?.nombre_producto || 'Producto eliminado'}</span>
                                    {det.descuento_individual > 0 && (
                                        <span className="block text-xs text-slate-500 mt-0.5">Descuento aplicado: {det.descuento_individual}%</span>
                                    )}
                                </td>
                                <td className="py-3 px-3 text-right">
                                    ${det.precio_unitario.toFixed(2)}
                                </td>
                                <td className="py-3 px-3 text-right font-bold text-slate-800">${det.subtotal.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* TOTALES */}
            <div className="flex justify-end mt-6">
                <div className="w-[300px] space-y-2">
                    <div className="flex justify-between text-slate-600">
                        <span>Subtotal:</span>
                        <span className="font-semibold">${presupuesto.subtotal.toFixed(2)}</span>
                    </div>
                    {presupuesto.descuento_global > 0 && (
                        <div className="flex justify-between text-emerald-600">
                            <span>Descuento Global:</span>
                            <span className="font-semibold">-${presupuesto.descuento_global.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-end border-t-2 border-slate-900 pt-2 mt-2">
                        <span className="text-xl font-black text-slate-800">TOTAL:</span>
                        <span className="text-3xl font-black text-emerald-600">${presupuesto.total.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* PIE DE PÁGINA */}
            <div className="mt-20 border-t border-slate-200 pt-8 text-center text-sm text-slate-500">
                <p>Las cotizaciones están sujetas a modificaciones sin previo aviso y a disponibilidad de stock al momento de confirmar la compra.</p>
                <p className="font-bold mt-2">Los precios expresados en este documento mantendrán validez por {presupuesto.vigencia_dias || 15} días.</p>
            </div>
        </div>
    );
}
