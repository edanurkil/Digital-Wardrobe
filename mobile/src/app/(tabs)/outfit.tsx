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
import { Ionicons } from '@expo/vector-icons';
import {
  getItems,
  createOutfit,
  uploadImage,
  updateOutfitImage,
  type ClothingItem,
} from '../../services/api';
import { pickImageWithSourceChoice } from '../../utils/imagePicker';
import { categoryIcon, UI } from '@/constants/design';


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

const DRESS_CATEGORIES = new Set(['Elbise', 'Tulum']);
const OUTERWEAR_CATEGORIES = new Set(['Dış Giyim', 'Hırka', 'Yelek']);
const ACCESSORY_CATEGORIES = new Set([
  'Aksesuar',
  'Çorap',
  'Gözlük',
  'Kemer',
  'Şal',
  'Şapka',
  'Takı',
  'Atkı',
]);

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
function parseSeasons(season?: string | null): string[] {
  if (!season) return ['Tüm Mevsimler'];
  return season.split(',').map((s) => s.trim());
}

function seasonsOverlap(itemSeason: string | null | undefined, targetSeasons: string[]) {
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
          const data = await getItems();
          if (mounted) setAllItems(data);
        } catch (err: any) {
          if (mounted) {
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
    }, [])
  );

  const generateOutfit = () => {
    pan.setValue({ x: 0, y: 0 });

    const tops = prioritizeFavorites(allItems.filter((i) => i.category === 'Üst'));
    const bottoms = prioritizeFavorites(allItems.filter((i) => i.category === 'Alt'));
    const dresses = prioritizeFavorites(allItems.filter((i) => DRESS_CATEGORIES.has(i.category)));
    const outerwears = prioritizeFavorites(
      allItems.filter((i) => OUTERWEAR_CATEGORIES.has(i.category)),
    );
    const shoesList = prioritizeFavorites(allItems.filter((i) => i.category === 'Ayakkabı'));
    const accessories = prioritizeFavorites(
      allItems.filter((i) => ACCESSORY_CATEGORIES.has(i.category)),
    );
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
        <ActivityIndicator size="large" color={UI.colors.accent} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>{loadError}</Text>
        <Pressable style={styles.retryButton} onPress={() => router.replace('/(tabs)/outfit')}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </Pressable>
      </View>
    );
  }

  const hasEnoughItems =
    allItems.some((i) => DRESS_CATEGORIES.has(i.category)) ||
    (allItems.some((i) => i.category === 'Üst') &&
      allItems.some((i) => i.category === 'Alt'));

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>GÜNLÜK SEÇKİ</Text>
      <Text style={styles.title}>Kombin oluştur</Text>
      <Text style={styles.intro}>Dolabındaki parçalardan yeni bir görünüm oluştur.</Text>

      {!hasEnoughItems ? (
        <View style={styles.emptyState}>
          <Image
            source={require('../../../assets/images/outfit-illustration.png')}
            style={styles.emptyIllustration}
            resizeMode="contain"
            accessible={false}
          />
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyStateText}>
              Önce dolabına bir elbise ya da bir üst ve bir alt parça ekle.
            </Text>
            <Pressable
              style={[styles.retryButton, styles.emptyRetryButton]}
              onPress={() => router.push('/(tabs)/add-item')}
            >
              <Text style={styles.retryButtonText}>Parça ekle</Text>
            </Pressable>
          </View>
        </View>
      ) : !outfit ? (
        <Pressable
          style={styles.generateButton}
          onPress={generateOutfit}
          accessibilityRole="button"
        >
          <Ionicons name="shuffle-outline" size={19} color={UI.colors.textPrimary} />
          <Text style={styles.generateButtonText}>Yeni kombin</Text>
        </Pressable>
      ) : (
        <>
          <Text style={styles.swipeHint}>
            Beğenmediğini sola, beğendiğini sağa kaydır
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
              accessibilityRole="button"
              accessibilityLabel="Kombini geç"
            >
              <Ionicons name="close-outline" size={20} color={UI.colors.textSecondary} />
              <Text style={styles.actionButtonText}>Geç</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.approveButton]}
              onPress={handleApprove}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Kombini kaydet"
            >
              <Ionicons name="checkmark-outline" size={20} color={UI.colors.accent} />
              <Text style={styles.actionButtonText}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
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
            <View style={styles.imagePlaceholder}>
              <Ionicons name={categoryIcon(label)} size={22} color={UI.colors.textMuted} />
            </View>
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
  container: { flex: 1, padding: UI.spacing.lg, backgroundColor: UI.colors.background },
  eyebrow: {
    color: UI.colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: UI.spacing.md,
  },
  title: {
    color: UI.colors.textPrimary,
    fontFamily: UI.fonts.display,
    fontSize: 30,
    marginTop: 4,
  },
  intro: { fontSize: 14, color: UI.colors.textSecondary, marginTop: 6, marginBottom: 22 },
  emptyText: {
    fontSize: 14,
    color: UI.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: UI.spacing.md,
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    width: '100%',
    maxWidth: 760,
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.lg,
    backgroundColor: UI.colors.surface,
    gap: UI.spacing.lg,
    padding: UI.spacing.lg,
    marginTop: UI.spacing.md,
  },
  emptyIllustration: { width: '34%', height: 116 },
  emptyCopy: { flex: 1, alignItems: 'flex-start' },
  emptyStateText: {
    fontSize: 14,
    color: UI.colors.textSecondary,
    lineHeight: 22,
  },
  emptyRetryButton: { alignSelf: 'flex-start' },
  retryButton: {
    alignSelf: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: UI.radius.md,
    borderWidth: 1,
    borderColor: UI.colors.accent,
    backgroundColor: UI.colors.primaryDark,
  },
  retryButtonText: { color: UI.colors.textPrimary, fontWeight: '600' },
  generateButton: {
    backgroundColor: UI.colors.primaryDark,
    borderRadius: UI.radius.md,
    paddingVertical: 15,
    borderColor: UI.colors.accent,
    borderWidth: 1,
    flexDirection: 'row',
    gap: UI.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonText: {
    color: UI.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  swipeHint: {
    textAlign: 'center',
    color: UI.colors.textMuted,
    fontSize: 12,
    marginBottom: UI.spacing.md,
  },
  card: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.lg,
    padding: UI.spacing.md,
    gap: 12,
    borderWidth: 1,
    borderColor: UI.colors.border,
    boxShadow: UI.shadow.card,
  },
  slot: { marginBottom: 4 },
  slotLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 7,
    color: UI.colors.accent,
  },
  slotCard: {
    backgroundColor: UI.colors.surfaceAlt,
    borderRadius: UI.radius.md,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imagePlaceholder: {
    width: 50,
    height: 50,
    backgroundColor: UI.colors.background,
    borderRadius: UI.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageThumb: {
    width: 50,
    height: 50,
    borderRadius: UI.radius.sm,
  },
  slotItemName: { fontSize: 14, fontWeight: '600', color: UI.colors.textPrimary },
  slotItemDetail: { fontSize: 12, color: UI.colors.textSecondary, marginTop: 3 },
  slotEmpty: { fontSize: 12, color: UI.colors.textMuted },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    borderRadius: UI.radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
  },
  rejectButton: { backgroundColor: UI.colors.surfaceAlt, borderColor: UI.colors.border },
  approveButton: { backgroundColor: UI.colors.primaryDark, borderColor: UI.colors.accent },
  actionButtonText: { color: UI.colors.textPrimary, fontSize: 13, fontWeight: '600' },
});