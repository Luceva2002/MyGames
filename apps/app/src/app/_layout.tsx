import { Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { Bungee_400Regular } from '@expo-google-fonts/bungee';
import { Figtree_500Medium, Figtree_700Bold, useFonts } from '@expo-google-fonts/figtree';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useWakeServer } from '../session/online';
import { shellColors as colors } from '../ui/theme';

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.accent } };

export default function RootLayout() {
  // Chi apre il sito sveglia subito il server delle stanze (dorme dopo 15 minuti senza visite).
  useWakeServer();
  // Bungee per titoli e punteggi, Figtree per i testi, Fredoka per le carte.
  const [loaded] = useFonts({ Fredoka_600SemiBold, Fredoka_700Bold, Bungee_400Regular, Figtree_500Medium, Figtree_700Bold });
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
