export function generarQRBase64(venta: any, empresa: any): string | null {
    if (!venta.cae || !empresa) return null;

    let codComprobante = 0;
    if (venta.tipo_comprobante === "FACTURA_A") codComprobante = 1;
    else if (venta.tipo_comprobante === "FACTURA_B") codComprobante = 6;
    else if (venta.tipo_comprobante === "FACTURA_C") codComprobante = 11;

    let tipoDoc = 99; // Por defecto Consumidor Final / Sin Identificar
    let numDoc = 0;

    const cuitDniLimpio = venta.cliente?.dni_cuit ? venta.cliente.dni_cuit.replace(/[^0-9]/g, '') : '';
    
    if (cuitDniLimpio) {
        if (cuitDniLimpio.length >= 10) {
            tipoDoc = 80; // CUIT
        } else if (cuitDniLimpio.length >= 7) {
            tipoDoc = 96; // DNI
        }
        numDoc = Number(cuitDniLimpio);
    }

    const obj = {
        ver: 1,
        fecha: new Date(venta.fecha_emision).toISOString().split('T')[0],
        cuit: Number(empresa.cuit.replace(/[^0-9]/g, '')),
        ptoVta: venta.punto_venta,
        tipoCmp: codComprobante,
        nroCmp: venta.numero_comprobante,
        importe: Number(venta.total.toFixed(2)),
        moneda: "PES",
        ctz: 1,
        tipoDocRec: tipoDoc,
        nroDocRec: numDoc,
        tipoCodAut: "E",
        codAut: Number(venta.cae)
    };

    return typeof window !== "undefined"
        ? window.btoa(JSON.stringify(obj))
        : Buffer.from(JSON.stringify(obj)).toString('base64');
}
