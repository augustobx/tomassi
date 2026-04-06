import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// Llave maestra del sistema (En producción debería ir en un archivo .env)
const secretKey = process.env.SESSION_SECRET || 'tendeco-super-secret-key-2024';
const key = new TextEncoder().encode(secretKey);

export async function crearToken(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('12h') // La sesión dura 12 horas (un turno laboral)
        .sign(key);
}

export async function crearSesion(usuario: any) {
    const expires = new Date(Date.now() + 12 * 60 * 60 * 1000);

    // Guardamos qué permisos tiene este usuario adentro del token
    const sessionData = {
        id: usuario.id,
        nombre: usuario.nombre,
        username: usuario.username,
        rol: usuario.rol,
        sucursalId: usuario.sucursalId, // NUEVO: Contexto de Sucursal
        permisos: JSON.parse(usuario.permisos || "[]")
    };

    const token = await crearToken(sessionData);

    // LA CORRECCIÓN ESTÁ ACÁ: Hay que "esperar" a las cookies
    const cookieStore = await cookies();

    cookieStore.set('tendeco_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: expires,
        sameSite: 'lax',
        path: '/',
    });
}

export async function cerrarSesion() {
    // ACÁ TAMBIÉN: Esperamos a las cookies para borrarlas
    const cookieStore = await cookies();
    cookieStore.set('tendeco_session', '', { expires: new Date(0) });
}

export async function getSessionUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get('tendeco_session')?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, key);
        return payload;
    } catch {
        return null;
    }
}