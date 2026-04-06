"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getClientSession } from "./auth";
import { emitirComprobanteAFIP } from "./afip";

// ============================================================================
// 1. REGISTRAR NUEVO PEDIDO
// ============================================================================
export async function registrarPedidoPWA(data: any) {
    try {
        const resultado = await prisma.$transaction(async (tx) => {
            const session = await getClientSession();
            const usuarioId = (session as any)?.id ? Number((session as any).id) : null;

            if (!usuarioId) throw new Error("No estás autenticado.");

            // A. VERIFICACIÓN ESTRICTA DE STOCK
            for (const item of data.carrito) {
                const stockUbi = await tx.stockUbicacion.findUnique({
                    where: { productoId_depositoId: { productoId: item.productoId, depositoId: data.depositoId } }
                });

                if (!stockUbi || stockUbi.cantidad < item.cantidad) {
                    const prod = await tx.producto.findUnique({ where: { id: item.productoId } });
                    throw new Error(`SIN STOCK: Solo quedan ${stockUbi?.cantidad || 0} de "${prod?.nombre_producto}".`);
                }
            }

            // B. GENERAR NÚMERO DE PEDIDO SECUENCIAL
            const ultimoPedido = await tx.pedido.findFirst({
                orderBy: { numero: 'desc' }
            });
            const nuevoNumero = ultimoPedido ? ultimoPedido.numero + 1 : 1;

            // C. CREAR EL PEDIDO EN LA BD
            const nuevoPedido = await tx.pedido.create({
                data: {
                    numero: nuevoNumero,
                    clienteId: data.clienteId,
                    usuarioId: usuarioId,
                    listaPrecioId: data.listaPrecioId,
                    subtotal: data.subtotal,
                    descuento_global: data.descuento_global || 0,
                    total: data.total,
                    notas: data.notas,
                    estado: 'PENDIENTE',
                    metodo_pago: data.metodoPago,         // <--- NUEVO
                    monto_abonado: data.montoAbonado, // <--- Estado inicial clave
                    detalles: {
                        create: data.carrito.map((item: any) => ({
                            productoId: item.productoId,
                            cantidad: item.cantidad,
                            precio_unitario: item.precio_unitario,
                            descuento_individual: item.descuento_individual || 0,
                            precio_final: item.precio_final,
                            subtotal: item.subtotal
                        }))
                    }
                }
            });

            // D. DESCONTAR STOCK PREVENTIVO DEL DEPÓSITO
            for (const item of data.carrito) {
                await tx.stockUbicacion.update({
                    where: { productoId_depositoId: { productoId: item.productoId, depositoId: data.depositoId } },
                    data: { cantidad: { decrement: item.cantidad } }
                });
            }

            return nuevoPedido;
        });

        revalidatePath("/vendedor");
        return { success: true, data: resultado };

    } catch (error: any) {
        console.error("Error al registrar pedido:", error);
        return { success: false, error: error.message || "Error al procesar el pedido." };
    }
}

// ============================================================================
// 2. OBTENER EL HISTORIAL DEL VENDEDOR
// ============================================================================
export async function obtenerPedidosVendedor() {
    try {
        const session = await getClientSession();
        const usuarioId = (session as any)?.id ? Number((session as any).id) : null;
        if (!usuarioId) return [];

        return await prisma.pedido.findMany({
            where: { usuarioId },
            include: {
                cliente: true,
                detalles: {
                    include: {
                        producto: { select: { nombre_producto: true, codigo_articulo: true } }
                    }
                }
            },
            orderBy: { fecha: 'desc' },
            take: 100 // Límite para que la PWA cargue rápido en la calle
        });
    } catch (error) {
        console.error("Error al obtener pedidos:", error);
        return [];
    }
}

