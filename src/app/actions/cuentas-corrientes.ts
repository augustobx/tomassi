"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ==========================================
// 1. DIRECTORIO DE DEUDORES (CON FILTROS)
// ==========================================
export async function getClientesDeudores(filtros?: {
    termino?: string;
    estado?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
}) {
    try {
        let whereVentas: any = { estado_pago: { in: ['PENDIENTE', 'PARCIAL'] } };

        if (filtros?.fecha_desde || filtros?.fecha_hasta) {
            whereVentas.fecha_emision = {};
            if (filtros?.fecha_desde) whereVentas.fecha_emision.gte = new Date(`${filtros?.fecha_desde}T00:00:00.000Z`);
            if (filtros?.fecha_hasta) whereVentas.fecha_emision.lte = new Date(`${filtros?.fecha_hasta}T23:59:59.999Z`);
        }

        let whereCliente: any = {
            ventas: { some: whereVentas }
        };

        if (filtros?.termino && filtros.termino.length >= 1) {
            whereCliente.OR = [
                { nombre_razon_social: { contains: filtros.termino } },
                { dni_cuit: { contains: filtros.termino } }
            ];
        }

        const clientes = await prisma.cliente.findMany({
            where: whereCliente,
            include: {
                ventas: { where: whereVentas }
            },
            orderBy: { nombre_razon_social: 'asc' }
        });

        let dataFiltrada = clientes.map(c => ({
            id: c.id,
            nombre: c.nombre_razon_social,
            telefono: c.telefono,
            cantidad_facturas: c.ventas.length,
            total_deuda: c.ventas.reduce((acc, v) => acc + v.saldo_pendiente, 0),
            limite_credito: c.limite_credito,
            ventas_vencidas: c.ventas.filter(v => v.fecha_vencimiento_cc && new Date(v.fecha_vencimiento_cc) < new Date()).length
        }));

        if (filtros?.estado === 'VENCIDAS') {
            dataFiltrada = dataFiltrada.filter(c => c.ventas_vencidas > 0);
        } else if (filtros?.estado === 'AL_DIA') {
            dataFiltrada = dataFiltrada.filter(c => c.ventas_vencidas === 0);
        }

        return { success: true, data: dataFiltrada };
    } catch (error: any) {
        return { success: false, error: "Error al cargar los deudores." };
    }
}

// ==========================================
// 2. FICHA COMPLETA DEL CLIENTE
// ==========================================
export async function getFichaCuentaCorriente(clienteId: number) {
    try {
        const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });

        const ventasPendientes = await prisma.venta.findMany({
            where: { clienteId, estado_pago: { in: ['PENDIENTE', 'PARCIAL'] } },
            include: { detalles: { include: { producto: true } } },
            orderBy: { fecha_emision: 'asc' }
        });

        const movimientos = await prisma.movimientoCuentaCorriente.findMany({
            where: { clienteId },
            include: { venta: true },
            orderBy: { fecha: 'desc' }
        });

        return { success: true, data: { cliente, ventasPendientes, movimientos } };
    } catch (error: any) {
        return { success: false, error: "Error al cargar la ficha del cliente." };
    }
}

