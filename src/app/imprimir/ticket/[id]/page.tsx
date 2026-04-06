"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getDatosEmpresa, getVentaParaTicket } from "@/app/actions/configuracion-empresa";
import { Store, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { generarQRBase64 } from "@/lib/afipQrAlgorithm";

export default function TicketPrintPage() {
    const params = useParams();
    const ventaId = Number(params.id);
    const searchParams = useSearchParams();
    const mostrarDescuentos = searchParams.get("descuentos") !== "false";

    const [venta, setVenta] = useState<any>(null);
    const [empresa, setEmpresa] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const cargarDatos = async () => {
            const [v, emp] = await Promise.all([
                getVentaParaTicket(ventaId),
                getDatosEmpresa()
            ]);
            setVenta(v);
            setEmpresa(emp);
            setLoading(false);

            // Una vez que carga, abre la ventana de impresión automática
            if (v) {
                setTimeout(() => {
                    window.print();
                }, 500);
            }
        };
        cargarDatos();
    }, [ventaId]);

    if (loading) return <div className="p-10"><Loader2 className="animate-spin h-6 w-6" /></div>;
    if (!venta) return <div className="p-10 font-bold">Comprobante no encontrado.</div>;

    // Lógica ARCA: Letra del comprobante
    let letraComprobante = "X";
    let codComprobante = "000";

    if (venta.tipo_comprobante === "FACTURA_A") { letraComprobante = "A"; codComprobante = "001"; }
    else if (venta.tipo_comprobante === "FACTURA_B") { letraComprobante = "B"; codComprobante = "006"; }
    if (venta.tipo_comprobante === "FACTURA_C") { letraComprobante = "C"; codComprobante = "011"; }

    const qrBase64 = generarQRBase64(venta, empresa);

    return (
        <div className="w-[80mm] min-h-[100px] bg-white text-black font-mono text-[12px] leading-tight mx-auto print:mx-auto pb-10">

            {/* BOTÓN VOLVER (Oculto al imprimir) */}
            <div className="print:hidden text-center mb-4 pt-4">
                <button 
                    onClick={() => window.history.back()} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded shadow-md w-full"
                >
                    Volver al POS
                </button>
            </div>

            {/* 1. CABECERA: DATOS DE LA EMPRESA */}
            <div className="text-center pt-2 mb-2">
                <h1 className="text-[17px] font-black uppercase mb-1">{empresa.nombre_fantasia}</h1>
                <p className="font-bold text-[10px] uppercase">Razón Social: {empresa.razon_social}</p>
                <p className="mt-1 text-[11px]">{empresa.direccion}</p>
                <p className="text-[11px]">IVA: {empresa.condicion_iva}</p>
                <p className="text-[11px]">CUIT: {empresa.cuit}</p>
                <p className="text-[11px]">Inicio Actividades: {empresa.inicio_actividad}</p>
            </div>

            {/* 2. CABECERA: DATOS DEL COMPROBANTE (Diseño Fiscal ARCA corregido) */}
            <div className="flex justify-center relative my-4">
                <div className="absolute w-full border-t-2 border-black border-dashed top-1/2 -translate-y-1/2 z-0"></div>
                <div className="bg-white px-3 py-1 border-2 border-black flex flex-col items-center z-10">
                    <span className="text-xl font-black leading-none">{letraComprobante}</span>
                    <span className="text-[8px] font-bold leading-tight mt-0.5">COD {codComprobante}</span>
                </div>
            </div>

            <div className="text-center border-b-2 border-black border-dashed pb-3 mb-3">
                <h2 className="text-[14px] font-bold uppercase">{venta.tipo_comprobante.replace('_', ' ')}</h2>
                <p className="font-bold text-[13px]">Nº 000{venta.punto_venta}-{String(venta.numero_comprobante).padStart(8, '0')}</p>
                <p className="mt-1">Fecha: {new Date(venta.fecha_emision).toLocaleDateString('es-AR')} Hora: {new Date(venta.fecha_emision).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>

            {/* 3. DATOS DEL CLIENTE Y PAGOS */}
            <div className="border-b-2 border-black border-dashed pb-3 mb-3">
                <p><span className="font-bold">Cliente:</span> {venta.cliente.nombre_razon_social}</p>
                <p><span className="font-bold">CUIT/DNI:</span> {venta.cliente.dni_cuit || "Consumidor Final"}</p>
                <div className="mt-1">
                    <span className="font-bold">Medios de Pago:</span>
                    {venta.pagos && venta.pagos.length > 0 ? (
                        <ul className="text-[10px] ml-2 list-none">
                            {venta.pagos.map((pago: any) => (
                                <li key={pago.id}>- {pago.metodo_pago.replace('_', ' ')}: ${pago.monto.toFixed(2)}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="ml-2">- {venta.metodo_pago.replace('_', ' ')}</p>
                    )}
                </div>
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
                        {venta.detalles.map((det: any) => (
                            <tr key={det.id} className="align-top">
                                <td className="py-1">{det.cantidad}</td>
                                <td className="py-1 pr-1">
                                    {det.producto.nombre_producto}
                                    {/* Solo se muestra el descuento si el toggle está activado */}
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

                {/* Si ocultamos los descuentos, solo mostramos el TOTAL FINAL para no marear al cliente con la matemática */}
                {mostrarDescuentos ? (
                    <>
                        <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span>${venta.subtotal.toFixed(2)}</span>
                        </div>
                        {venta.descuento_global > 0 && (
                            <div className="flex justify-between">
                                <span>Descuento Global:</span>
                                <span>-${venta.descuento_global.toFixed(2)}</span>
                            </div>
                        )}
                    </>
                ) : null}

                <div className="flex justify-between text-[16px] font-black mt-2 pt-2 border-t border-black">
                    <span>TOTAL:</span>
                    <span>${venta.total.toFixed(2)}</span>
                </div>
            </div>

            {/* 6. PIE DE PÁGINA COMERCIAL Y FISCAL */}
            <div className="text-center space-y-1">
                {letraComprobante !== "X" && venta.cae && qrBase64 && (
                    <div className="border-t border-b border-black py-2 mb-3 text-[10px] flex flex-col items-center">
                        <div className="mb-2">
                            <QRCodeSVG value={`https://www.afip.gob.ar/fe/qr/?p=${qrBase64}`} size={120} />
                        </div>
                        <p className="font-bold">CAE N°: {venta.cae}</p>
                        <p>Vencimiento CAE: {new Date(venta.cae_vto).toLocaleDateString('es-AR')}</p>
                        <p className="text-[8px] font-bold mt-1 text-center">COMPROBANTE AUTORIZADO<br/>AFIP</p>
                    </div>
                )}
                {letraComprobante !== "X" && !venta.cae && (
                    <div className="border border-black p-2 mb-3 text-[10px] text-left">
                        <p><strong>CAE:</strong> Rechazado/Pendiente</p>
                        <p className="text-[8px] mt-1 text-center">Este comprobante no tiene validez fiscal.</p>
                    </div>
                )}
                <p className="font-bold text-[14px]">¡Gracias por su compra!</p>
                {letraComprobante === "X" && (
                    <div className="border-t border-black pt-2 pb-2 mt-2 mb-2">
                        <p className="text-[10px] leading-tight">Las cotizaciones están sujetas a modificaciones sin previo aviso y a disponibilidad de stock.</p>
                    </div>
                )}
                <p className="mt-2">Tel: {empresa.telefono}</p>
                <p>{empresa.redes_sociales}</p>
                <div className="text-[9px] mt-4 pt-2 border-t border-black border-dotted">
                    <p>Cajero: {venta.usuario ? venta.usuario.nombre_completo : "Sistema"}</p>
                    <p>Generado por Tendeco POS</p>
                </div>
            </div>

        </div>
    );
}