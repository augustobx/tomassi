"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type CompraData = {
  fecha: string;
  productoId: number;
  costo_base: number;
  costo_final: number;
  notas?: string;
  impuestos: {
    nombre: string;
    porcentaje?: number;
    monto: number;
  }[];
  cantidad?: number;
  depositoId?: number;
};

export async function registrarCompra(data: CompraData) {
  try {
    const { fecha, productoId, costo_base, costo_final, notas, impuestos } = data;

    // 1. Create the Compra
    const compra = await prisma.compra.create({
      data: {
        fecha: new Date(fecha),
        productoId,
        costo_base,
        costo_final,
        cantidad: data.cantidad || 0,
        depositoId: data.depositoId,
        notas,
        impuestos: {
          create: impuestos.map((imp) => ({
            nombre: imp.nombre,
            porcentaje: imp.porcentaje,
            monto: imp.monto,
          })),
        },
      },
    });

    // 1.5 Update Stock if cantidad and depositoId are provided
    if (data.cantidad && data.cantidad > 0 && data.depositoId) {
      // Create MovimientoStock
      await prisma.movimientoStock.create({
        data: {
          productoId,
          depositoDestinoId: data.depositoId,
          cantidad: data.cantidad,
          tipo: "INGRESO_COMPRA",
          motivo: `Ingreso por compra #${compra.id}`,
          fecha: new Date(fecha)
        }
      });

      // Update StockUbicacion
      await prisma.stockUbicacion.upsert({
        where: {
          productoId_depositoId: {
            productoId,
            depositoId: data.depositoId
          }
        },
        update: {
          cantidad: { increment: data.cantidad }
        },
        create: {
          productoId,
          depositoId: data.depositoId,
          cantidad: data.cantidad
        }
      });
    }

    // 2. Update the product's precio_costo
    const producto = await prisma.producto.findUnique({
      where: { id: productoId }
    });

    if (producto) {
      // Record history
      await prisma.historialPrecio.create({
        data: {
          productoId,
          precio_costo_anterior: producto.precio_costo,
          precio_costo_nuevo: costo_final,
          motivo: `Actualización por carga de compra #${compra.id}`,
          porcentaje_cambio: producto.precio_costo > 0 
            ? ((costo_final - producto.precio_costo) / producto.precio_costo) * 100 
            : 0
        }
      });

      // Update product
      await prisma.producto.update({
        where: { id: productoId },
        data: {
          precio_costo: costo_final
        }
      });
    }

    revalidatePath("/compras");
    revalidatePath("/productos");

    return { success: true, compra };
  } catch (error: any) {
    console.error("Error registrando compra:", error);
    return { success: false, error: error.message };
  }
}

export async function getHistorialCompras(filtros?: {
  desde?: string;
  hasta?: string;
  productoId?: number;
}) {
  try {
    let where: any = {};

    if (filtros?.desde && filtros?.hasta) {
      where.fecha = {
        gte: new Date(filtros.desde),
        lte: new Date(filtros.hasta + "T23:59:59.999Z"),
      };
    }

    if (filtros?.productoId) {
      where.productoId = filtros.productoId;
    }

    const compras = await prisma.compra.findMany({
      where,
      include: {
        producto: {
          select: {
            nombre_producto: true,
            codigo_articulo: true,
          }
        },
        impuestos: true,
      },
      orderBy: {
        fecha: "desc",
      },
    });

    return compras;
  } catch (error) {
    console.error("Error al obtener compras:", error);
    return [];
  }
}

export async function getUltimaCompra(productoId: number) {
  try {
    const ultima = await prisma.compra.findFirst({
      where: { productoId },
      include: {
        impuestos: true,
      },
      orderBy: {
        fecha: "desc",
      },
    });
    return ultima;
  } catch (error) {
    console.error("Error al obtener ultima compra:", error);
    return null;
  }
}
