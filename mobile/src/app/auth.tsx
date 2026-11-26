import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { UI } from "@/constants/design";
import { notify } from "@/utils/dialogs";
import { getSupabaseClient } from "@/lib/supabase";

export default function AuthScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      notify("E-posta geçersiz", "Geçerli bir e-posta adresi gir.");
      return;
    }
    if (password.length < 4) {
      notify("Şifre çok kısa", "Şifre en az 4 karakter olmalı.");
      return;
    }

    setBusy(true);
    try {
      const auth = getSupabaseClient().auth;
      const { error } = await auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;
      router.replace("/");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "İşlem tamamlanamadı.";
      const normalizedMessage = message.toLowerCase();
      if (normalizedMessage.includes("invalid login credentials")) {
        notify("Giriş başarısız", "E-posta veya şifre hatalı.");
      } else if (normalizedMessage.includes("already registered")) {
        notify("Hesap zaten var", "Bu e-posta ile giriş yapmayı dene.");
      } else if (normalizedMessage.includes("email not confirmed")) {
        notify("E-posta doğrulanmadı", "Önce e-posta adresini doğrula.");
      } else if (normalizedMessage.includes("anonymous") && normalizedMessage.includes("disabled")) {
        notify(
          "Misafir girişi kapalı",
          "Supabase ayarlarında Anonymous Sign-Ins seçeneğini etkinleştir.",
        );
      } else {
        notify("İşlem başarısız", message);
      }
    } finally {
      setBusy(false);
    }
  };

  const continueAsGuest = async () => {
    setBusy(true);
    try {
      const { error } = await getSupabaseClient().auth.signInAnonymously();
      if (error) throw error;
      router.replace("/");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Misafir oturumu açılamadı.";
      const normalizedMessage = message.toLowerCase();
      if (normalizedMessage.includes("anonymous") && normalizedMessage.includes("disabled")) {
        notify(
          "Misafir girişi kapalı",
          "Supabase Dashboard > Authentication ayarlarında Anonymous Sign-Ins seçeneğini etkinleştir.",
        );
      } else {
        notify("Misafir girişi başarısız", message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <View style={styles.icon}>
          <Ionicons name="moon-outline" size={28} color={UI.colors.accent} />
        </View>
        <Text style={styles.eyebrow}>KİŞİSEL ARŞİV</Text>
        <Text style={styles.title}>Dolabına giriş yap</Text>
        <Text style={styles.subtitle}>
          Kıyafetlerini ve kombinlerini güvenle sakla.
        </Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="E-posta"
          placeholderTextColor={UI.colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Şifre"
          placeholderTextColor={UI.colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
        />

        <Pressable
          style={[styles.submit, busy && styles.disabled]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={UI.colors.textPrimary} />
          ) : (
            <Text style={styles.submitText}>Giriş yap</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.guestButton, busy && styles.disabled]}
          onPress={continueAsGuest}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={styles.guestButtonText}>Misafir olarak devam et</Text>
        </Pressable>
        <Text style={styles.guestNote}>
          Misafir hesabını daha sonra profilinden kalıcı hesaba dönüştürebilirsin.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: UI.spacing.lg,
    backgroundColor: UI.colors.background,
  },
  card: {
    alignSelf: "center",
    backgroundColor: UI.colors.surface,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.lg,
    borderWidth: 1,
    maxWidth: 460,
    padding: UI.spacing.lg,
    width: "100%",
  },
  icon: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: UI.colors.surfaceAlt,
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  eyebrow: {
    color: UI.colors.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    marginTop: UI.spacing.md,
    textAlign: "center",
  },
  title: {
    color: UI.colors.textPrimary,
    fontFamily: UI.fonts.display,
    fontSize: 28,
    marginTop: UI.spacing.xs,
    textAlign: "center",
  },
  subtitle: {
    color: UI.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: UI.spacing.lg,
    marginTop: UI.spacing.xs,
    textAlign: "center",
  },
  input: {
    backgroundColor: UI.colors.background,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.md,
    borderWidth: 1,
    color: UI.colors.textPrimary,
    fontSize: 15,
    marginBottom: UI.spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  submit: {
    alignItems: "center",
    backgroundColor: UI.colors.primaryDark,
    borderColor: UI.colors.accent,
    borderRadius: UI.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    marginTop: UI.spacing.xs,
  },
  disabled: { opacity: 0.6 },
  submitText: { color: UI.colors.textPrimary, fontSize: 14, fontWeight: "700" },
  guestButton: {
    alignItems: "center",
    borderColor: UI.colors.border,
    borderRadius: UI.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 46,
    marginTop: UI.spacing.md,
  },
  guestButtonText: {
    color: UI.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  guestNote: {
    color: UI.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: UI.spacing.sm,
    textAlign: "center",
  },
});
