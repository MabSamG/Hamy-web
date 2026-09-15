/**
 * Client-side cart, persisted in IndexedDB so it survives page reloads
 * without a backend cart table. IndexedDB (not localStorage) because
 * personalization photos are File objects — too large/binary for
 * localStorage's string-only, ~5MB quota.
 *
 * Checkout (src/pages/carrito.astro) reads this cart, uploads any photo
 * fields to Supabase Storage, and inserts one row into `pedidos` whose
 * `items` JSON mirrors this shape — that's the hookup point for Stripe
 * later (create the Checkout Session right after the insert, keyed by
 * the same pedido id).
 */

const DB_NAME = "hamy-cart";
const DB_VERSION = 1;
const STORE_NAME = "items";

export const CART_UPDATED_EVENT = "hamy:cart-updated";

export type PersonalizationFieldEntry = {
  label: string;
  value: string | File | null;
};

export type CartItemPersonalization = Record<
  string,
  {
    groupLabel: string;
    fields: Record<string, PersonalizationFieldEntry>;
  }
>;

export type CartItem = {
  id: string;
  productSlug: string;
  productName: string;
  priceCents: number;
  emoji: string;
  addedAt: number;
  personalization: CartItemPersonalization;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDb();
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function notifyCartUpdated() {
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
}

export async function addToCart(item: Omit<CartItem, "id" | "addedAt">): Promise<CartItem> {
  const fullItem: CartItem = { ...item, id: crypto.randomUUID(), addedAt: Date.now() };
  const store = await getStore("readwrite");
  await runRequest(store.add(fullItem));
  notifyCartUpdated();
  return fullItem;
}

export async function getCart(): Promise<CartItem[]> {
  const store = await getStore("readonly");
  const items = await runRequest(store.getAll() as IDBRequest<CartItem[]>);
  return items.sort((a, b) => a.addedAt - b.addedAt);
}

export async function removeFromCart(id: string): Promise<void> {
  const store = await getStore("readwrite");
  await runRequest(store.delete(id));
  notifyCartUpdated();
}

export async function clearCart(): Promise<void> {
  const store = await getStore("readwrite");
  await runRequest(store.clear());
  notifyCartUpdated();
}

export async function getCartCount(): Promise<number> {
  const items = await getCart();
  return items.length;
}
