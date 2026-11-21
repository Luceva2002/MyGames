import { useEffect, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { BALLO_RELIGHT_WINDOW_MS, BALLO_SKIP, type BalloMove, type BalloView, type Seat } from '@giochi/engine';
import { BalloTaskCard } from './BalloTasks';
import type { BoardProps } from './common';
import { MENU_GAP } from './common';
import { SeatAvatar } from '../ui/avatars';
import { Button, T, tap } from '../ui/kit';
import { useIsTv } from '../ui/settings';
import { sfx } from '../ui/sound';
import { TableBg } from '../ui/tables';
import { colors } from '../ui/theme';

/** Il tempo che scorre: il server dice quanto manca, il telefono conta da solo fino al prossimo messaggio. */
function useCountdown(ms: number | null) {
  const [, setBeat] = useState(0);
  const base = useRef({ at: Date.now(), ms });
  if (base.current.ms !== ms) base.current = { at: Date.now(), ms };
  useEffect(() => {
    if (ms === null) return;
    const t = setInterval(() => setBeat((b) => b + 1), 250);
    return () => clearInterval(t);
  }, [ms === null]); // eslint-disable-line react-hooks/exhaustive-deps
  if (ms === null) return null;
  return Math.max(0, Math.ceil((ms - (Date.now() - base.current.at)) / 1000));
}

/** La barra della festa e il tempo: sempre in alto, uguale per tutti. */
function PartyBar({ bar, goal, seconds, label }: { bar: number; goal: number; seconds: number | null; label: string }) {
  const pct = Math.min(100, Math.round((bar / goal) * 100));
  return (
    <View style={{ gap: 3, paddingLeft: 10, paddingRight: MENU_GAP + 6, paddingTop: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <T size={14} weight="900" lines={1} style={{ flexShrink: 1 }}>
          {label}
        </T>
        {seconds !== null && (
          <T size={20} weight="900" color={colors.accent}>
            {seconds}s
          </T>
        )}
      </View>
      <View accessibilityLabel={`Barra della festa ${pct} per cento`} style={{ height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: colors.accent2 }} />
      </View>
    </View>
  );
}

/** Tutti gli invitati: chi è fuori si vede subito. */
function Guests({ names, out, traitors }: { names: string[]; out: boolean[]; traitors?: Seat[] }) {
  // Sullo schermo del tavolo si leggono da lontano.
  const size = useIsTv() ? 56 : 34;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
      {names.map((n, p) => (
        <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3, paddingLeft: 3, paddingRight: 10, borderRadius: 999, backgroundColor: 'rgba(13,14,17,0.6)', opacity: out[p] ? 0.55 : 1, maxWidth: '48%' }}>
          <SeatAvatar seat={p} name={n} size={size} />
          <T size={12} weight="800" lines={1} style={{ flexShrink: 1, textDecorationLine: out[p] ? 'line-through' : 'none' }} color={traitors?.includes(p) ? colors.accent : colors.text}>
            {n}
          </T>
          {out[p] ? <T size={12}>👻</T> : null}
        </View>
      ))}
    </View>
  );
}

