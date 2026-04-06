"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ==========================================
// 1. LISTADO DE PRESUPUESTOS
// ==========================================
export async function getPresupuestos(filtros?: {
    termino?: string;
    estado?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
}) {
    try {
        const where: any = {};

        if (filtros?.estado && filtros.estado !== "TODOS") {
            where.estado = filtros.estado;
        }

        if (filtros?.termino && filtros.termino.length >= 2) {
            where.cliente = {
                OR: [
                    { nombre_razon_social: { contains: filtros.termino } },
                    { dni_cuit: { contains: filtros.termino } }
                ]
            };
        }

        if (filtros?.fecha_desde || filtros?.fecha_hasta) {
            where.fecha = {};
            if (filtros.fecha_desde) where.fecha.gte = new Date(`${filtros.fecha_desde}T00:00:00.000Z`);
            if (filtros.fecha_hasta) where.fecha.lte = new Date(`${filtros.fecha_hasta}T23:59:59.999Z`);
        }

        const presupuestos = await prisma.presupuesto.findMany({
            where,
            include: {
                cliente: true,
                listaPrecio: true,
                _count: { select: { detalles: true } }
            },
            orderBy: { fecha: 'desc' }
        });

        return { success: true, data: presupuestos };
    } catch (error: any) {
        console.error("Error al cargar presupuestos:", error);
        return { success: false, error: "Error al cargar presupuestos." };
    }
}

// ==========================================
// 2. DETALLE DE PRESUPUESTO
// ==========================================
export async function getPresupuestoById(id: number) {
    try {
        const presupuesto = await prisma.presupuesto.findUnique({
            where: { id },
            include: {
                cliente: true,
                listaPrecio: true,
                detalles: {
                    include: {
                        producto: {
                            include: {
                                proveedor: true,
                                marca: true,
                                categoria: true,
                            }
                        }
                    }
                }
            }
        });

        if (!presupuesto) return { success: false, error: "Presupuesto no encontrado." };

        return { success: true, data: presupuesto };
    } catch (error: any) {
        return { success: false, error: "Error al cargar el presupuesto." };
    }
}

// ==========================================
// 3. CREAR PRESUPUESTO (NO AFECTA STOCK)
// ==========================================
export async function crearPresupuesto(data: {
    clienteId: number;
    listaPrecioId: number;
    vigencia_dias: number;
    notas: string;
    subtotal: number;
    descuento_global: number;
    total: number;
    carrito: {
        productoId: number;
        cantidad: number;
        precio_unitario: number;
        descuento_individual: number;
        precio_final: number;
        subtotal: number;
    }[];
}) {
    try {
        // Generate next numero
        const lastPresupuesto = await prisma.presupuesto.findFirst({
            orderBy: { numero: 'desc' }
        });
        const nextNumero = (lastPresupuesto?.numero ?? 0) + 1;

        const presupuesto = await prisma.presupuesto.create({
            data: {
                numero: nextNumero,
                clienteId: data.clienteId,
                listaPrecioId: data.listaPrecioId,
                vigencia_dias: data.vigencia_dias,
                notas: data.notas || null,
                subtotal: data.subtotal,
                descuento_global: data.descuento_global,
                total: data.total,
                detalles: {
                    create: data.carrito.map(item => ({
                        productoId: item.productoId,
                        cantidad: item.cantidad,
                        precio_unitario: item.precio_unitario,
                        descuento_individual: item.descuento_individual,
                        precio_final: item.precio_final,
                        subtotal: item.subtotal
                    }))
                }
            }
        });

        revalidatePath("/presupuestos");
        return { success: true, data: presupuesto };
    } catch (error: any) {
        console.error("Error al crear presupuesto:", error);
        return { success: false, error: error.message || "Error al crear el presupuesto." };
    }
}

