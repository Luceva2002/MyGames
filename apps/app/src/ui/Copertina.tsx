import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MostriniHero } from './MostriniHero';
import { CharacterAvatar } from './avatars';
import { T } from './kit';
import { QrCode } from './QrCode';
import { SOFT, shellColors as colors, shellFont as font } from './theme';

/**
 * La copertina di PC e TV: i mostrini attorno al tavolo e, in basso a sinistra, il riquadro con cui si entra (QR e
 * codice) e il conto di chi è al tavolo. Sul telefono non c'è.
 */
export function Copertina({ width, height, top, action, code, url, count, avatars, notice }: {
  width: number;
  height: number;
  /** Quello che sta in alto a sinistra: nome dell'app, frase, bottoni. */
  top: ReactNode;
  /** Un bottone nell'angolo in alto a destra, sopra l'illustrazione. */
  action?: ReactNode;
  code?: string;
  url?: string | null;
  count?: number;
  avatars?: string[];
  /** Al posto del QR quando la stanza non è ancora pronta. */
  notice?: string;
}) {
  // Il QR lascia posto a quello che sta sopra e ai margini del riquadro.
  const qr = Math.round(Math.min(height * 0.56, height - 170));
  const codeSize = Math.round(Math.max(48, height * 0.17));
  const inside = height - 2;
  // I mostrini hanno una colonna tutta loro a destra, così il riquadro del QR non li copre mai.
  const masksWidth = Math.round(Math.min(width * 0.46, inside * 1.33));
  const artHeight = Math.round(Math.min(inside - 16, (masksWidth * 3) / 4));
  return (
    <View style={[styles.cover, { height }]}>
      <View style={{ position: 'absolute', right: 14, top: 0, bottom: 0, width: masksWidth, overflow: 'hidden', justifyContent: 'center' }}>
        <MostriniHero width={masksWidth} height={artHeight} />
      </View>
      <View style={{ flex: 1, padding: 16, marginRight: masksWidth + 14, justifyContent: 'space-between', gap: 8 }}>
        {top}
        {code ? (
          <View style={styles.pill}>
            {url ? <QrCode value={url} size={qr} /> : null}
            <View style={{ gap: 6, flex: 1, minWidth: 0 }}>
              <T size={16} weight="800" color="#D5DAD6">
                Inquadra o scrivi il codice
              </T>
              <Text accessibilityLabel={`Codice stanza ${code.split('').join(' ')}`} numberOfLines={1} style={[styles.code, { fontSize: codeSize, lineHeight: Math.round(codeSize * 1.1) }]}>
                {code}
              </Text>
              <T size={26} weight="900" color="#FFFFFF">
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
            <T size={15} color="#D5DAD6">
              {notice}
            </T>
          </View>
        ) : null}
      </View>
      {action ? <View style={{ position: 'absolute', top: 16, right: 16 }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: 30, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', backgroundColor: colors.cover, boxShadow: SOFT, marginBottom: 7 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 18, alignSelf: 'stretch', padding: 14, paddingRight: 18, borderRadius: 24, backgroundColor: colors.line },
  code: { color: colors.accent, fontFamily: font.display, letterSpacing: 4 },
});
