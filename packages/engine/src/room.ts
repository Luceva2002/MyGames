import type { GameResult, Seat } from './core/types';

/** Messaggi scambiati fra app e server delle stanze. */

export type MemberRole = 'screen' | 'player';

export interface RoomMember {
  id: string;
  name: string;
  role: MemberRole;
  connected: boolean;
  /** Id della maschera scelta come avatar. */
  avatar?: string;
}

export interface RoomSeat {
  name: string;
  bot: boolean;
  memberId: string | null;
  avatar?: string;
}

export interface RoomSnapshot {
  code: string;
  hostId: string;
  gameId: string | null;
  bots: number;
  /** Le maschere che siederanno al tavolo come computer, già scelte per mostrarle in lobby. */
  botNames: string[];
  phase: 'lobby' | 'playing';
  members: RoomMember[];
  seats: RoomSeat[];
}

/** Quello che ogni dispositivo riceve durante la partita: solo la sua vista. */
export interface SeatView {
  gameId: string;
  view: unknown;
  me: Seat | null;
  myTurn: boolean;
  names: string[];
  /** Maschera di ogni posto (null: nessuna scelta). */
  avatars?: (string | null)[];
  active: Seat[];
  result: GameResult | null;
}

export interface JoinOptions {
  name: string;
  role: MemberRole;
  avatar?: string;
}

export const ROOM_NAME = 'tavolo';
export const DEFAULT_PORT = 2567;

/** Lettere senza ambiguità (niente I/O/0/1), facili da dettare a voce. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 4;

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z]/g, '').slice(0, CODE_LENGTH);
}

/** Chi può scegliere il gioco e avviare: il capotavola e, se il capotavola è uno schermo, il primo giocatore. */
export function canControl(snapshot: Pick<RoomSnapshot, 'hostId' | 'members'>, memberId: string): boolean {
  if (memberId === snapshot.hostId) return true;
  const host = snapshot.members.find((m) => m.id === snapshot.hostId);
  const firstPlayer = snapshot.members.find((m) => m.role === 'player');
  return host?.role === 'screen' && firstPlayer?.id === memberId;
}
