import { ScrollView, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { frenchDeck, italianDeck, unoDeck } from '@giochi/engine';
import { PlayingCard } from '../ui/cards';

// Pagina provvisoria per rivedere i mazzi (da togliere).
export default function DevCarte() {
  // Solo in sviluppo: nel sito pubblicato rimanda alla home.
  const { solo } = useLocalSearchParams<{ solo?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  const it = italianDeck();
  const fr = frenchDeck({ jokersPerDeck: 2 });
  return (
    <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, padding: 20, backgroundColor: '#2A0E5C' }}>
      {(solo === 'uno' ? unoDeck().filter((c, i, a) => a.findIndex((x) => x.suit === c.suit && x.rank === c.rank) === i) : [...it, ...fr].filter((c) => solo !== 'assi' || c.rank === 1)).map((c) => (
        <View key={c.id}>
          <PlayingCard card={c} width={170} sway={false} />
        </View>
      ))}
    </ScrollView>
  );
}
