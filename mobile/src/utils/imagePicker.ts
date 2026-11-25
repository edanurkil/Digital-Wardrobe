import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

type PickOptions = { aspect?: [number, number] };

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

async function fromLibrary(aspect: [number, number]) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    showMessage('İzin gerekli', 'Fotoğraf seçmek için galeri izni vermelisin.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.7,
  });
  return result.canceled ? null : result.assets[0].uri;
}

async function fromCamera(aspect: [number, number]) {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    showMessage('İzin gerekli', 'Kamerayı kullanmak için izin vermelisin.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect,
    quality: 0.7,
  });
  return result.canceled ? null : result.assets[0].uri;
}

export async function pickImageWithSourceChoice(
  options: PickOptions = {},
): Promise<string | null> {
  const aspect = options.aspect ?? [1, 1];

  if (Platform.OS === 'web') {
    return fromLibrary(aspect);
  }

  return new Promise((resolve) => {
    Alert.alert(
      'Fotoğraf Ekle',
      'Fotoğrafı nereden eklemek istersin?',
      [
        { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Kamera', onPress: async () => resolve(await fromCamera(aspect)) },
        { text: 'Galeri', onPress: async () => resolve(await fromLibrary(aspect)) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}