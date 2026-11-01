/**
 * Prova end-to-end dell'uscita dalla stanza: chi esce chiude la partita per tutti e torna la lobby,
 * chi perde la connessione e rientra dallo stesso dispositivo ritrova il suo posto, senza doppioni.
 * Serve il server acceso: SERVER_URL=ws://localhost:2567 npx tsx test/uscita.ts
 */
import { Client, type Room } from '@colyseus/sdk';
import { ROOM_NAME, type RoomSnapshot, type SeatView } from '@giochi/engine';

const url = process.env.SERVER_URL ?? 'ws://localhost:2567';
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${label}${ok || detail === undefined ? '' : ` (${JSON.stringify(detail)})`}`);
}

interface Phone {
  room: Room;
  snap: () => RoomSnapshot;
  view: () => SeatView | null;
  errors: string[];
}
function watch(room: Room): Phone {
  let snap = null as RoomSnapshot | null;
  let view = null as SeatView | null;
  const errors: string[] = [];
  room.onMessage('room', (s: RoomSnapshot) => {
    snap = s;
    if (s.phase === 'lobby') view = null;
  });
  room.onMessage('view', (v: SeatView) => (view = v));
  room.onMessage('error', (e: { message: string }) => errors.push(e.message));
  return { room, snap: () => snap!, view: () => view, errors };
}
const join = async (code: string, name: string, deviceId: string) => watch(await new Client(url).joinById(code, { name, role: 'player', deviceId }));
/** Taglia il filo come una scheda chiusa, senza dire al server che si esce. */
const cut = (p: Phone) => {
  p.room.reconnection.maxRetries = 0;
  p.room.connection.transport.close(3000);
};

async function table(bots = 1) {
  const a = watch(await new Client(url).create(ROOM_NAME, { name: 'Anna', role: 'player', deviceId: 'dev-a', gameId: 'briscola' }));
  const b = await join(a.room.roomId, 'Bruno', 'dev-b');
  a.room.send('setBots', { count: bots });
  await wait();
  a.room.send('start');
  await wait();
  return { a, b };
}

console.log('— Chi esce di proposito');
{
  const { a, b } = await table();
  check('la partita è partita', a.snap().phase === 'playing' && !!a.view());
  await b.room.leave();
  await wait();
  check('la partita finisce per chi resta', a.snap().phase === 'lobby', a.snap().phase);
  check('niente posti rimasti', a.snap().seats.length === 0, a.snap().seats);
  check('niente computer rimasti', a.snap().bots === 0, a.snap().bots);
  check('chi resta sa perché', a.errors.some((e) => e.includes('Bruno')), a.errors);
  const back = await join(a.room.roomId, 'Bruno', 'dev-b');
  await wait();
  check('rientrando è presente una volta sola', back.snap().members.filter((m) => m.name === 'Bruno').length === 1, back.snap().members);
  check('rientrando trova la lobby', back.snap().phase === 'lobby');
  await Promise.all([a.room.leave(), back.room.leave()]);
}

console.log('— Chi esce a partita finita');
{
  const a = watch(await new Client(url).create(ROOM_NAME, { name: 'Anna', role: 'player', deviceId: 'dev-a', gameId: 'tris' }));
  const b = await join(a.room.roomId, 'Bruno', 'dev-b');
  await wait();
  a.room.send('start');
  await wait();
  // Tris: il primo a muovere vince sulla riga in alto.
  const first = a.view()!.myTurn ? a : b;
  const second = first === a ? b : a;
  for (const [p, cell] of [[first, 0], [second, 3], [first, 1], [second, 4], [first, 2]] as const) {
    p.room.send('move', { move: { cell } });
    await wait(80);
  }
  check('la partita è finita', !!a.view()?.result);
  await second.room.leave();
  await wait();
  check('chi resta vede ancora il risultato', first.snap().phase === 'playing' && !!first.view()?.result);
  first.room.send('restart');
  await wait();
  check('la rivincita senza l\'altro riporta alla lobby', first.snap().phase === 'lobby', first.snap().phase);
  await first.room.leave();
}

console.log('— Chi perde la connessione e rientra dallo stesso dispositivo');
{
  const { a, b } = await table();
  const code = a.room.roomId;
  const seatBefore = a.snap().seats.findIndex((s) => s.name === 'Bruno');
  cut(b);
  await wait(400);
  check('la partita aspetta', a.snap().phase === 'playing');
  check('gli altri vedono che manca', a.snap().members.find((m) => m.name === 'Bruno')?.connected === false, a.snap().members);
  const back = await join(code, 'Bruno', 'dev-b');
  await wait();
  check('nessun doppione', back.snap().members.filter((m) => m.name === 'Bruno').length === 1, back.snap().members);
  check('torna connesso', back.snap().members.find((m) => m.name === 'Bruno')?.connected === true);
  check('ritrova il suo posto', back.view()?.me === seatBefore, back.view()?.me);
  check('riceve subito il tavolo', !!back.view());
  await Promise.all([a.room.leave().catch(() => {}), back.room.leave().catch(() => {})]);
}

console.log('— Chi ricarica la pagina (gettone di rientro)');
{
  const { a, b } = await table();
  const token = b.room.reconnectionToken;
  cut(b);
  await wait(400);
  const back = watch(await new Client(url).reconnect(token));
  await wait();
  check('riceve subito il tavolo', !!back.view(), back.view());
  check('resta uno solo', a.snap().members.filter((m) => m.name === 'Bruno').length === 1);
  await Promise.all([a.room.leave().catch(() => {}), back.room.leave().catch(() => {})]);
}

console.log('— Due schede dello stesso browser, entrambe collegate');
{
  const a = watch(await new Client(url).create(ROOM_NAME, { name: 'Anna', role: 'player', deviceId: 'stesso' }));
  const b = await join(a.room.roomId, 'Bruno', 'stesso');
  await wait();
  check('sono due giocatori distinti', a.snap().members.length === 2, a.snap().members);
  await Promise.all([a.room.leave(), b.room.leave()]);
}

console.log(failed ? `\n${failed} prove fallite` : '\nTutto a posto');
process.exit(failed ? 1 : 0);
