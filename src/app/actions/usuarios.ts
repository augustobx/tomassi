"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

export async function getUsuarios() {
    try {
        return await prisma.usuario.findMany({ orderBy: { id: 'asc' } });
    } catch (error) {
        return [];
    }
}

export async function guardarUsuario(formData: FormData, permisosJSON: string) {
    try {
        const id = formData.get("id") ? Number(formData.get("id")) : null;
        const nombre = formData.get("nombre") as string;
        const username = formData.get("username") as string;
        const password = formData.get("password") as string;
        const sucursalIdRaw = formData.get("sucursalId");
        const sucursalIdStr = (sucursalIdRaw && sucursalIdRaw !== "null" && sucursalIdRaw !== "") ? Number(sucursalIdRaw) : null;

        // Verificamos si es el primer usuario del sistema para hacerlo ADMIN
        const totalUsuarios = await prisma.usuario.count();
        const rolForm = formData.get("rol") as string;
        const rol = totalUsuarios === 0 ? "ADMIN" : (rolForm || "CAJERO");

        if (id) {
            // ACTUALIZAR USUARIO EXISTENTE
            const dataUpdate: any = { 
                nombre, 
                username, 
                permisos: permisosJSON,
                sucursalId: sucursalIdStr
            };
            // Si se envía un rol y el usuario no es ADMIN, actualizar
            if (rolForm && rolForm !== 'ADMIN') {
                dataUpdate.rol = rolForm;
            }
            if (password && password.trim() !== "") {
                dataUpdate.password = password; // Nota: En producción esto se encripta con bcrypt
            }

            await prisma.usuario.update({
                where: { id },
                data: dataUpdate
            });
        } else {
            // CREAR NUEVO USUARIO
            if (!password) throw new Error("La contraseña es obligatoria para un nuevo usuario.");

            await prisma.usuario.create({
                data: {
                    nombre,
                    username,
                    password,
                    rol,
                    permisos: permisosJSON,
                    sucursalId: sucursalIdStr
                }
            });
        }

        revalidatePath("/usuarios");
        return { success: true };
    } catch (error: any) {
        if (error.code === 'P2002') return { success: false, error: "El nombre de usuario ya está en uso." };
        return { success: false, error: error.message || "Error al guardar el usuario." };
    }
}

export async function eliminarUsuario(id: number) {
    try {
        await prisma.usuario.delete({ where: { id } });
        revalidatePath("/usuarios");
        return { success: true };
    } catch (error) {
        return { success: false, error: "No se pudo eliminar el usuario." };
    }
}