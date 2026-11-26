import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { UI } from "@/constants/design";
import { getOutfits, deleteOutfit } from "../../services/api";
import { getSupabaseClient } from "@/lib/supabase";
import { notify } from "@/utils/dialogs";

type ClothingItem = {
  id: number;
  name: string;
  category: string;
  color: string;
  image_url: string | null;
};

type Outfit = {
  id: number;
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

type UpgradeStep = "email" | "confirmation" | "password";

function confirmAsync(
  title: string,
  message: string,
  confirmLabel = "Sil",
  destructive = true,
): Promise<boolean> {
  if (Platform.OS === "web") {
    const webConfirm = typeof globalThis !== "undefined" ? globalThis.confirm : undefined;
    return Promise.resolve(
      typeof webConfirm === "function" ? webConfirm(`${title}\n\n${message}`) : false
    );
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Vazgeç", style: "cancel", onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}

function outfitItems(outfit: Outfit) {
  return [
    ["ELBİSE", outfit.dress],
    ["ÜST", outfit.top],
    ["ALT", outfit.bottom],
    ["DIŞ GİYİM", outfit.outerwear],
    ["AYAKKABI", outfit.shoes],
    ["AKSESUAR", outfit.accessory],
    ["ÇANTA", outfit.bag],
  ] as const;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [account, setAccount] = useState<{ isAnonymous: boolean; email: string | null } | null>(null);
  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const [upgradeStep, setUpgradeStep] = useState<UpgradeStep>("email");
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [upgradePassword, setUpgradePassword] = useState("");
  const [upgradePasswordConfirmation, setUpgradePasswordConfirmation] = useState("");
  const [upgradeBusy, setUpgradeBusy] = useState(false);

  const handleSignOut = async () => {
    if (account?.isAnonymous) return;
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw error;
    } catch (error: unknown) {
      notify(
        "Çıkış yapılamadı",
        error instanceof Error ? error.message : "Lütfen tekrar dene.",
      );
    }
  };

  const handleExistingAccountLogin = async () => {
    const confirmed = await confirmAsync(
      "Mevcut hesaba giriş yap",
      "Misafir oturumun kapanacak. Bu misafir dolabındaki veriler mevcut hesabına aktarılmaz ve bu misafir hesaba tekrar erişemeyebilirsin. Devam etmeden önce misafir hesabını kalıcı yapman daha güvenli.",
      "Giriş ekranına geç",
      false,
    );
    if (!confirmed) return;

    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw error;
      router.replace("/auth");
    } catch (error: unknown) {
      notify(
        "Giriş ekranı açılamadı",
        error instanceof Error ? error.message : "Lütfen tekrar dene.",
      );
    }
  };

  const sendUpgradeEmail = async () => {
    const email = upgradeEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      notify("E-posta geçersiz", "Geçerli bir e-posta adresi gir.");
      return;
    }

    setUpgradeBusy(true);
    try {
      const { data, error } = await getSupabaseClient().auth.updateUser({ email });
      if (error) throw error;

      setUpgradeEmail(email);
      if (!data.user.is_anonymous && data.user.email_confirmed_at) {
        setUpgradeStep("password");
      } else {
        setUpgradeStep("confirmation");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "E-posta bağlanamadı.";
      const normalizedMessage = message.toLowerCase();
      if (
        normalizedMessage.includes("already") &&
        (normalizedMessage.includes("registered") || normalizedMessage.includes("exists"))
      ) {
        notify(
          "E-posta başka hesapta kullanılıyor",
          "Mevcut hesapları otomatik birleştiremiyoruz. Misafir hesabındaki veriler silinmedi; bu ekrandan çıkış yapmadan başka bir e-posta deneyebilirsin.",
        );
      } else if (normalizedMessage.includes("manual") && normalizedMessage.includes("link")) {
        notify(
          "Hesap bağlama kapalı",
          "Supabase Dashboard > Authentication ayarlarında Manual Linking seçeneğini etkinleştir.",
        );
      } else if (normalizedMessage.includes("email address not authorized")) {
        notify(
          "E-posta gönderilemedi",
          "Supabase varsayılan e-posta servisi yalnızca proje ekibindeki adreslere e-posta gönderiyor. Herkese gönderebilmek için Supabase Authentication > SMTP Settings bölümünde özel SMTP sağlayıcısı yapılandırılmalı.",
        );
      } else {
        notify("Hesap yükseltilemedi", message);
      }
    } finally {
      setUpgradeBusy(false);
    }
  };

  const resendUpgradeEmail = async () => {
    setUpgradeBusy(true);
    try {
      const { error } = await getSupabaseClient().auth.resend({
        type: "email_change",
        email: upgradeEmail,
      });
      if (error) throw error;
      notify("E-posta tekrar gönderildi", "Gelen kutunu ve spam klasörünü kontrol et.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "E-posta tekrar gönderilemedi.";
      if (message.toLowerCase().includes("email address not authorized")) {
        notify(
          "E-posta gönderilemedi",
          "Supabase varsayılan e-posta servisi yalnızca proje ekibindeki adreslere e-posta gönderiyor. Herkese gönderebilmek için özel SMTP yapılandırılmalı.",
        );
      } else {
        notify("E-posta tekrar gönderilemedi", message);
      }
    } finally {
      setUpgradeBusy(false);
    }
  };

  const checkUpgradeEmail = async () => {
    setUpgradeBusy(true);
    try {
      const { data, error } = await getSupabaseClient().auth.getUser();
      if (error) throw error;
      if (data.user.is_anonymous || !data.user.email_confirmed_at) {
        notify(
          "Doğrulama bekleniyor",
          "E-postandaki doğrulama bağlantısını açtıktan sonra tekrar kontrol et.",
        );
        return;
      }
      setUpgradeStep("password");
    } catch (error: unknown) {
      notify(
        "Doğrulama kontrol edilemedi",
        error instanceof Error ? error.message : "Lütfen tekrar dene.",
      );
    } finally {
      setUpgradeBusy(false);
    }
  };

  const saveUpgradePassword = async () => {
    if (upgradePassword.length < 4) {
      notify("Şifre çok kısa", "Şifre en az 4 karakter olmalı.");
      return;
    }
    if (upgradePassword !== upgradePasswordConfirmation) {
      notify("Şifreler eşleşmiyor", "İki şifre alanını da kontrol et.");
      return;
    }

    setUpgradeBusy(true);
    try {
      const { data, error } = await getSupabaseClient().auth.updateUser({
        password: upgradePassword,
      });
      if (error) throw error;

      setAccount({
        isAnonymous: false,
        email: data.user.email ?? upgradeEmail,
      });
      setUpgradeVisible(false);
      setUpgradeStep("email");
      setUpgradePassword("");
      setUpgradePasswordConfirmation("");
      notify("Hesap kalıcı hale getirildi", "Dolap verilerin aynı hesapta korunuyor.");
    } catch (error: unknown) {
      notify(
        "Şifre kaydedilemedi",
        error instanceof Error ? error.message : "Lütfen tekrar dene.",
      );
    } finally {
      setUpgradeBusy(false);
    }
  };

  const handleDeleteOutfit = async (outfitId: number) => {
    const confirmed = await confirmAsync(
      "Kombini Sil",
      "Bu kombini silmek istediğine emin misin?"
    );
    if (!confirmed) return;

    try {
      await deleteOutfit(outfitId);
      setOutfits((prev) => prev.filter((o) => o.id !== outfitId));
    } catch (error: any) {
      Alert.alert("Hata", error?.message ?? "Kombin silinemedi.");
    }
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setLoadError(null);

      (async () => {
        try {
          const { data: userData, error: userError } =
            await getSupabaseClient().auth.getUser();
          if (userError) throw userError;
          if (active) {
            setAccount({
              isAnonymous: userData.user.is_anonymous ?? false,
              email: userData.user.email ?? null,
            });
          }

          const outfits = await getOutfits();
          if (active) setOutfits(outfits);
        } catch (error) {
          if (active) {
            console.error("Kombinler yüklenemedi:", error);
            setOutfits([]);
            setLoadError(error instanceof Error ? error.message : "Kombinler yüklenemedi.");
          }
        } finally {
          if (active) setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, []),
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={UI.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Kombinlerim</Text>
        {!account?.isAnonymous && (
          <Pressable
            style={styles.signOutButton}
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="Oturumu kapat"
          >
            <Ionicons name="log-out-outline" size={18} color={UI.colors.textSecondary} />
            <Text style={styles.signOutText}>Çıkış</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.accountCard}>
        <Text style={styles.userLabel}>
          {account?.isAnonymous ? "MİSAFİR HESABI" : "SUPABASE BULUT ARŞİVİ"}
        </Text>
        {account?.isAnonymous ? (
          <>
            <Text style={styles.accountNote}>
              Verilerini başka cihaza taşıyabilmek ve kaybetmemek için hesabını kalıcı hale getir.
            </Text>
            <Pressable
              style={styles.upgradeButton}
              onPress={() => setUpgradeVisible(true)}
              accessibilityRole="button"
            >
              <Ionicons name="person-add-outline" size={18} color={UI.colors.textPrimary} />
              <Text style={styles.upgradeButtonText}>Hesabı kalıcı yap</Text>
            </Pressable>
            <Pressable
              style={styles.existingAccountButton}
              onPress={handleExistingAccountLogin}
              accessibilityRole="button"
            >
              <Text style={styles.existingAccountButtonText}>
                Mevcut hesabıma giriş yap
              </Text>
            </Pressable>
            <Text style={styles.guestWarning}>
              Hesabı yükseltmeden çıkış yapma veya uygulamayı silme; misafir hesabına yeniden erişemeyebilirsin.
            </Text>
          </>
        ) : account?.email ? (
          <Text style={styles.accountNote}>{account.email}</Text>
        ) : null}
      </View>

      {loadError ? (
        <Text style={styles.emptyText}>{loadError}</Text>
      ) : outfits.length === 0 ? (
        <View style={styles.emptyState}>
          <Image
            source={require('../../../assets/images/lookbook-illustration.png')}
            style={styles.emptyIllustration}
            resizeMode="contain"
            accessible={false}
          />
          <Text style={styles.emptyTitle}>Henüz kayıtlı kombin yok</Text>
          <Text style={styles.savedEmptyText}>Kaydettiğin görünümler burada bir araya gelecek.</Text>
        </View>
      ) : (
        <FlatList
          data={outfits}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDeleteOutfit(item.id)}
                accessibilityRole="button"
                accessibilityLabel="Kombini sil"
              >
                <Ionicons name="close" size={17} color={UI.colors.textSecondary} />
              </Pressable>

              {item.outfit_image_url && (
                <Image
                  source={{ uri: item.outfit_image_url }}
                  style={styles.outfitPhoto}
                  resizeMode="contain"
                />
              )}
              <OutfitPreview outfit={item} />
              <Text style={styles.cardDate}>
                {new Date(item.created_at).toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <View style={styles.itemsRow}>
                {outfitItems(item).map(([label, clothing]) =>
                  clothing ? (
                    <View key={label} style={styles.itemRow}>
                      <Text style={styles.itemLabel}>{label}</Text>
                      <Text style={styles.itemText}>{clothing.name}</Text>
                    </View>
                  ) : null,
                )}
              </View>
            </View>
          )}
        />
      )}

      <Modal
        visible={upgradeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!upgradeBusy) setUpgradeVisible(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Misafir hesabını koru</Text>
            {upgradeStep === "email" ? (
              <>
                <Text style={styles.modalText}>
                  E-postanı doğrulayarak bu hesabı kalıcılaştır. Dolap verilerin aynı kullanıcı hesabında kalır.
                </Text>
                <TextInput
                  style={styles.input}
                  value={upgradeEmail}
                  onChangeText={setUpgradeEmail}
                  placeholder="E-posta"
                  placeholderTextColor={UI.colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  editable={!upgradeBusy}
                />
                <Pressable
                  style={[styles.upgradeButton, upgradeBusy && styles.disabled]}
                  onPress={sendUpgradeEmail}
                  disabled={upgradeBusy}
                >
                  {upgradeBusy ? (
                    <ActivityIndicator color={UI.colors.textPrimary} />
                  ) : (
                    <Text style={styles.upgradeButtonText}>Doğrulama e-postası gönder</Text>
                  )}
                </Pressable>
              </>
            ) : upgradeStep === "confirmation" ? (
              <>
                <Text style={styles.modalText}>
                  {upgradeEmail} adresine gönderilen bağlantıyı aç. Uygulamaya döndükten sonra doğrulamayı kontrol et.
                </Text>
                <Pressable
                  style={[styles.upgradeButton, upgradeBusy && styles.disabled]}
                  onPress={checkUpgradeEmail}
                  disabled={upgradeBusy}
                >
                  {upgradeBusy ? (
                    <ActivityIndicator color={UI.colors.textPrimary} />
                  ) : (
                    <Text style={styles.upgradeButtonText}>Doğrulamayı kontrol et</Text>
                  )}
                </Pressable>
                <Pressable onPress={resendUpgradeEmail} disabled={upgradeBusy}>
                  <Text style={styles.modalLink}>E-postayı tekrar gönder</Text>
                </Pressable>
                <Pressable
                  onPress={() => setUpgradeStep("email")}
                  disabled={upgradeBusy}
                >
                  <Text style={styles.modalLink}>E-posta adresini değiştir</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.modalText}>
                  E-posta doğrulandı. Hesabına giriş yapmak için bir şifre belirle.
                </Text>
                <TextInput
                  style={styles.input}
                  value={upgradePassword}
                  onChangeText={setUpgradePassword}
                  placeholder="Şifre (en az 4 karakter)"
                  placeholderTextColor={UI.colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  editable={!upgradeBusy}
                />
                <TextInput
                  style={styles.input}
                  value={upgradePasswordConfirmation}
                  onChangeText={setUpgradePasswordConfirmation}
                  placeholder="Şifreyi tekrar gir"
                  placeholderTextColor={UI.colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  editable={!upgradeBusy}
                />
                <Pressable
                  style={[styles.upgradeButton, upgradeBusy && styles.disabled]}
                  onPress={saveUpgradePassword}
                  disabled={upgradeBusy}
                >
                  {upgradeBusy ? (
                    <ActivityIndicator color={UI.colors.textPrimary} />
                  ) : (
                    <Text style={styles.upgradeButtonText}>Hesabı tamamla</Text>
                  )}
                </Pressable>
              </>
            )}
            <Pressable
              onPress={() => setUpgradeVisible(false)}
              disabled={upgradeBusy}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Daha sonra</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function OutfitPreview({ outfit }: { outfit: Outfit }) {
  const imageItems = outfitItems(outfit).filter(([, clothing]) => clothing?.image_url);
  if (imageItems.length === 0) return null;

  return (
    <View style={styles.lookPreview}>
      {imageItems.map(([label, clothing]) =>
        clothing?.image_url ? (
          <View key={label} style={styles.lookItem}>
            <Image
              source={{ uri: clothing.image_url }}
              style={styles.lookItemImage}
              resizeMode="contain"
            />
            <Text style={styles.lookItemLabel}>{label}</Text>
            <Text style={styles.lookItemName} numberOfLines={1}>
              {clothing.name}
            </Text>
          </View>
        ) : null,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: UI.spacing.lg, backgroundColor: UI.colors.background },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  signOutButton: {
    alignItems: "center",
    borderColor: UI.colors.border,
    borderRadius: UI.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  signOutText: { color: UI.colors.textSecondary, fontSize: 12, fontWeight: "600" },
  accountCard: {
    backgroundColor: UI.colors.surface,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.md,
    borderWidth: 1,
    marginBottom: UI.spacing.md,
    padding: UI.spacing.md,
  },
  accountNote: {
    color: UI.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  guestWarning: {
    color: UI.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: UI.spacing.sm,
  },
  upgradeButton: {
    alignItems: "center",
    backgroundColor: UI.colors.primaryDark,
    borderColor: UI.colors.accent,
    borderRadius: UI.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: UI.spacing.sm,
    justifyContent: "center",
    marginTop: UI.spacing.md,
    minHeight: 46,
    paddingHorizontal: UI.spacing.md,
  },
  upgradeButtonText: {
    color: UI.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  existingAccountButton: {
    alignItems: "center",
    borderColor: UI.colors.border,
    borderRadius: UI.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: UI.spacing.sm,
    minHeight: 44,
  },
  existingAccountButtonText: {
    color: UI.colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  disabled: { opacity: 0.6 },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    flex: 1,
    justifyContent: "center",
    padding: UI.spacing.lg,
  },
  modalCard: {
    backgroundColor: UI.colors.surface,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.lg,
    borderWidth: 1,
    maxWidth: 460,
    padding: UI.spacing.lg,
    width: "100%",
  },
  modalTitle: {
    color: UI.colors.textPrimary,
    fontFamily: UI.fonts.display,
    fontSize: 23,
    textAlign: "center",
  },
  modalText: {
    color: UI.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: UI.spacing.md,
    marginTop: UI.spacing.sm,
    textAlign: "center",
  },
  input: {
    backgroundColor: UI.colors.background,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.md,
    borderWidth: 1,
    color: UI.colors.textPrimary,
    fontSize: 14,
    marginTop: UI.spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  modalLink: {
    color: UI.colors.accent,
    fontSize: 13,
    fontWeight: "600",
    marginTop: UI.spacing.md,
    textAlign: "center",
  },
  cancelText: {
    color: UI.colors.textMuted,
    fontSize: 13,
    marginTop: UI.spacing.lg,
    textAlign: "center",
  },
  title: {
    fontSize: 28,
    fontFamily: UI.fonts.display,
    color: UI.colors.textPrimary,
  },
  userLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
    color: UI.colors.accent,
    marginBottom: UI.spacing.lg,
  },
  emptyText: {
    fontSize: 14,
    color: UI.colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 40,
  },
  emptyState: {
    alignItems: "center",
    alignSelf: "center",
    width: "100%",
    maxWidth: 580,
    marginTop: UI.spacing.lg,
    padding: UI.spacing.lg,
    borderRadius: UI.radius.lg,
    borderWidth: 1,
    borderColor: UI.colors.border,
    backgroundColor: UI.colors.surface,
  },
  emptyIllustration: { width: 132, height: 110 },
  emptyTitle: {
    marginTop: UI.spacing.sm,
    fontSize: 21,
    fontFamily: UI.fonts.display,
    color: UI.colors.textPrimary,
    textAlign: "center",
  },
  savedEmptyText: {
    marginTop: UI.spacing.sm,
    fontSize: 14,
    color: UI.colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  card: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.md,
    padding: UI.spacing.md,
    marginBottom: UI.spacing.md,
    borderWidth: 1,
    borderColor: UI.colors.border,
    position: "relative",
    boxShadow: UI.shadow.card,
  },
  deleteButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: UI.colors.surfaceAlt,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 3px rgba(0, 0, 0, 0.15)",
  },
  outfitPhoto: {
    width: "100%",
    height: 220,
    borderRadius: UI.radius.sm,
    marginBottom: UI.spacing.md,
    backgroundColor: UI.colors.surfaceAlt,
  },
  lookPreview: {
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: UI.spacing.sm,
    marginBottom: UI.spacing.md,
    maxWidth: 420,
    width: "100%",
  },
  lookItem: {
    backgroundColor: "#F2EEEA",
    borderColor: UI.colors.border,
    borderRadius: UI.radius.md,
    borderWidth: 1,
    overflow: "hidden",
    padding: UI.spacing.sm,
    width: "47%",
  },
  lookItemImage: {
    height: 136,
    width: "100%",
  },
  lookItemLabel: {
    color: UI.colors.accent,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginTop: 4,
  },
  lookItemName: {
    color: UI.colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  cardDate: {
    fontSize: 12,
    fontWeight: "600",
    color: UI.colors.textSecondary,
    marginBottom: UI.spacing.md,
    letterSpacing: 0.3,
  },
  itemsRow: { gap: UI.spacing.sm },
  itemRow: { flexDirection: "row", alignItems: "baseline", gap: UI.spacing.sm },
  itemLabel: { width: 82, fontSize: 9, letterSpacing: 1.1, color: UI.colors.accent },
  itemText: { flex: 1, fontSize: 13, color: UI.colors.textPrimary },
});