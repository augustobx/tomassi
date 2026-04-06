"use client";

import { useEffect, useState, use, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getDatosEmpresa } from "@/app/actions/configuracion-empresa";
import { getPresupuestoById } from "@/app/actions/presupuestos";
import { Loader2 } from "lucide-react";

function TicketContent({ id }: { id: string }) {
    const presupuestoId = Number(id);
    const searchParams = useSearchParams();
    const mostrarDescuentos = searchParams.get("descuentos") !== "false";

    const [presupuesto, setPresupuesto] = useState<any>(null);
    const [empresa, setEmpresa] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const cargarDatos = async () => {
            const [pRes, emp] = await Promise.all([
                getPresupuestoById(presupuestoId),
                getDatosEmpresa()
            ]);
            
            if (pRes.success) {
               setPresupuesto(pRes.data);
            } else {
               setError(pRes.error || "No encontrado");
            }
            setEmpresa(emp);
            setLoading(false);

            // Una vez que carga, abre la ventana de impresión automática
            if (pRes.success && pRes.data) {
                setTimeout(() => {
                    window.print();
                }, 500);
            }
        };
        cargarDatos();
    }, [presupuestoId]);

    if (loading) return <div className="p-10"><Loader2 className="animate-spin h-6 w-6" /></div>;
    if (error || !presupuesto || !empresa) return <div className="p-10 font-bold">Error: {error || "Comprobante o empresa no encontrado."}</div>;

    const fechaFormat = presupuesto.fecha ? new Date(presupuesto.fecha) : new Date();
    const createFormat = presupuesto.createdAt ? new Date(presupuesto.createdAt) : new Date();

    return (
        <div className="w-[80mm] min-h-[100px] bg-white text-black font-mono text-[12px] leading-tight mx-auto print:mx-auto pb-10">

            {/* BOTÓN VOLVER (Oculto al imprimir) */}
            <div className="print:hidden text-center mb-4 pt-4">
                <button 
                    onClick={() => window.history.back()} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded shadow-md w-full"
                >
                    Volver al Detalle
                </button>
            </div>

            {/* 1. CABECERA: DATOS DE LA EMPRESA */}
            <div className="text-center pt-2 mb-2">
                <h1 className="text-[17px] font-black uppercase mb-1">{empresa.nombre_fantasia}</h1>
                <p className="font-bold text-[10px] uppercase">Razón Social: {empresa.razon_social}</p>
                <p className="mt-1 text-[11px]">{empresa.direccion}</p>
                <p className="text-[11px]">Tel: {empresa.telefono}</p>
            </div>

            {/* 2. CABECERA: DATOS DEL COMPROBANTE NO FISCAL */}
            <div className="flex justify-center relative my-4">
                <div className="absolute w-full border-t-2 border-black border-dashed top-1/2 -translate-y-1/2 z-0"></div>
                <div className="bg-white px-3 py-1 border-2 border-black flex flex-col items-center z-10">
                    <span className="text-xl font-black leading-none">X</span>
                    <span className="text-[8px] font-bold leading-tight mt-0.5">PRESUPUESTO</span>
                </div>
            </div>

            <div className="text-center border-b-2 border-black border-dashed pb-3 mb-3">
                <h2 className="text-[14px] font-bold uppercase">PRESUPUESTO</h2>
                <p className="font-bold text-[13px]">Nº {String(presupuesto.numero || 0).padStart(6, '0')}</p>
                <p className="mt-1">Emitido: {fechaFormat.toLocaleDateString('es-AR')} Hora: {createFormat.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-[11px] font-bold mt-1">Válido por {presupuesto.vigencia_dias || 15} días.</p>
            </div>

            {/* 3. DATOS DEL CLIENTE */}
            <div className="border-b-2 border-black border-dashed pb-3 mb-3">
                <p><span className="font-bold">Cliente:</span> {presupuesto.cliente?.nombre_razon_social || "Consumidor Final"}</p>
                <p><span className="font-bold">DNI/CUIT:</span> {presupuesto.cliente?.dni_cuit || "N/A"}</p>
                {presupuesto.notas && (
                    <p className="mt-1 italic text-[10px]">Notas: {presupuesto.notas}</p>
                )}
            </div>

            {/* 4. CUERPO: DETALLE DE ÍTEMS */}
            <div className="border-b-2 border-black border-dashed pb-3 mb-3">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-black">
                            <th className="py-1 w-2/12">Cant</th>
                            <th className="py-1 w-6/12">Producto</th>
                            <th className="py-1 w-4/12 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {presupuesto.detalles.map((det: any) => (
                            <tr key={det.id} className="align-top">
                                <td className="py-1">{det.cantidad}</td>
                                <td className="py-1 pr-1">
                                    {det.producto?.nombre_producto || 'Desconocido'}
                                    {mostrarDescuentos && det.descuento_individual > 0 && (
                                        <span className="block text-[10px]">(Desc. {det.descuento_individual}%)</span>
                                    )}
                                </td>
                                <td className="py-1 text-right">${det.subtotal.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 5. TOTALES */}
            <div className="border-b-2 border-black border-dashed pb-3 mb-4 space-y-1">

                {mostrarDescuentos ? (
                    <>
                        <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span>${presupuesto.subtotal.toFixed(2)}</span>
                        </div>
                        {presupuesto.descuento_global > 0 && (
                            <div className="flex justify-between">
                                <span>Descuento Global:</span>
                                <span>-${presupuesto.descuento_global.toFixed(2)}</span>
                            </div>
                        )}
                    </>
                ) : null}

                <div className="flex justify-between text-[16px] font-black mt-2 pt-2 border-t border-black">
                    <span>TOTAL:</span>
                    <span>${presupuesto.total.toFixed(2)}</span>
                </div>
            </div>

            {/* 6. PIE DE PÁGINA COMERCIAL */}
            <div className="text-center space-y-1">
                <div className="border border-black p-2 mb-3 text-[10px] text-left">
                    <p className="text-[10px] font-bold text-center uppercase">Documento No Válido Como Factura</p>
                    <p className="text-[9px] mt-1 text-center">Este presupuesto es estimativo y su valor está sujeto a modificación sin previo aviso tras el periodo de vigencia.</p>
                </div>
                
                <p className="font-bold text-[14px]">¡Gracias por consultarnos!</p>
                <p className="mt-2">Tel: {empresa.telefono}</p>
                <p>{empresa.redes_sociales}</p>
                <div className="text-[9px] mt-4 pt-2 border-t border-black border-dotted">
                    <p>Generado por Tendeco POS</p>
                </div>
            </div>

        </div>
    );
}

export default function TicketPrintPresupuestoPageWrapper({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return (
        <Suspense fallback={<div className="p-10"><Loader2 className="animate-spin h-6 w-6" /></div>}>
            <TicketContent id={id} />
        </Suspense>
    );
}
