import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { GameMeta, GameResult, LastAction, Seat } from '@giochi/engine';
import { BOARDS } from './registry';
import { GAME_ART } from '../ui/art';
import { BotFigure, SeatAvatar, SeatAvatars } from '../ui/avatars';
import { botByName } from '@giochi/engine';
import { Button, Confirm, focusRing, PlayerTag, Row, T, tap } from '../ui/kit';
import { DragProvider } from '../ui/drag';
import { CardZoomLayer } from '../ui/cards';
import { PopIn } from '../ui/motion';
import { sfx } from '../ui/sound';
import { TvContext } from '../ui/settings';
import { colors, MIN_TOUCH, radius, seatColor } from '../ui/theme';

/**
 * Guscio comune a ogni partita (P-SHELL-3): barra in alto con uscita confermata, nome del gioco
 * e di chi è il turno; area di gioco; regole, errori, attesa di rete e risultati.
 */
export function GameFrame({ meta, view, me, names, avatars, myTurn, active, onMove, result, error, onExit, onRestart, overlay, headerRight, tv, pending, lastAction }: {
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
  overlay?: ReactNode;
  headerRight?: ReactNode;
  /** Schermo condiviso: testi grandi, margini TV, niente carte segrete. */
  tv?: boolean;
  /** Mossa inviata al server e non ancora confermata (V-FB-2). */
  pending?: boolean;
}) {
  const Board = BOARDS[meta.id];
  const [rules, setRules] = useState(false);
  const [leaving, setLeaving] = useState(false);
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
      <View style={[{ flex: 1 }, tv && styles.tvSafe]}>
        <Row style={styles.header} gap={10}>
          <IconButton label="Esci dalla partita" glyph="✕" onPress={() => setLeaving(true)} />
          <T size={18} weight="900" lines={1} style={{ flexShrink: 1 }}>
            {meta.name}
          </T>
          <View style={{ flex: 1 }} />
          {!result && !tv && <TurnPill active={active} names={names} me={me} myTurn={myTurn} />}
          {headerRight}
          <IconButton label="Come si gioca" glyph="?" onPress={() => setRules(true)} />
        </Row>
        {tv && !result && active.length > 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <TurnPill active={active} names={names} me={me} myTurn={myTurn} />
          </View>
        )}
        <ActionStrip action={lastAction ?? null} me={me} names={names} />
        <View style={{ flex: 1 }} pointerEvents={pending ? 'none' : 'auto'}>
          <CardZoomLayer>
          <DragProvider>
            {Board ? <Board view={view} me={me} names={names} myTurn={myTurn && !pending} onMove={onMove} /> : <T>Interfaccia non disponibile.</T>}
          </DragProvider>
          </CardZoomLayer>
        </View>
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
                    .sort((a, b) => b.s - a.s)
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
          message={tv ? 'La stanza resta aperta per gli altri.' : 'La partita in corso andrà persa.'}
          confirmLabel="Esci"
          onCancel={() => setLeaving(false)}
          onConfirm={() => {
            setLeaving(false);
            onExit();
          }}
        />
      </View>
    </SeatAvatars.Provider>
    </TvContext.Provider>
  );
}

function IconButton({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      style={(state) => [styles.iconButton, state.pressed && { backgroundColor: colors.surface2 }, focusRing((state as { focused?: boolean }).focused ?? false)]}
    >
      <T size={18} weight="900" color={colors.text}>
        {glyph}
      </T>
    </Pressable>
  );
}

/** Di chi è il turno, leggibile in un secondo da telefono e TV (V-ST-1). */
function TurnPill({ active, names, me, myTurn }: { active: Seat[]; names: string[]; me: Seat | null; myTurn: boolean }) {
  // Sul telefono basta l'icona di chi gioca, così il nome del gioco nella barra resta leggibile.
  const narrow = useWindowDimensions().width < 480;
  if (!active.length) return null;
  if (myTurn) {
    return (
      <View style={[styles.pill, { backgroundColor: colors.accent }]} accessibilityLiveRegion="polite">
        <T size={15} weight="900" color={colors.onAccent}>
          {narrow ? '▶ Tu' : '▶ Tocca a te'}
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
        {narrow ? '⏳' : 'Tocca a'}
      </T>
      {others.map((s) => (
        narrow ? <SeatAvatar key={s} seat={s} name={names[s]} size={30} /> : <PlayerTag key={s} seat={s} name={names[s]} size={15} />
      ))}
    </View>
  );
}

/**
 * Cosa ha appena fatto un avversario, in una riga sola sotto la barra: icona, nome e mossa
 * ("Pulcinella gioca 7 di denari e prende 2 carte"). Le mie mosse non si ripetono.
 */
function ActionStrip({ action, me, names }: { action: LastAction | null; me: Seat | null; names: string[] }) {
  if (!action || action.seat === me) return <View style={styles.stripSpace} />;
  const text = action.text.replace(/%v(\d+)/g, (_, n) => (Number(n) === me ? 'te' : names[Number(n)] ?? ''));
  return (
    <PopIn key={action.n} style={styles.stripWrap}>
      <View style={[styles.strip, { borderColor: seatColor(action.seat) }]} accessibilityLiveRegion="polite" accessibilityLabel={`${names[action.seat]} ${text}`}>
        <SeatAvatar seat={action.seat} name={names[action.seat]} size={22} />
        <T size={13} weight="800" lines={1} style={{ flexShrink: 1 }}>
          {names[action.seat]}{' '}
          <T size={13} weight="700" color={colors.muted}>
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
  stripSpace: { height: 0 },
  stripWrap: { alignItems: 'center', paddingHorizontal: 10, paddingTop: 4 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%', paddingVertical: 3, paddingLeft: 3, paddingRight: 12, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 2 },
  tvSafe: { paddingHorizontal: '5%', paddingVertical: '2.5%' },
  header: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 3, borderColor: colors.line, minHeight: MIN_TOUCH + 16, backgroundColor: colors.brand },
  iconButton: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.line },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.line, flexShrink: 1, boxShadow: `0px 4px 0px ${colors.line}` },
  pending: { position: 'absolute', bottom: 24, alignSelf: 'center', flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  toast: { position: 'absolute', top: 80, alignSelf: 'center', backgroundColor: colors.danger, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, maxWidth: '90%' },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: colors.surface, borderRadius: radius.l, padding: 24, gap: 14, width: '100%', maxWidth: 460, borderWidth: 3, borderColor: colors.line, boxShadow: `0px 8px 0px ${colors.line}` },
  endWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 40 },
  endSticker: { backgroundColor: colors.accent2, borderWidth: 3, borderColor: colors.line, borderRadius: 18, paddingHorizontal: 22, paddingVertical: 10, transform: [{ rotate: '-5deg' }], boxShadow: `0px 6px 0px ${colors.line}` },
  endBar: { position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 40, flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', padding: 10, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.line },
  resultArt: { width: 96, height: 96, borderRadius: 20, alignSelf: 'center' },
});
