import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  Animated,
  PanResponder,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  getItems,
  createOutfit,
  uploadImage,
  updateOutfitImage,
} from '../../services/api';
import { getSession } from '@/lib/supabase';
import { pickImageWithSourceChoice } from '../../utils/imagePicker';
import { Brand } from "@/constants/theme";


type ClothingItem = {
  id: number;
  name: string;
  category: string;
  color: string;
  image_url: string | null;
  season?: string;
  is_favorite?: boolean;
};

type GeneratedOutfit = {
  top: ClothingItem | null;
  bottom: ClothingItem | null;
  dress: ClothingItem | null;
  outerwear: ClothingItem | null;
  shoes: ClothingItem | null;
  accessory: ClothingItem | null;
  bag: ClothingItem | null;
};

const NEUTRAL_COLORS = ['beyaz', 'siyah', 'gri', 'lacivert', 'bej', 'kahverengi'];

const CLASHING_PAIRS: [string, string][] = [
  ['kırmızı', 'turuncu'],
  ['kırmızı', 'pembe'],
  ['mor', 'kahverengi'],
  ['turuncu', 'mor'],
  ['sarı', 'mor'],
  ['yeşil', 'kırmızı'],
];

function normalizeColor(color: string) {
  return color.trim().toLocaleLowerCase('tr-TR');
}

function colorsClash(colorA: string, colorB: string) {
  const a = normalizeColor(colorA);
  const b = normalizeColor(colorB);
  if (NEUTRAL_COLORS.includes(a) || NEUTRAL_COLORS.includes(b)) return false;
  if (a === b) return false;
  return CLASHING_PAIRS.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a)
  );
}

function prioritizeFavorites(items: ClothingItem[]) {
  const favorites = items.filter((i) => i.is_favorite);
  const normal = items.filter((i) => !i.is_favorite);
  return favorites.length > 0 ? [...favorites, ...normal] : items;
}

function pickWeightedFavorite(items: ClothingItem[]) {
  const prioritized = prioritizeFavorites(items);
  if (prioritized.length === 0) return null;

  const favoriteOptions = prioritized.filter((i) => i.is_favorite);
  if (favoriteOptions.length > 0 && Math.random() < 0.7) {
    return favoriteOptions[Math.floor(Math.random() * favoriteOptions.length)];
  }

  return prioritized[Math.floor(Math.random() * prioritized.length)];
}

// Bir kıyafetin mevsim alanı "Yaz,Kış" gibi virgülle ayrılmış olabilir
function parseSeasons(season?: string): string[] {
  if (!season) return ['Tüm Mevsimler'];
  return season.split(',').map((s) => s.trim());
}

function seasonsOverlap(itemSeason: string | undefined, targetSeasons: string[]) {
  if (targetSeasons.includes('Tüm Mevsimler')) return true;
  const itemSeasons = parseSeasons(itemSeason);
  if (itemSeasons.includes('Tüm Mevsimler')) return true;
  return itemSeasons.some((s) => targetSeasons.includes(s));
}

function filterBySeason(items: ClothingItem[], targetSeasons: string[]) {
  if (targetSeasons.includes('Tüm Mevsimler')) return items;
  const matching = items.filter((i) => seasonsOverlap(i.season, targetSeasons));
  return matching.length > 0 ? matching : items;
}

function filterByColor(items: ClothingItem[], referenceColor?: string) {
  if (!referenceColor) return items;
  const nonClashing = items.filter((i) => !colorsClash(i.color, referenceColor));
  return nonClashing.length > 0 ? nonClashing : items;
}

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    const webAlert = typeof globalThis !== 'undefined' ? globalThis.alert : undefined;
    if (typeof webAlert === 'function') {
      webAlert(`${title}: ${message}`);
      return;
    }
  }

  Alert.alert(title, message);
}

function confirmAsync(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const webConfirm = typeof globalThis !== 'undefined' ? globalThis.confirm : undefined;
    return Promise.resolve(typeof webConfirm === 'function' ? webConfirm(`${title}\n\n${message}`) : false);
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Hayır', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Evet', onPress: () => resolve(true) },
    ]);
  });
}

