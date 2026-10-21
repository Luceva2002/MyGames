import { getSettings, setSettings } from '../ui/settings';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Client, type Room } from '@colyseus/sdk';
import { BOT_CHARACTERS, characterById, DEFAULT_PORT, ROOM_NAME, type JoinOptions, type RoomSnapshot, type SeatView } from '@giochi/engine';

/**
 * Indirizzo del server delle stanze. Si può fissare con EXPO_PUBLIC_SERVER_URL;
 * altrimenti si usa lo stesso computer che serve l'app (comodo in casa, sulla stessa Wi-Fi).
 */
export function serverUrl(): string {
  const fixed = process.env.EXPO_PUBLIC_SERVER_URL;
  if (fixed) return fixed;
  if (Platform.OS === 'web' && typeof location !== 'undefined') {
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:${DEFAULT_PORT}`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `ws://${host}:${DEFAULT_PORT}`;
}

/** Sito pubblico di Tavolata, dove entra chi è invitato senza avere l'app. */
const PUBLIC_WEB_URL = 'https://tavolata-five.vercel.app';

/** Indirizzo da far aprire agli altri per entrare nella stanza. */
export function joinUrl(code: string): string | null {
  const fixed = process.env.EXPO_PUBLIC_WEB_URL;
  if (fixed) return `${fixed.replace(/\/$/, '')}/?code=${code}`;
  if (Platform.OS === 'web' && typeof location !== 'undefined') {
    // Da localhost il QR non può dire "localhost": il telefono aprirebbe sé stesso. Si usa
    // l'indirizzo del computer sulla Wi-Fi, che `make` passa in EXPO_PUBLIC_LAN_HOST.
    const lan = process.env.EXPO_PUBLIC_LAN_HOST;
    if (lan && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return `${location.protocol}//${lan}${location.port ? `:${location.port}` : ''}/?code=${code}`;
    return `${location.origin}/?code=${code}`;
  }
  // Dall'app installata il link porta sempre al sito: chi è invitato entra dal browser, senza app.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:8081/?code=${code}` : `${PUBLIC_WEB_URL}/?code=${code}`;
}

interface OnlineState {
  room: Room | null;
  snapshot: RoomSnapshot | null;
  seatView: SeatView | null;
  error: string | null;
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed';
  /** Mossa inviata e non ancora confermata dal server. */
  pending: boolean;
}

let current: OnlineState = { room: null, snapshot: null, seatView: null, error: null, status: 'idle', pending: false };
const listeners = new Set<(s: OnlineState) => void>();

function set(patch: Partial<OnlineState>) {
  current = { ...current, ...patch };
  listeners.forEach((l) => l(current));
}

/** Il gettone per rientrare nella stessa stanza col proprio posto se si ricarica la pagina. */
const TOKEN_KEY = 'tavolata.rejoin';
function saveToken(room: Room | null) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (room) sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ code: room.roomId, token: room.reconnectionToken }));
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Archivio del browser non disponibile: si rientra come nuovo giocatore.
  }
}

/**
 * Rientra nella stanza `code`: prima col proprio posto (dopo una ricarica della pagina), altrimenti
 * come nuovo giocatore col nome salvato.
 */
export async function rejoin(code: string): Promise<string | null> {
  try {
    const saved = typeof sessionStorage !== 'undefined' ? JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null') : null;
    if (saved?.code === code && saved.token) {
      set({ status: 'connecting', error: null });
      const room = await new Client(serverUrl()).reconnect(saved.token);
      attach(room);
      return room.roomId;
    }
  } catch {
    // Posto scaduto: si entra di nuovo.
  }
  return quickJoin(code);
}

function attach(room: Room) {
  set({ room, status: 'connected', error: null, snapshot: null, seatView: null });
  saveToken(room);
  room.onMessage('room', (snapshot: RoomSnapshot) => {
    set({ snapshot, ...(snapshot.phase === 'lobby' ? { seatView: null } : {}) });
  });
  room.onMessage('view', (seatView: SeatView) => set({ seatView, pending: false }));
  room.onMessage('error', ({ message }: { message: string }) => set({ error: message, pending: false }));
  room.onDrop(() => set({ status: 'reconnecting' }));
  room.onReconnect(() => set({ status: 'connected' }));
  room.onLeave(() => {
    if (current.room === room) set({ status: 'closed' });
  });
  room.onReconnect(() => saveToken(room));
}

