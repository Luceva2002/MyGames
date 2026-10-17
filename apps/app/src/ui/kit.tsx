import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getSettings, TEXT_SCALE, useIsTv, useSettings } from './settings';
import { BotAvatar } from './avatars';
import { colors, font, MIN_TEXT, MIN_TOUCH, OUTLINE, radius, seatColor, seatSymbol, shadow, TV_MIN_TEXT, TV_SCALE } from './theme';

/** Vibrazione leggera al tocco, se attiva nelle impostazioni (P-A11Y-3). */
export function tap() {
  if (getSettings().haptics) Haptics.selectionAsync().catch(() => {});
}

/** Dimensione del testo con le impostazioni e lo schermo TV applicati (V-TXT-1, V-TXT-2). */
export function useTextSize(size: number) {
  const s = useSettings();
  const tv = useIsTv();
  const scaled = size * TEXT_SCALE[s.textSize] * (tv ? TV_SCALE : 1);
  return Math.max(tv ? TV_MIN_TEXT : MIN_TEXT, scaled);
}

/** Testo leggibile sopra un colore pieno: scuro sui colori chiari (giallo, turchese), bianco sugli altri. */
export function onColor(bg: string) {
  const h = bg.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? colors.onAccent : '#FFFFFF';
}

/** Bordo di focus visibile per tastiera e telecomando, non solo colore (V-IN-5). */
export const focusRing = (focused: boolean): ViewStyle | null =>
  focused && Platform.OS === 'web' ? ({ outlineColor: colors.focus, outlineWidth: 3, outlineStyle: 'solid', outlineOffset: 3 } as ViewStyle) : null;

export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const tv = useIsTv();
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.scroll, tv && styles.tvInset, style]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, tv && styles.tvInset, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function T({ children, style, size = 16, weight = '500', color = colors.text, center, lines }: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  size?: number;
  weight?: TextStyle['fontWeight'];
  color?: string;
  center?: boolean;
  lines?: number;
}) {
  const fontSize = useTextSize(size);
  // I testi "900" sono titoli, punteggi e cartelli: Bagel Fat One. Il resto è Nunito.
  const w = String(weight);
  const fontFamily = w === '900' ? font.display : Number(w) >= 700 || w === 'bold' ? font.bold : font.body;
  return (
    <Text numberOfLines={lines} style={[{ color, fontSize, fontFamily, textAlign: center ? 'center' : undefined }, style]}>
      {children}
    </Text>
  );
}

export function Button({ label, onPress, color = colors.accent, kind = 'solid', disabled, small, icon, style, a11y }: {
  label: string;
  onPress: () => void;
  color?: string;
  kind?: 'solid' | 'ghost';
  disabled?: boolean;
  small?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  a11y?: string;
}) {
  const solid = kind === 'solid';
  const hc = useSettings().highContrast;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={(state) => [
        styles.button,
        small && styles.buttonSmall,
        solid ? { backgroundColor: color, borderColor: colors.line, ...shadow(state.pressed ? 2 : 6) } : { borderColor: color, backgroundColor: colors.surface },
        hc && { borderColor: colors.text },
        { opacity: disabled ? 0.5 : 1, transform: [{ translateY: solid && state.pressed ? 4 : 0 }] },
        focusRing((state as { focused?: boolean }).focused ?? false),
        style,
      ]}
    >
      <T size={small ? 15 : 18} weight="800" color={solid ? onColor(color) : color} center>
        {icon ? `${icon}  ` : ''}
        {label}
      </T>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, color = colors.accent }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        tap();
        onPress();
      }}
      // Scelto: pieno del suo colore; non scelto: bordo del suo colore, così la categoria si riconosce sempre.
      style={(state) => [styles.chip, active ? { backgroundColor: color, borderColor: colors.line } : { borderColor: color === colors.line ? colors.dim : color }, focusRing((state as { focused?: boolean }).focused ?? false)]}
    >
      <T size={15} weight="700" color={active ? onColor(color) : colors.muted}>
        {active ? '✓ ' : ''}
        {label}
      </T>
    </Pressable>
  );
}

/** Segno del giocatore: simbolo colorato, riconoscibile anche senza distinguere i colori (V-COL-2). */
export function SeatDot({ seat, size = 14 }: { seat: number; size?: number }) {
  const fontSize = useTextSize(size);
  return (
    <Text accessibilityElementsHidden style={{ color: seatColor(seat), fontSize, lineHeight: fontSize * 1.15, fontWeight: '900', minWidth: fontSize }}>
      {seatSymbol(seat)}
    </Text>
  );
}

/** Colore + simbolo + nome (P-ID-1). */
export function PlayerTag({ seat, name, size = 15, active, suffix }: { seat: number; name: string; size?: number; active?: boolean; suffix?: string }) {
  return (
    <Row gap={6} style={active ? { borderBottomWidth: 3, borderColor: seatColor(seat) } : undefined}>
      <BotAvatar name={name} size={Math.round(size * 2.6)} seat={seat} />
      <SeatDot seat={seat} size={size} />
      <T size={size} weight="800" lines={1}>
        {name}
        {suffix ?? ''}
      </T>
    </Row>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const hc = useSettings().highContrast;
  return <View style={[styles.panel, hc && { borderColor: colors.muted }, style]}>{children}</View>;
}

export function Row({ children, gap = 8, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

/** Conferma per le azioni distruttive, come uscire dalla partita (V-IN-4). */
export function Confirm({ visible, title, message, confirmLabel, onConfirm, onCancel }: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.scrim}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <T size={22} weight="900">
            {title}
          </T>
          {message ? <T color={colors.muted}>{message}</T> : null}
          <Button label="Resta" kind="ghost" color={colors.text} onPress={onCancel} />
          <Button label={confirmLabel} color={colors.danger} onPress={onConfirm} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 48, gap: 16, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  // Margine di sicurezza del 5% sui televisori (V-SAFE-1).
  tvInset: { paddingHorizontal: '5%', paddingVertical: '3%', maxWidth: undefined },
  button: { minHeight: MIN_TOUCH + 8, paddingVertical: 14, paddingHorizontal: 22, borderRadius: radius.l, borderWidth: OUTLINE, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  buttonSmall: { minHeight: MIN_TOUCH, paddingVertical: 10, paddingHorizontal: 16 },
  chip: { minHeight: MIN_TOUCH - 4, justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, borderWidth: OUTLINE, borderColor: colors.line, backgroundColor: colors.surface },
  panel: { backgroundColor: colors.surface, borderRadius: radius.l, padding: 16, gap: 12, borderWidth: OUTLINE, borderColor: colors.line, boxShadow: `0px 6px 0px ${colors.line}`, marginBottom: 6 },
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.l, padding: 24, gap: 14, width: '100%', maxWidth: 420, borderWidth: OUTLINE, borderColor: colors.line, boxShadow: `0px 8px 0px ${colors.line}` },
});
