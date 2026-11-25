import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { UI } from '@/constants/design';

export default function OpeningScreen() {
  const router = useRouter();
  const flight = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const imageWidth = Math.min(340, width * 0.84);
  const imageHeight = imageWidth * (585 / 1080);

  useEffect(() => {
    const animation = Animated.timing(flight, {
      toValue: 1,
      duration: 4200,
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });

    animation.start(({ finished }) => {
      if (finished) router.replace('/(tabs)');
    });

    return () => animation.stop();
  }, [flight, router]);

  const translateX = flight.interpolate({
    inputRange: [0, 1],
    outputRange: [-(width + imageWidth) / 2, (width + imageWidth) / 2],
  });
  const translateY = flight.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [22, -24, 8],
  });
  const rotate = flight.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-5deg', '1deg', '-4deg'],
  });
  const opacity = flight.interpolate({
    inputRange: [0, 0.08, 0.9, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Ionicons name="moon-outline" size={30} color={UI.colors.accent} />
        <Text style={styles.eyebrow}>KİŞİSEL ARŞİV</Text>
        <Text style={styles.title}>Dolabım</Text>
      </View>

      <Animated.Image
        source={require('../../assets/images/witch-on-broom.png')}
        style={[
          styles.witch,
          {
            width: imageWidth,
            height: imageHeight,
            marginLeft: -imageWidth / 2,
            marginTop: -imageHeight / 2,
            opacity,
            transform: [{ translateX }, { translateY }, { rotate }],
          },
        ]}
        resizeMode="contain"
        accessible={false}
      />

      <Text style={styles.caption}>Dolabın açılıyor</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.colors.background,
    overflow: 'hidden',
  },
  brand: {
    position: 'absolute',
    top: '19%',
    alignItems: 'center',
  },
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
    fontSize: 36,
    marginTop: 4,
  },
  witch: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  caption: {
    position: 'absolute',
    bottom: '18%',
    color: UI.colors.textSecondary,
    fontSize: 14,
    letterSpacing: 0.5,
  },
});
