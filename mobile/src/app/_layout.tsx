import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, usePathname, useRouter } from "expo-router";
import type { Session } from "@supabase/supabase-js";
import { StatusBar } from "expo-status-bar";
import "@/global.css";
import { UI } from "@/constants/design";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    let active = true;
    let unsubscribe = () => {};
    try {
      const client = getSupabaseClient();
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, nextSession) => {
        if (active) {
          setSession(nextSession);
          setAuthError(null);
          setLoading(false);
        }
      });
      unsubscribe = () => subscription.unsubscribe();

      client.auth
        .getSession()
        .then(({ data, error }) => {
          if (!active) return;
          if (error) {
            setAuthError(error.message);
          } else {
            setSession(data.session);
          }
          setLoading(false);
        })
        .catch((error: unknown) => {
          if (!active) return;
          setAuthError(error instanceof Error ? error.message : "Oturum kontrol edilemedi.");
          setLoading(false);
        });
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : "Oturum kontrol edilemedi.");
      setLoading(false);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, [attempt, configured]);

  useEffect(() => {
    if (loading || !configured || authError) return;
    const isAuthRoute = pathname === "/auth";
    if (!session && !isAuthRoute) router.replace("/auth");
    if (session && isAuthRoute) router.replace("/");
  }, [authError, configured, loading, pathname, router, session]);

  if (!configured) {
    return (
      <SetupMessage
        title="Supabase yapılandırılmamış"
        message="EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY (veya EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) değerlerini EAS ortamına ekleyip uygulamayı yeniden derle."
      />
    );
  }

  if (loading) {
    return <SetupMessage title="Oturum kontrol ediliyor" message="Lütfen bekle." />;
  }

  if (authError) {
    return (
      <SetupMessage
        title="Oturum kontrol edilemedi"
        message={authError}
        action={() => {
          setAuthError(null);
          setLoading(true);
          setAttempt((value) => value + 1);
        }}
      />
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: UI.colors.background },
        }}
      >
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

function SetupMessage({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: () => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {action ? (
        <Pressable style={styles.button} onPress={action}>
          <Text style={styles.buttonText}>Tekrar dene</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: UI.spacing.lg,
    backgroundColor: UI.colors.background,
  },
  title: {
    color: UI.colors.textPrimary,
    fontFamily: UI.fonts.display,
    fontSize: 26,
    textAlign: "center",
  },
  message: {
    color: UI.colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: UI.spacing.md,
    textAlign: "center",
  },
  button: {
    alignSelf: "center",
    backgroundColor: UI.colors.primaryDark,
    borderColor: UI.colors.accent,
    borderRadius: UI.radius.md,
    borderWidth: 1,
    marginTop: UI.spacing.lg,
    paddingHorizontal: UI.spacing.lg,
    paddingVertical: UI.spacing.sm,
  },
  buttonText: { color: UI.colors.textPrimary, fontWeight: "700" },
});