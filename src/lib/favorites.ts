import type { ApiProduct, ApiFavorite } from "@/types/product";

export const FAVORITES_STORAGE_KEY = "EXPIRYGO_FAVORITES";
export const SAVED_PRODUCTS_STORAGE_KEY = "EXPIRYGO_SAVED_PRODUCTS";
export const FAVORITES_CHANGED_EVENT = "EXPIRYGO_FAVORITES_CHANGED";

/**
 * Retrieve saved favorite product IDs from localStorage
 */
export function getStoredFavoriteIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Retrieve cached full ApiProduct objects for saved deals
 */
export function getStoredSavedProducts(): ApiProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_PRODUCTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save a full product to local saved cache and ID list
 */
export function storeSavedProduct(product: ApiProduct): void {
  if (typeof window === "undefined" || !product?.id) return;
  try {
    // 1. Update ID list
    const ids = new Set(getStoredFavoriteIds());
    ids.add(product.id);
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(ids)));

    // 2. Update Product Cache
    const existing = getStoredSavedProducts();
    const map = new Map<string, ApiProduct>();
    existing.forEach((p) => {
      if (p?.id) map.set(p.id, p);
    });
    map.set(product.id, product);
    localStorage.setItem(
      SAVED_PRODUCTS_STORAGE_KEY,
      JSON.stringify(Array.from(map.values()))
    );

    // 3. Broadcast update to other components and tabs
    notifyFavoritesChanged(Array.from(ids));
  } catch (err) {
    console.warn("Failed to store saved product:", err);
  }
}

/**
 * Remove a product from local saved cache and ID list
 */
export function removeStoredSavedProduct(productId: string): void {
  if (typeof window === "undefined" || !productId) return;
  try {
    // 1. Update ID list
    const ids = new Set(getStoredFavoriteIds());
    ids.delete(productId);
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(ids)));

    // 2. Update Product Cache
    const existing = getStoredSavedProducts();
    const updated = existing.filter((p) => p.id !== productId);
    localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify(updated));

    // 3. Broadcast update
    notifyFavoritesChanged(Array.from(ids));
  } catch (err) {
    console.warn("Failed to remove saved product:", err);
  }
}

/**
 * Clear all wishlisted/saved items
 */
export function clearAllStoredSavedProducts(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify([]));
    notifyFavoritesChanged([]);
  } catch (err) {
    console.warn("Failed to clear saved products:", err);
  }
}

/**
 * Synchronize products returned from the backend favorites API
 */
export function syncSavedProductsWithFavorites(favorites: ApiFavorite[]): ApiProduct[] {
  if (typeof window === "undefined" || !Array.isArray(favorites)) return [];
  try {
    const existingProducts = getStoredSavedProducts();
    const map = new Map<string, ApiProduct>();

    // Seed existing
    existingProducts.forEach((p) => {
      if (p?.id) map.set(p.id, p);
    });

    // Merge API favorites
    const apiIds: string[] = [];
    favorites.forEach((fav) => {
      if (fav.product_id) {
        apiIds.push(fav.product_id);
      }
      if (fav.product?.id) {
        map.set(fav.product.id, fav.product);
      }
    });

    const combinedIds = Array.from(new Set([...getStoredFavoriteIds(), ...apiIds]));
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(combinedIds));

    const combinedProducts = Array.from(map.values()).filter((p) =>
      combinedIds.includes(p.id)
    );
    localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify(combinedProducts));

    notifyFavoritesChanged(combinedIds);
    return combinedProducts;
  } catch {
    return [];
  }
}

/**
 * Broadcast an event across window/tabs
 */
export function notifyFavoritesChanged(favoriteIds: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(FAVORITES_CHANGED_EVENT, {
        detail: { favoriteIds },
      })
    );
  } catch {}
}