function Middle({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>{children}</View>;
}

/** Il ruolo resta coperto finché si tiene premuto, così nessuno lo legge da sopra la spalla. */
function RoleCard({ view, me, names, onSeen }: { view: BalloView; me: Seat; names: string[]; onSeen: () => void }) {
  const [held, setHeld] = useState(false);
  const [peeked, setPeeked] = useState(false);
  const traitor = view.role === 'traditore';
  return (
    <Middle>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tieni premuto per scoprire il ruolo"
        onPressIn={() => {
          setHeld(true);
          setPeeked(true);
          sfx('card');
        }}
        onPressOut={() => setHeld(false)}
        style={{ width: 280, minHeight: 280, borderRadius: 26, borderWidth: 1.5, borderColor: colors.line, backgroundColor: !held ? colors.brand : traitor ? colors.accent2 : colors.accent, alignItems: 'center', justifyContent: 'center', padding: 18, gap: 10, boxShadow: `0px 6px 16px rgba(0,0,0,0.35)` }}
      >
        <T size={56}>{!held ? '🎭' : traitor ? '🗡️' : '🥂'}</T>
        {held ? (
          <>
            <T size={28} weight="900" center color={traitor ? colors.text : colors.onAccent}>
              {traitor ? 'Traditore' : 'Invitato'}
            </T>
            <T size={14} weight="800" center color={traitor ? colors.text : colors.onAccent}>
              {traitor ? 'Fingi di fare i compiti e smaschera gli invitati.' : 'Fai i compiti, riempi la barra e scopri i Traditori.'}
            </T>
            {traitor && view.traitors.length > 1 && (
              <T size={14} weight="900" center>
                Con te: {view.traitors.filter((t) => t !== me).map((t) => names[t]).join(' e ')}
              </T>
            )}
          </>
        ) : (
          <T size={18} weight="900" center>
            Tieni premuto per scoprire il tuo ruolo
          </T>
        )}
      </Pressable>
      {view.iSaw ? (
        <T size={15} weight="800" center>
          {`Aspetta gli altri: ${view.seen} di ${view.players}`}
        </T>
      ) : (
        <Button label="Ho visto" disabled={!peeked} onPress={onSeen} style={{ minWidth: 200 }} />
      )}
    </Middle>
  );
}

/** Il buio: compiti bloccati e telefono scuro, finché non torna la luce. */
function LightsOut({ ms, canRelight, onRelight }: { ms: number; canRelight: boolean; onRelight: () => void }) {
  const seconds = useCountdown(ms);
  const [pressed, setPressed] = useState(false);
  useEffect(() => {
    if (!pressed) return;
    const t = setTimeout(() => setPressed(false), BALLO_RELIGHT_WINDOW_MS);
    return () => clearTimeout(t);
  }, [pressed]);
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: '#05020F', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 20 }}>
      <T size={30} weight="900" center>
        🌑 Luci spente
      </T>
      <T size={44} weight="900" color={colors.accent}>
        {seconds}s
      </T>
      {canRelight && (
        <>
          <Button label={pressed ? 'Premuto!' : '💡 Riaccendi'} disabled={pressed} onPress={() => {
            setPressed(true);
            onRelight();
          }} style={{ minWidth: 240 }} />
          <T size={14} weight="800" center color={colors.muted}>
            {pressed ? 'Serve un altro invitato, adesso!' : 'Servono due invitati che premono insieme'}
          </T>
        </>
      )}
    </View>
  );
}

/** Cosa può fare il Traditore, oltre a fingere coi compiti. */
function TraitorActions({ view, names, me, onMove }: { view: BalloView; names: string[]; me: Seat; onMove: (m: BalloMove) => void }) {
  const [picking, setPicking] = useState(false);
  const left = useCountdown(view.killLeft) ?? 0;
  const targets = names.map((_, p) => p).filter((p) => !view.out[p] && !view.traitors.includes(p));
  useEffect(() => {
    if (left > 0) setPicking(false);
  }, [left]);
  if (view.out[me]) return null;
  if (picking) {
    return (
      <View style={{ gap: 6, padding: 8, borderRadius: 18, backgroundColor: colors.accent2, borderWidth: 1.5, borderColor: colors.line, alignSelf: 'stretch' }}>
        <T size={14} weight="900" center>
          Chi smascheri?
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
          {targets.map((p) => (
            <Button small key={p} color="#FFFDF6" label={names[p]} a11y={`Smaschera ${names[p]}`} onPress={() => {
              setPicking(false);
              onMove({ type: 'kill', target: p });
            }} />
          ))}
          <Button small kind="ghost" color={colors.text} label="Annulla" onPress={() => setPicking(false)} />
        </View>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignSelf: 'stretch' }}>
      <Button small color={colors.accent2} label={left > 0 ? `🎭 Smaschera ${left}s` : '🎭 Smaschera'} a11y="Smaschera" disabled={left > 0} style={{ flex: 1, paddingHorizontal: 4 }} onPress={() => setPicking(true)} />
      <Button small color="#FFFDF6" label="🌑 Spegni luci" a11y="Spegni le luci" disabled={view.lightsUsed} style={{ flex: 1, paddingHorizontal: 4 }} onPress={() => onMove({ type: 'lights' })} />
    </View>
  );
}

