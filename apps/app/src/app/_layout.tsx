import { BagelFatOne_400Regular } from '@expo-google-fonts/bagel-fat-one';
import { Nunito_500Medium, Nunito_800ExtraBold, useFonts } from '@expo-google-fonts/nunito';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useWakeServer } from '../session/online';
import { colors } from '../ui/theme';

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.accent } };

export default function RootLayout() {
  // Chi apre il sito sveglia subito il server delle stanze (dorme dopo 15 minuti senza visite).
  useWakeServer();
  // Font del Carnevale: Bagel Fat One per titoli e punteggi, Nunito per testi e bottoni.
  const [loaded] = useFonts({ BagelFatOne_400Regular, Nunito_500Medium, Nunito_800ExtraBold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
