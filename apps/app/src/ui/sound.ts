import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { getSettings } from './settings';

/**
 * Effetti sonori del tavolo, sintetizzati apposta e leggeri (assets/sounds). Rispettano
 * l'impostazione "Suoni" e il tasto silenzioso del telefono; se l'audio non parte, si gioca lo stesso.
 */
const SOURCES = {
  card: require('../../assets/sounds/card.wav'),
  pick: require('../../assets/sounds/pick.wav'),
  deal: require('../../assets/sounds/deal.wav'),
  capture: require('../../assets/sounds/capture.wav'),
  scopa: require('../../assets/sounds/scopa.wav'),
  win: require('../../assets/sounds/win.wav'),
  turn: require('../../assets/sounds/turn.wav'),
  hover: require('../../assets/sounds/hover.wav'),
};

export type Sfx = keyof typeof SOURCES;

const players: Partial<Record<Sfx, AudioPlayer>> = {};
const lastAt: Partial<Record<Sfx, number>> = {};

export function sfx(name: Sfx) {
  if (!getSettings().sound) return;
  // Più carte distribuite insieme non devono diventare un rumore unico.
  const now = Date.now();
  if (now - (lastAt[name] ?? 0) < 45) return;
  lastAt[name] = now;
  try {
    const p = (players[name] ??= createAudioPlayer(SOURCES[name]));
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // Audio non disponibile (permessi del browser, dispositivo): nessun problema.
  }
}