export default function OutfitScreen() {
  const router = useRouter();
  const [allItems, setAllItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [outfit, setOutfit] = useState<GeneratedOutfit | null>(null);

  const pan = useRef(new Animated.ValueXY()).current;
  const handlersRef = useRef({ approve: () => {}, reject: () => {} });

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setLoading(true);
      setLoadError(null);

      (async () => {
        try {
          const session = await getSession();
          if (!session) {
            router.replace('/auth');
            return;
          }

          const data = await getItems();
          if (mounted) setAllItems(data);
        } catch (err: any) {
          if (mounted) {
            if (err?.message?.includes('Oturum')) {
              router.replace('/auth');
              return;
            }
            setLoadError(err.message ?? 'Kıyafetler yüklenemedi.');
            console.error('Outfit load failed', err);
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

  const generateOutfit = () => {
    pan.setValue({ x: 0, y: 0 });

    const tops = prioritizeFavorites(allItems.filter((i) => i.category === 'Üst'));
    const bottoms = prioritizeFavorites(allItems.filter((i) => i.category === 'Alt'));
    const dresses = prioritizeFavorites(allItems.filter((i) => i.category === 'Elbise'));
    const outerwears = prioritizeFavorites(allItems.filter((i) => i.category === 'Dış Giyim'));
    const shoesList = prioritizeFavorites(allItems.filter((i) => i.category === 'Ayakkabı'));
    const accessories = prioritizeFavorites(allItems.filter((i) => i.category === 'Aksesuar'));
    const bags = prioritizeFavorites(allItems.filter((i) => i.category === 'Çanta'));

    const canUseDress = dresses.length > 0;
    const canUseTopBottom = tops.length > 0 && bottoms.length > 0;
    const useDress = canUseDress && (!canUseTopBottom || Math.random() < 0.5);

    let chosenTop: ClothingItem | null = null;
    let chosenBottom: ClothingItem | null = null;
    let chosenDress: ClothingItem | null = null;
    let targetSeasons: string[] = ['Tüm Mevsimler'];
    let baseColor: string | undefined;

    if (useDress) {
      chosenDress = pickWeightedFavorite(dresses);
      targetSeasons = parseSeasons(chosenDress?.season);
      baseColor = chosenDress?.color;
    } else {
      chosenTop = pickWeightedFavorite(tops);
      targetSeasons = parseSeasons(chosenTop?.season);
      baseColor = chosenTop?.color;

      const seasonMatchedBottoms = filterBySeason(bottoms, targetSeasons);
      const colorMatchedBottoms = filterByColor(seasonMatchedBottoms, baseColor);
      chosenBottom = pickWeightedFavorite(colorMatchedBottoms);
    }

    const seasonMatchedShoes = filterBySeason(shoesList, targetSeasons);
    const colorMatchedShoes = filterByColor(seasonMatchedShoes, baseColor);
    const chosenShoes = pickWeightedFavorite(colorMatchedShoes);

    const chosenOuterwear =
      outerwears.length > 0 && Math.random() < 0.5
        ? pickWeightedFavorite(filterByColor(filterBySeason(outerwears, targetSeasons), baseColor))
        : null;
    const chosenAccessory =
      accessories.length > 0 && Math.random() < 0.5
        ? pickWeightedFavorite(accessories)
        : null;
    const chosenBag =
      bags.length > 0 && Math.random() < 0.5 ? pickWeightedFavorite(bags) : null;

    setOutfit({
      top: chosenTop,
      bottom: chosenBottom,
      dress: chosenDress,
      outerwear: chosenOuterwear,
      shoes: chosenShoes,
      accessory: chosenAccessory,
      bag: chosenBag,
    });
  };

  const handleApprove = async () => {
    if (!outfit) return;
    setSaving(true);
    try {
      const created = await createOutfit({
        top_id: outfit.top?.id,
        bottom_id: outfit.bottom?.id,
        dress_id: outfit.dress?.id,
        outerwear_id: outfit.outerwear?.id,
        shoes_id: outfit.shoes?.id,
        accessory_id: outfit.accessory?.id,
        bag_id: outfit.bag?.id,
      });
      setSaving(false);
      setOutfit(null);

      const wantsPhoto = await confirmAsync(
        'Kombin Fotoğrafı',
        'Bu kombini üzerinizde çekip eklemek ister misiniz?'
      );

      if (!wantsPhoto) {
        notify('Kaydedildi', 'Kombin profiline eklendi.');
        return;
      }

      const uri = await pickImageWithSourceChoice();
      if (uri) {
        try {
          const imageUrl = await uploadImage(uri);
          await updateOutfitImage(created.id, imageUrl);
          notify('Harika', 'Kombin fotoğrafınla birlikte kaydedildi.');
        } catch {
          notify('Kaydedildi', 'Kombin kaydedildi ama fotoğraf yüklenemedi.');
        }
      }
    } catch {
      setSaving(false);
      notify('Hata', 'Kombin kaydedilemedi.');
    }
  };

  const handleReject = () => {
    setOutfit(null);
    generateOutfit();
  };

  handlersRef.current.approve = handleApprove;
  handlersRef.current.reject = handleReject;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,
      onPanResponderMove: Animated.event([null, { dx: pan.x }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 120) {
          Animated.timing(pan, {
            toValue: { x: 500, y: 0 },
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            handlersRef.current.approve();
          });
        } else if (gesture.dx < -120) {
          Animated.timing(pan, {
            toValue: { x: -500, y: 0 },
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            handlersRef.current.reject();
          });
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const rotate = pan.x.interpolate({
    inputRange: [-300, 0, 300],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Hata: {loadError}</Text>
        <Pressable style={styles.retryButton} onPress={() => router.replace('/(tabs)/outfit')}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </Pressable>
      </View>
    );
  }

  const hasEnoughItems =
    allItems.filter((i) => i.category === 'Elbise').length > 0 ||
    (allItems.filter((i) => i.category === 'Üst').length > 0 &&
      allItems.filter((i) => i.category === 'Alt').length > 0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kombin Oluştur</Text>

      {!hasEnoughItems ? (
        <Text style={styles.emptyText}>
          Kombin oluşturmak için dolabında bir &quot;Elbise&quot; ya da en az bir &quot;Üst&quot; ve bir
          &quot;Alt&quot; olmalı.
        </Text>
      ) : !outfit ? (
        <Pressable style={styles.generateButton} onPress={generateOutfit}>
          <Text style={styles.generateButtonText}>Kombin Öner</Text>
        </Pressable>
      ) : (
        <>
          <Text style={styles.swipeHint}>
            ← Beğenmedim &nbsp;&nbsp;·&nbsp;&nbsp; Beğendim →
          </Text>

          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.card,
              {
                transform: [{ translateX: pan.x }, { rotate }],
              },
            ]}
          >
            {outfit.dress ? (
              <OutfitSlot label="Elbise" item={outfit.dress} />
            ) : (
              <>
                <OutfitSlot label="Üst" item={outfit.top} />
                <OutfitSlot label="Alt" item={outfit.bottom} />
              </>
            )}
            {outfit.outerwear && (
              <OutfitSlot label="Dış Giyim" item={outfit.outerwear} />
            )}
            <OutfitSlot label="Ayakkabı" item={outfit.shoes} />
            {outfit.accessory && (
              <OutfitSlot label="Aksesuar" item={outfit.accessory} />
            )}
            {outfit.bag && <OutfitSlot label="Çanta" item={outfit.bag} />}
          </Animated.View>

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionButton, styles.rejectButton]}
              onPress={handleReject}
              disabled={saving}
            >
              <Text style={styles.actionButtonText}>✕ Beğenmedim</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.approveButton]}
              onPress={handleApprove}
              disabled={saving}
            >
              <Text style={styles.actionButtonText}>
                {saving ? 'Kaydediliyor...' : '✓ Beğendim'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function OutfitSlot({ label, item }: { label: string; item: ClothingItem | null }) {
  return (
    <View style={styles.slot}>
      <Text style={styles.slotLabel}>{label}</Text>
      {item ? (
        <View style={styles.slotCard}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.imageThumb} />
          ) : (
            <View style={styles.imagePlaceholder} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.slotItemName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.slotItemDetail} numberOfLines={1}>
              {item.color}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.slotEmpty}>Bu kategoride kıyafet yok</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: Brand.background },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  emptyText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 40 },
  retryButton: {
    alignSelf: 'center',
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#222',
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  generateButton: {
    backgroundColor: '#222',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  generateButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  swipeHint: {
    textAlign: 'center',
    color: '#999',
    fontSize: 13,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  slot: { marginBottom: 4 },
  slotLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#555' },
  slotCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imagePlaceholder: {
    width: 50,
    height: 50,
    backgroundColor: '#ddd',
    borderRadius: 8,
  },
  imageThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  slotItemName: { fontSize: 15, fontWeight: '600' },
  slotItemDetail: { fontSize: 13, color: '#666' },
  slotEmpty: { fontSize: 13, color: '#aaa', fontStyle: 'italic' },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  rejectButton: { backgroundColor: '#ef4444' },
  approveButton: { backgroundColor: '#16a34a' },
  actionButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});