function Festa({ view, me, names, onMove }: { view: BalloView; me: Seat; names: string[]; onMove: (m: BalloMove) => void }) {
  const { width } = useWindowDimensions();
  const ghost = view.out[me];
  const traitor = view.role === 'traditore';
  const cardW = Math.min(width - 72, 360);
  return (
    <>
      {ghost ? (
        <T size={13} weight="800" center color={colors.muted}>
          👻 Sei fuori: stai zitto, ma i tuoi compiti contano ancora
        </T>
      ) : traitor ? (
        <T size={13} weight="800" center color={colors.accent}>
          🗡️ Traditore: i tuoi compiti sono finti{view.traitors.length > 1 ? ` · con te ${view.traitors.filter((t) => t !== me).map((t) => names[t]).join(', ')}` : ''}
        </T>
      ) : null}
      <Middle>
        {view.task && <BalloTaskCard key={view.task.n} task={view.task} width={cardW} onDone={() => onMove({ type: 'task', n: view.task!.n })} />}
      </Middle>
      <View style={{ gap: 6 }}>
        {traitor && <TraitorActions view={view} names={names} me={me} onMove={onMove} />}
        {!ghost && !view.meetingUsed && <Button small color={colors.accent} label="📣 Riunione!" onPress={() => onMove({ type: 'meeting' })} />}
      </View>
    </>
  );
}

function Discussione({ view, me, names, onMove }: { view: BalloView; me: Seat | null; names: string[]; onMove: (m: BalloMove) => void }) {
  const victims = view.meeting?.victims ?? [];
  const caller = view.meeting?.caller ?? null;
  const alive = view.out.filter((o) => !o).length;
  return (
    <Middle>
      <T size={24} weight="900" center>
        {caller !== null ? `📣 Riunione di ${names[caller]}` : '⏰ La festa si ferma'}
      </T>
      <T size={17} weight="800" center color={victims.length ? colors.accent : colors.text}>
        {victims.length ? `Smascherati: ${victims.map((v) => names[v]).join(', ')}` : 'Nessuno è stato smascherato'}
      </T>
      <T size={14} center color={colors.muted}>
        Discutete a voce. Chi è fuori sta zitto.
      </T>
      <Guests names={names} out={view.out} />
      {me !== null && !view.out[me] && (view.iReady ? (
        <T size={15} weight="800" center>{`Pronti a votare: ${view.ready} di ${alive}`}</T>
      ) : (
        <Button label="Pronto a votare" style={{ minWidth: 240 }} onPress={() => onMove({ type: 'ready' })} />
      ))}
    </Middle>
  );
}

