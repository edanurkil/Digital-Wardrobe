import Constants from "expo-constants";
import { Image as NativeImage } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import { getSupabaseClient } from "@/lib/supabase";

export type ClothingItem = {
  id: number;
  user_id: string;
  name: string;
  category: string;
  color: string;
  season?: string | null;
  image_url: string | null;
  is_favorite: boolean;
  created_at: string;
};

export type Outfit = {
  id: number;
  user_id: string;
  note: string | null;
  outfit_image_url: string | null;
  created_at: string;
  top: ClothingItem | null;
  bottom: ClothingItem | null;
  dress: ClothingItem | null;
  outerwear: ClothingItem | null;
  shoes: ClothingItem | null;
  accessory: ClothingItem | null;
  bag: ClothingItem | null;
};

const STORAGE_BUCKET = "clothing-images";
const IMAGE_URL_TTL_SECONDS = 60 * 60 * 24;
const CACHE_TTL_MS = 30_000;
const IMAGE_API_TIMEOUT_MS = 180_000;
type Cache<T> = { userId: string; value: T; expiresAt: number } | null;
let itemsCache: Cache<ClothingItem[]> = null;
let outfitsCache: Cache<Outfit[]> = null;

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const defaultApiUrl = configuredApiUrl || (__DEV__ ? "http://localhost:8000" : "");
const metroHost = Constants.expoConfig?.hostUri?.split(":")[0];
let apiUrl = "";
let apiConfigurationError = "";

if (defaultApiUrl) {
  try {
    const parsedUrl = new URL(defaultApiUrl);
    if (!__DEV__ && parsedUrl.protocol !== "https:") {
      apiConfigurationError = "Canlı APK için EXPO_PUBLIC_API_URL HTTPS adresi olmalıdır.";
    } else {
      const isLoopback =
        parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";
      apiUrl = (
        __DEV__ && isLoopback && metroHost
          ? `${parsedUrl.protocol}//${metroHost}:${parsedUrl.port || "8000"}`
          : defaultApiUrl
      ).replace(/\/$/, "");
    }
  } catch {
    apiConfigurationError = "EXPO_PUBLIC_API_URL geçerli bir URL değil.";
  }
} else {
  apiConfigurationError =
    "Arka plan kaldırma servisi yapılandırılmamış. EAS ortamında EXPO_PUBLIC_API_URL ayarla.";
}

export function clearApiCache() {
  itemsCache = null;
  outfitsCache = null;
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function getUserId() {
  const { data, error } = await getSupabaseClient().auth.getSession();
  throwIfError(error);
  if (!data.session?.user.id) {
    throw new Error("Oturum bulunamadı. Lütfen yeniden giriş yap.");
  }
  return data.session.user.id;
}

async function getSignedImageUrl(path: string | null | undefined) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;

  const { data, error } = await getSupabaseClient()
    .storage.from(STORAGE_BUCKET)
    .createSignedUrl(path, IMAGE_URL_TTL_SECONDS);
  throwIfError(error);
  if (!data) throw new Error("Fotoğraf bağlantısı oluşturulamadı.");
  return data.signedUrl;
}

async function withSignedImage(item: ClothingItem): Promise<ClothingItem> {
  return { ...item, image_url: await getSignedImageUrl(item.image_url) };
}

