import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tavolata.names';

export async function loadNames(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function saveNames(names: string[]) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(names));
  } catch {
    // Non salvare i nomi non è grave: alla prossima partita si riscrivono.
  }
}

export function defaultName(i: number) {
  return `Giocatore ${i + 1}`;
}
