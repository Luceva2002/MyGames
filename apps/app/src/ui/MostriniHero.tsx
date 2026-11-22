import { Image } from 'react-native';

/**
 * L'illustrazione della copertina (22/11/2026, scelta da Luca): i mostrini che giocano a poker sotto la lampada, come nel
 * quadro dei cani, con Dado sotto il tavolo che passa un asso a Zap. Immagine 3:2 col fondo uguale a quello della copertina.
 */
export const HERO_RATIO = 1536 / 1024;

export function MostriniHero({ width, height }: { width: number; height: number }) {
  return (
    <Image
      source={require('../../assets/copertina.jpg')}
      accessibilityLabel="I mostrini giocano a poker attorno al tavolo verde"
      style={{ width, height }}
      resizeMode="contain"
    />
  );
}
