import { Alert, Platform } from 'react-native';

export function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    const webAlert = typeof globalThis !== 'undefined' ? globalThis.alert : undefined;
    if (typeof webAlert === 'function') {
      webAlert(`${title}: ${message}`);
      return;
    }
  }
  Alert.alert(title, message);
}

export function confirmAsync(
  title: string,
  message: string,
  confirmLabel = 'Evet',
  destructive = false,
): Promise<boolean> {
  if (Platform.OS === 'web') {
    const webConfirm = typeof globalThis !== 'undefined' ? globalThis.confirm : undefined;
    return Promise.resolve(
      typeof webConfirm === 'function' ? webConfirm(`${title}\n\n${message}`) : false,
    );
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}