import { Image, ScrollView, View } from 'react-native';
import { T } from '../ui/kit';
import { colors } from '../ui/theme';

// Pagina provvisoria: prova delle carte del Lupus nello stile dell'app (non ancora usate nel gioco).
const NEW = [
  { name: 'Retro', src: require('../../assets/lupus-prova/retro.jpg') },
  { name: 'Il Lupo', src: require('../../assets/lupus-prova/lupo.jpg') },
  { name: 'La Veggente', src: require('../../assets/lupus-prova/veggente.jpg') },
];
const OLD = [
  { name: 'Retro', src: require('../../assets/lupus/retro.jpg') },
  { name: 'Il Lupo', src: require('../../assets/lupus/lupo.jpg') },
  { name: 'La Veggente', src: require('../../assets/lupus/veggente.jpg') },
];

function Row({ title, cards }: { title: string; cards: typeof NEW }) {
  return (
    <View style={{ gap: 10 }}>
      <T size={20} weight="900">
        {title}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {cards.map((c) => (
          <View key={c.name} style={{ alignItems: 'center', gap: 6 }}>
            <Image source={c.src} style={{ width: 200, height: 300, borderRadius: 14 }} />
            <T size={13} color={colors.muted}>
              {c.name}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function DevLupus() {
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, gap: 28 }}>
      <Row title="Proposta: tarocchi semplici nello stile dell'app" cards={NEW} />
      <Row title="Attuali" cards={OLD} />
    </ScrollView>
  );
}
