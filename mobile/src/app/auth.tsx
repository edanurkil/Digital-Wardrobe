import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getSession, signIn, signUp } from '@/lib/supabase';
import { Brand } from '@/constants/theme';

export default function AuthScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [isLogin, setIsLogin] = useState(true);
  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
  };

  useEffect(() => {
    (async () => {
      try {
        const session = await getSession();
        if (session) {
          router.replace('/(tabs)');
        }
      } catch (err) {
        console.error('Session error', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (!normalizedEmail || !normalizedPassword) {
      Alert.alert('Eksik bilgi', 'E-posta ve şifre gerekli.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      Alert.alert('Geçersiz e-posta', 'Geçerli bir e-posta adresi gir.');
      return;
    }

    if (normalizedPassword.length < 6) {
      Alert.alert('Şifre çok kısa', 'Şifre en az 6 karakter olmalı.');
      return;
    }

    setBusy(true);
    try {
      if (isLogin) {
        const result = await signIn(normalizedEmail, normalizedPassword);

        if (!result.session) {
          Alert.alert('Giriş başarısız', 'Kullanıcı bulunamadı veya şifre yanlış.');
          return;
        }

        Alert.alert('Giriş başarılı', 'Hoş geldin!');
        router.replace('/(tabs)');
        return;
      }

      const result = await signUp(normalizedEmail, normalizedPassword);

      if (result.session) {
        Alert.alert('Kayıt başarılı', 'Hesabınız oluşturuldu.');
        router.replace('/(tabs)');
        return;
      }

      Alert.alert(
        'Kayıt alındı',
        'Hesabınız oluşturuldu. E-posta doğrulaması gerekiyorsa posta kutunuzu kontrol edin.',
      );
    } catch (error: any) {
      const message = String(error?.message ?? '').toLowerCase();
      if (message.includes('already registered') || message.includes('already been registered')) {
        Alert.alert('Hesap zaten var', 'Bu e-posta kayıtlı. Giriş yapmayı dene.');
      } else if (message.includes('invalid login credentials')) {
        Alert.alert('Giriş başarısız', 'E-posta veya şifre hatalı.');
      } else if (message.includes('email not confirmed')) {
        Alert.alert('E-posta doğrulanmadı', 'Önce e-posta adresini doğrula.');
      } else {
        Alert.alert('İşlem başarısız', error?.message ?? 'Lütfen tekrar dene.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.containerCentered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isLogin ? 'Giriş Yap' : 'Hesap Oluştur'}</Text>
      <Text style={styles.subtitle}>Kişisel dolabın için giriş yap.</Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="E-posta"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Şifre"
        secureTextEntry
      />

      <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={busy}>
        <Text style={styles.primaryButtonText}>{busy ? 'İşleniyor...' : isLogin ? 'Giriş Yap' : 'Kayıt Ol'}</Text>
      </Pressable>

      <Pressable
        onPress={() => {
          setIsLogin((prev) => !prev);
          resetForm();
        }}
      >
        <Text style={styles.switchText}>
          {isLogin ? 'Hesabın yok mu? Kayıt ol' : 'Zaten hesabın var mı? Giriş yap'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  containerCentered: {
    flex: 1,
    backgroundColor: Brand.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: Brand.background,
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    color: Brand.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: Brand.textSecondary,
    marginBottom: 24,
  },
  input: {
    backgroundColor: Brand.surface,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    fontSize: 16,
    color: Brand.textPrimary,
  },
  primaryButton: {
    backgroundColor: Brand.primaryDark,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  switchText: {
    textAlign: 'center',
    color: Brand.primaryDark,
    marginTop: 18,
    fontWeight: '600',
  },
});
