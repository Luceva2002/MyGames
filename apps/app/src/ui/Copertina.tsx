import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { HERO } from './art';
import { CharacterAvatar } from './avatars';
import { T } from './kit';
import { QrCode } from './QrCode';
import { colors, font, OUTLINE } from './theme';

/**
 * La copertina di PC e TV: le maschere e, in basso a sinistra, il riquadro con cui si entra (QR e
 * codice) e il conto di chi è al tavolo. Sul telefono non c'è.
 */
export function Copertina({ width, height, top, code, url, count, avatars, notice }: {
  width: number;
  height: number;
  /** Quello che sta in alto a sinistra: nome dell'app, frase, bottoni. */
  top: ReactNode;
  code?: string;
  url?: string | null;
  count?: number;
  avatars?: string[];
  /** Al posto del QR quando la stanza non è ancora pronta. */
  notice?: string;
}) {
  const qr = Math.round(Math.min(260, height * 0.56));
  const inside = height - OUTLINE * 2;
  return (
    <View style={[styles.cover, { height }]}>
      <Image source={HERO} style={{ position: 'absolute', right: Math.round(width * 0.05), top: 0, height: inside, width: Math.round((inside * 1600) / 720) }} accessibilityIgnoresInvertColors />
      <View style={{ flex: 1, padding: 16, justifyContent: 'space-between', gap: 8 }}>
        {top}
        {code ? (
          <View style={styles.pill}>
            {url ? <QrCode value={url} size={qr} /> : null}
            <View style={{ gap: 6, flexShrink: 1 }}>
              <T size={16} weight="800" color={colors.muted}>
                Inquadra o scrivi il codice
              </T>
              <Text accessibilityLabel={`Codice stanza ${code.split('').join(' ')}`} style={styles.code}>
                {code}
              </Text>
              <T size={26} weight="900" style={{ lineHeight: 30 }}>
                {count ?? 0} al tavolo
              </T>
              <View style={{ flexDirection: 'row' }}>
                {(avatars ?? []).slice(0, 6).map((id, i) => (
                  <View key={`${id}${i}`} style={{ marginLeft: i ? -10 : 0 }}>
                    <CharacterAvatar id={id} size={44} />
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : notice ? (
          <View style={styles.pill}>
            <T size={15} color={colors.muted}>
              {notice}
            </T>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: 30, borderWidth: OUTLINE, borderColor: colors.line, overflow: 'hidden', backgroundColor: colors.cover, boxShadow: `0px 7px 0px ${colors.line}`, marginBottom: 7 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 22, alignSelf: 'flex-start', padding: 14, paddingRight: 26, borderRadius: 24, backgroundColor: colors.line },
  code: { color: colors.accent, fontFamily: font.display, fontSize: 60, lineHeight: 66, letterSpacing: 4 },
});
