import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { GameMeta, GameResult, LastAction, Seat } from '@giochi/engine';
import { BOARDS } from './registry';
import { GAME_ART } from '../ui/art';
import { BotFigure, SeatAvatar, SeatAvatars } from '../ui/avatars';
import { botByName } from '@giochi/engine';
import { Button, Confirm, focusRing, PlayerTag, Row, Sheet, SheetOption, T, tap } from '../ui/kit';
import { DragProvider } from '../ui/drag';
import { CardZoomLayer } from '../ui/cards';
import { AnchorProvider, PopIn } from '../ui/motion';
import { sfx } from '../ui/sound';
import { setSettings, TvContext, useSettings } from '../ui/settings';
import { colors, MIN_TOUCH, radius, seatColor } from '../ui/theme';

/**
 * Guscio comune a ogni partita (P-SHELL-3): il tavolo a tutta altezza, il bottone del menu in alto
 * a destra (regole, suoni, rivincita, uscita confermata), la striscia con l'ultima mossa degli altri;
 * regole, errori, attesa di rete e risultati.
 */
export function GameFrame({ meta, view, me, names, avatars, myTurn, active, onMove, result, error, onExit, onRestart, onChangeGame, overlay, roomCode, tv, pending, lastAction }: {
  meta: GameMeta;
  view: unknown;
  me: Seat | null;
  names: string[];
  /** Maschera di ogni posto, per avatar e punteggi. */
  avatars?: (string | null)[];
  myTurn: boolean;
  /** Chi deve muovere adesso, per la barra di stato (V-ST-1). */
  active: Seat[];
  onMove: (m: unknown) => void;
  result: GameResult | null;
  /** L'ultima mossa raccontata: si vede in una striscia sotto la barra, se l'ha fatta un altro. */
  lastAction?: LastAction | null;
  error: string | null;
  onExit: () => void;
  onRestart?: () => void;
  /** Solo per chi comanda la stanza: si torna alla scelta del gioco. */
  onChangeGame?: () => void;
  overlay?: ReactNode;
  /** Il codice della stanza, se si gioca online. */
  roomCode?: string;
  /** Schermo condiviso: testi grandi, margini TV, niente carte segrete. */
  tv?: boolean;
  /** Mossa inviata al server e non ancora confermata (V-FB-2). */
  pending?: boolean;
}) {
  const Board = BOARDS[meta.id];
  const [rules, setRules] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // A fine partita il tavolo resta visibile qualche istante: si vede l'ultima mossa (la presa,
  // la freccetta, la biglia in buca) prima che arrivi il riepilogo con chi ha vinto.
  const [settled, setSettled] = useState(false);
  // Il risultato può essere un oggetto nuovo a ogni giro: conta solo se cambia davvero.
  const resultKey = result ? JSON.stringify(result) : null;
  useEffect(() => {
    setDismissed(false);
    setSettled(false);
    if (!result) return;
    const t = setTimeout(() => setSettled(true), 2200);
    return () => clearTimeout(t);
  }, [resultKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Un "ding" quando tocca a te (non all'apertura della partita) e la fanfara se vinci.
  const started = useRef(false);
  useEffect(() => {
    if (myTurn && started.current && !result) sfx('turn');
    started.current = true;
  }, [myTurn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (result && me !== null && result.winners.includes(me)) sfx('win');
  }, [resultKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TvContext.Provider value={!!tv}>
    <SeatAvatars.Provider value={avatars ?? []}>
      <AnchorProvider>
      <View style={[{ flex: 1 }, tv && styles.tvSafe]}>
        {tv && !result && active.length > 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <TurnPill active={active} names={names} me={me} myTurn={myTurn} />
          </View>
        )}
        <View style={{ flex: 1 }} pointerEvents={pending ? 'none' : 'auto'}>
          <CardZoomLayer>
          <DragProvider>
            {Board ? <Board view={view} me={me} names={names} myTurn={myTurn && !pending} onMove={onMove} /> : <T>Interfaccia non disponibile.</T>}
          </DragProvider>
          </CardZoomLayer>
          <ActionStrip action={lastAction ?? null} me={me} names={names} low={meta.category !== 'carte'} />
        </View>
        <GameMenu meta={meta} roomCode={roomCode} onRules={() => setRules(true)} onRestart={onRestart && !result ? () => setRestarting(true) : undefined} onChangeGame={onChangeGame} onExit={() => setLeaving(true)} />
        {pending && (
          <View style={styles.pending} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.onAccent} />
            <T size={14} weight="800" color={colors.onAccent}>
              Invio…
            </T>
          </View>
        )}
        {error && (
          <View style={styles.toast} pointerEvents="none" accessibilityLiveRegion="assertive">
            <T weight="800" color={colors.onAccent} center>
              ⚠ {error}
            </T>
          </View>
        )}
        {overlay}
        {result && !settled && (
          <View pointerEvents="none" style={styles.endWrap}>
            <PopIn>
              <View style={styles.endSticker}>
                <T size={26} weight="900" color="#fff" center>
                  {me !== null && result.winners.includes(me) ? '🏆 Hai vinto!' : 'Partita finita!'}
                </T>
              </View>
            </PopIn>
          </View>
        )}
        {result && settled && dismissed && (
          <View style={styles.endBar}>
            {onRestart && <Button small label="Rivincita" icon="↻" onPress={onRestart} />}
            <Button small kind="ghost" color={colors.text} label="Risultato" onPress={() => setDismissed(false)} />
            <Button small kind="ghost" color={colors.muted} label="Esci" onPress={onExit} />
          </View>
        )}
        {result && settled && !dismissed && (
          <View style={styles.cover}>
            <View style={styles.card}>
              {result.winners.some((w) => botByName(names[w])) ? (
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                  {result.winners.filter((w) => botByName(names[w])).slice(0, 3).map((w) => (
                    <BotFigure key={w} name={names[w]} height={150} />
                  ))}
                </View>
              ) : (
                GAME_ART[meta.id] && <Image source={GAME_ART[meta.id]} style={styles.resultArt} accessibilityIgnoresInvertColors />
              )}
              <T size={28} weight="900" center>
                {result.winners.length === 0
                  ? '🤝 Pareggio'
                  : me !== null && result.winners.includes(me)
                    ? '🏆 Hai vinto!'
                    : `🎉 ${result.winners.map((w) => names[w]).join(' e ')} ${result.winners.length > 1 ? 'vincono' : 'vince'}!`}
              </T>
              <T color={colors.muted} center>
                {result.summary}
              </T>
              {result.scores && result.scores.length === names.length && (
                <View style={{ gap: 8 }}>
                  {names
                    .map((n, i) => ({ n, i, s: result.scores![i] }))
                    .sort((a, b) => (result.lowWins ? a.s - b.s : b.s - a.s))
                    .map(({ n, i, s }) => (
                      <Row key={i} gap={8}>
                        <View style={{ flex: 1 }}>
                          <PlayerTag seat={i} name={n} suffix={result.winners.includes(i) ? '  🏆' : ''} />
                        </View>
                        <T size={20} weight="900">
                          {s}
                        </T>
                      </Row>
                    ))}
                </View>
              )}
              {onRestart && <Button label="Rivincita" icon="↻" onPress={onRestart} />}
              <Button label="Guarda il tavolo" kind="ghost" color={colors.muted} small onPress={() => setDismissed(true)} />
              <Button label="Torna ai giochi" kind="ghost" color={colors.text} onPress={onExit} />
            </View>
          </View>
        )}
        <Modal visible={rules} transparent animationType="fade" onRequestClose={() => setRules(false)}>
          <View style={styles.cover}>
            <View style={styles.card} accessibilityViewIsModal>
              <T size={22} weight="900">
                Come si gioca a {meta.name}
              </T>
              <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 12 }}>
                {meta.rules.map((r, i) => (
                  <Row key={i} gap={10} style={{ alignItems: 'flex-start' }}>
                    <T weight="900" color={meta.color}>
                      {i + 1}.
                    </T>
                    <T style={{ flex: 1, lineHeight: 24 }}>{r}</T>
                  </Row>
                ))}
              </ScrollView>
              <Button label="Ho capito" onPress={() => setRules(false)} />
            </View>
          </View>
        </Modal>
        <Confirm
          visible={leaving}
          title="Vuoi uscire dalla partita?"
          message={tv ? 'La stanza resta aperta per gli altri.' : roomCode ? 'La partita finisce per tutti e si torna alla stanza.' : 'La partita in corso andrà persa.'}
          confirmLabel="Esci"
          onCancel={() => setLeaving(false)}
          onConfirm={() => {
            setLeaving(false);
            onExit();
          }}
        />
        {onRestart && (
          <Confirm
            visible={restarting}
            title="Vuoi ricominciare?"
            message="La partita in corso andrà persa."
            confirmLabel="Ricomincia"
            onCancel={() => setRestarting(false)}
            onConfirm={() => {
              setRestarting(false);
              onRestart();
            }}
          />
        )}
      </View>
      </AnchorProvider>
    </SeatAvatars.Provider>
    </TvContext.Provider>
  );
}

