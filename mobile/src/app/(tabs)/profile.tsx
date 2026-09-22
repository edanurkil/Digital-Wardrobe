import { Brand } from "@/constants/theme";
import { getSession, signOut } from "@/lib/supabase";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getOutfits } from "../../services/api";

type ClothingItem = {
  id: number;
  name: string;
  category: string;
  color: string;
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

export default function ProfileScreen() {
  const router = useRouter();
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/auth");
    } catch (error) {
      console.error("Sign out failed", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);

      (async () => {
        try {
          const session = await getSession();
          if (!session) {
            router.replace('/auth');
            return;
          }

          if (active) setSessionReady(true);

          const outfits = await getOutfits();
          if (active) setOutfits(outfits);
        } catch (error) {
          if (active) {
            console.error("Kombinler yüklenemedi:", error);
            setSessionReady(false);
            setOutfits([]);
          }
        } finally {
          if (active) setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [router]),
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Kombinlerim</Text>
        <Pressable style={styles.logoutButton} onPress={handleSignOut}>
          <Text style={styles.logoutButtonText}>Çıkış</Text>
        </Pressable>
      </View>

      <Text style={styles.userLabel}>
        {sessionReady ? "Oturum açık" : "Oturum kapalı"}
      </Text>

      {outfits.length === 0 ? (
        <Text style={styles.emptyText}>
          Henüz kaydedilmiş kombinin yok. &quot;Kombin&quot; sekmesinden bir tane kaydet.
        </Text>
      ) : (
        <FlatList
          data={outfits}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.outfit_image_url && (
                <Image
                  source={{ uri: item.outfit_image_url }}
                  style={styles.outfitPhoto}
                />
              )}
              <Text style={styles.cardDate}>
                {new Date(item.created_at).toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <View style={styles.itemsRow}>
                {item.dress && (
                  <Text style={styles.itemText}>👗 {item.dress.name}</Text>
                )}
                {item.top && (
                  <Text style={styles.itemText}>👕 {item.top.name}</Text>
                )}
                {item.bottom && (
                  <Text style={styles.itemText}>👖 {item.bottom.name}</Text>
                )}
                {item.outerwear && (
                  <Text style={styles.itemText}>🧥 {item.outerwear.name}</Text>
                )}
                {item.shoes && (
                  <Text style={styles.itemText}>👟 {item.shoes.name}</Text>
                )}
                {item.accessory && (
                  <Text style={styles.itemText}>💍 {item.accessory.name}</Text>
                )}
                {item.bag && (
                  <Text style={styles.itemText}>👜 {item.bag.name}</Text>
                )}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: Brand.background },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: Brand.textPrimary,
  },
  logoutButton: {
    backgroundColor: Brand.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  userLabel: {
    fontSize: 12,
    color: Brand.textSecondary,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: Brand.textSecondary,
    textAlign: "center",
    marginTop: 40,
  },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  outfitPhoto: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: "#F4E4E8",
  },
  cardDate: {
    fontSize: 14,
    fontWeight: "600",
    color: Brand.textPrimary,
    marginBottom: 6,
  },
  itemsRow: { gap: 4 },
  itemText: { fontSize: 14, color: Brand.textMuted },
});
