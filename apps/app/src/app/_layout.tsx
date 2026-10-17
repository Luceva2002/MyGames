import { BagelFatOne_400Regular } from '@expo-google-fonts/bagel-fat-one';
import { Nunito_500Medium, Nunito_800ExtraBold, useFonts } from '@expo-google-fonts/nunito';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { colors } from '../ui/theme';

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.accent } };

export default function RootLayout() {
  // Font del Carnevale: Bagel Fat One per titoli e punteggi, Nunito per testi e bottoni.
  const [loaded] = useFonts({ BagelFatOne_400Regular, Nunito_500Medium, Nunito_800ExtraBold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }} />
    </ThemeProvider>
  );
}