function Voto({ view, me, names, onMove }: { view: BalloView; me: Seat | null; names: string[]; onMove: (m: BalloMove) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const alive = names.map((_, p) => p).filter((p) => !view.out[p]);
  const canVote = me !== null && !view.out[me] && view.myVote === null;
  if (!canVote) {
    return (
      <Middle>
        <T size={24} weight="900" center>
          🗳️ Si vota
        </T>
        <T size={17} weight="800" center>{`Hanno votato ${view.voted} di ${alive.length}`}</T>
        <Guests names={names} out={view.out} />
      </Middle>
    );
  }
  return (
    <Middle>
      <T size={22} weight="900" center>
        🗳️ Chi esce dalla festa?
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
        {alive.map((p) => (
          <Pressable
            key={p}
            accessibilityRole="radio"
            accessibilityState={{ selected: sel === p }}
            accessibilityLabel={`Vota ${names[p]}`}
            onPress={() => {
              tap();
              setSel(p);
            }}
            style={{ width: '48%', minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 5, borderRadius: 16, borderWidth: 1.5, borderColor: sel === p ? colors.accent : colors.line, backgroundColor: sel === p ? colors.surface2 : colors.surface }}
          >
            <SeatAvatar seat={p} name={names[p]} size={38} />
            <T size={13} weight="800" lines={1} style={{ flexShrink: 1 }}>
              {p === me ? 'Tu' : names[p]}
            </T>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, alignSelf: 'stretch' }}>
        <Button small kind="ghost" color={colors.text} label="Salta" style={{ flex: 1 }} onPress={() => onMove({ type: 'vote', target: BALLO_SKIP })} />
        <Button small label="Vota" disabled={sel === null} style={{ flex: 1 }} onPress={() => sel !== null && onMove({ type: 'vote', target: sel })} />
      </View>
    </Middle>
  );
}

function Esito({ view, names }: { view: BalloView; names: string[] }) {
  const o = view.outcome;
  if (!o) return null;
  return (
    <Middle>
      <T size={26} weight="900" center color={o.traitor ? colors.accent : colors.text}>
        {o.seat === null ? 'Non esce nessuno' : o.traitor ? `${names[o.seat]} era un Traditore!` : `${names[o.seat]} non era un Traditore`}
      </T>
      <View style={{ gap: 3 }}>
        {o.tally.map((t) => (
          <T key={t.target} size={15} weight="800" center color={colors.muted}>
            {`${t.target === BALLO_SKIP ? 'Saltato' : names[t.target]}: ${t.votes} ${t.votes === 1 ? 'voto' : 'voti'}`}
          </T>
        ))}
      </View>
      <Guests names={names} out={view.out} />
    </Middle>
  );
}

const LABELS: Record<BalloView['phase'], string> = { roles: 'Il Ballo Mascherato', festa: 'La festa', discussione: 'Riunione', voto: 'Voto segreto', esito: 'Esito', fine: 'Fine della festa' };

export function BalloBoard({ view, me, names, onMove }: BoardProps<BalloView, BalloMove>) {
  const seconds = useCountdown(view.left);
  // La vittima lo scopre subito, una volta sola; chi esce col voto lo sa già dall'esito.
  const [understood, setUnderstood] = useState(false);
  const out = me !== null && view.out[me];
  useEffect(() => {
    if (out && view.phase !== 'festa') setUnderstood(true);
    if (!out) setUnderstood(false);
  }, [out, view.phase]);
  const dark = view.phase === 'festa' && view.lightsLeft > 0;

  let body;
  if (view.phase === 'roles') {
    body = me !== null ? (
      <RoleCard view={view} me={me} names={names} onSeen={() => onMove({ type: 'seen' })} />
    ) : (
      <Middle>
        <T size={22} weight="900" center>{`Ognuno guarda il suo ruolo: ${view.seen} di ${view.players}`}</T>
        <Guests names={names} out={view.out} />
      </Middle>
    );
  } else if (view.phase === 'festa') {
    body = me !== null ? (
      <Festa view={view} me={me} names={names} onMove={onMove} />
    ) : (
      <Middle>
        <T size={22} weight="900" center>
          La festa è in corso
        </T>
        <Guests names={names} out={view.out} />
      </Middle>
    );
  } else if (view.phase === 'discussione') body = <Discussione view={view} me={me} names={names} onMove={onMove} />;
  else if (view.phase === 'voto') body = <Voto view={view} me={me} names={names} onMove={onMove} />;
  else if (view.phase === 'esito') body = <Esito view={view} names={names} />;
  else {
    body = (
      <Middle>
        <T size={24} weight="900" center>
          {view.reason}
        </T>
        <T size={16} weight="800" center color={colors.accent}>
          {`${view.traitors.length > 1 ? 'I Traditori erano' : 'Il Traditore era'} ${view.traitors.map((t) => names[t]).join(' e ')}`}
        </T>
        <Guests names={names} out={view.out} traitors={view.traitors} />
      </Middle>
    );
  }
  return (
    <TableBg table="teal">
      <View style={{ flex: 1, paddingHorizontal: 4, paddingTop: 4, paddingBottom: 10, gap: 6 }}>
        <PartyBar bar={view.bar} goal={view.barGoal} seconds={seconds} label={LABELS[view.phase]} />
        {body}
      </View>
      {dark && <LightsOut ms={view.lightsLeft} canRelight={me !== null && !out} onRelight={() => onMove({ type: 'relight' })} />}
      {out && !understood && view.phase === 'festa' && (
        <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 30, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 22, gap: 16 }}>
          <T size={56}>👻</T>
          <T size={28} weight="900" center>
            Sei stato smascherato!
          </T>
          <T size={16} weight="800" center>
            Da adesso stai zitto, senza far capire niente. I tuoi compiti contano ancora.
          </T>
          <Button label="Ho capito" style={{ minWidth: 220 }} onPress={() => setUnderstood(true)} />
        </View>
      )}
    </TableBg>
  );
}