// ==========================================
// 4. ACTUALIZAR PRESUPUESTO
// ==========================================
export async function actualizarPresupuesto(id: number, data: {
    clienteId: number;
    listaPrecioId: number;
    vigencia_dias: number;
    notas: string;
    subtotal: number;
    descuento_global: number;
    total: number;
    carrito: {
        productoId: number;
        cantidad: number;
        precio_unitario: number;
        descuento_individual: number;
        precio_final: number;
        subtotal: number;
    }[];
}) {
    try {
        const existing = await prisma.presupuesto.findUnique({ where: { id } });
        if (!existing) return { success: false, error: "Presupuesto no encontrado." };
        if (existing.estado !== 'PENDIENTE') return { success: false, error: "Solo se pueden editar presupuestos pendientes." };

        await prisma.$transaction(async (tx) => {
            // Borrar detalles actuales
            await tx.detallePresupuesto.deleteMany({ where: { presupuestoId: id } });

            // Actualizar presupuesto con nuevos datos
            await tx.presupuesto.update({
                where: { id },
                data: {
                    clienteId: data.clienteId,
                    listaPrecioId: data.listaPrecioId,
                    vigencia_dias: data.vigencia_dias,
                    notas: data.notas || null,
                    subtotal: data.subtotal,
                    descuento_global: data.descuento_global,
                    total: data.total,
                    detalles: {
                        create: data.carrito.map(item => ({
                            productoId: item.productoId,
                            cantidad: item.cantidad,
                            precio_unitario: item.precio_unitario,
                            descuento_individual: item.descuento_individual,
                            precio_final: item.precio_final,
                            subtotal: item.subtotal
                        }))
                    }
                }
            });
        });

        revalidatePath("/presupuestos");
        return { success: true };
    } catch (error: any) {
        console.error("Error al actualizar presupuesto:", error);
        return { success: false, error: error.message || "Error al actualizar." };
    }
}

// ==========================================
// 5. CONVERTIR PRESUPUESTO → VENTA
// ==========================================
export async function convertirPresupuestoAVenta(presupuestoId: number, ventaData: {
    clienteId: number;
    listaPrecioId: number;
    tipo_comprobante: string;
    pagos: { metodo_pago: string; monto: number }[];
    fecha_vencimiento_cc?: string;
    comentario_venta?: string;
    subtotal: number;
    descuento_global: number;
    total: number;
    sucursalId: number;
    depositoId: number;
    carrito: {
        productoId: number;
        cantidad: number;
        precio_unitario: number;
        descuento_individual: number;
        precio_final: number;
        subtotal: number;
    }[];
}) {
    try {
        const presupuesto = await prisma.presupuesto.findUnique({ where: { id: presupuestoId } });
        if (!presupuesto) return { success: false, error: "Presupuesto no encontrado." };
        if (presupuesto.estado !== 'PENDIENTE') return { success: false, error: "Solo se pueden convertir presupuestos pendientes." };

        // Import registrarVenta
        const { registrarVenta } = await import("./ventas");

        const resultado = await registrarVenta({
            ...ventaData,
            metodo_pago: ventaData.pagos[0]?.metodo_pago || 'CONTADO',
            fecha_emision: new Date().toISOString(),
            presupuestoOrigenId: presupuestoId,
            detalles: presupuesto.notas,
        });

        if (resultado.success) {
            // Marcar como convertido
            await prisma.presupuesto.update({
                where: { id: presupuestoId },
                data: { estado: 'CONVERTIDO' }
            });

            revalidatePath("/presupuestos");
        }

        return resultado;
    } catch (error: any) {
        console.error("Error al convertir presupuesto:", error);
        return { success: false, error: error.message || "Error al convertir el presupuesto a venta." };
    }
}

// ==========================================
// 6. CANCELAR / ELIMINAR PRESUPUESTO
// ==========================================
export async function cancelarPresupuesto(id: number) {
    try {
        const existing = await prisma.presupuesto.findUnique({ where: { id } });
        if (!existing) return { success: false, error: "Presupuesto no encontrado." };
        if (existing.estado !== 'PENDIENTE') return { success: false, error: "Solo se pueden cancelar presupuestos pendientes." };

        await prisma.presupuesto.update({
            where: { id },
            data: { estado: 'CANCELADO' }
        });

        revalidatePath("/presupuestos");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "Error al cancelar el presupuesto." };
    }
}

export async function eliminarPresupuesto(id: number) {
    try {
        const existing = await prisma.presupuesto.findUnique({ where: { id } });
        if (!existing) return { success: false, error: "Presupuesto no encontrado." };
        if (existing.estado === 'CONVERTIDO') return { success: false, error: "No se puede eliminar un presupuesto ya convertido a venta." };

        await prisma.presupuesto.delete({ where: { id } });

        revalidatePath("/presupuestos");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "Error al eliminar el presupuesto." };
    }
}
