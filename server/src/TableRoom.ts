import { Room, type Client } from '@colyseus/core';
import {
  applyMove,
  assignAvatars,
  botByName,
  botMove,
  characterById,
  CODE_ALPHABET,
  CODE_LENGTH,
  canControl,
  getGame,
  narrate,
  narrateCards,
  newSeed,
  pickBots,
  playerCounts,
  type Game,
  type JoinOptions,
  type LastAction,
  type RoomMember,
  type RoomSeat,
  type RoomSnapshot,
  type SeatView,
} from '@giochi/engine';

const BOT_DELAY_MS = 1300;
const RECONNECT_SECONDS = 120;

const usedCodes = new Set<string>();

function newCode(): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      return code;
    }
  }
}

/**
 * Una stanza: un tavolo con un codice di 4 lettere. Le regole girano qui e ogni dispositivo
 * riceve solo la propria vista, così le carte degli altri non arrivano mai sul tuo telefono.
 */
export class TableRoom extends Room {
  maxClients = 16;
  private members: RoomMember[] = [];
  private hostId = '';
  private gameId: string | null = null;
  private bots = 0;
  private botNames = pickBots(16).map((b) => b.name);
  /** I computer al tavolo, senza le maschere già scelte da chi gioca. */
  private seatedBots() {
    const taken = new Set(this.members.map((m) => m.avatar).filter(Boolean));
    return this.botNames.filter((n) => !taken.has(botByName(n)?.id)).slice(0, this.bots);
  }
  private seats: RoomSeat[] = [];
  private game: Game | null = null;
  private state_: unknown = null;
  private botTimer: { clear(): void } | null = null;

  onCreate(options: { gameId?: string }) {
    this.roomId = newCode();
    this.autoDispose = true;
    if (options.gameId && getGame(options.gameId)) this.gameId = options.gameId;

    this.onMessage('setGame', (client, msg: { gameId: string }) => {
      if (!this.isHost(client) || this.game) return;
      if (!getGame(msg.gameId)) return this.fail(client, 'Gioco sconosciuto.');
      this.gameId = msg.gameId;
      this.bots = 0;
      this.broadcastRoom();
    });
    this.onMessage('setBots', (client, msg: { count: number }) => {
      if (!this.isHost(client) || this.game) return;
      this.bots = Math.max(0, Math.min(9, Math.floor(msg.count)));
      this.broadcastRoom();
    });
    this.onMessage('avatar', (client, msg: { avatar: string }) => {
      const m = this.member(client.sessionId);
      if (m && characterById(msg.avatar)) m.avatar = msg.avatar;
      this.broadcastRoom();
    });
    this.onMessage('rename', (client, msg: { name: string }) => {
      const m = this.member(client.sessionId);
      if (m && msg.name?.trim()) m.name = msg.name.trim().slice(0, 16);
      this.broadcastRoom();
    });
    this.onMessage('start', (client) => {
      if (!this.isHost(client)) return;
      this.start(client);
    });
    this.onMessage('restart', (client) => {
      if (!this.isHost(client) || !this.game) return;
      this.state_ = this.game.setup({ players: this.seats.length, seed: newSeed() });
      this.afterChange();
    });
    this.onMessage('toLobby', (client) => {
      if (!this.isHost(client)) return;
      this.game = null;
      this.state_ = null;
      this.lastAction = null;
      this.seats = [];
      this.botTimer?.clear();
      this.broadcastRoom();
    });
    this.onMessage('move', (client, msg: { move: unknown }) => {
      if (!this.game) return;
      const seat = this.seats.findIndex((s) => s.memberId === client.sessionId);
      if (seat < 0) return this.fail(client, 'Stai guardando: non hai un posto al tavolo.');
      try {
        const before = this.state_;
        this.state_ = applyMove(this.game, this.state_, seat, msg.move);
        this.tell(before, seat, msg.move);
        this.afterChange();
      } catch (e) {
        this.fail(client, (e as Error).message);
      }
    });
  }

  onJoin(client: Client, options: JoinOptions) {
    const name = (options?.name ?? '').trim().slice(0, 16) || `Giocatore ${this.members.length + 1}`;
    const avatar = characterById(options?.avatar)?.id;
    this.members.push({ id: client.sessionId, name, role: options?.role === 'screen' ? 'screen' : 'player', connected: true, avatar });
    if (!this.hostId) this.hostId = client.sessionId;
    this.broadcastRoom();
  }

  async onDrop(client: Client) {
    const m = this.member(client.sessionId);
    if (m) m.connected = false;
    this.broadcastRoom();
    this.allowReconnection(client, RECONNECT_SECONDS);
  }

