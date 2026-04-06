"use server";

import { PrismaClient } from "@prisma/client";
import { crearSesion, cerrarSesion, getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export async function getClientSession() {
    const payload = await getSessionUser();
    if (!payload || !payload.id) return null;

    // Refresh critical fields from DB so we don't have to force logouts
    try {
        const userFresh = await prisma.usuario.findUnique({ where: { id: payload.id as number } });
        if (userFresh) {
            return {
                ...payload,
                sucursalId: userFresh.sucursalId,
                permisos: JSON.parse(userFresh.permisos || "[]"),
                rol: userFresh.rol
            };
        }
    } catch (e) {
        console.error(e);
    }
    return payload;
}

export async function login(formData: FormData) {
    try {
        const username = formData.get("username") as string;
        const password = formData.get("password") as string;

        const usuario = await prisma.usuario.findUnique({ where: { username } });

        // En un sistema 100% real de producción, acá se usa bcrypt para comparar contraseñas encriptadas.
        // Para este nivel operativo, lo dejamos directo.
        if (!usuario || usuario.password !== password) {
            return { success: false, error: "Usuario o contraseña incorrectos." };
        }

        if (!usuario.activo) {
            return { success: false, error: "Esta cuenta está desactivada. Hablá con el administrador." };
        }

        // Si todo está bien, le creamos la pulsera VIP
        await crearSesion(usuario);
        return { success: true, rol: usuario.rol };

    } catch (error) {
        return { success: false, error: "Error interno del servidor al iniciar sesión." };
    }
}

export async function logout() {
    await cerrarSesion();
    redirect("/login");
}