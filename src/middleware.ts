import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const secretKey = process.env.SESSION_SECRET || 'tendeco-super-secret-key-2024';
const key = new TextEncoder().encode(secretKey);

// Este diccionario conecta las rutas de la URL con los permisos que creamos en la base de datos
const RUTAS_MODULOS: Record<string, string> = {
    '/ventas': 'VENTAS',
    '/caja': 'CAJA',
    '/cuentas-corrientes': 'CLIENTES',
    '/inventario': 'INVENTARIO',
    '/historial': 'HISTORIAL',
    '/reportes': 'REPORTES',
    '/configuracion': 'CONFIGURACION'
};

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Dejar pasar archivos del sistema, imágenes, y la página de login libremente.
    // También dejamos pasar la ruta /imprimir para que los tickets no pidan login al abrirse en ventana nueva.
    if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/login' || pathname.startsWith('/imprimir')) {
        return NextResponse.next();
    }

    // 2. Buscar si el usuario tiene el token de sesión guardado
    const sessionToken = request.cookies.get('tendeco_session')?.value;

    // Si no tiene token, ¡afuera! Lo mandamos a loguearse.
    if (!sessionToken) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
        // 3. Desencriptar el token y leer quién es
        const { payload } = await jwtVerify(sessionToken, key);
        const rol = payload.rol as string;
        const permisos = payload.permisos as string[];

        // Si es el DUEÑO (ADMIN), tiene acceso VIP a todo el sistema. Pasa directo.
        if (rol === 'ADMIN') return NextResponse.next();

        // --------------------------------------------------------
        // REGLAS ESTRICTAS PARA EMPLEADOS (CAJEROS)
        // --------------------------------------------------------

        // A) Nunca pueden entrar a gestionar otros usuarios
        if (pathname.startsWith('/usuarios')) {
            return NextResponse.redirect(new URL('/', request.url));
        }

        // B) Revisar si la ruta a la que intenta entrar requiere un permiso específico
        const moduloRequerido = Object.keys(RUTAS_MODULOS).find(ruta => pathname.startsWith(ruta));

        if (moduloRequerido) {
            const permisoNecesario = RUTAS_MODULOS[moduloRequerido];

            // Si el cajero NO tiene el permiso tildado en su cuenta, lo rebotamos al inicio.
            if (!permisos.includes(permisoNecesario)) {
                return NextResponse.redirect(new URL('/', request.url));
            }
        }

        // Si pasó todas las pruebas, lo dejamos pasar a la pantalla
        return NextResponse.next();

    } catch (error) {
        // Si el token expiró (pasaron las 12 horas) o alguien lo modificó, lo mandamos al login.
        return NextResponse.redirect(new URL('/login', request.url));
    }
}

// Configuración para que el patovica no pierda el tiempo revisando íconos o archivos estáticos
export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};