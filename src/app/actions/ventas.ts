"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { emitirComprobanteAFIP } from "./afip";
import { getClientSession } from "./auth";

// ==========================================
// 1. BUSCADORES EN TIEMPO REAL
// ==========================================

export async function buscarClientes(query: string) {
    return await prisma.cliente.findMany({
        where: query ? {
            OR: [
                { nombre_razon_social: { contains: query } },
                { dni_cuit: { contains: query } }
            ]
        } : {},
        include: {
            lista_default: true,
            listas_permitidas: { include: { listaPrecio: true } }
        },
        take: 50
    });
}

// NUEVA FUNCIÓN: Trae las listas para el selector de la PWA
export async function obtenerListasPrecio() {
    return await prisma.listaPrecio.findMany({
        select: { id: true, nombre: true, margen_defecto: true },
        // Quitamos la validación de 'activa' porque tu base de datos trae todas por defecto
        orderBy: { nombre: 'asc' }
    });
}

// NUEVAS FUNCIONES PARA FILTROS EN LA PWA
export async function obtenerMarcas() {
    return await prisma.marca.findMany({
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' }
    });
}

export async function obtenerCategorias() {
    return await prisma.categoria.findMany({
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' }
    });
}

export async function buscarProductos(query: string) {
    const productos = await prisma.producto.findMany({
        where: query ? {
            OR: [
                { nombre_producto: { contains: query } },
                { codigo_articulo: { contains: query } },
                { codigo_barras: { contains: query } }
            ]
        } : {}, // <-- Aquí quitamos el "activo: true" y dejamos el objeto vacío si no hay búsqueda
        include: {
            listas_precios: { include: { listaPrecio: true } },
            stocks: { include: { deposito: true } },
            marca: { select: { id: true, nombre: true } },
            categoria: { select: { id: true, nombre: true } },
        },
        take: 100 // Límite para rendimiento en celulares
    });

    return productos.map(p => ({
        ...p,
        stock_actual: p.stocks.reduce((acc: any, current: any) => acc + current.cantidad, 0)
    }));
}

// ==========================================
// 2. CONSUMIDOR FINAL AUTOMÁTICO
// ==========================================

export async function getConsumidorFinal() {
    try {
        const cf = await prisma.cliente.findFirst({
            where: {
                OR: [
                    { nombre_razon_social: { contains: "CONSUMIDOR FINAL" } },
                    { nombre_razon_social: { contains: "consumidor final" } },
                ]
            },
            include: {
                lista_default: true,
                listas_permitidas: { include: { listaPrecio: true } }
            }
        });
        return cf;
    } catch (error) {
        return null;
    }
}

// ==========================================
// 3. GESTOR DE CORRELATIVIDAD DE FACTURAS
// ==========================================

export async function previsualizarProximoComprobante(tipo_comprobante: string, punto_venta: number = 1) {
    const secuencia = await prisma.secuenciaFactura.findUnique({
        where: { tipo_comprobante }
    });

    const proximoNumero = secuencia ? secuencia.numero_actual + 1 : 1;

    return {
        punto_venta_str: String(punto_venta).padStart(4, '0'),
        numero_str: String(proximoNumero).padStart(8, '0'),
        punto_venta,
        proximoNumero
    };
}

// ==========================================
// 4. GUARDADO DE LA VENTA (TRANSACCIÓN SEGURA)
// ==========================================

