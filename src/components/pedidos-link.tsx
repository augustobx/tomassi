"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { usePathname } from "next/navigation";

export function PedidosLink() {
    const [pendientes, setPendientes] = useState(0);
    const pathname = usePathname();
    const isActive = pathname === "/pedidos";

    useEffect(() => {
        // IMPORTANTE: Tenés que guardar un archivo mp3 en la carpeta /public
        // Ejemplo: /public/alerta.mp3
        const audio = new Audio('/alerta.mp3');

        const checkPedidos = async () => {
            try {
                const res = await fetch('/api/pedidos/pendientes');
                if (!res.ok) return;

                const { count } = await res.json();

                setPendientes((prev) => {
                    // Si el número de pedidos de la base de datos es MAYOR al que teníamos guardado,
                    // significa que entró un pedido nuevo. Hacemos sonar la alerta.
                    // (Evitamos que suene en la primera carga cuando prev es 0)
                    if (count > prev && prev !== 0) {
                        audio.play().catch((e) => console.log("Navegador bloqueó autoplay:", e));
                    }
                    return count;
                });
            } catch (error) {
                console.error("Error consultando pedidos pendientes:", error);
            }
        };

        // Consultar inmediatamente al montar
        checkPedidos();

        // Consultar cada 15 segundos (Short Polling)
        const intervalId = setInterval(checkPedidos, 15000);

        return () => clearInterval(intervalId);
    }, []);

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
                <span className="flex items-center justify-center bg-red-500 text-white text-[10px] font-black h-5 px-2 rounded-full shadow-sm animate-pulse">
                    {pendientes}
                </span>
            )}
        </Link>
    );
}