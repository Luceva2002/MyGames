/**
 * Prova end-to-end: due "telefoni" entrano nella stanza, il primo sceglie il gioco e avvia,
 * poi entrambi giocano usando la propria vista finché la partita finisce.
 */
import { Client } from '@colyseus/sdk';
import { ROOM_NAME, type RoomSnapshot, type SeatView } from '@giochi/engine';

const url = process.env.SERVER_URL ?? 'ws://localhost:2567';
const gameId = process.argv[2] ?? 'briscola';
const bots = Number(process.argv[3] ?? 1);

const host = await new Client(url).create(ROOM_NAME, { name: 'Luca', role: 'player' });
const code = host.roomId;
const guest = await new Client(url).joinById(code, { name: 'Marco', role: 'player' });
const tv = await new Client(url).joinById(code, { name: 'TV', role: 'screen' });
console.log(`stanza ${code}`);

let finished = 0;
let tvSawCards = false;
const done = new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('timeout')), 120000);
  for (const [label, room] of [['Luca', host], ['Marco', guest], ['TV', tv]] as const) {
    if (room !== host) room.onMessage('room', () => {});
    room.onMessage('error', (e: { message: string }) => reject(new Error(`${label}: ${e.message}`)));
    room.onMessage('view', (v: SeatView) => {
      if (label === 'TV' && Array.isArray((v.view as { hand?: unknown[] }).hand) && (v.view as { hand: unknown[] }).hand.length) tvSawCards = true;
      if (v.result) {
        if (++finished === 3) {
          clearTimeout(timeout);
          console.log(`fine: ${v.result.summary}, vincitori ${v.result.winners.map((w) => v.names[w]).join(', ') || 'nessuno'}`);
          resolve();
        }
        return;
      }
      if (!v.myTurn || v.me === null) return;
      // Il "telefono" vede solo la sua vista: gioca la prima mossa valida che riesce a ricavarne.
      const view = v.view as { hand?: { id: string }[]; playable?: string[]; phase?: string };
      let move: unknown;
      if (view.phase === 'handEnd') move = { type: 'next' };
      else if (gameId === 'briscola') move = { card: view.hand![0].id };
      else if (gameId === 'tresette') move = { type: 'play', card: view.playable![0] };
      else if (gameId === 'tris') move = { cell: (v.view as { board: (number | null)[] }).board.indexOf(null) };
      else throw new Error('gioco non gestito nel test');
      setTimeout(() => room.send('move', { move }), 5);
    });
  }
});

let snapshot: RoomSnapshot | null = null;
host.onMessage('room', (s: RoomSnapshot) => (snapshot = s));
host.send('setGame', { gameId });
host.send('setBots', { count: bots });
await new Promise((r) => setTimeout(r, 300));
host.send('start');
await done;
console.log(`posti: ${snapshot!.seats.map((s) => s.name).join(', ')}; la TV ha visto carte: ${tvSawCards}`);
await Promise.all([host.leave(), guest.leave(), tv.leave()]);
process.exit(tvSawCards ? 1 : 0);