export async function registrarVenta(data: any) {
    try {
        const resultado = await prisma.$transaction(async (tx) => {
            if (!data.sucursalId || !data.depositoId) {
                throw new Error("ERROR: Faltan datos de Sucursal o Depósito activo.");
            }

            // === LÓGICA DE CAJA ===
            const cajaAbierta = await tx.cajaDiaria.findFirst({ where: { estado: 'ABIERTA', sucursalId: data.sucursalId } });
            if (!cajaAbierta) throw new Error("CAJA_CERRADA: No puede facturar sin abrir la caja diaria en la sucursal activa.");

            // === LÓGICA DE STOCK Y LISTAS ===
            for (const item of data.carrito) {
                const prod = await tx.producto.findUnique({ where: { id: item.productoId } });
                if (!prod) throw new Error(`Producto ID ${item.productoId} no encontrado.`);

                const stockUbi = await tx.stockUbicacion.findUnique({
                    where: { productoId_depositoId: { productoId: item.productoId, depositoId: data.depositoId } }
                });

                if (!stockUbi) {
                    await tx.stockUbicacion.create({ data: { productoId: item.productoId, depositoId: data.depositoId, cantidad: 0 } });
                }

                // === VALIDACIÓN DE LISTA DE PRECIOS ===
                const pivot = await tx.productoListaPrecio.findUnique({
                    where: {
                        productoId_listaPrecioId: {
                            productoId: item.productoId,
                            listaPrecioId: data.listaPrecioId
                        }
                    }
                });
                if (!pivot) {
                    throw new Error(`LISTA_NO_ASIGNADA: El producto "${prod.nombre_producto}" no está habilitado para la lista de precios seleccionada.`);
                }
            }

            let secuencia = await tx.secuenciaFactura.findUnique({
                where: { tipo_comprobante: data.tipo_comprobante }
            });

            if (!secuencia) {
                secuencia = await tx.secuenciaFactura.create({
                    data: { tipo_comprobante: data.tipo_comprobante, punto_venta: 1, numero_actual: 0 }
                });
            }

            const session = await getClientSession();
            const usuarioId = (session as any)?.id ? Number((session as any).id) : null;

            const clienteData = await tx.cliente.findUnique({ where: { id: data.clienteId } });
            if (!clienteData) throw new Error("CLIENTE_NO_ENCONTRADO: El cliente asignado a esta venta no existe.");

            const nuevoNumero = secuencia.numero_actual + 1;

            let afipData: any = null;
            if (["FACTURA_A", "FACTURA_B", "FACTURA_C"].includes(data.tipo_comprobante)) {
                afipData = await emitirComprobanteAFIP(
                    data.tipo_comprobante,
                    secuencia.punto_venta,
                    clienteData.dni_cuit || "",
                    clienteData.condicion_iva || "CONSUMIDOR_FINAL",
                    data.total
                );
            }

            // Determinar si es pago mixto o único
            const pagos = data.pagos || [{ metodo_pago: data.metodo_pago, monto: data.total }];
            const tieneCuentaCorriente = pagos.some((p: any) => p.metodo_pago === 'CUENTA_CORRIENTE');
            const montoCuentaCorriente = pagos
                .filter((p: any) => p.metodo_pago === 'CUENTA_CORRIENTE')
                .reduce((acc: number, p: any) => acc + p.monto, 0);

            // CONTROL DE LIMITE DE CREDITO
            if (tieneCuentaCorriente && clienteData.limite_credito !== null && clienteData.limite_credito > 0) {
                const deudasPrevias = await tx.venta.aggregate({
                    where: { clienteId: clienteData.id, saldo_pendiente: { gt: 0 } },
                    _sum: { saldo_pendiente: true }
                });
                const deudaAcumulada = deudasPrevias._sum.saldo_pendiente || 0;

                if (deudaAcumulada + montoCuentaCorriente > clienteData.limite_credito) {
                    throw new Error(`LIMITE_CREDITO_EXCEDIDO: Intentás cargar $${montoCuentaCorriente.toFixed(2)}, pero este cliente ya debe $${deudaAcumulada.toFixed(2)} y su tope autorizado es $${clienteData.limite_credito.toFixed(2)}. Tenés superado el límite. Efectuá un cobro o elevá el tope del cliente.`);
                }
            }

            // CONTROL DE SALDO A FAVOR
            const montoSaldoAFavor = pagos
                .filter((p: any) => p.metodo_pago === 'SALDO_A_FAVOR')
                .reduce((acc: number, p: any) => acc + p.monto, 0);

            if (montoSaldoAFavor > 0) {
                const movimientos = await tx.movimientoCuentaCorriente.findMany({
                    where: { clienteId: data.clienteId }
                });
                const totalCargos = movimientos.filter(m => m.tipo === 'CARGO').reduce((acc, m) => acc + m.monto, 0);
                const totalAbonos = movimientos.filter(m => m.tipo === 'ABONO').reduce((acc, m) => acc + m.monto, 0);
                const saldoAFavorActual = Math.max(0, totalAbonos - totalCargos);

                if (montoSaldoAFavor > saldoAFavorActual) {
                    throw new Error(`SALDO_INSUFICIENTE: Intentás usar $${montoSaldoAFavor.toFixed(2)} de Saldo a Favor, pero el cliente solo tiene $${saldoAFavorActual.toFixed(2)} disponible.`);
                }
            }

            // Determinar estado de pago
            let estadoPago: 'PAGADO' | 'PENDIENTE' | 'PARCIAL' = 'PAGADO';
            let saldoPendiente = 0;
            if (tieneCuentaCorriente) {
                saldoPendiente = montoCuentaCorriente;
                estadoPago = montoCuentaCorriente >= data.total ? 'PENDIENTE' : 'PARCIAL';
            }

            // Auto-Vencimiento CC
            let fechaVencimientoObj = data.fecha_vencimiento_cc ? new Date(data.fecha_vencimiento_cc) : null;
            if (tieneCuentaCorriente && !fechaVencimientoObj && clienteData.dias_aviso_deuda > 0) {
                const vecimientoCalculado = new Date(data.fecha_emision);
                vecimientoCalculado.setDate(vecimientoCalculado.getDate() + clienteData.dias_aviso_deuda);
                fechaVencimientoObj = vecimientoCalculado;
            }

            // 1. UTILIDAD PARA PARSEAR FECHA YYYYMMDD DE AFIP
            const parseCaeVtoDate = (rawDate: any): Date | null => {
                if (!rawDate) return null;
                if (rawDate instanceof Date && !isNaN(rawDate.getTime())) return rawDate;

                const strDate = String(rawDate).trim();
                // Si el formato es exactamente YYYYMMDD (ej: "20260415")
                if (/^\d{8}$/.test(strDate)) {
                    const year = parseInt(strDate.substring(0, 4), 10);
                    const month = parseInt(strDate.substring(4, 6), 10) - 1; // JS 0-11
                    const day = parseInt(strDate.substring(6, 8), 10);
                    // Establecer al mediodía para evitar cruces extraños de zona horaria
                    return new Date(year, month, day, 12, 0, 0);
                }

                // Fallback para otros strings ("YYYY-MM-DD")
                const parsed = new Date(strDate);
                return !isNaN(parsed.getTime()) ? parsed : null;
            };

            const finalDateCae = afipData ? parseCaeVtoDate(afipData.cae_vto) : null;

            // 2. CREAR LA VENTA MAESTRA
            const nuevaVenta = await tx.venta.create({
                data: {
                    fecha_emision: new Date(data.fecha_emision),
                    tipo_comprobante: data.tipo_comprobante,
                    punto_venta: secuencia.punto_venta,
                    numero_comprobante: nuevoNumero,
                    clienteId: data.clienteId,
                    listaPrecioId: data.listaPrecioId,
                    sucursalId: data.sucursalId,
                    depositoOrigenId: data.depositoId,

                    cae: afipData ? afipData.cae : null,
                    cae_vto: finalDateCae,
                    importe_neto: afipData ? afipData.importe_neto : data.subtotal,
                    importe_iva: afipData ? afipData.importe_iva : 0,

                    metodo_pago: pagos.length === 1 ? pagos[0].metodo_pago : 'CONTADO', // Legacy field
                    estado_pago: estadoPago,
                    saldo_pendiente: saldoPendiente,
                    fecha_vencimiento_cc: fechaVencimientoObj,

                    requiere_envio: data.requiere_envio,
                    direccion_envio: data.direccion_envio,
                    notas_venta: data.detalles,
                    comentario_venta: data.comentario_venta || null,

                    subtotal: data.subtotal,
                    descuento_global: data.descuento_global,
                    total: data.total,

                    presupuestoOrigenId: data.presupuestoOrigenId || null,
                    usuarioId: usuarioId,

                    detalles: {
                        create: data.carrito.map((item: any) => ({
                            productoId: item.productoId,
                            cantidad: item.cantidad,
                            precio_unitario: item.precio_unitario,
                            descuento_individual: item.descuento_individual,
                            precio_final: item.precio_final,
                            subtotal: item.subtotal
                        }))
                    },

                    // Pagos múltiples
                    pagos: {
                        create: pagos.map((p: any) => ({
                            metodo_pago: p.metodo_pago,
                            monto: p.monto
                        }))
                    }
                }
            });

            // 2. REGISTRAR PAGOS
            for (const pago of pagos) {
                if (pago.metodo_pago === 'CONTADO' || pago.metodo_pago === 'TARJETA' || pago.metodo_pago === 'TRANSFERENCIA') {
                    await tx.movimientoCaja.create({
                        data: {
                            cajaId: cajaAbierta.id,
                            tipo: 'VENTA',
                            metodo_pago: pago.metodo_pago,
                            monto: pago.monto,
                            descripcion: `Venta ${data.tipo_comprobante.replace('_', ' ')} 000${secuencia.punto_venta}-${nuevoNumero} (${pago.metodo_pago})`,
                            ventaId: nuevaVenta.id
                        }
                    });
                } else if (pago.metodo_pago === 'CUENTA_CORRIENTE') {
                    await tx.movimientoCuentaCorriente.create({
                        data: {
                            clienteId: data.clienteId,
                            ventaId: nuevaVenta.id,
                            tipo: 'CARGO',
                            monto: pago.monto,
                            metodo_pago: 'CUENTA_CORRIENTE',
                            notas: `Crédito por Venta #${nuevoNumero}`
                        }
                    });
                } else if (pago.metodo_pago === 'SALDO_A_FAVOR') {
                    // Si paga con el saldo a favor, tenemos que registrar el cargo (descuento de su favor)
                    await tx.movimientoCuentaCorriente.create({
                        data: {
                            clienteId: data.clienteId,
                            ventaId: nuevaVenta.id,
                            tipo: 'CARGO',
                            monto: pago.monto,
                            metodo_pago: 'SALDO_A_FAVOR',
                            notas: `Uso de Saldo a Favor en Venta #${nuevoNumero}`
                        }
                    });
                }
            }

            // 3. ACTUALIZAR NÚMERO DE FACTURA
            await tx.secuenciaFactura.update({
                where: { tipo_comprobante: data.tipo_comprobante },
                data: { numero_actual: nuevoNumero }
            });

            // 4. DESCONTAR STOCK Y REGISTRAR MOVIMIENTO
            for (const item of data.carrito) {
                await tx.stockUbicacion.update({
                    where: { productoId_depositoId: { productoId: item.productoId, depositoId: data.depositoId } },
                    data: { cantidad: { decrement: item.cantidad } }
                });

                await tx.movimientoStock.create({
                    data: {
                        productoId: item.productoId,
                        depositoOrigenId: data.depositoId,
                        cantidad: item.cantidad,
                        tipo: "VENTA",
                        ventaId: nuevaVenta.id
                    }
                });
            }

            return nuevaVenta;
        }, {
            maxWait: 10000,
            timeout: 35000
        });

        revalidatePath("/ventas");
        revalidatePath("/inventario");
        revalidatePath("/historial");
        revalidatePath("/caja");

        return { success: true, data: resultado, ventaId: resultado.id };

    } catch (error: any) {
        console.error("Error al registrar venta:", error);
        return { success: false, error: `${error.message || "Fallo desconocido"}` };
    }
}


