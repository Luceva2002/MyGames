import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { getSettings, TEXT_SCALE, useIsTv, useSettings } from './settings';
import { SeatAvatar } from './avatars';
import { colors, font, MIN_TEXT, MIN_TOUCH, OUTLINE, radius, seatColor, shadow, TV_MIN_TEXT, TV_SCALE } from './theme';

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
  focused && Platform.OS === 'web' && keyboardNav ? ({ outlineColor: colors.focus, outlineWidth: 3, outlineStyle: 'solid', outlineOffset: 3 } as ViewStyle) : null;

/**
 * Il bordo di focus serve a chi usa tastiera o telecomando: con mouse e dita non si vede
 * (come :focus-visible). Si accende al primo tasto e si spegne al primo clic o tocco.
 */
let keyboardNav = false;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter' || e.key === ' ') keyboardNav = true;
  }, true);
  window.addEventListener('pointerdown', () => (keyboardNav = false), true);
}

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

/** Bottone tondo con un'icona: indietro in alto a sinistra, menu in alto a destra. */
export function RoundButton({ icon, label, onPress }: { icon: 'back' | 'menu'; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      style={(state) => [styles.round, focusRing((state as { focused?: boolean }).focused ?? false)]}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <Path d={icon === 'back' ? 'M15 5l-7 7 7 7' : 'M4 7h16M4 12h16M4 17h16'} />
      </Svg>
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

/** Segno del giocatore: la sua icona tonda in piccolo (al posto delle vecchie forme colorate). */
export function SeatDot({ seat, size = 14, name = '' }: { seat: number; size?: number; name?: string }) {
  return <SeatAvatar seat={seat} name={name} size={Math.round(size * 1.7)} />;
}

/** Colore + simbolo + nome (P-ID-1). */
export function PlayerTag({ seat, name, size = 15, active, suffix }: { seat: number; name: string; size?: number; active?: boolean; suffix?: string }) {
  return (
    <Row gap={6} style={active ? { borderBottomWidth: 3, borderColor: seatColor(seat) } : undefined}>
      <SeatAvatar seat={seat} name={name} size={Math.round(size * 2.6)} />
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

/** La finestra di scelta al centro dello schermo: la stessa per «come giochiamo» e per il menu della partita. */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Chiudi">
        <Pressable style={styles.sheet} onPress={() => {}} accessibilityViewIsModal>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Una scelta della finestra: icona, titolo e, se serve, una riga di spiegazione. */
export function SheetOption({ icon, title, text, primary, chevron = true, onPress }: { icon: string; title: string; text?: string; primary?: boolean; chevron?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text ? `${title}. ${text}` : title}
      onPress={() => {
        tap();
        onPress();
      }}
      style={(state) => [styles.sheetOption, primary && { backgroundColor: colors.accent }, { transform: [{ translateY: state.pressed ? 3 : 0 }] }, focusRing((state as { focused?: boolean }).focused ?? false)]}
    >
      <T size={26}>{icon}</T>
      <View style={{ flex: 1 }}>
        <T size={17} weight="900" color={primary ? colors.onAccent : colors.text}>
          {title}
        </T>
        {text ? (
          <T size={13} weight="700" color={primary ? colors.onAccent : colors.muted}>
            {text}
          </T>
        ) : null}
      </View>
      {chevron && (
        <T size={20} weight="900" color={primary ? colors.onAccent : colors.accent}>
          ›
        </T>
      )}
    </Pressable>
  );
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
  round: { width: MIN_TOUCH, height: MIN_TOUCH, flexShrink: 0, borderRadius: MIN_TOUCH / 2, borderWidth: OUTLINE, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: MIN_TOUCH - 4, justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, borderWidth: OUTLINE, borderColor: colors.line, backgroundColor: colors.surface },
  panel: { backgroundColor: colors.surface, borderRadius: radius.l, padding: 16, gap: 12, borderWidth: OUTLINE, borderColor: colors.line, boxShadow: `0px 6px 0px ${colors.line}`, marginBottom: 6 },
  sheet: { width: '100%', maxWidth: 460, gap: 10, padding: 18, borderRadius: 28, backgroundColor: colors.surface, borderWidth: OUTLINE, borderColor: colors.line, boxShadow: `0px 8px 0px ${colors.line}` },
  sheetOption: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderWidth: OUTLINE, borderColor: colors.line, backgroundColor: colors.surface2, boxShadow: `0px 4px 0px ${colors.line}` },
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.l, padding: 24, gap: 14, width: '100%', maxWidth: 420, borderWidth: OUTLINE, borderColor: colors.line, boxShadow: `0px 8px 0px ${colors.line}` },
});
