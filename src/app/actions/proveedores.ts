"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ==========================================
// 1. CRUD DE PROVEEDORES
// ==========================================
export async function getProveedoresCompleto() {
    try {
        return await prisma.proveedor.findMany({
            orderBy: { nombre: 'asc' },
            include: {
                _count: { select: { productos: true, marcas: true } },
                marcas: {
                    include: {
                        _count: { select: { productos: true, categorias: true } },
                        categorias: {
                            include: {
                                _count: { select: { productos: true } }
                            }
                        }
                    },
                    orderBy: { nombre: 'asc' }
                }
            }
        });
    } catch (error) {
        return [];
    }
}

export async function guardarProveedor(formData: FormData) {
    try {
        const id = formData.get("id") ? Number(formData.get("id")) : null;
        const data = {
            nombre: formData.get("nombre") as string,
            cuit: formData.get("cuit") as string,
            telefono: formData.get("telefono") as string,
            email: formData.get("email") as string,
            direccion: formData.get("direccion") as string,
            notas: formData.get("notas") as string,
            aumento_porcentaje: Number(formData.get("aumento_porcentaje") || 0),
        };

        if (id) {
            await prisma.proveedor.update({ where: { id }, data });
        } else {
            await prisma.proveedor.create({ data });
        }

        revalidatePath("/proveedores");
        revalidatePath("/inventario");
        return { success: true };
    } catch (error: any) {
        if (error.code === 'P2002') return { success: false, error: "Ya existe un proveedor con ese nombre." };
        return { success: false, error: "Error al guardar el proveedor." };
    }
}

// ==========================================
// 2. CRUD DE MARCAS
// ==========================================
export async function guardarMarca(formData: FormData) {
    try {
        const id = formData.get("id") ? Number(formData.get("id")) : null;
        const proveedorId = Number(formData.get("proveedorId"));
        const nombre = formData.get("nombre") as string;
        const aumento_porcentaje = Number(formData.get("aumento_porcentaje") || 0);

        if (!nombre?.trim()) return { success: false, error: "El nombre es obligatorio." };

        if (id) {
            await prisma.marca.update({ where: { id }, data: { nombre: nombre.trim(), aumento_porcentaje } });
        } else {
            await prisma.marca.create({ data: { nombre: nombre.trim(), proveedorId, aumento_porcentaje } });
        }

        revalidatePath("/proveedores");
        revalidatePath("/inventario");
        return { success: true };
    } catch (error: any) {
        if (error.code === 'P2002') return { success: false, error: "Esta marca ya existe para este proveedor." };
        return { success: false, error: "Error al guardar la marca." };
    }
}

export async function eliminarMarca(id: number) {
    try {
        await prisma.marca.delete({ where: { id } });
        revalidatePath("/proveedores");
        revalidatePath("/inventario");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "No se puede eliminar esta marca porque tiene productos o categorías asignadas." };
    }
}

// ==========================================
// 3. ACTUALIZACIÓN MASIVA CON CASCADA
// ==========================================
export async function actualizarPreciosMasivos(
    proveedorId: number,
    porcentaje: number,
    accion: "AUMENTO" | "REBAJA",
    marcaId?: number,
    categoriaId?: number
) {
    try {
        const whereProducto: any = { proveedorId };
        if (marcaId) whereProducto.marcaId = marcaId;
        if (categoriaId) whereProducto.categoriaId = categoriaId;

        const productos = await prisma.producto.findMany({
            where: whereProducto,
            include: { proveedor: true, marca: true, categoria: true }
        });

        if (productos.length === 0) return { success: false, error: "No hay productos que coincidan con los filtros seleccionados." };

        const multiplicador = accion === "AUMENTO" ? (1 + (porcentaje / 100)) : (1 - (porcentaje / 100));

        // Build description for audit trail
        let descripcion = `Proveedor: ${productos[0].proveedor?.nombre || 'N/A'}`;
        if (marcaId && productos[0].marca) descripcion += ` | Marca: ${productos[0].marca.nombre}`;
        if (categoriaId && productos[0].categoria) descripcion += ` | Categoría: ${productos[0].categoria.nombre}`;
        const motivoTexto = `Actualización Masiva: ${accion === "AUMENTO" ? '+' : '-'}${porcentaje}% (${descripcion})`;

        await prisma.$transaction(async (tx) => {
            for (const prod of productos) {
                const nuevoCosto = Number((prod.precio_costo * multiplicador).toFixed(2));

                await tx.producto.update({
                    where: { id: prod.id },
                    data: { precio_costo: nuevoCosto }
                });

                await tx.historialPrecio.create({
                    data: {
                        productoId: prod.id,
                        precio_costo_anterior: prod.precio_costo,
                        precio_costo_nuevo: nuevoCosto,
                        porcentaje_cambio: accion === "AUMENTO" ? porcentaje : -porcentaje,
                        motivo: motivoTexto
                    }
                });
            }
        });

        revalidatePath("/proveedores");
        revalidatePath("/inventario");
        revalidatePath("/reportes");

        return { success: true, cantidadModificada: productos.length };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Error al aplicar la actualización masiva." };
    }
}