// ==========================================
// 3. REGISTRAR PAGO CON DESCUENTO OPCIONAL
// ==========================================
export async function registrarPagoCC(data: {
    clienteId: number;
    ventaId: number;
    monto: number;
    metodo_pago: string;
    notas: string;
    descuento_porcentaje?: number;
}) {
    try {
        await prisma.$transaction(async (tx) => {
            const venta = await tx.venta.findUnique({ where: { id: data.ventaId } });
            if (!venta) throw new Error("Venta no encontrada.");
            if (data.monto <= 0) throw new Error("El monto debe ser mayor a 0.");

            const cajaAbierta = await tx.cajaDiaria.findFirst({ where: { estado: 'ABIERTA' } });
            if (!cajaAbierta) throw new Error("Debe abrir la caja diaria en el menú Caja para registrar cobros.");

            // Calcular descuento si aplica
            const descPorcentaje = data.descuento_porcentaje || 0;
            const montoDescuento = data.monto * (descPorcentaje / 100);
            const montoEfectivo = data.monto - montoDescuento; // Lo que realmente paga el cliente
            const montoAplicado = data.monto; // Lo que se reduce de la deuda (el total sin quitar el descuento)

            if (montoAplicado > venta.saldo_pendiente + 0.01) {
                throw new Error("El monto supera la deuda actual de esta factura.");
            }

            const nuevoSaldo = venta.saldo_pendiente - montoAplicado;
            const nuevoEstado = nuevoSaldo <= 0.01 ? 'PAGADO' : 'PARCIAL';

            // 1. Actualizamos la factura
            await tx.venta.update({
                where: { id: data.ventaId },
                data: { saldo_pendiente: nuevoSaldo < 0 ? 0 : nuevoSaldo, estado_pago: nuevoEstado }
            });

            // 2. Registramos el recibo con el descuento aplicado
            const notasConDescuento = descPorcentaje > 0
                ? `${data.notas || ''} | Descuento por pronto pago: ${descPorcentaje}% (-$${montoDescuento.toFixed(2)})`
                : data.notas || `Pago para comprobante ${venta.numero_comprobante}`;

            await tx.movimientoCuentaCorriente.create({
                data: {
                    clienteId: data.clienteId,
                    ventaId: data.ventaId,
                    tipo: 'ABONO',
                    monto: montoAplicado,
                    descuento_pago: montoDescuento,
                    metodo_pago: data.metodo_pago as any,
                    notas: notasConDescuento
                }
            });

            // 3. Ingresamos el pago REAL (efectivo) a la Caja Diaria
            await tx.movimientoCaja.create({
                data: {
                    cajaId: cajaAbierta.id,
                    tipo: 'COBRO_CC',
                    metodo_pago: data.metodo_pago as any,
                    monto: montoEfectivo, // Lo que realmente entra a caja
                    descripcion: `Abono CC (Fac. #${venta.numero_comprobante})${descPorcentaje > 0 ? ` - Desc. ${descPorcentaje}%` : ''}`,
                    ventaId: venta.id
                }
            });
        });

        revalidatePath("/cuentas-corrientes");
        revalidatePath("/caja");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ==========================================
// 4. RECALCULAR DEUDA POR INFLACIÓN
// ==========================================
export async function recalcularVentaVencida(ventaId: number) {
    try {
        const resultado = await prisma.$transaction(async (tx) => {
            const venta = await tx.venta.findUnique({
                where: { id: ventaId },
                include: {
                    listaPrecio: true,
                    detalles: { include: { producto: { include: { listas_precios: true } } } }
                }
            });

            if (!venta) throw new Error("Venta no encontrada.");
            if (venta.estado_pago === 'PAGADO') throw new Error("Esta factura ya está pagada.");

            let nuevoSubtotalVenta = 0;

            for (const detalle of venta.detalles) {
                const prod = detalle.producto;

                const pivot = prod.listas_precios.find((p: any) => p.listaPrecioId === venta.listaPrecioId);
                const margen = (pivot?.margen_personalizado !== null && pivot?.margen_personalizado !== undefined)
                    ? Number(pivot.margen_personalizado)
                    : Number(venta.listaPrecio.margen_defecto);

                const costoNeto = prod.precio_costo * (1 - (prod.descuento_proveedor / 100));
                const costoIva = costoNeto * (1 + (prod.alicuota_iva / 100));
                const precioBaseNuevo = costoIva * (1 + (margen / 100));

                const precioFinalNuevo = precioBaseNuevo * (1 - (detalle.descuento_individual / 100));
                const subtotalItemNuevo = precioFinalNuevo * detalle.cantidad;

                nuevoSubtotalVenta += subtotalItemNuevo;

                await tx.detalleVenta.update({
                    where: { id: detalle.id },
                    data: {
                        precio_unitario: precioBaseNuevo,
                        precio_final: precioFinalNuevo,
                        subtotal: subtotalItemNuevo
                    }
                });
            }

            const descuentoGlobalMonto = nuevoSubtotalVenta * ((venta.descuento_global / venta.subtotal) || 0);
            const nuevoTotalVenta = nuevoSubtotalVenta - descuentoGlobalMonto;

            const montoPagadoHastaAhora = venta.total - venta.saldo_pendiente;
            const nuevoSaldoPendiente = nuevoTotalVenta - montoPagadoHastaAhora;

            await tx.venta.update({
                where: { id: ventaId },
                data: {
                    subtotal: nuevoSubtotalVenta,
                    total: nuevoTotalVenta,
                    saldo_pendiente: nuevoSaldoPendiente,
                    fecha_vencimiento_cc: null,
                    notas_venta: `${venta.notas_venta || ''}\n[Sistema]: Precio actualizado por inflación el ${new Date().toLocaleDateString('es-AR')}.`
                }
            });

            return nuevoSaldoPendiente;
        });

        revalidatePath("/cuentas-corrientes");
        return { success: true, nuevoSaldo: resultado };
    } catch (error: any) {
        console.error(error);
        return { success: false, error: "No se pudo recalcular la deuda." };
    }
}