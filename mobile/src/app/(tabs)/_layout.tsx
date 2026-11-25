import { UI } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: UI.colors.surface },
        headerShadowVisible: false,
        headerTintColor: UI.colors.textPrimary,
        headerTitleStyle: {
          fontFamily: UI.fonts.display,
          fontWeight: '600',
          color: UI.colors.textPrimary,
        },
        tabBarActiveTintColor: UI.colors.accent,
        tabBarInactiveTintColor: UI.colors.textMuted,
        tabBarStyle: {
          backgroundColor: UI.colors.surface,
          borderTopColor: UI.colors.border,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
        sceneStyle: { backgroundColor: UI.colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dolap',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'shirt' : 'shirt-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add-item"
        options={{
          title: 'Ekle',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'add-circle' : 'add-circle-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="outfit"
        options={{
          title: 'Kombin',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'layers' : 'layers-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}