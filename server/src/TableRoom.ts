import { Room, type Client } from '@colyseus/core';
import {
  applyMove,
  assignAvatars,
  botByName,
  botMove,
  BOT_LEVELS,
  characterById,
  CODE_ALPHABET,
  CODE_LENGTH,
  canControl,
  getGame,
  narrate,
  newSeed,
  pickBots,
  playerCounts,
  type Game,
  type BotLevel,
  type JoinOptions,
  type LastAction,
  type RoomMember,
  type RoomSeat,
  type RoomSnapshot,
  type SeatView,
} from '@giochi/engine';

const BOT_DELAY_MS = 1300;
/** Pausa minima fra due mosse del computer nei giochi di carte: la carta deve fare in tempo a viaggiare fino al tavolo. */
const MIN_BOT_PAUSE_MS = 1400;
const RECONNECT_SECONDS = 120;
/** A partita in corso gli altri stanno aspettando: chi cade ha meno tempo per tornare. */
const RECONNECT_IN_GAME_SECONDS = 60;

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
  /** Il dispositivo di ciascun presente, per riconoscere chi rientra dopo aver perso la connessione. */
  private devices = new Map<string, string>();
  private hostId = '';
  private gameId: string | null = null;
  private bots = 0;
  private botNames = pickBots(16).map((b) => b.name);
  /** Bravura di ogni maschera che gioca come computer (per nome); se manca è Normale. */
  private botLevels: Record<string, BotLevel> = {};
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
    // Il capotavola cambia la maschera o la bravura di un computer seduto al tavolo.
    this.onMessage('setBot', (client, msg: { index: number; name?: string; level?: BotLevel }) => {
      if (!this.isHost(client) || this.game) return;
      const current = this.seatedBots()[msg.index];
      if (!current) return;
      let name = current;
      if (msg.name && botByName(msg.name) && msg.name !== current) {
        const i = this.botNames.indexOf(current);
        const j = this.botNames.indexOf(msg.name);
        if (j >= 0) [this.botNames[i], this.botNames[j]] = [this.botNames[j], this.botNames[i]];
        name = msg.name;
        // La bravura resta al posto, non alla maschera.
        if (this.botLevels[current]) this.botLevels[name] = this.botLevels[current];
        delete this.botLevels[current];
      }
      if (msg.level && BOT_LEVELS.some((l) => l.id === msg.level)) this.botLevels[name] = msg.level;
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
      if (!this.isHost(client) || this.game) return;
      this.start(client);
    });
    this.onMessage('restart', (client) => {
      if (!this.isHost(client) || !this.game) return;
      // Qualcuno ha lasciato il tavolo a partita finita: con un posto vuoto non si rigioca.
      if (this.seats.some((s) => !s.bot && !s.memberId)) return this.backToLobby();
      this.state_ = this.game.setup({ players: this.seats.length, seed: newSeed() });
      this.afterChange();
    });
    this.onMessage('toLobby', (client) => {
      if (!this.isHost(client)) return;
      this.endMatch();
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
    const role = options?.role === 'screen' ? 'screen' : 'player';
    // Stesso dispositivo di chi è caduto (scheda chiusa e riaperta): è lui che torna, non un nuovo giocatore.
    const lost = this.members.find((m) => !m.connected && m.role === role && !!options?.deviceId && this.devices.get(m.id) === options.deviceId);
    if (lost) {
      const seat = this.seats.find((s) => s.memberId === lost.id);
      if (seat) seat.memberId = client.sessionId;
      if (this.hostId === lost.id) this.hostId = client.sessionId;
      this.devices.delete(lost.id);
      lost.id = client.sessionId;
      lost.connected = true;
    } else {
      const name = (options?.name ?? '').trim().slice(0, 16) || `Giocatore ${this.members.length + 1}`;
      this.members.push({ id: client.sessionId, name, role, connected: true, avatar: characterById(options?.avatar)?.id });
    }
    if (options?.deviceId) this.devices.set(client.sessionId, options.deviceId);
    if (!this.hostId) this.hostId = client.sessionId;
    this.broadcastRoom();
    this.sendView(client);
  }

  async onDrop(client: Client) {
    const m = this.member(client.sessionId);
    if (m) m.connected = false;
    this.broadcastRoom();
    this.allowReconnection(client, this.game ? RECONNECT_IN_GAME_SECONDS : RECONNECT_SECONDS);
  }

  onReconnect(client: Client) {
    const m = this.member(client.sessionId);
    // Il suo posto è già stato ripreso dallo stesso dispositivo in un'altra scheda.
    if (!m) return client.leave();
    m.connected = true;
    this.broadcastRoom();
    this.sendView(client);
  }

  onLeave(client: Client) {
    const m = this.member(client.sessionId);
    if (!m) return;
    this.devices.delete(client.sessionId);
    this.members = this.members.filter((x) => x !== m);
    if (this.hostId === client.sessionId) this.hostId = (this.members.find((x) => x.connected) ?? this.members[0])?.id ?? '';
    const seat = this.seats.find((s) => s.memberId === client.sessionId);
    if (seat && this.game && !this.game.result(this.state_)) {
      // Chi esce a partita in corso la chiude per tutti: si torna alla lobby, senza posti né computer.
      this.backToLobby();
      this.broadcast('error', { message: `${m.name} ha lasciato il tavolo: partita finita.` });
      return;
    }
    // A partita finita gli altri stanno ancora guardando il risultato: il posto resta solo vuoto.
    if (seat) seat.memberId = null;
    this.broadcastRoom();
  }

  onDispose() {
    usedCodes.delete(this.roomId);
    this.botTimer?.clear();
  }

  private endMatch() {
    this.game = null;
    this.state_ = null;
    this.lastAction = null;
    this.seats = [];
    this.botTimer?.clear();
  }

  /** Fine partita per un posto rimasto vuoto: la stanza riparte pulita. */
  private backToLobby() {
    this.endMatch();
    this.bots = 0;
    this.botLevels = {};
    this.broadcastRoom();
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
    if (text && this.game) this.lastAction = { seat, text, n: (this.lastAction?.n ?? 0) + 1 };
  }

  private afterChange() {
    this.broadcastRoom();
    if (!this.game) return;
    const game = this.game;
    const result = game.result(this.state_);
    const active = result ? [] : game.activePlayers(this.state_);
    for (const client of this.clients) this.sendView(client);
    this.botTimer?.clear();
    const bot = active.find((s) => this.seats[s]?.bot);
    // Se un posto umano deve muovere da solo (es. fine mano su un posto vuoto), muove il computer.
    if (bot !== undefined) {
      this.botTimer = this.clock.setTimeout(() => {
        if (this.game !== game) return;
        try {
          const before = this.state_;
          const move = botMove(game, this.state_, bot, this.botLevels[this.seats[bot]?.name ?? ''] ?? 'normale');
          this.state_ = applyMove(game, this.state_, bot, move);
          this.tell(before, bot, move);
        } catch (e) {
          console.error(`[${this.roomId}] mossa del computer non valida`, e);
          return;
        }
        this.afterChange();
      }, Math.max(game.meta.category === 'carte' ? MIN_BOT_PAUSE_MS : 0, game.pause?.(this.state_) ?? BOT_DELAY_MS));
    }
  }

  /** La vista del tavolo per un dispositivo: a ogni mossa e a chi entra o rientra a partita in corso. */
  private sendView(client: Client) {
    if (!this.game) return;
    const game = this.game;
    const result = game.result(this.state_);
    const active = result ? [] : game.activePlayers(this.state_);
    const seatIndex = this.seats.findIndex((s) => s.memberId === client.sessionId);
    const me = seatIndex >= 0 ? seatIndex : null;
    const msg: SeatView = { gameId: game.meta.id, view: game.view(this.state_, me), me, myTurn: me !== null && active.includes(me), names: this.seats.map((s) => s.name), avatars: assignAvatars(this.seats), active, result, lastAction: this.lastAction };
    client.send('view', msg);
  }

  private snapshot(): RoomSnapshot {
    return {
      code: this.roomId,
      hostId: this.hostId,
      gameId: this.gameId,
      bots: this.bots,
      botNames: this.seatedBots(),
      botLevels: this.seatedBots().map((n) => this.botLevels[n] ?? 'normale'),
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
