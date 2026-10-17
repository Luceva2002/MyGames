import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Client, type Room } from '@colyseus/sdk';
import { DEFAULT_PORT, ROOM_NAME, type JoinOptions, type RoomSnapshot, type SeatView } from '@giochi/engine';

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

/** Indirizzo da far aprire agli altri per entrare nella stanza. */
export function joinUrl(code: string): string | null {
  const fixed = process.env.EXPO_PUBLIC_WEB_URL;
  if (fixed) return `${fixed.replace(/\/$/, '')}/room/join?code=${code}`;
  if (Platform.OS === 'web' && typeof location !== 'undefined') return `${location.origin}/room/join?code=${code}`;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:8081/room/join?code=${code}` : null;
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

function attach(room: Room) {
  set({ room, status: 'connected', error: null, snapshot: null, seatView: null });
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
}

function friendly(e: unknown): string {
  const msg = String((e as Error)?.message ?? e);
  if (/not found|no rooms found|invalid/i.test(msg)) return 'Nessuna stanza con questo codice.';
  if (/ECONNREFUSED|Failed to fetch|Network|network/i.test(msg)) return 'Server delle stanze non raggiungibile. È acceso?';
  return msg;
}

export async function createRoom(options: JoinOptions & { gameId?: string }) {
  set({ status: 'connecting', error: null });
  try {
    const room = await new Client(serverUrl()).create(ROOM_NAME, options);
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
    const room = await new Client(serverUrl()).joinById(code, options);
    attach(room);
    return room.roomId;
  } catch (e) {
    set({ status: 'idle', error: friendly(e) });
    return null;
  }
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
