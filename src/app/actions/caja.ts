"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getClientSession } from "./auth";

const prisma = new PrismaClient();

// 1. Obtener la caja abierta (si existe)
export async function getCajaActiva(sucursalId: number) {
    try {
        const caja = await prisma.cajaDiaria.findFirst({
            where: { estado: 'ABIERTA', sucursalId: sucursalId },
            include: {
                movimientos: { 
                    orderBy: { fecha: 'desc' },
                    include: { usuario: { select: { nombre: true } } }
                }
            }
        });
        return { success: true, data: caja };
    } catch (error) {
        return { success: false, error: "Error al consultar la caja." };
    }
}

// NUEVO: 2. Obtener el historial de cajas cerradas (Para métricas de horarios)
export async function getHistorialCajas(sucursalId: number) {
    try {
        const cajas = await prisma.cajaDiaria.findMany({
            where: { estado: 'CERRADA', sucursalId: sucursalId },
            include: {
                movimientos: { 
                    orderBy: { fecha: 'desc' },
                    include: { usuario: { select: { nombre: true } } }
                }
            },
            orderBy: { fecha_apertura: 'desc' },
            take: 30 // Traemos los últimos 30 turnos para no saturar
        });
        return { success: true, data: cajas };
    } catch (error) {
        return { success: false, error: "Error al cargar el historial de cajas." };
    }
}

// 3. Abrir el turno de caja (Registra hora exacta del servidor)
export async function abrirCaja(saldo_inicial: number, sucursalId: number) {
    try {
        const cajaExistente = await prisma.cajaDiaria.findFirst({ where: { estado: 'ABIERTA', sucursalId: sucursalId } });
        if (cajaExistente) throw new Error("Ya existe una caja abierta en esta sucursal. Ciérrela primero.");

        const session = await getClientSession();
        const usuarioId = (session as any)?.id ? Number((session as any).id) : null;

        await prisma.$transaction(async (tx) => {
            const nuevaCaja = await tx.cajaDiaria.create({
                data: { saldo_inicial, sucursalId: sucursalId } // fecha_apertura se genera sola con hora exacta
            });

            await tx.movimientoCaja.create({
                data: {
                    cajaId: nuevaCaja.id,
                    tipo: 'APERTURA',
                    metodo_pago: 'CONTADO',
                    monto: saldo_inicial,
                    descripcion: 'Apertura de Caja',
                    usuarioId: usuarioId
                }
            });
        });

        revalidatePath("/caja");
        revalidatePath("/ventas");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// 4. Retiros o Ingresos Manuales (Gastos)
export async function registrarMovimientoManual(cajaId: number, tipo: "INGRESO_MANUAL" | "EGRESO_MANUAL", monto: number, descripcion: string) {
    try {
        if (monto <= 0) throw new Error("El monto debe ser mayor a 0.");

        const session = await getClientSession();
        const usuarioId = (session as any)?.id ? Number((session as any).id) : null;

        await prisma.movimientoCaja.create({
            data: {
                cajaId,
                tipo,
                metodo_pago: 'CONTADO',
                monto,
                descripcion,
                usuarioId: usuarioId
            }
        });

        revalidatePath("/caja");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// 5. Cierre de Caja (Registra hora exacta del cierre)
export async function cerrarCaja(cajaId: number, saldo_real_efectivo: number) {
    try {
        const caja = await prisma.cajaDiaria.findUnique({
            where: { id: cajaId }, include: { movimientos: true }
        });
        if (!caja) throw new Error("Caja no encontrada.");

        let saldo_esperado_efectivo = 0;

        for (const mov of caja.movimientos) {
            if (mov.metodo_pago === 'CONTADO') {
                if (['APERTURA', 'INGRESO_MANUAL', 'VENTA', 'COBRO_CC'].includes(mov.tipo)) {
                    saldo_esperado_efectivo += mov.monto;
                } else if (mov.tipo === 'EGRESO_MANUAL') {
                    saldo_esperado_efectivo -= mov.monto;
                }
            }
        }

        const diferencia = saldo_real_efectivo - saldo_esperado_efectivo;

        // Calcular ganancia del turno
        let gananciaCalculada = 0;
        const ventaIds = caja.movimientos
            .filter((m: any) => m.ventaId !== null)
            .map((m: any) => m.ventaId)
            .filter((value: any, index: number, self: any[]) => self.indexOf(value) === index); // Unique

        if (ventaIds.length > 0) {
            const ventasDelTurno = await prisma.venta.findMany({
                where: { id: { in: ventaIds as number[] } },
                include: { detalles: { include: { producto: true } } }
            });

            for (const v of ventasDelTurno) {
                let costoVenta = 0;
                for (const det of v.detalles) {
                    costoVenta += (det.cantidad - (det.cantidad_devuelta || 0)) * det.producto.precio_costo;
                }
                gananciaCalculada += (v.total - costoVenta);
            }
        }

        await prisma.cajaDiaria.update({
            where: { id: cajaId },
            data: {
                estado: 'CERRADA',
                fecha_cierre: new Date(),
                saldo_esperado: saldo_esperado_efectivo,
                saldo_real: saldo_real_efectivo,
                diferencia: diferencia,
                ganancia: gananciaCalculada
            }
        });

        revalidatePath("/caja");
        return { success: true, data: { esperado: saldo_esperado_efectivo, diferencia, ganancia: gananciaCalculada } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}