// ============================================================================
// 3. ANULAR O EDITAR PEDIDO (Con Regla de Negocio)
// ============================================================================
export async function accionarPedidoVendedor(pedidoId: number, accion: 'CANCELAR' | 'EDITAR') {
    try {
        const resultado = await prisma.$transaction(async (tx) => {
            const pedido = await tx.pedido.findUnique({ where: { id: pedidoId }, include: { detalles: true } });

            if (!pedido) throw new Error("Pedido no encontrado.");

            // REGLA DE NEGOCIO: Bloqueo estricto si administración ya lo procesó
            if (pedido.estado !== 'PENDIENTE') {
                throw new Error("ACCESO DENEGADO: El pedido ya fue procesado por Administración. Solo ellos pueden modificarlo ahora.");
            }

            const depositoCentralId = 1;

            // A. DEVOLVER EL STOCK PREVENTIVO PARA QUE OTROS VENDEDORES PUEDAN VENDERLO
            for (const item of pedido.detalles) {
                await tx.stockUbicacion.update({
                    where: { productoId_depositoId: { productoId: item.productoId, depositoId: depositoCentralId } },
                    data: { cantidad: { increment: item.cantidad } }
                });
            }

            // B. REGISTRAR AUDITORÍA EN LAS NOTAS DEL PEDIDO
            const fechaHora = new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
            const mensajeAuditoria = `\n\n[SISTEMA ${fechaHora}] -> Pedido ${accion === 'EDITAR' ? 'ANULADO PARA EDICIÓN' : 'CANCELADO'} por el vendedor en calle. Stock liberado.`;

            // C. CAMBIAR ESTADO A CANCELADO
            const pedidoActualizado = await tx.pedido.update({
                where: { id: pedidoId },
                data: {
                    estado: 'CANCELADO',
                    notas: (pedido.notas || "") + mensajeAuditoria
                }
            });

            return pedidoActualizado;
        });

        revalidatePath("/vendedor");
        return { success: true, data: resultado };

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ============================================================================
// 4. FUNCIONES DE ADMINISTRACIÓN (OFICINA)
// ============================================================================
export async function obtenerTodosLosPedidos() {
    try {
        return await prisma.pedido.findMany({
            include: {
                cliente: { select: { nombre_razon_social: true, dni_cuit: true, telefono: true } },
                usuario: { select: { nombre: true } }, // El Vendedor
                listaPrecio: { select: { nombre: true } },
                detalles: {
                    include: { producto: { select: { nombre_producto: true, codigo_articulo: true } } }
                }
            },
            orderBy: { fecha: 'desc' }
        });
    } catch (error) {
        console.error("Error al obtener todos los pedidos:", error);
        return [];
    }
}

export async function cambiarEstadoPedidoAdmin(
    pedidoId: number,
    nuevoEstado: 'APROBADO' | 'RECHAZADO' | 'FACTURADO',
    tipoComprobante?: string // Solo para FACTURADO
) {
    try {
        const resultado = await prisma.$transaction(async (tx) => {
            const pedido = await tx.pedido.findUnique({
                where: { id: pedidoId },
                include: {
                    detalles: { include: { producto: true } },
                    cliente: true,
                    listaPrecio: true,
                    usuario: true // Necesario para obtener la sucursal asignada al vendedor
                }
            });
            if (!pedido) throw new Error("Pedido no encontrado");

            // ========== RECHAZAR ==========
            if (nuevoEstado === 'RECHAZADO' && pedido.estado !== 'RECHAZADO' && pedido.estado !== 'CANCELADO') {
                const depositoCentralId = 1;
                for (const item of pedido.detalles) {
                    await tx.stockUbicacion.update({
                        where: { productoId_depositoId: { productoId: item.productoId, depositoId: depositoCentralId } },
                        data: { cantidad: { increment: item.cantidad } }
                    });
                }

                const fechaHora = new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
                const actualizado = await tx.pedido.update({
                    where: { id: pedidoId },
                    data: {
                        estado: 'RECHAZADO',
                        notas: (pedido.notas || "") + `\n\n[ADMINISTRACIÓN ${fechaHora}] -> RECHAZADO. Stock devuelto al inventario.`
                    }
                });
                return { pedido: actualizado };
            }

            // ========== APROBAR ==========
            if (nuevoEstado === 'APROBADO') {
                const fechaHora = new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
                const actualizado = await tx.pedido.update({
                    where: { id: pedidoId },
                    data: {
                        estado: 'APROBADO',
                        notas: (pedido.notas || "") + `\n\n[ADMINISTRACIÓN ${fechaHora}] -> APROBADO. En preparación.`
                    }
                });
                return { pedido: actualizado };
            }

            // ========== FACTURAR — CREAR VENTA REAL ==========
            if (nuevoEstado === 'FACTURADO') {
                const tipo_comprobante = tipoComprobante || "COMPROBANTE_X";
                const depositoCentralId = 1;

                // Para auditoría y la Venta, usamos el usuario del pedido (el vendedor original)
                // Esto es crucial para que las comisiones y el historial reflejen a quién hizo la venta
                const usuarioVendedorId = pedido.usuarioId;
                
                // Buscar si hay sucursal asociada al pedido/vendedor
                const sucursalId = pedido.usuario?.sucursalId || null;

                // A. GENERAR NÚMERO DE COMPROBANTE
                let secuencia = await tx.secuenciaFactura.findUnique({
                    where: { tipo_comprobante: tipo_comprobante }
                });
                if (!secuencia) {
                    secuencia = await tx.secuenciaFactura.create({
                        data: { tipo_comprobante: tipo_comprobante, punto_venta: 1, numero_actual: 0 }
                    });
                }
                const nuevoNumero = secuencia.numero_actual + 1;

                // B. AFIP (Solo para facturas fiscales)
                let afipData: any = null;
                if (["FACTURA_A", "FACTURA_B", "FACTURA_C"].includes(tipo_comprobante)) {
                    afipData = await emitirComprobanteAFIP(
                        tipo_comprobante,
                        secuencia.punto_venta,
                        pedido.cliente?.dni_cuit || "",
                        pedido.cliente?.condicion_iva || "CONSUMIDOR_FINAL",
                        pedido.total
                    );
                }

                // C. Parsear fecha CAE
                const parseCaeVtoDate = (rawDate: any): Date | null => {
                    if (!rawDate) return null;
                    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) return rawDate;
                    const strDate = String(rawDate).trim();
                    if (/^\d{8}$/.test(strDate)) {
                        const year = parseInt(strDate.substring(0, 4), 10);
                        const month = parseInt(strDate.substring(4, 6), 10) - 1;
                        const day = parseInt(strDate.substring(6, 8), 10);
                        return new Date(year, month, day, 12, 0, 0);
                    }
                    const parsed = new Date(strDate);
                    return !isNaN(parsed.getTime()) ? parsed : null;
                };
                const finalDateCae = afipData ? parseCaeVtoDate(afipData.cae_vto) : null;

                // D. DETERMINAR ESTADO DE PAGO SEGÚN MÉTODO
                const esCuentaCorriente = pedido.metodo_pago === 'CUENTA_CORRIENTE';
                const estadoPago = esCuentaCorriente ? 'PENDIENTE' : 'PAGADO';
                const saldoPendiente = esCuentaCorriente ? pedido.total : 0;

                // Auto-vencimiento CC
                let fechaVencimientoCC: Date | null = null;
                if (esCuentaCorriente && pedido.cliente && pedido.cliente.dias_aviso_deuda > 0) {
                    fechaVencimientoCC = new Date();
                    fechaVencimientoCC.setDate(fechaVencimientoCC.getDate() + pedido.cliente.dias_aviso_deuda);
                }

                // E. CONTROL DE LÍMITE DE CRÉDITO
                if (esCuentaCorriente && pedido.cliente?.limite_credito !== null && pedido.cliente?.limite_credito !== undefined && pedido.cliente.limite_credito > 0) {
                    const deudasPrevias = await tx.venta.aggregate({
                        where: { clienteId: pedido.clienteId, saldo_pendiente: { gt: 0 } },
                        _sum: { saldo_pendiente: true }
                    });
                    const deudaAcumulada = deudasPrevias._sum.saldo_pendiente || 0;
                    if (deudaAcumulada + pedido.total > pedido.cliente.limite_credito) {
                        throw new Error(`LIMITE_CREDITO_EXCEDIDO: El cliente ya debe $${deudaAcumulada.toFixed(2)} y su tope autorizado es $${pedido.cliente.limite_credito.toFixed(2)}. No se puede cargar $${pedido.total.toFixed(2)} más.`);
                    }
                }

                const ventaData = {
                    fecha_emision: new Date(),
                    tipo_comprobante: tipo_comprobante,
                    punto_venta: secuencia.punto_venta,
                    numero_comprobante: nuevoNumero,
                    clienteId: pedido.clienteId,
                    listaPrecioId: pedido.listaPrecioId,
                    sucursalId: sucursalId,
                    depositoOrigenId: depositoCentralId,

                    cae: afipData ? afipData.cae : null,
                    cae_vto: finalDateCae,
                    importe_neto: afipData ? afipData.importe_neto : pedido.subtotal,
                    importe_iva: afipData ? afipData.importe_iva : 0,

                    metodo_pago: (esCuentaCorriente ? 'CUENTA_CORRIENTE' : 'CONTADO') as any,
                    estado_pago: estadoPago as any,
                    saldo_pendiente: saldoPendiente,
                    fecha_vencimiento_cc: fechaVencimientoCC,

                    notas_venta: `Generado desde Pedido #${pedido.numero}`,
                    comentario_venta: pedido.notas,

                    subtotal: pedido.subtotal,
                    descuento_global: pedido.descuento_global,
                    total: pedido.total,

                    presupuestoOrigenId: null,
                    usuarioId: usuarioVendedorId,

                    detalles: {
                        create: pedido.detalles.map((item: any) => ({
                            productoId: item.productoId,
                            cantidad: item.cantidad,
                            precio_unitario: item.precio_unitario,
                            descuento_individual: item.descuento_individual,
                            precio_final: item.precio_final,
                            subtotal: item.subtotal
                        }))
                    },

                    pagos: {
                        create: [{
                            metodo_pago: (esCuentaCorriente ? 'CUENTA_CORRIENTE' : 'CONTADO') as any,
                            monto: pedido.total
                        }]
                    }
                };
                
                console.log("INTENTANDO CREAR VENTA CON DATOS:", JSON.stringify({ ...ventaData, detalles: 'OMITTED', pagos: 'OMITTED' }, null, 2));

                // F. CREAR LA VENTA REAL
                const nuevaVenta = await tx.venta.create({
                    data: ventaData
                });

                // G. REGISTRAR EN CAJA (solo efectivo, si hay caja abierta)
                if (!esCuentaCorriente) {
                    const cajaAbierta = sucursalId
                        ? await tx.cajaDiaria.findFirst({ where: { estado: 'ABIERTA', sucursalId: sucursalId } })
                        : await tx.cajaDiaria.findFirst({ where: { estado: 'ABIERTA' } });

                    if (cajaAbierta) {
                        await tx.movimientoCaja.create({
                            data: {
                                cajaId: cajaAbierta.id,
                                tipo: 'VENTA',
                                metodo_pago: 'CONTADO',
                                monto: pedido.total,
                                descripcion: `Pedido #${pedido.numero} → ${tipo_comprobante.replace('_', ' ')} 000${secuencia.punto_venta}-${nuevoNumero}`,
                                ventaId: nuevaVenta.id
                            }
                        });
                    }
                }

                // H. REGISTRAR EN CUENTA CORRIENTE (solo CC)
                if (esCuentaCorriente) {
                    await tx.movimientoCuentaCorriente.create({
                        data: {
                            clienteId: pedido.clienteId,
                            ventaId: nuevaVenta.id,
                            tipo: 'CARGO',
                            monto: pedido.total,
                            metodo_pago: 'CUENTA_CORRIENTE',
                            notas: `Crédito por Pedido #${pedido.numero} → Factura #${nuevoNumero}`
                        }
                    });
                }

                // I. REGISTRAR MOVIMIENTOS DE STOCK (auditoría - stock ya fue descontado al crear el pedido)
                for (const item of pedido.detalles) {
                    await tx.movimientoStock.create({
                        data: {
                            productoId: item.productoId,
                            depositoOrigenId: depositoCentralId,
                            cantidad: item.cantidad,
                            tipo: "VENTA",
                            ventaId: nuevaVenta.id
                        }
                    });
                }

                // J. ACTUALIZAR NÚMERO DE FACTURA
                await tx.secuenciaFactura.update({
                    where: { tipo_comprobante: tipo_comprobante },
                    data: { numero_actual: nuevoNumero }
                });

                // K. MARCAR PEDIDO COMO FACTURADO CON REFERENCIA A LA VENTA
                const fechaHora = new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
                const pedidoActualizado = await tx.pedido.update({
                    where: { id: pedidoId },
                    data: {
                        estado: 'FACTURADO',
                        ventaId: nuevaVenta.id,
                        notas: (pedido.notas || "") + `\n\n[ADMINISTRACIÓN ${fechaHora}] -> FACTURADO como ${tipo_comprobante.replace('_', ' ')} #${nuevoNumero}. VentaID: ${nuevaVenta.id}`
                    }
                });

                return { pedido: pedidoActualizado, venta: nuevaVenta };
            }

            throw new Error("Estado no válido.");
        }, {
            maxWait: 10000,
            timeout: 35000
        });

        revalidatePath("/pedidos");
        revalidatePath("/historial");
        revalidatePath("/caja");
        revalidatePath("/cuentas-corrientes");
        revalidatePath("/inventario");
        revalidatePath("/vendedor");

        return { success: true, data: resultado };

    } catch (error: any) {
        console.error("Error al procesar pedido:", error);
        return { success: false, error: error.message };
    }
}