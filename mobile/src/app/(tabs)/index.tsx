import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Chip, EmptyState, ErrorState, SkeletonBlock } from '@/components/ui/kombin-ui';
import { CATEGORIES, UI, categoryIcon } from '@/constants/design';
import { ClothingItem, deleteItem, getItems, updateFavoriteItem } from '@/services/api';
import { confirmAsync, notify } from '@/utils/dialogs';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function WardrobeScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('Hepsi');
  const [favoriteUpdates, setFavoriteUpdates] = useState<Set<number>>(() => new Set());
  const favoriteUpdatesRef = useRef(new Set<number>());
  const hasLoaded = useRef(false);

  const load = useCallback(
    async (force = false, isActive: () => boolean = () => true) => {
      try {
        if (isActive()) setError(null);
        const data = await getItems(force);
        if (isActive()) setItems(data);
      } catch (err: unknown) {
        const message = getErrorMessage(err, 'Kıyafetler yüklenemedi.');
        if (isActive()) setError(message);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!hasLoaded.current) setLoading(true);
        await load(false, () => active);
        if (active) {
          hasLoaded.current = true;
          setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const retry = useCallback(async () => {
    setLoading(true);
    try {
      await load(true);
    } finally {
      setLoading(false);
    }
  }, [load]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const item of items) {
      result[item.category] = (result[item.category] ?? 0) + 1;
    }
    return result;
  }, [items]);

  const categoryFilters = useMemo(() => {
    const knownCategories = new Set<string>(CATEGORIES.map((category) => category.key));
    const known = CATEGORIES.filter((category) => counts[category.key] > 0).map(
      (category) => category.key,
    );
    const custom = Object.keys(counts)
      .filter((category) => !knownCategories.has(category))
      .sort((a, b) => a.localeCompare(b, 'tr'));
    return [...known, ...custom];
  }, [counts]);

  const activeFilter = filter === 'Hepsi' || counts[filter] > 0 ? filter : 'Hepsi';

  const visible = useMemo(() => {
    const filtered =
      activeFilter === 'Hepsi' ? items : items.filter((i) => i.category === activeFilter);
    return [...filtered].sort(
      (a, b) => Number(!!b.is_favorite) - Number(!!a.is_favorite),
    );
  }, [items, activeFilter]);

  const favoriteCount = items.filter((i) => i.is_favorite).length;

  const toggleFavorite = async (item: ClothingItem) => {
    if (favoriteUpdatesRef.current.has(item.id)) return;

    const next = !item.is_favorite;
    favoriteUpdatesRef.current.add(item.id);
    setFavoriteUpdates((prev) => new Set(prev).add(item.id));
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_favorite: next } : i)));
    try {
      await updateFavoriteItem(item.id, next);
    } catch (err: unknown) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_favorite: !next } : i)),
      );
      notify('Hata', getErrorMessage(err, 'Favori güncellenemedi.'));
    } finally {
      favoriteUpdatesRef.current.delete(item.id);
      setFavoriteUpdates((prev) => {
        const nextUpdates = new Set(prev);
        nextUpdates.delete(item.id);
        return nextUpdates;
      });
    }
  };

  const handleDelete = async (item: ClothingItem) => {
    const confirmed = await confirmAsync(
      'Kıyafeti sil',
      `"${item.name}" silinsin mi?`,
      'Sil',
      true,
    );
    if (!confirmed) return;

    try {
      await deleteItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err: unknown) {
      notify('Hata', getErrorMessage(err, 'Kıyafet silinemedi.'));
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonWrap}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.cardWrap}>
              <SkeletonBlock style={{ aspectRatio: 0.85 }} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorState message={error} onRetry={retry} />
      </View>
    );
  }

  const header = (
    <View>
      <View style={styles.banner}>
        <View style={styles.bannerAccent} />
        <View style={styles.bannerContent}>
          <Text style={styles.eyebrow}>KİŞİSEL ARŞİV</Text>
          <Text style={styles.bannerTitle}>Dolabım</Text>
          <Text style={styles.bannerSub}>
            {items.length} parça <Text style={styles.bannerDivider}>/</Text> {favoriteCount} favori
          </Text>
        </View>
        <Image
          source={require('../../../assets/images/witchy-wardrobe.png')}
          style={styles.bannerArt}
          resizeMode="contain"
          accessible={false}
        />
      </View>

      {items.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip
            label={`Hepsi (${items.length})`}
            selected={activeFilter === 'Hepsi'}
            onPress={() => setFilter('Hepsi')}
          />
          {categoryFilters.map((category) => (
            <Chip
              key={category}
              label={`${category} (${counts[category]})`}
              selected={activeFilter === category}
              onPress={() => setFilter(category)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            icon="shirt-outline"
            title="Dolabın henüz boş"
            message="İlk parçanı ekleyerek kişisel arşivini oluşturmaya başla."
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={UI.colors.accent}
            colors={[UI.colors.accent]}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <View style={styles.card}>
              <View style={styles.imageBox}>
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.image}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons
                    name={categoryIcon(item.category)}
                    size={40}
                    color={UI.colors.textMuted}
                  />
                )}

                <Pressable
                  style={[styles.roundBtn, styles.favBtn]}
                  onPress={() => toggleFavorite(item)}
                  disabled={favoriteUpdates.has(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    item.is_favorite ? `${item.name} favorilerden çıkar` : `${item.name} favorilere ekle`
                  }
                  hitSlop={8}
                >
                  <Ionicons
                    name={item.is_favorite ? 'heart' : 'heart-outline'}
                    size={17}
                    color={item.is_favorite ? UI.colors.danger : UI.colors.textSecondary}
                  />
                </Pressable>

                <Pressable
                  style={[styles.roundBtn, styles.delBtn]}
                  onPress={() => handleDelete(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} kıyafetini sil`}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={17} color={UI.colors.textSecondary} />
                </Pressable>
              </View>

              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.category} <Text style={styles.metaDivider}>/</Text> {item.color}
              </Text>
            </View>
          </View>
        )}
      />

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(tabs)/add-item')}
        accessibilityRole="button"
        accessibilityLabel="Kıyafet ekle"
      >
        <Ionicons name="add" size={27} color={UI.colors.accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.colors.background },
  listContent: { padding: UI.spacing.md, paddingBottom: 112 },
  skeletonWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: UI.spacing.md,
  },
  banner: {
    flexDirection: 'row',
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.lg,
    padding: UI.spacing.lg,
    marginBottom: UI.spacing.md,
  },
  bannerAccent: {
    width: 2,
    backgroundColor: UI.colors.accent,
    marginRight: UI.spacing.lg,
    borderRadius: UI.radius.pill,
  },
  bannerContent: { flex: 1 },
  bannerArt: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: '38%',
    height: '100%',
    opacity: 0.9,
  },
  eyebrow: {
    color: UI.colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  bannerTitle: {
    fontSize: 30,
    fontFamily: UI.fonts.display,
    color: UI.colors.textPrimary,
    marginTop: 4,
  },
  bannerSub: { fontSize: 13, color: UI.colors.textSecondary, marginTop: 5 },
  bannerDivider: { color: UI.colors.accent, paddingHorizontal: 3 },
  chipRow: { gap: UI.spacing.sm, paddingBottom: UI.spacing.md },
  cardWrap: { width: '50%', padding: 6 },
  card: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.md,
    padding: 8,
    borderWidth: 1,
    borderColor: UI.colors.border,
    boxShadow: UI.shadow.card,
  },
  imageBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: UI.radius.sm,
    backgroundColor: UI.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  image: { width: '100%', height: '100%' },
  roundBtn: {
    position: 'absolute',
    top: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: UI.colors.surface,
    borderWidth: 1,
    borderColor: UI.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favBtn: { left: 6 },
  delBtn: { right: 6 },
  name: { fontSize: 15, fontWeight: '600', color: UI.colors.textPrimary },
  meta: { fontSize: 11, color: UI.colors.textSecondary, marginTop: 4 },
  metaDivider: { color: UI.colors.accent },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: UI.colors.primaryDark,
    borderWidth: 1,
    borderColor: UI.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: UI.shadow.raised,
  },
});