function friendly(e: unknown): string {
  const msg = String((e as Error)?.message ?? e);
  if (/not found|no rooms found|invalid/i.test(msg)) return 'Nessuna stanza con questo codice.';
  if (/ECONNREFUSED|Failed to fetch|Network|network/i.test(msg)) return 'Server delle stanze non raggiungibile. È acceso?';
  return msg;
}

/** Chi gioca porta con sé la maschera scelta nelle impostazioni (lo schermo condiviso no). */
const withAvatar = <T extends JoinOptions>(o: T): T => (o.role === 'player' && getSettings().avatar ? { ...o, avatar: getSettings().avatar! } : o);

export async function createRoom(options: JoinOptions & { gameId?: string }) {
  set({ status: 'connecting', error: null });
  try {
    const room = await new Client(serverUrl()).create(ROOM_NAME, withAvatar(options));
    attach(room);
    return room.roomId;
  } catch (e) {
    set({ status: 'idle', error: friendly(e) });
    return null;
  }
}

export async function joinRoom(code: string, options: JoinOptions) {
  set({ status: 'connecting', error: null });
  try {
    const room = await new Client(serverUrl()).joinById(code, withAvatar(options));
    attach(room);
    return room.roomId;
  } catch (e) {
    set({ status: 'idle', error: friendly(e) });
    return null;
  }
}

/**
 * Entrare al volo (link, QR o codice scritto in home): col nome salvato o, la prima volta, col
 * nome di una maschera a caso; anche il personaggio, se non c'è, è scelto a caso.
 */
export async function quickJoin(code: string): Promise<string | null> {
  const { loadNames, saveNames } = await import('./names');
  const names = await loadNames();
  let name = names[0]?.trim();
  if (!getSettings().avatar) setSettings({ ...getSettings(), avatar: BOT_CHARACTERS[Math.floor(Math.random() * BOT_CHARACTERS.length)].id });
  if (!name || name === 'Io') {
    name = characterById(getSettings().avatar)?.name ?? 'Ospite';
    saveNames([name, ...names.slice(1)]);
  }
  return joinRoom(code, { name, role: 'player' });
}

export function send(type: string, payload?: unknown) {
  current.room?.send(type, payload);
}

/** Invia una mossa e segna l'attesa finché il server non risponde (V-FB-2). */
export function sendMove(move: unknown) {
  if (!current.room || current.pending) return;
  set({ pending: true });
  current.room.send('move', { move });
  // Se la risposta non arriva (connessione persa), si sblocca da solo.
  setTimeout(() => current.pending && set({ pending: false }), 6000);
}

export async function leaveRoom() {
  const room = current.room;
  saveToken(null);
  set({ room: null, snapshot: null, seatView: null, status: 'idle', error: null });
  await room?.leave().catch(() => {});
}

export function clearOnlineError() {
  set({ error: null });
}

export function useOnline(): OnlineState {
  const [state, setState] = useState(current);
  useEffect(() => {
    listeners.add(setState);
    setState(current);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}

/**
 * "Gioca con amici", come in Jackbox: un tocco crea la stanza (col gioco già scelto, se c'è).
 * Uno schermo grande fa da tavolo; un telefono entra come giocatore col nome salvato.
 * Restituisce il codice della stanza, o null se il server non risponde.
 */
export async function quickRoom(gameId?: string, bigScreen = false): Promise<string | null> {
  if (current.snapshot && current.room) {
    if (gameId && current.snapshot.gameId !== gameId) send('setGame', { gameId });
    return current.snapshot.code;
  }
  if (bigScreen) return createRoom({ name: 'Schermo', role: 'screen', gameId });
  const { loadNames } = await import('./names');
  const names = await loadNames();
  return createRoom({ name: names[0]?.trim() || 'Io', role: 'player', gameId });
}
