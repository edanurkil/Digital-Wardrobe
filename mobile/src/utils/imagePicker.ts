import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export async function pickImageWithSourceChoice(): Promise<string | null> {
  if (Platform.OS === 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      const webAlert = typeof globalThis !== 'undefined' ? globalThis.alert : undefined;
      if (typeof webAlert === 'function') {
        webAlert('Fotoğraf seçmek için galeri izni vermelisin.');
      }
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled) return null;
    return result.assets[0].uri;
  }

  return new Promise((resolve) => {
    Alert.alert('Fotoğraf Ekle', 'Fotoğrafı nereden eklemek istersin?', [
      { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(null) },
      {
        text: 'Kamera',
        onPress: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('İzin gerekli', 'Kamerayı kullanmak için izin vermelisin.');
            resolve(null);
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
          resolve(result.canceled ? null : result.assets[0].uri);
        },
      },
      {
        text: 'Galeri',
        onPress: async () => {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('İzin gerekli', 'Fotoğraf seçmek için galeri izni vermelisin.');
            resolve(null);
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
          });
          resolve(result.canceled ? null : result.assets[0].uri);
        },
      },
    ]);
  });
}