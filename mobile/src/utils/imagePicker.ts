import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') {
    const webAlert = typeof globalThis !== 'undefined' ? globalThis.alert : undefined;
    if (typeof webAlert === 'function') {
      webAlert(`${title}: ${message}`);
      return;
    }
  }
  Alert.alert(title, message);
}

async function fromLibrary() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    showMessage('İzin gerekli', 'Fotoğraf seçmek için galeri izni vermelisin.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.7,
  });
  return result.canceled ? null : result.assets[0].uri;
}

async function fromCamera() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    showMessage('İzin gerekli', 'Kamerayı kullanmak için izin vermelisin.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.7,
  });
  return result.canceled ? null : result.assets[0].uri;
}

export async function pickImageWithSourceChoice(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return fromLibrary();
  }

  return new Promise((resolve) => {
    Alert.alert(
      'Fotoğraf Ekle',
      'Fotoğrafı nereden eklemek istersin?',
      [
        { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Kamera', onPress: async () => resolve(await fromCamera()) },
        { text: 'Galeri', onPress: async () => resolve(await fromLibrary()) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}