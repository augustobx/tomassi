"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function BotonActualizar() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleRefresh = () => {
        startTransition(() => {
            // Esto fuerza a Next.js a volver a ejecutar el fetch del servidor
            // y actualizar la UI con los datos frescos de la BD en tiempo real.
            router.refresh();
        });
    };

    return (
        <button
      onClick= { handleRefresh }
    disabled = { isPending }
    className = "flex items-center gap-2 px-4 py-2 text-sm font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400 rounded-xl transition-all shadow-sm disabled:opacity-50"
        >
        <RefreshCw className={ `h-4 w-4 ${isPending ? "animate-spin" : ""}` } />
    { isPending ? "Actualizando..." : "Actualizar Stock" }
    </button>
  );
}