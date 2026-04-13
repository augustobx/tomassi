import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secretKey = process.env.SESSION_SECRET || 'tendeco-super-secret-key-2024';
const key = new TextEncoder().encode(secretKey);

const COOKIE_NAME = 'tendeco_session';

// ========================================================
// LÓGICA DE TIEMPO: Calcula el próximo cierre a las 18:00
// ========================================================
function obtenerProximoCierre() {
    const now = new Date();

    // Obtenemos la fecha y hora actual específicamente en Argentina.
    // Esto evita que el servidor (que suele estar en UTC) calcule mal el día.
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', hourCycle: 'h23'
    }).formatToParts(now);

    const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);

    const year = getPart('year');
    const month = getPart('month') - 1; // En JavaScript los meses empiezan en 0
    const day = getPart('day');
    const currentHour = getPart('hour'); // Hora en formato 0-23

    // Construimos la fecha en UTC. 
    // Las 18:00 en Argentina equivalen a las 21:00 en UTC (UTC-3)
    const cierreUTC = new Date(Date.UTC(year, month, day, 21, 0, 0, 0));

    // Si la hora actual en Argentina ya es igual o mayor a las 18:00,
    // significa que el próximo cierre debe ser MAÑANA a las 18:00.
    if (currentHour >= 18) {
        cierreUTC.setDate(cierreUTC.getDate() + 1);
    }

    return cierreUTC;
}

// ========================================================
// CONTROL DE SESIÓN
// ========================================================
export async function crearSesion(usuario: any) {
    const expiresAt = obtenerProximoCierre();

    // El JWT requiere el tiempo de expiración en formato UNIX (segundos)
    const expUnix = Math.floor(expiresAt.getTime() / 1000);

    const payload = {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol,
        permisos: JSON.parse(usuario.permisos || "[]"),
        sucursalId: usuario.sucursalId
    };

    // 1. Firmamos el Token con fecha de muerte exacta a las 18:00
    const sessionToken = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expUnix)
        .sign(key);

    // 2. Le decimos al navegador que borre la Cookie a las 18:00
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: expiresAt,
        sameSite: 'lax',
        path: '/',
    });
}

export async function getSessionUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) return null;

    try {
        const { payload } = await jwtVerify(token, key);
        return payload;
    } catch (error) {
        // Si ya pasaron las 18:00, la firma falla por expiración y cae directo acá, invalidando la sesión
        return null;
    }
}

export async function cerrarSesion() {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}