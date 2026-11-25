import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UI } from '@/constants/design';
import type { IconName } from '@/constants/design';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

type ButtonProps = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
}: ButtonProps) {
  const isSecondary = variant === 'secondary';
  const background =
    variant === 'danger'
      ? UI.colors.danger
      : isSecondary
        ? UI.colors.primarySoft
        : UI.colors.primaryDark;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        (disabled || loading) && { opacity: 0.6 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isSecondary ? UI.colors.primaryDark : UI.colors.white} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isSecondary && { color: UI.colors.primaryDark },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

type EmptyProps = {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  icon = 'shirt-outline',
  title,
  message,
  actionLabel,
  onAction,
}: EmptyProps) {
  return (
    <View style={styles.centerBox}>
      <View style={styles.iconFrame}>
        <Ionicons name={icon} size={28} color={UI.colors.accent} />
      </View>
      <Text style={styles.centerTitle}>{title}</Text>
      {message ? <Text style={styles.centerMessage}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} style={{ marginTop: UI.spacing.lg }} />
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <EmptyState
      icon="alert-circle-outline"
      title="Bir şeyler ters gitti"
      message={message}
      actionLabel="Tekrar dene"
      onAction={onRetry}
    />
  );
}

export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          backgroundColor: UI.colors.surfaceAlt,
          borderRadius: UI.radius.md,
          borderWidth: 1,
          borderColor: UI.colors.border,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: UI.radius.pill,
    borderWidth: 1,
    borderColor: UI.colors.border,
    backgroundColor: UI.colors.surface,
  },
  chipSelected: {
    backgroundColor: UI.colors.primarySoft,
    borderColor: UI.colors.accent,
  },
  chipText: { fontSize: 13, color: UI.colors.textSecondary, fontWeight: '600' },
  chipTextSelected: { color: UI.colors.textPrimary },
  button: {
    borderRadius: UI.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: UI.colors.accent,
  },
  buttonText: {
    color: UI.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: UI.spacing.xl,
  },
  iconFrame: {
    width: 64,
    height: 64,
    borderWidth: 1,
    borderColor: UI.colors.border,
    borderRadius: UI.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: UI.spacing.lg,
  },
  centerTitle: {
    fontSize: 23,
    fontFamily: UI.fonts.display,
    color: UI.colors.textPrimary,
    textAlign: 'center',
  },
  centerMessage: {
    fontSize: 14,
    color: UI.colors.textSecondary,
    textAlign: 'center',
    marginTop: UI.spacing.md,
    lineHeight: 20,
  },
});