  onReconnect(client: Client) {
    const m = this.member(client.sessionId);
    if (m) m.connected = true;
    this.broadcastRoom();
  }

  onLeave(client: Client) {
    const seat = this.seats.find((s) => s.memberId === client.sessionId);
    if (seat) {
      // Chi se ne va durante la partita viene sostituito dal computer, così il tavolo non si blocca.
      seat.bot = true;
      seat.memberId = null;
      seat.name = `${seat.name} 🤖`;
    }
    this.members = this.members.filter((m) => m.id !== client.sessionId);
    if (this.hostId === client.sessionId) this.hostId = (this.members.find((m) => m.connected) ?? this.members[0])?.id ?? '';
    if (this.game) this.afterChange();
    else this.broadcastRoom();
  }

  onDispose() {
    usedCodes.delete(this.roomId);
    this.botTimer?.clear();
  }

  private start(client: Client) {
    const game = this.gameId ? getGame(this.gameId) : undefined;
    if (!game) return this.fail(client, 'Scegli prima un gioco.');
    const players = this.members.filter((m) => m.role === 'player');
    const total = players.length + this.bots;
    const allowed = playerCounts(game.meta);
    if (!allowed.includes(total)) return this.fail(client, `${game.meta.name} si gioca in ${allowed.join(', ')}.`);
    this.lastAction = null;
    this.seats = [
      ...players.map((m): RoomSeat => ({ name: m.name, bot: false, memberId: m.id, avatar: m.avatar })),
      ...this.seatedBots().map((name): RoomSeat => ({ name, bot: true, memberId: null, avatar: botByName(name)?.id })),
    ];
    this.game = game;
    this.state_ = game.setup({ players: total, seed: newSeed() });
    this.afterChange();
  }

  /** Dopo ogni mossa: manda a ciascuno la sua vista e, se tocca a un computer, lo fa muovere. */
  /** L'ultima mossa raccontata, mandata a tutti insieme alla vista. */
  private lastAction: LastAction | null = null;
  private tell(before: unknown, seat: number, move: unknown) {
    const text = this.game ? narrate(this.game.meta.id, before, this.state_, seat, move) : null;
    if (text && this.game) this.lastAction = { seat, text, n: (this.lastAction?.n ?? 0) + 1, cards: narrateCards(this.game.meta.id, before, move) };
  }

  private afterChange() {
    this.broadcastRoom();
    if (!this.game) return;
    const game = this.game;
    const result = game.result(this.state_);
    const active = result ? [] : game.activePlayers(this.state_);
    const names = this.seats.map((s) => s.name);
    const avatars = assignAvatars(this.seats);
    for (const client of this.clients) {
      const seatIndex = this.seats.findIndex((s) => s.memberId === client.sessionId);
      const me = seatIndex >= 0 ? seatIndex : null;
      const msg: SeatView = { gameId: game.meta.id, view: game.view(this.state_, me), me, myTurn: me !== null && active.includes(me), names, avatars, active, result, lastAction: this.lastAction };
      client.send('view', msg);
    }
    this.botTimer?.clear();
    const bot = active.find((s) => this.seats[s]?.bot);
    // Se un posto umano deve muovere da solo (es. fine mano su un posto vuoto), muove il computer.
    if (bot !== undefined) {
      this.botTimer = this.clock.setTimeout(() => {
        if (this.game !== game) return;
        try {
          const before = this.state_;
          const move = botMove(game, this.state_, bot);
          this.state_ = applyMove(game, this.state_, bot, move);
          this.tell(before, bot, move);
        } catch (e) {
          console.error(`[${this.roomId}] mossa del computer non valida`, e);
          return;
        }
        this.afterChange();
      }, game.pause?.(this.state_) ?? BOT_DELAY_MS);
    }
  }

  private snapshot(): RoomSnapshot {
    return {
      code: this.roomId,
      hostId: this.hostId,
      gameId: this.gameId,
      bots: this.bots,
      botNames: this.seatedBots(),
      phase: this.game ? 'playing' : 'lobby',
      members: this.members,
      seats: this.seats,
    };
  }

  private broadcastRoom() {
    this.broadcast('room', this.snapshot());
  }

  private member(id: string) {
    return this.members.find((m) => m.id === id);
  }

  /** Comanda il capotavola; se il capotavola è lo schermo, anche il primo giocatore (come il VIP di Jackbox). */
  private isHost(client: Client) {
    return canControl(this.snapshot(), client.sessionId);
  }

  private fail(client: Client, message: string) {
    client.send('error', { message });
  }
}
