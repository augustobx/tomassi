"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function registrarTransferencia(
    productoId: number, 
    depositoOrigenId: number, 
    depositoDestinoId: number, 
    cantidad: number, 
    usuarioId: number
) {
    try {
        if (depositoOrigenId === depositoDestinoId) {
            throw new Error("El depósito origen y destino no pueden ser el mismo.");
        }
        if (cantidad <= 0) {
            throw new Error("La cantidad debe ser mayor a 0.");
        }

        await prisma.$transaction(async (tx) => {
            // Verificar stock en origen
            const stockOrigen = await tx.stockUbicacion.findUnique({
                where: { productoId_depositoId: { productoId, depositoId: depositoOrigenId } }
            });

            if (!stockOrigen || stockOrigen.cantidad < cantidad) {
                throw new Error("Stock insuficiente en el depósito de origen.");
            }

            // Descontar de origen
            await tx.stockUbicacion.update({
                where: { productoId_depositoId: { productoId, depositoId: depositoOrigenId } },
                data: { cantidad: { decrement: cantidad } }
            });

            // Sumar a destino (upsert por si no existiera, aunque debería existir)
            await tx.stockUbicacion.upsert({
                where: { productoId_depositoId: { productoId, depositoId: depositoDestinoId } },
                update: { cantidad: { increment: cantidad } },
                create: { productoId, depositoId: depositoDestinoId, cantidad }
            });

            // Registrar movimiento contable
            await tx.movimientoStock.create({
                data: {
                    productoId,
                    depositoOrigenId,
                    depositoDestinoId,
                    cantidad,
                    tipo: "TRANSFERENCIA",
                    motivo: "Transferencia generada manualmente",
                    usuarioId
                }
            });
        });

        revalidatePath("/transferencias");
        revalidatePath("/inventario");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || "Error al transferir stock." };
    }
}

export async function getUltimasTransferencias() {
    return await prisma.movimientoStock.findMany({
        where: { tipo: "TRANSFERENCIA" },
        include: {
            producto: { select: { nombre_producto: true, codigo_articulo: true } },
            depositoOrigen: { select: { nombre: true, sucursal: { select: { nombre: true } } } },
            depositoDestino: { select: { nombre: true, sucursal: { select: { nombre: true } } } },
            usuario: { select: { nombre: true } }
        },
        orderBy: { fecha: 'desc' },
        take: 30
    });
}
