import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

let client: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}

export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase ayarlanmamış. EXPO_PUBLIC_SUPABASE_URL ve public key değerlerini yapılandır.",
    );
  }

  if (!client) {
    client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        ...(Platform.OS === "web" ? {} : { storage: AsyncStorage }),
      },
    });
  }

  return client;
}
