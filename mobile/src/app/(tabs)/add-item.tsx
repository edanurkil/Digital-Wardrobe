import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '@/components/ui/kombin-ui';
import {
  CATEGORIES,
  CATEGORY_HINTS,
  OTHER_CATEGORY_SUGGESTIONS,
  SEASONS,
  UI,
} from '@/constants/design';
import {
  createItem,
  deleteStoredImage,
  removeImageBackground,
  updateItemImage,
  uploadImage,
} from '../../services/api';
import { pickImageWithSourceChoice } from '../../utils/imagePicker';

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

async function finishBackgroundRemoval(
  itemId: number,
  originalPath: string,
  sourceUri: string,
) {
  try {
    const processedPath = await removeImageBackground(originalPath, sourceUri);
    if (!processedPath) {
      notify(
        'Kıyafet kaydedildi',
        'Arka plan kaldırılamadı; orijinal fotoğrafın güvende ve kayıtta görünüyor.',
      );
      return;
    }

    await updateItemImage(itemId, processedPath);
    await deleteStoredImage(originalPath);
    notify('Arka plan kaldırıldı', 'Kıyafet fotoğrafın güncellendi.');
  } catch (error: unknown) {
    console.error('Background removal failed after saving the clothing item:', error);
    notify(
      'Kıyafet kaydedildi',
      error instanceof Error
        ? `${error.message} Orijinal fotoğrafın korunuyor.`
        : 'Arka plan kaldırılamadı. Orijinal fotoğrafın korunuyor.',
    );
  }
}

