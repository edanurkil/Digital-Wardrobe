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
import { createItem, uploadImage } from '../../services/api';
import { getSession } from '@/lib/supabase';
import { pickImageWithSourceChoice } from '../../utils/imagePicker';
import { Brand } from "@/constants/theme";


const CATEGORIES = ['Üst', 'Alt', 'Elbise', 'Dış Giyim', 'Ayakkabı', 'Aksesuar', 'Çanta'];
const SEASONS = ['Yaz', 'Kış', 'İlkbahar', 'Sonbahar', 'Tüm Mevsimler'];

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

export default function AddItemScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
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

    try {
      const session = await getSession();
      if (!session) {
        router.replace('/auth');
        return;
      }
    } catch {
      router.replace('/auth');
      return;
    }

    setSaving(true);
    try {
      let imageUrl: string | undefined;
      if (imageUri) {
        imageUrl = await uploadImage(imageUri);
      }

      await createItem({
        name,
        color,
        category,
        season: selectedSeasons.join(','),
        image_url: imageUrl,
      });
      notify('Başarılı', 'Kıyafet dolabına eklendi.');
      setName('');
      setColor('');
      setImageUri(null);
      setSelectedSeasons(['Tüm Mevsimler']);
      router.push('/(tabs)');
    } catch (err: any) {
      if (err?.message?.includes('Oturum')) {
        router.replace('/auth');
        return;
      }
      notify('Hata', err.message ?? 'Bir şeyler ters gitti.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Kıyafet Ekle</Text>

      <Text style={styles.label}>Fotoğraf</Text>
      <Pressable style={styles.imagePicker} onPress={pickImage}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        ) : (
          <Text style={styles.imagePickerText}>+ Fotoğraf Seç</Text>
        )}
      </Pressable>

      <Text style={styles.label}>İsim</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Örn. Tişört"
      />

      <Text style={styles.label}>Renk</Text>
      <TextInput
        style={styles.input}
        value={color}
        onChangeText={setColor}
        placeholder="Örn. Beyaz"
      />

      <Text style={styles.label}>Kategori</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            style={[styles.chip, category === c && styles.chipSelected]}
          >
            <Text style={[styles.chipText, category === c && styles.chipTextSelected]}>
              {c}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Mevsim (birden fazla seçebilirsin)</Text>
      <View style={styles.chipRow}>
        {SEASONS.map((s) => (
          <Pressable
            key={s}
            onPress={() => toggleSeason(s)}
            style={[
              styles.chip,
              selectedSeasons.includes(s) && styles.chipSelected,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                selectedSeasons.includes(s) && styles.chipTextSelected,
              ]}
            >
              {s}
            </Text>
          </Pressable>
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
  container: { flex: 1, padding: 16, backgroundColor: Brand.background },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  imagePicker: {
    width: 120,
    height: 120,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagePickerText: { color: '#888', fontSize: 13, textAlign: 'center' },
  previewImage: { width: '100%', height: '100%' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f5f5f5',
  },
  chipSelected: { backgroundColor: '#222', borderColor: '#222' },
  chipText: { fontSize: 14, color: '#333' },
  chipTextSelected: { color: '#fff' },
  saveButton: {
    marginTop: 28,
    backgroundColor: '#222',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 40,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});