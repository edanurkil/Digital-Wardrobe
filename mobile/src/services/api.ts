import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { getSession } from "@/lib/supabase";

const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

const CACHE_TTL_MS = 30_000;
let itemsCache: { token: string; value: unknown[]; expiresAt: number } | null = null;
let outfitsCache: { token: string; value: unknown[]; expiresAt: number } | null = null;

async function request(path: string, init: RequestInit = {}, timeoutMs = 15_000) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: any) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error("Sunucu yanıt vermedi. Fotoğraf çok büyük olabilir, lütfen tekrar dene.");
    }
    throw new Error(`Sunucuya bağlanılamadı (${API_URL}). Backend'in çalıştığından emin ol.`);
  }

  if (response.ok) return response;

  let detail = "İstek başarısız oldu";
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") {
      detail = body.detail;
    } else if (Array.isArray(body?.detail)) {
      detail = body.detail
        .map((entry: any) => entry?.msg)
        .filter(Boolean)
        .join(", ") || detail;
    }
  } catch {
    // Keep the status-based fallback for non-JSON server errors.
  }

  if (response.status === 401) {
    throw new Error("Oturum süresi doldu. Lütfen tekrar giriş yapın.");
  }
  throw new Error(detail);
}

async function getAuthHeaders(extra: Record<string, string> = {}) {
  const session = await getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
  }

  return {
    ...extra,
    Authorization: `Bearer ${token}`,
  };
}

export async function getItems() {
  const session = await getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
  if (itemsCache?.token === token && itemsCache.expiresAt > Date.now()) return itemsCache.value;

  const response = await request("/items/", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const value = await response.json();
  itemsCache = { token, value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function createItem(item: {
  name: string;
  category: string;
  color: string;
  season?: string;
  image_url?: string;
}) {
  const response = await request("/items/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthHeaders()),
    },
    body: JSON.stringify(item),
  });
  itemsCache = null;
  return response.json();
}

export async function deleteItem(id: number) {
  const response = await request(`/items/${id}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });
  itemsCache = null;
  return response.json();
}

export async function updateFavoriteItem(itemId: number, isFavorite: boolean) {
  const response = await request(`/items/${itemId}/favorite`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthHeaders()),
    },
    body: JSON.stringify({ is_favorite: isFavorite }),
  });

  itemsCache = null;
  return response.json();
}

export async function createOutfit(outfit: {
  top_id?: number;
  bottom_id?: number;
  dress_id?: number;
  outerwear_id?: number;
  shoes_id?: number;
  accessory_id?: number;
  bag_id?: number;
  note?: string;
}) {
  const response = await request("/outfits/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthHeaders()),
    },
    body: JSON.stringify(outfit),
  });
  outfitsCache = null;
  return response.json();
}

export async function getOutfits() {
  const session = await getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
  if (outfitsCache?.token === token && outfitsCache.expiresAt > Date.now()) return outfitsCache.value;

  const response = await request("/outfits/", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const value = await response.json();
  outfitsCache = { token, value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function updateOutfitImage(outfitId: number, imageUrl: string) {
  const response = await request(`/outfits/${outfitId}/image`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthHeaders()),
    },
    body: JSON.stringify({ outfit_image_url: imageUrl }),
  });
  outfitsCache = null;
  return response.json();
}

export async function uploadImage(uri: string): Promise<string> {
  let base64: string;

  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  const fileExt = uri.split(".").pop()?.toLowerCase() || "jpg";

  let uploadResponse: Response;
  try {
    uploadResponse = await request(
      "/upload/image-base64",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ image_base64: base64, file_ext: fileExt }),
      },
      120_000,
    );
  } catch (error: any) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error("Fotoğraf işlenirken zaman aşımına uğradı. Daha küçük bir fotoğraf dene.");
    }
    throw error;
  }

  const data = await uploadResponse.json();
  return data.url;
}

export async function deleteOutfit(outfitId: number) {
  const response = await request(`/outfits/${outfitId}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });
  outfitsCache = null;
  return response.json();
}