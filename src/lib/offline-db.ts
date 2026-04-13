// src/lib/offline-db.ts
export const DB_NAME = "Tommasi_Offline_DB";
export const STORE_PEDIDOS = "pedidos_pendientes";
export const STORE_CLIENTES = "clientes_pendientes";

export function initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_PEDIDOS)) db.createObjectStore(STORE_PEDIDOS, { keyPath: "id", autoIncrement: true });
            if (!db.objectStoreNames.contains(STORE_CLIENTES)) db.createObjectStore(STORE_CLIENTES, { keyPath: "id", autoIncrement: true });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function guardarOffline(storeName: string, data: any) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.add({ ...data, timestamp: Date.now() });
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

export async function obtenerTodosOffline(storeName: string): Promise<any[]> {
    const db = await initDB();
    return new Promise((resolve) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });
}

export async function eliminarOffline(storeName: string, id: number) {
    const db = await initDB();
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(id);
}