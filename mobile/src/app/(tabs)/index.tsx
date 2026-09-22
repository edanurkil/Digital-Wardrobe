import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getItems, deleteItem, updateFavoriteItem } from '../../services/api';
import { getSession } from '@/lib/supabase';
import { Brand } from "@/constants/theme";

type ClothingItem = {
  id: number;
  name: string;
  category: string;
  color: string;
  image_url: string | null;
  is_favorite?: boolean;
};

export default function WardrobeScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setLoading(true);

      (async () => {
        try {
          const session = await getSession();
          if (!session) {
            router.replace('/auth');
            return;
          }

          const data = await getItems();
          if (mounted) setItems(data);
        } catch (err: any) {
          if (mounted) {
            if (err?.message?.includes('Oturum')) {
              router.replace('/auth');
              return;
            }
            setError(err.message ?? 'Kıyafetler yüklenemedi.');
          }
        } finally {
          if (mounted) setLoading(false);
        }
      })();

      return () => {
        mounted = false;
      };
    }, [router])
  );

  const handleDelete = (item: ClothingItem) => {
    const confirmDelete = async () => {
      await deleteItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    };

    if (Platform.OS === 'web') {
      const webConfirm = typeof globalThis !== 'undefined' ? globalThis.confirm : undefined;
      if (typeof webConfirm === 'function' && webConfirm(`"${item.name}" silinsin mi?`)) {
        void confirmDelete();
      }
      return;
    }

    Alert.alert('Kıyafeti Sil', `"${item.name}" silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: confirmDelete },
    ]);
  };

  const handleFavoriteToggle = async (item: ClothingItem) => {
    const nextValue = !(item.is_favorite ?? false);
    try {
      await updateFavoriteItem(item.id, nextValue);
      setItems((prev) =>
        prev
          .map((i) => (i.id === item.id ? { ...i, is_favorite: nextValue } : i))
          .sort((a, b) => Number(b.is_favorite ?? false) - Number(a.is_favorite ?? false))
      );
    } catch (err: any) {
      Alert.alert('Hata', err.message ?? 'Favori güncellenemedi.');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
  return (
    <View style={styles.container}>
      <Text style={styles.emptyText}>Hata: {error}</Text>
      <Pressable
        style={styles.retryButton}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.retryButtonText}>Tekrar Dene</Text>
      </Pressable>
    </View>
  );
}

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dolabım</Text>

      {items.length === 0 ? (
        <Text style={styles.emptyText}>
          Henüz kıyafet eklemedin. &quot;Ekle&quot; sekmesinden başlayabilirsin.
        </Text>
      ) : (
        <FlatList
          data={[...items].sort(
            (a, b) => Number(b.is_favorite ?? false) - Number(a.is_favorite ?? false)
          )}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                style={styles.favoriteButton}
                onPress={() => handleFavoriteToggle(item)}
              >
                <Text style={styles.favoriteButtonText}>
                  {item.is_favorite ? '♥' : '♡'}
                </Text>
              </Pressable>

              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDelete(item)}
              >
                <Text style={styles.deleteButtonText}>✕</Text>
              </Pressable>

              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.imagePlaceholder}
                />
              ) : (
                <View style={styles.imagePlaceholder} />
              )}

              <Text style={styles.itemName} numberOfLines={1} ellipsizeMode="tail">
                {item.name}
              </Text>
              <Text style={styles.itemDetail} numberOfLines={1} ellipsizeMode="tail">
                {item.category} · {item.color}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: Brand.background },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  emptyText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 40 },
  card: {
    flex: 1,
    margin: 6,
    padding: 10,
    backgroundColor: Brand.surface,
    borderRadius: 12,
    position: 'relative',
    minWidth: 0,
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#ddd',
    borderRadius: 8,
    marginBottom: 8,
  },
  itemName: { fontSize: 14, fontWeight: '600' },
  itemDetail: { fontSize: 12, color: '#666' },
  favoriteButton: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 10,
    backgroundColor: '#fff',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  favoriteButtonText: {
    fontSize: 16,
    color: '#f43f5e',
  },
  deleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
    backgroundColor: '#fff',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e11d48',
  },
  retryButton: {
  alignSelf: 'center',
  marginTop: 16,
  paddingHorizontal: 18,
  paddingVertical: 10,
  borderRadius: 8,
  backgroundColor: '#222',
},
retryButtonText: { color: '#fff', fontWeight: '600' },
});