/**
 * Il menu della partita: un bottone tondo ben visibile in alto a destra che apre la stessa finestra
 * della scelta «come giochiamo», con le voci grandi: regole, suoni, rivincita, uscita.
 */
function GameMenu({ meta, roomCode, onRules, onRestart, onChangeGame, onExit }: { meta: GameMeta; roomCode?: string; onRules: () => void; onRestart?: () => void; onChangeGame?: () => void; onExit: () => void }) {
  const [open, setOpen] = useState(false);
  const settings = useSettings();
  const art = GAME_ART[meta.id];
  const pick = (f: () => void) => () => {
    setOpen(false);
    f();
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Menu della partita"
        onPress={() => {
          tap();
          setOpen(true);
        }}
        style={(state) => [styles.menuButton, { transform: [{ translateY: state.pressed ? 2 : 0 }] }, focusRing((state as { focused?: boolean }).focused ?? false)]}
      >
        <T size={22} weight="800" color={colors.text}>
          ☰
        </T>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <Row gap={12}>
          {art ? <Image source={art} style={styles.menuArt} accessibilityIgnoresInvertColors /> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <T size={24} weight="900" lines={1}>
              {meta.name}
            </T>
            {roomCode ? (
              <T size={13} weight="800" color={colors.muted}>
                Stanza {roomCode}
              </T>
            ) : null}
          </View>
        </Row>
        <SheetOption icon="▶" title="Continua a giocare" primary chevron={false} onPress={() => setOpen(false)} />
        <SheetOption icon="📖" title="Regole" onPress={pick(onRules)} />
        <SheetOption icon={settings.sound ? '🔊' : '🔇'} title={settings.sound ? 'Suoni: sì' : 'Suoni: no'} chevron={false} onPress={() => setSettings({ ...settings, sound: !settings.sound })} />
        {onRestart && <SheetOption icon="↻" title="Ricomincia" onPress={pick(onRestart)} />}
        {onChangeGame && <SheetOption icon="⇄" title="Cambia gioco" onPress={pick(onChangeGame)} />}
        <SheetOption icon="✕" title="Esci dalla partita" onPress={pick(onExit)} />
      </Sheet>
    </>
  );
}

/** Di chi è il turno, in grande sullo schermo condiviso (V-ST-1); sul telefono lo dice il mio angolo. */
function TurnPill({ active, names, me, myTurn }: { active: Seat[]; names: string[]; me: Seat | null; myTurn: boolean }) {
  if (!active.length) return null;
  if (myTurn) {
    return (
      <View style={[styles.pill, { backgroundColor: colors.accent }]} accessibilityLiveRegion="polite">
        <T size={15} weight="900" color={colors.onAccent}>
          ▶ Tocca a te
        </T>
      </View>
    );
  }
  const others = active.filter((s) => s !== me);
  if (others.length > 2) {
    return (
      <View style={styles.pill}>
        <T size={15} weight="800">
          ⏳ Scelgono in {others.length}
        </T>
      </View>
    );
  }
  return (
    <View style={[styles.pill, { borderColor: seatColor(others[0] ?? 0) }]} accessibilityLiveRegion="polite">
      <T size={14} color={colors.muted} weight="700">
        Tocca a
      </T>
      {others.map((s) => (
        <PlayerTag key={s} seat={s} name={names[s]} size={15} />
      ))}
    </View>
  );
}

/**
 * Cosa ha appena fatto un avversario, in una riga sola sul bordo del tavolo: icona, nome e mossa ("Pulcinella gioca 7 di denari e prende 2 carte"). Le mie mosse non si ripetono.
 */
function ActionStrip({ action, me, names, low }: { action: LastAction | null; me: Seat | null; names: string[]; /** In basso: nei giochi senza carte in alto stanno i punteggi. */ low?: boolean }) {
  if (!action || action.seat === me) return null;
  const text = action.text.replace(/%v(\d+)/g, (_, n) => (Number(n) === me ? 'te' : names[Number(n)] ?? ''));
  return (
    <PopIn key={action.n} style={[styles.stripWrap, low ? styles.stripLow : styles.stripHigh]} pointerEvents="none">
      <View style={styles.strip} accessibilityLiveRegion="polite" accessibilityLabel={`${names[action.seat]} ${text}`}>
        <SeatAvatar seat={action.seat} name={names[action.seat]} size={18} />
        <T size={12} weight="800" lines={1} style={{ flexShrink: 1 }}>
          {names[action.seat]}{' '}
          <T size={12} weight="700" color="#ffffffcc">
            {text}
          </T>
        </T>
      </View>
    </PopIn>
  );
}

/** Schermata che copre le carte finché il telefono non arriva alla persona giusta (V-HID-2). */
export function HandoffCurtain({ seat, name, onReady }: { seat: Seat; name: string; onReady: () => void }) {
  return (
    <View style={[styles.cover, { backgroundColor: colors.bg }]}>
      <View style={[styles.card, { alignItems: 'center' }]}>
        <T size={56}>🤫</T>
        <T size={16} color={colors.muted}>
          Passa il telefono a
        </T>
        <PlayerTag seat={seat} name={name} size={30} />
        <T size={14} color={colors.muted} center>
          Gli altri non guardino: stanno per comparire carte o scelte segrete.
        </T>
        <Button label={`Sono ${name}, mostra`} onPress={onReady} style={{ alignSelf: 'stretch' }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // La striscia delle mosse sta sul bordo alto del tavolo, a sinistra del bottone del menu.
  stripWrap: { position: 'absolute', left: 12, alignItems: 'center', zIndex: 30 },
  stripHigh: { top: 2, right: MIN_TOUCH + 18 },
  stripLow: { bottom: 4, right: 12 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', paddingVertical: 2, paddingLeft: 2, paddingRight: 10, borderRadius: 999, backgroundColor: 'rgba(18,5,43,0.78)' },
  tvSafe: { paddingHorizontal: '5%', paddingVertical: '2.5%' },
  menuButton: { position: 'absolute', top: 6, right: 6, width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.line, boxShadow: `0px 3px 0px ${colors.line}`, alignItems: 'center', justifyContent: 'center', zIndex: 60 },
  menuArt: { width: 64, height: 64, borderRadius: 16, borderWidth: 3, borderColor: colors.line },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.line, flexShrink: 0, boxShadow: `0px 4px 0px ${colors.line}` },
  pending: { position: 'absolute', bottom: 24, alignSelf: 'center', flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  toast: { position: 'absolute', top: 80, alignSelf: 'center', backgroundColor: colors.danger, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, maxWidth: '90%' },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: colors.surface, borderRadius: radius.l, padding: 24, gap: 14, width: '100%', maxWidth: 460, borderWidth: 3, borderColor: colors.line, boxShadow: `0px 8px 0px ${colors.line}` },
  endWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 40 },
  endSticker: { backgroundColor: colors.accent2, borderWidth: 3, borderColor: colors.line, borderRadius: 18, paddingHorizontal: 22, paddingVertical: 10, transform: [{ rotate: '-5deg' }], boxShadow: `0px 6px 0px ${colors.line}` },
  endBar: { position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 40, flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', padding: 10, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.line },
  resultArt: { width: 96, height: 96, borderRadius: 20, alignSelf: 'center' },
});
