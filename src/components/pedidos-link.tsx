"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export function PedidosLink() {
    const [pendientes, setPendientes] = useState(0);
    const pathname = usePathname();
    const router = useRouter();
    const isActive = pathname === "/pedidos";

    useEffect(() => {
        // Asegurate de que alerta.mp3 esté en la carpeta /public
        const audio = new Audio('/alerta.mp3');
        audio.load();

        const checkPedidos = async () => {
            try {
                // Fetch fresco, sin caché
                const res = await fetch('/api/pedidos/pendientes', { cache: 'no-store' });
                if (!res.ok) return;

                const { count } = await res.json();

                setPendientes((prev) => {
                    // Si la cantidad de pedidos pendientes en la BD es mayor a lo que teníamos
                    if (count > prev) {
                        // Reproduce sonido (si el navegador lo permite)
                        audio.play().catch(e => console.warn("El navegador bloqueó el autoplay del sonido."));

                        // Refresca la tabla automáticamente
                        router.refresh();
                    }
                    return count;
                });
            } catch (error) {
                console.error("Error consultando pedidos pendientes:", error);
            }
        };

        // Ejecutar inmediatamente al montar y luego cada 10 segundos
        checkPedidos();
        const intervalId = setInterval(checkPedidos, 10000);

        return () => clearInterval(intervalId);
    }, [router]);

    return (
        <Link
            href="/pedidos"
            className={`flex items-center justify-between px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
                    : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-400 dark:hover:bg-zinc-800 dark:hover:text-slate-200'
                }`}
        >
            <div className="flex items-center gap-3">
                <ClipboardList className={`h-4 w-4 ${isActive ? 'opacity-100' : 'opacity-70'}`} />
                Pedidos Vendedores
            </div>

            {pendientes > 0 && (
                <span className="flex items-center justify-center bg-red-500 text-white text-[10px] font-black h-5 px-2 rounded-full shadow-sm animate-bounce">
                    {pendientes}
                </span>
            )}
        </Link>
    );
}