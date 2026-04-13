import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Le decimos a Next.js que esta ruta no se debe cachear nunca
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const count = await prisma.pedido.count({
            where: { estado: 'PENDIENTE' }
        });

        return NextResponse.json({ count });
    } catch (error) {
        return NextResponse.json({ error: 'Error al obtener pedidos' }, { status: 500 });
    }
}