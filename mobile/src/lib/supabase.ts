import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const isNodeRuntime =
  typeof process !== 'undefined' &&
  !!process.versions?.node &&
  typeof window === 'undefined';

const reactNativeStorage =
  typeof AsyncStorage?.getItem === 'function' && typeof AsyncStorage?.setItem === 'function'
    ? AsyncStorage
    : undefined;

const storage = {
  async getItem(key: string) {
    const localStorage = typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined;
    if (localStorage) {
      return localStorage.getItem(key);
    }

    if (reactNativeStorage) {
      return reactNativeStorage.getItem(key);
    }

    return null;
  },
  async setItem(key: string, value: string) {
    const localStorage = typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined;
    if (localStorage) {
      localStorage.setItem(key, value);
      return;
    }

    if (reactNativeStorage) {
      await reactNativeStorage.setItem(key, value);
    }
  },
  async removeItem(key: string) {
    const localStorage = typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined;
    if (localStorage) {
      localStorage.removeItem(key);
      return;
    }

    if (reactNativeStorage) {
      await reactNativeStorage.removeItem(key);
    }
  },
};

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey && !supabaseAnonKey.includes('PASTE_'));
}

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (isNodeRuntime) {
    throw new Error('Supabase client is not available in the Node render environment.');
  }

  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase environment variables are missing. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your mobile env file.',
    );
  }

  supabaseClient = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage,
    },
  });

  return supabaseClient;
}

export const supabase = isNodeRuntime ? null : getSupabaseClient();

export async function signUp(email: string, password: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const client = getSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const client = getSupabaseClient();

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('SESSION_TIMEOUT')), 8000);
  });

  try {
    const { data, error } = await Promise.race([client.auth.getSession(), timeout]);
    if (error) throw error;
    return data.session;
  } catch (err: any) {
    if (err?.message === 'SESSION_TIMEOUT') {
      throw new Error('Oturum bilgisi alınamadı, bağlantını kontrol et.');
    }
    throw err;
  }
}

export async function isAuthenticated() {
  try {
    const session = await getSession();
    return Boolean(session?.access_token);
  } catch {
    return false;
  }
}