async function prepareImageBase64(uri: string): Promise<string> {
  const { width, height } = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      NativeImage.getSize(uri, (imageWidth, imageHeight) => {
        resolve({ width: imageWidth, height: imageHeight });
      }, reject);
    },
  );
  const resizeAction =
    Math.max(width, height) > 1600
      ? [{ resize: width >= height ? { width: 1600 } : { height: 1600 } }]
      : [];
  const result = await ImageManipulator.manipulateAsync(uri, resizeAction, {
    base64: true,
    compress: 0.72,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  if (!result.base64) throw new Error("Fotoğraf sıkıştırılamadı.");
  return result.base64;
}

function decodeBase64(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function storeOriginalImage(userId: string, base64: string): Promise<string> {
  const objectPath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { data, error } = await getSupabaseClient()
    .storage.from(STORAGE_BUCKET)
    .upload(objectPath, decodeBase64(base64), {
      contentType: "image/jpeg",
      upsert: false,
    });
  throwIfError(error);
  if (!data?.path) throw new Error("Fotoğraf Supabase Storage'a kaydedilemedi.");
  return data.path;
}

export async function uploadImage(uri: string): Promise<string> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  throwIfError(error);
  const session = data.session;
  if (!session?.access_token) {
    throw new Error("Fotoğraf yüklemek için giriş yapmalısın.");
  }

  const base64 = await prepareImageBase64(uri);
  return storeOriginalImage(session.user.id, base64);
}

export async function removeImageBackground(path: string): Promise<string | null> {
  if (apiConfigurationError) return null;

  const { data, error } = await getSupabaseClient().auth.getSession();
  throwIfError(error);
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Oturum bulunamadı. Lütfen yeniden giriş yap.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_API_TIMEOUT_MS);

  try {
    const response = await fetch(`${apiUrl}/upload/process-storage-image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = `Fotoğraf servisi başarısız oldu (${response.status}).`;
      try {
        const body = await response.json();
        if (typeof body?.detail === "string") message = body.detail;
      } catch {
        // The response may be a non-JSON proxy error.
      }
      throw new Error(message);
    }

    const result: { path: string; background_removed: boolean } = await response.json();
    return result.background_removed && result.path !== path ? result.path : null;
  } catch (error: unknown) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("Arka plan kaldırma zaman aşımına uğradı; orijinal fotoğraf korunuyor.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function updateItemImage(itemId: number, imagePath: string) {
  const userId = await getUserId();
  const { data, error } = await getSupabaseClient()
    .from("clothing_items")
    .update({ image_url: imagePath })
    .eq("user_id", userId)
    .eq("id", itemId)
    .select("*")
    .single();
  throwIfError(error);
  itemsCache = null;
  return data;
}

export async function deleteStoredImage(path: string) {
  const { error } = await getSupabaseClient().storage.from(STORAGE_BUCKET).remove([path]);
  throwIfError(error);
}

export async function getItems(force = false): Promise<ClothingItem[]> {
  const userId = await getUserId();
  if (
    !force &&
    itemsCache?.userId === userId &&
    itemsCache.expiresAt > Date.now()
  ) {
    return itemsCache.value;
  }

  const { data, error } = await getSupabaseClient()
    .from("clothing_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  throwIfError(error);

  const value = await Promise.all((data ?? []).map(withSignedImage));
  itemsCache = { userId, value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function createItem(item: {
  name: string;
  category: string;
  color: string;
  season?: string;
  image_url?: string;
}) {
  const userId = await getUserId();
  const { data, error } = await getSupabaseClient()
    .from("clothing_items")
    .insert({
      ...item,
      user_id: userId,
      season: item.season ?? null,
      image_url: item.image_url ?? null,
    })
    .select("*")
    .single();
  throwIfError(error);
  itemsCache = null;
  return data;
}

export async function deleteItem(id: number) {
  const client = getSupabaseClient();
  const userId = await getUserId();
  const outfitSlots = [
    "top_id",
    "bottom_id",
    "dress_id",
    "outerwear_id",
    "shoes_id",
    "accessory_id",
    "bag_id",
  ];
  const { data: references, error: referenceError } = await client
    .from("outfits")
    .select("id")
    .eq("user_id", userId)
    .or(outfitSlots.map((slot) => `${slot}.eq.${id}`).join(","))
    .limit(1);
  throwIfError(referenceError);
  if (references?.length) {
    throw new Error("Bu kıyafet kayıtlı kombinlerde kullanılıyor.");
  }

  const { data: item, error: itemError } = await client
    .from("clothing_items")
    .select("image_url")
    .eq("user_id", userId)
    .eq("id", id)
    .single();
  throwIfError(itemError);
  if (!item) throw new Error("Kıyafet bulunamadı.");

  const { error } = await client
    .from("clothing_items")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  throwIfError(error);
  itemsCache = null;
  outfitsCache = null;

  if (item.image_url) {
    const { error: storageError } = await client.storage
      .from(STORAGE_BUCKET)
      .remove([item.image_url]);
    if (storageError) {
      throw new Error(`Kıyafet silindi ancak fotoğraf depodan silinemedi: ${storageError.message}`);
    }
  }
  return { message: "Kıyafet silindi" };
}

export async function updateFavoriteItem(itemId: number, isFavorite: boolean) {
  const userId = await getUserId();
  const { data, error } = await getSupabaseClient()
    .from("clothing_items")
    .update({ is_favorite: isFavorite })
    .eq("user_id", userId)
    .eq("id", itemId)
    .select("*")
    .single();
  throwIfError(error);
  itemsCache = null;
  return data;
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
  const userId = await getUserId();
  const { data, error } = await getSupabaseClient()
    .from("outfits")
    .insert({ ...outfit, user_id: userId })
    .select("*")
    .single();
  throwIfError(error);
  outfitsCache = null;
  return data;
}

const outfitSelect =
  "*, top:clothing_items!outfits_top_id_fkey(*), bottom:clothing_items!outfits_bottom_id_fkey(*), dress:clothing_items!outfits_dress_id_fkey(*), outerwear:clothing_items!outfits_outerwear_id_fkey(*), shoes:clothing_items!outfits_shoes_id_fkey(*), accessory:clothing_items!outfits_accessory_id_fkey(*), bag:clothing_items!outfits_bag_id_fkey(*)";

export async function getOutfits(force = false): Promise<Outfit[]> {
  const userId = await getUserId();
  if (
    !force &&
    outfitsCache?.userId === userId &&
    outfitsCache.expiresAt > Date.now()
  ) {
    return outfitsCache.value;
  }

  const { data, error } = await getSupabaseClient()
    .from("outfits")
    .select(outfitSelect)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  throwIfError(error);

  const value = await Promise.all(
    (data ?? []).map(async (outfit) => {
      const itemEntries = await Promise.all(
        (["top", "bottom", "dress", "outerwear", "shoes", "accessory", "bag"] as const).map(
          async (slot) => {
            const item = outfit[slot] as ClothingItem | null;
            return [slot, item ? await withSignedImage(item) : null] as const;
          },
        ),
      );
      return {
        ...outfit,
        ...Object.fromEntries(itemEntries),
        outfit_image_url: await getSignedImageUrl(outfit.outfit_image_url),
      } as Outfit;
    }),
  );
  outfitsCache = { userId, value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function deleteOutfit(outfitId: number) {
  const client = getSupabaseClient();
  const userId = await getUserId();
  const { data: outfit, error: readError } = await client
    .from("outfits")
    .select("outfit_image_url")
    .eq("user_id", userId)
    .eq("id", outfitId)
    .single();
  throwIfError(readError);
  if (!outfit) throw new Error("Kombin bulunamadı.");

  const { error } = await client
    .from("outfits")
    .delete()
    .eq("user_id", userId)
    .eq("id", outfitId);
  throwIfError(error);
  outfitsCache = null;

  if (outfit.outfit_image_url) {
    const { error: storageError } = await client.storage
      .from(STORAGE_BUCKET)
      .remove([outfit.outfit_image_url]);
    if (storageError) {
      throw new Error(`Kombin silindi ancak fotoğraf depodan silinemedi: ${storageError.message}`);
    }
  }
  return { message: "Kombin silindi" };
}

export async function updateOutfitImage(outfitId: number, imagePath: string) {
  const userId = await getUserId();
  const { data, error } = await getSupabaseClient()
    .from("outfits")
    .update({ outfit_image_url: imagePath })
    .eq("user_id", userId)
    .eq("id", outfitId)
    .select("*")
    .single();
  throwIfError(error);
  outfitsCache = null;
  return data;
}