// ==========================================
// 5. PROCESAR DEVOLUCIONES / NOTAS DE CRÉDITO
// ==========================================
export async function procesarDevolucion(data: {
    ventaId: number;
    clienteId: number;
    itemsDevueltos: { productoId: number; cantidad: number; nombre: string }[];
    montoReembolso: number;
    metodoReembolso: "CAJA" | "CUENTA_CORRIENTE";
}) {
    try {
        await prisma.$transaction(async (tx) => {
            const venta = await tx.venta.findUnique({ where: { id: data.ventaId } });
            if (!venta) throw new Error("Venta no encontrada");

            const depositoDevolucion = venta.depositoOrigenId;
            if (!depositoDevolucion) throw new Error("Esta venta no tiene depósito origen registrado para devolver la mercadería.");

            let detalleTexto = "";
            for (const item of data.itemsDevueltos) {
                if (item.cantidad > 0) {
                    const detalleVenta = await tx.detalleVenta.findFirst({
                        where: { ventaId: venta.id, productoId: item.productoId }
                    });

                    if (!detalleVenta) throw new Error(`El producto ID ${item.productoId} no pertenece a esta venta.`);

                    const disponibleRestante = detalleVenta.cantidad - detalleVenta.cantidad_devuelta;
                    if (item.cantidad > disponibleRestante) {
                        throw new Error(`Intentás devolver ${item.cantidad} unidades de un producto, pero solo quedan ${disponibleRestante} disponibles para devolver en esta venta.`);
                    }

                    await tx.detalleVenta.update({
                        where: { id: detalleVenta.id },
                        data: { cantidad_devuelta: { increment: item.cantidad } }
                    });

                    await tx.stockUbicacion.update({
                        where: { productoId_depositoId: { productoId: item.productoId, depositoId: depositoDevolucion } },
                        data: { cantidad: { increment: item.cantidad } }
                    });

                    await tx.movimientoStock.create({
                        data: {
                            productoId: item.productoId,
                            depositoDestinoId: depositoDevolucion,
                            cantidad: item.cantidad,
                            tipo: "DEVOLUCION",
                            ventaId: venta.id
                        }
                    });
                    detalleTexto += `- ${item.cantidad}x ${item.nombre}\n`;
                }
            }

            if (data.metodoReembolso === "CAJA") {
                const cajaAbierta = await tx.cajaDiaria.findFirst({ where: { estado: 'ABIERTA', sucursalId: venta.sucursalId } });
                if (!cajaAbierta) throw new Error("Debe tener la caja abierta en la sucursal de la venta para sacar dinero para un reembolso.");

                await tx.movimientoCaja.create({
                    data: {
                        cajaId: cajaAbierta.id,
                        tipo: 'EGRESO_MANUAL',
                        metodo_pago: 'CONTADO',
                        monto: data.montoReembolso,
                        descripcion: `Devolución (Efectivo) s/ Factura #${venta.numero_comprobante}`,
                        ventaId: venta.id
                    }
                });
            } else if (data.metodoReembolso === "CUENTA_CORRIENTE") {
                await tx.movimientoCuentaCorriente.create({
                    data: {
                        clienteId: data.clienteId,
                        ventaId: venta.id,
                        tipo: 'ABONO',
                        monto: data.montoReembolso,
                        metodo_pago: 'CONTADO',
                        notas: `Nota de Crédito por Devolución s/ Factura #${venta.numero_comprobante}`
                    }
                });

                const nuevoSaldo = venta.saldo_pendiente - data.montoReembolso;
                await tx.venta.update({
                    where: { id: venta.id },
                    data: {
                        saldo_pendiente: nuevoSaldo < 0 ? 0 : nuevoSaldo,
                        estado_pago: nuevoSaldo <= 0.01 ? 'PAGADO' : 'PARCIAL'
                    }
                });
            }

            const selloDevolucion = `\n\n[SISTEMA - DEVOLUCIÓN EL ${new Date().toLocaleDateString('es-AR')}]\nSe devolvió $${data.montoReembolso.toFixed(2)} vía ${data.metodoReembolso}.\nItems devueltos:\n${detalleTexto}`;

            await tx.venta.update({
                where: { id: venta.id },
                data: { notas_venta: (venta.notas_venta || "") + selloDevolucion }
            });
        });

        revalidatePath("/historial");
        revalidatePath("/inventario");
        revalidatePath("/caja");
        revalidatePath("/cuentas-corrientes");

        return { success: true };
    } catch (error: any) {
        console.error("Error en devolución:", error);
        return { success: false, error: error.message || "Error al procesar la devolución" };
    }
}