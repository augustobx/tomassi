"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

// --- CATEGORÍAS ---
export async function getCategorias() {
    return await prisma.categoria.findMany({
        orderBy: { nombre: 'asc' }
    });
}

export async function crearCategoria(formData: FormData) {
    const nombre = formData.get("nombre") as string;
    if (!nombre) return;

    await prisma.categoria.create({
        data: { nombre }
    });

    // Refresca las páginas para que se vea el cambio al instante
    revalidatePath("/categorias");
    revalidatePath("/inventario/nuevo");
}

// --- LISTAS DE PRECIOS ---
export async function getListasPrecio() {
    return await prisma.listaPrecio.findMany({
        orderBy: { nombre: 'asc' }
    });
}

export async function crearListaPrecio(formData: FormData) {
    const nombre = formData.get("nombre") as string;
    const margen_defecto = parseFloat(formData.get("margen_defecto") as string);

    if (!nombre || isNaN(margen_defecto)) return;

    await prisma.listaPrecio.create({
        data: { nombre, margen_defecto }
    });

    revalidatePath("/listas-precio");
    revalidatePath("/inventario/nuevo");
}

// --- SUCURSALES Y DEPÓSITOS ---
export async function getSucursales() {
    return await prisma.sucursal.findMany({
        where: { estado: true },
        include: { depositos: true },
        orderBy: { nombre: 'asc' }
    });
}

export async function getDepositos(sucursalId?: number) {
    const whereClause = sucursalId ? { sucursalId, estado: true } : { estado: true };
    return await prisma.deposito.findMany({
        where: whereClause,
        orderBy: { nombre: 'asc' }
    });
}