export default function AddItemScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0].key);
  const [otherCategory, setOtherCategory] = useState('');
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>(['Tüm Mevsimler']);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleSeason = (s: string) => {
    if (s === 'Tüm Mevsimler') {
      setSelectedSeasons(['Tüm Mevsimler']);
      return;
    }
    setSelectedSeasons((prev) => {
      const withoutAll = prev.filter((x) => x !== 'Tüm Mevsimler');
      if (withoutAll.includes(s)) {
        const next = withoutAll.filter((x) => x !== s);
        return next.length > 0 ? next : ['Tüm Mevsimler'];
      }
      return [...withoutAll, s];
    });
  };

  const pickImage = async () => {
    const uri = await pickImageWithSourceChoice();
    if (uri) setImageUri(uri);
  };

  const handleSave = async () => {
    if (!name.trim() || !color.trim()) {
      notify('Eksik bilgi', 'Lütfen isim ve renk alanlarını doldur.');
      return;
    }
    if (category === 'Diğer' && !otherCategory.trim()) {
      notify('Tür gerekli', 'Bir öneri seç ya da kendi kıyafet türünü yaz.');
      return;
    }

    setSaving(true);
    let uploadedImagePath: string | undefined;
    try {
      if (imageUri) {
        uploadedImagePath = await uploadImage(imageUri);
      }

      const created = await createItem({
        name,
        color: color.trim(),
        category: category === 'Diğer' ? otherCategory.trim() : category,
        season: selectedSeasons.join(','),
        image_url: uploadedImagePath,
      });
      notify(
        'Kıyafet kaydedildi',
        uploadedImagePath
          ? 'Fotoğraf kaydedildi. Arka plan kaldırma işlemi arka planda devam ediyor; bu sırada uygulamayı kullanabilirsin.'
          : 'Kıyafet dolabına eklendi.',
      );
      setName('');
      setColor('');
      setImageUri(null);
      setOtherCategory('');
      setSelectedSeasons(['Tüm Mevsimler']);
      router.push('/(tabs)');
      if (uploadedImagePath && imageUri) {
        void finishBackgroundRemoval(created.id, uploadedImagePath, imageUri);
      }
    } catch (error: unknown) {
      let message = error instanceof Error ? error.message : 'Bir şeyler ters gitti.';
      if (uploadedImagePath) {
        try {
          await deleteStoredImage(uploadedImagePath);
        } catch (cleanupError: unknown) {
          const cleanupMessage =
            cleanupError instanceof Error ? cleanupError.message : 'Fotoğraf temizlenemedi.';
          message = `${message} (${cleanupMessage})`;
        }
      }
      notify('Kayıt başarısız', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroRow}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>DOLABINA EKLE</Text>
          <Text style={styles.title}>Yeni parça</Text>
          <Text style={styles.intro}>Koleksiyonuna yeni bir parça ekle.</Text>
        </View>
        <Image
          source={require('../../../assets/images/add-item-art.png')}
          style={styles.heroArt}
          resizeMode="contain"
          accessible={false}
        />
      </View>

      <Text style={styles.label}>Fotoğraf</Text>
      <Pressable style={styles.imagePicker} onPress={pickImage}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.imagePrompt}>
            <Ionicons name="camera-outline" size={25} color={UI.colors.accent} />
            <Text style={styles.imagePickerText}>Fotoğraf seç</Text>
            <Text style={styles.imageHint}>İsteğe bağlı</Text>
          </View>
        )}
      </Pressable>
      <Text style={styles.imageHint}>
        Fotoğraf kırpılmadan eklenir. Servis geçici olarak ulaşılamazsa orijinal fotoğrafın kaydedilir.
      </Text>

      <Text style={styles.label}>İsim</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Örn. Tişört"
        placeholderTextColor={UI.colors.textMuted}
      />

      <Text style={styles.label}>Renk</Text>
      <TextInput
        style={styles.input}
        value={color}
        onChangeText={setColor}
        placeholder="Örn. Beyaz"
        placeholderTextColor={UI.colors.textMuted}
      />

      <Text style={styles.label}>Kategori</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map(({ key }) => (
          <Chip
            key={key}
            label={key}
            selected={category === key}
            onPress={() => setCategory(key)}
          />
        ))}
      </View>
      {category === 'Diğer' ? (
        <View style={styles.otherCategorySection}>
          <Text style={styles.label}>Kıyafet türü</Text>
          <TextInput
            style={styles.input}
            value={otherCategory}
            onChangeText={setOtherCategory}
            placeholder="Örn. Pijama, mayo, şal"
            placeholderTextColor={UI.colors.textMuted}
            autoCapitalize="words"
            returnKeyType="done"
          />
          <Text style={styles.helperText}>Hazır türlerden birini seçebilir veya kendin yazabilirsin.</Text>
          <View style={styles.chipRow}>
            {OTHER_CATEGORY_SUGGESTIONS.map((suggestion) => (
              <Chip
                key={suggestion}
                label={suggestion}
                selected={otherCategory === suggestion}
                onPress={() => setOtherCategory(suggestion)}
              />
            ))}
          </View>
        </View>
      ) : (
        <Text style={styles.helperText}>{CATEGORY_HINTS[category]}</Text>
      )}

      <Text style={styles.label}>Mevsim (birden fazla seçebilirsin)</Text>
      <View style={styles.chipRow}>
        {SEASONS.map(({ key }) => (
          <Chip
            key={key}
            label={key}
            selected={selectedSeasons.includes(key)}
            onPress={() => toggleSeason(key)}
          />
        ))}
      </View>

      <Pressable
        style={[styles.saveButton, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? 'Kaydediliyor...' : 'Dolaba Ekle'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.colors.background },
  content: { padding: UI.spacing.lg, paddingBottom: 48 },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UI.spacing.sm,
    marginTop: UI.spacing.md,
    marginBottom: 8,
  },
  heroCopy: { flex: 1 },
  heroArt: { width: 112, height: 96, opacity: 0.9 },
  eyebrow: {
    color: UI.colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    color: UI.colors.textPrimary,
    fontFamily: UI.fonts.display,
    fontSize: 30,
    marginTop: 4,
  },
  intro: { color: UI.colors.textSecondary, fontSize: 14, marginTop: 6, marginBottom: 10 },
  label: {
    color: UI.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: UI.spacing.lg,
    marginBottom: UI.spacing.sm,
  },
  helperText: {
    color: UI.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: UI.spacing.sm,
  },
  otherCategorySection: { marginTop: UI.spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.md,
    backgroundColor: UI.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: UI.colors.textPrimary,
  },
  imagePicker: {
    height: 176,
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.md,
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagePrompt: { alignItems: 'center', gap: 8 },
  imagePickerText: { color: UI.colors.textPrimary, fontSize: 14, fontWeight: '600' },
  imageHint: { color: UI.colors.textMuted, fontSize: 12 },
  previewImage: { width: '100%', height: '100%' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: UI.spacing.sm },
  saveButton: {
    marginTop: UI.spacing.xl,
    backgroundColor: UI.colors.primaryDark,
    borderColor: UI.colors.accent,
    borderWidth: 1,
    borderRadius: UI.radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 40,
  },
  saveButtonText: {
    color: UI.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});