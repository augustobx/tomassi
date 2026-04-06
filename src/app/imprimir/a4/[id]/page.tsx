"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { getDatosEmpresa, getVentaParaTicket } from "@/app/actions/configuracion-empresa";
import { Store, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { generarQRBase64 } from "@/lib/afipQrAlgorithm";

export default function FacturaA4PrintPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const ventaId = Number(id);

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

            if (v) {
                setTimeout(() => window.print(), 500);
            }
        };
        cargarDatos();
    }, [ventaId]);

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-black" /></div>;
    if (!venta) return <div className="p-10 font-bold text-center">Comprobante no encontrado.</div>;

    let letraComprobante = "X";
    let codComprobante = "000";
    let tipoTexto = "COMPROBANTE NO FISCAL";

    if (venta.tipo_comprobante === "FACTURA_A") { letraComprobante = "A"; codComprobante = "001"; tipoTexto = "FACTURA"; }
    else if (venta.tipo_comprobante === "FACTURA_B") { letraComprobante = "B"; codComprobante = "006"; tipoTexto = "FACTURA"; }
    else if (venta.tipo_comprobante === "FACTURA_C") { letraComprobante = "C"; codComprobante = "011"; tipoTexto = "FACTURA"; }

    const qrBase64 = generarQRBase64(venta, empresa);

    // Calcular totales de IVA genéricos si corresponden
    let subNeto = venta.subtotal;
    let impIva = 0;
    if (venta.tipo_comprobante === "FACTURA_A") {
        subNeto = venta.subtotal / 1.21;
        impIva = venta.subtotal - subNeto;
    }

    return (
        <>
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 0mm;
                    }
                }
            `}} />

            <div className="w-[210mm] min-h-[297mm] bg-white text-black p-8 mx-auto font-sans text-sm print:m-0 print:p-8">

            {/* BOTÓN VOLVER (Oculto al imprimir) */}
            <div className="print:hidden mb-4 relative z-50">
                <button 
                    onClick={() => window.history.back()} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded shadow-md flex items-center justify-center m-auto"
                >
                    Volver al POS
                </button>
            </div>

            {/* CABECERA TRIPARTITA */}
            <div className="relative border border-black p-4 mb-4 flex justify-between h-[150px]">
                
                {/* Cuadro Central Letra */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-[1px] bg-white border border-black w-[50px] h-[50px] flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold leading-none">{letraComprobante}</span>
                    <span className="text-[9px] font-bold mt-1 leading-none border-t border-black w-full text-center pt-1">COD {codComprobante}</span>
                </div>
                {/* Linea divisoria central */}
                <div className="absolute left-1/2 top-[50px] bottom-0 w-[1px] bg-black"></div>

                {/* Izquierda: Empresa */}
                <div className="w-[45%] pr-4 pt-2">
                    {empresa?.logo_url ? (
                        <img src={empresa.logo_url} alt="Logo" className="max-h-12 mb-2" />
                    ) : (
                        <div className="flex items-center gap-2 mb-2">
                            <Store className="h-6 w-6 text-black" />
                            <h1 className="text-xl font-bold uppercase tracking-tight">{empresa?.nombre_fantasia || "Mi Empresa"}</h1>
                        </div>
                    )}
                    <p className="font-bold text-xs uppercase mb-1">{empresa?.razon_social}</p>
                    <p className="text-[11px] leading-tight break-words">{empresa?.direccion}</p>
                    <p className="text-[11px] leading-tight">Tel: {empresa?.telefono}</p>
                    <p className="text-[11px] mt-2 font-bold uppercase">IVA {empresa?.condicion_iva}</p>
                </div>

                {/* Derecha: Comprobante */}
                <div className="w-[45%] pl-4 pt-2 text-left">
                    <h2 className="text-2xl font-bold uppercase">{tipoTexto}</h2>
                    <div className="flex gap-4 items-center mb-2 mt-1">
                        <p className="font-bold text-sm">Nº {String(venta.punto_venta).padStart(4, '0')}-{String(venta.numero_comprobante).padStart(8, '0')}</p>
                        <p className="font-bold text-sm border-l border-black pl-4">Fecha: {new Date(venta.fecha_emision).toLocaleDateString('es-AR')}</p>
                    </div>
                    <p className="text-[11px]"><strong>CUIT:</strong> {empresa?.cuit}</p>
                    <p className="text-[11px]"><strong>Ingresos Brutos:</strong> {empresa?.cuit}</p>
                    <p className="text-[11px]"><strong>Inicio de Actividades:</strong> {empresa?.inicio_actividad}</p>
                </div>
            </div>

            {/* DATOS DEL CLIENTE */}
            <div className="border border-black p-4 mb-4 grid grid-cols-2 gap-y-2 text-xs">
                <div><span className="font-bold">Cliente:</span> {venta.cliente?.nombre_razon_social || "Consumidor Final"}</div>
                <div><span className="font-bold">CUIT/DNI:</span> {venta.cliente?.dni_cuit || "---"}</div>
                <div><span className="font-bold">Condición de IVA:</span> {venta.cliente?.condicion_iva || "Consumidor Final"}</div>
                <div className="flex">
                    <span className="font-bold whitespace-nowrap mr-1">Condición de Venta:</span> 
                    <div>
                        {venta.pagos && venta.pagos.length > 0 ? (
                            venta.pagos.map((pago: any) => (
                                <span key={pago.id} className="block leading-tight">
                                    {pago.metodo_pago.replace('_', ' ')}: ${pago.monto.toFixed(2)}
                                </span>
                            ))
                        ) : (
                            <span className="block">{venta.metodo_pago.replace('_', ' ')}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* TABLA DE ÍTEMS */}
            <div className="border border-black min-h-[140mm] flex flex-col relative">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="border-b border-black bg-slate-100">
                            <th className="py-2 px-3 border-r border-black w-12 text-center">Cant</th>
                            <th className="py-2 px-3 border-r border-black">Producto / Descripción</th>
                            <th className="py-2 px-3 border-r border-black w-24 text-right">P. Unit</th>
                            {venta.tipo_comprobante === "FACTURA_A" && <th className="py-2 px-3 border-r border-black w-16 text-right">% IVA</th>}
                            <th className="py-2 px-3 w-28 text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {venta.detalles?.map((det: any, index: number) => {
                            let itemUnitario = det.precio_unitario;
                            let itemSubtotal = det.subtotal;
                            if (venta.tipo_comprobante === "FACTURA_A") {
                                itemUnitario = det.precio_unitario / 1.21;
                                itemSubtotal = det.subtotal / 1.21;
                            }
                            return (
                                <tr key={det.id} className="align-top">
                                    <td className="py-2 px-3 border-r border-black text-center">{det.cantidad}</td>
                                    <td className="py-2 px-3 border-r border-black">
                                        {det.producto?.nombre_producto || 'Producto genérico'}
                                        {det.descuento_individual > 0 && <span className="block text-[10px] text-slate-500 mt-1">*{det.descuento_individual}% OFF Aplicado</span>}
                                    </td>
                                    <td className="py-2 px-3 border-r border-black text-right">${itemUnitario.toFixed(2)}</td>
                                    {venta.tipo_comprobante === "FACTURA_A" && <td className="py-2 px-3 border-r border-black text-right">21%</td>}
                                    <td className="py-2 px-3 text-right">${itemSubtotal.toFixed(2)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* TOTALES */}
            <div className="border border-t-0 border-black mb-4 flex">
                <div className="w-[60%] border-r border-black p-2 flex flex-col text-xs text-slate-600 justify-end">
                    {venta.tipo_comprobante === "FACTURA_A" ? (
                        <p>Los importes expresados son netos sujetos a la aplicación del IVA.</p>
                    ) : (
                        <p>Los importes están expresados en pesos argentinos.</p>
                    )}
                </div>
                <div className="w-[40%] p-3 space-y-2 text-sm">
                    {venta.tipo_comprobante === "FACTURA_A" && (
                        <>
                            <div className="flex justify-between">
                                <span>Subtotal Neto:</span>
                                <span>${subNeto.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>IVA 21%:</span>
                                <span>${impIva.toFixed(2)}</span>
                            </div>
                        </>
                    )}
                    {venta.tipo_comprobante !== "FACTURA_A" && (
                        <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span>${venta.subtotal.toFixed(2)}</span>
                        </div>
                    )}
                    
                    {venta.descuento_global > 0 && (
                        <div className="flex justify-between">
                            <span>Descuento Global:</span>
                            <span>-${venta.descuento_global.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-base border-t border-black pt-2">
                        <span>TOTAL:</span>
                        <span>${venta.total.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* FOOOTER QR CAE */}
            <div className="flex justify-between items-end mt-2">
                <div className="flex items-center gap-4">
                    {letraComprobante !== "X" && qrBase64 && (
                        <QRCodeSVG value={`https://www.afip.gob.ar/fe/qr/?p=${qrBase64}`} size={90} className="border border-black p-1" />
                    )}
                    {letraComprobante !== "X" && venta.cae && (
                        <div className="text-[12px]">
                            {empresa.logo_url && <img src="/afip_logo.png" className="max-h-8 object-contain mb-1 opacity-50" onError={(e) => e.currentTarget.style.display = 'none'} />}
                            <p className="font-bold flex items-center gap-2">CAE N°: <span className="font-normal text-sm">{venta.cae}</span></p>
                            <p className="font-bold flex items-center gap-2">Vto CAE: <span className="font-normal">{new Date(venta.cae_vto).toLocaleDateString('es-AR')}</span></p>
                        </div>
                    )}
                    {letraComprobante !== "X" && !venta.cae && (
                        <div className="text-[12px] text-red-600 font-bold border border-red-600 p-2">COMPROBANTE SIN CAE FISCAL AUTORIZADO</div>
                    )}
                </div>
                <div className="text-right text-[10px] text-slate-500 max-w-sm flex flex-col justify-end">
                    {letraComprobante === "X" && (
                        <p className="mb-1 font-bold text-slate-600">Las cotizaciones están sujetas a modificaciones sin previo aviso y a disponibilidad de stock al momento de confirmar la compra.</p>
                    )}
                    <span className="font-bold">Cajero: {venta.usuario ? venta.usuario.nombre_completo : "Sistema"}</span>
                    <span>Documento impreso desde Tendeco POS</span>
                </div>
            </div>

        </div>
        </>
    );
}