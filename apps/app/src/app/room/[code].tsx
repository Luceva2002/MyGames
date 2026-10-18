import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { assignAvatars, canControl, GAMES, getGame, playerCounts, type RoomSnapshot } from '@giochi/engine';
import { GameFrame } from '../../games/GameFrame';
import { clearOnlineError, joinUrl, leaveRoom, send, sendMove, useOnline } from '../../session/online';
import { GAME_ART } from '../../ui/art';
import { BotFigure } from '../../ui/avatars';
import { CharacterPickerModal } from '../../ui/CharacterPicker';
import { SeatAvatars } from '../../ui/avatars';
import { getSettings, setSettings } from '../../ui/settings';
import { Button, Confirm, focusRing, Panel, PlayerTag, Row, Screen, T, tap } from '../../ui/kit';
import { QrCode } from '../../ui/QrCode';
import { TvContext } from '../../ui/settings';
import { colors, font, MIN_TOUCH, radius } from '../../ui/theme';

export default function RoomScreen() {
  useKeepAwake();
  const online = useOnline();
  const { snapshot, seatView, room } = online;

  useEffect(() => {
    if (!online.error) return;
    const t = setTimeout(clearOnlineError, 3000);
    return () => clearTimeout(t);
  }, [online.error]);

  const exit = () => {
    leaveRoom();
    router.replace('/');
  };

  if (!room || online.status === 'closed') {
    return (
      <Screen>
        <T size={24} weight="900">
          {online.status === 'closed' ? 'La stanza è stata chiusa' : 'Non sei in nessuna stanza'}
        </T>
        <Button label="Entra con un codice" onPress={() => router.replace('/room/join')} />
        <Button label="Torna ai giochi" kind="ghost" color={colors.text} onPress={exit} />
      </Screen>
    );
  }
  if (!snapshot) {
    return (
      <Screen>
        <T size={20} weight="800">
          ⏳ Collegamento alla stanza…
        </T>
      </Screen>
    );
  }

  const me = snapshot.members.find((m) => m.id === room.sessionId);
  const tv = me?.role === 'screen';
  const isHost = canControl(snapshot, room.sessionId);
  // Stato di riconnessione visibile su TV e telefono (V-PTY-3).
  const reconnecting = online.status === 'reconnecting' && (
    <View style={styles.reconnect} accessibilityLiveRegion="assertive">
      <T weight="800" color={colors.onAccent}>
        📡 Connessione persa, riprovo…
      </T>
    </View>
  );

  if (snapshot.phase === 'playing' && seatView) {
    const game = getGame(seatView.gameId)!;
    return (
      <Screen scroll={false}>
        <GameFrame
          meta={game.meta}
          view={seatView.view}
          me={seatView.me}
          names={seatView.names}
          avatars={seatView.avatars}
          myTurn={seatView.myTurn}
          active={seatView.active}
          onMove={sendMove}
          pending={online.pending}
          result={seatView.result}
          error={online.error}
          onExit={exit}
          onRestart={isHost ? () => send('restart') : undefined}
          tv={tv}
          headerRight={
            <Row gap={8}>
              <T size={14} weight="900" color={colors.muted}>
                {snapshot.code}
              </T>
              {isHost && <Button small kind="ghost" color={colors.muted} label="Cambia gioco" onPress={() => send('toLobby')} />}
            </Row>
          }
          overlay={reconnecting}
        />
      </Screen>
    );
  }

  return (
    <TvContext.Provider value={tv}>
      <Lobby snapshot={snapshot} myId={room.sessionId} isHost={isHost} tv={tv} error={online.error} onExit={exit} reconnecting={reconnecting} />
    </TvContext.Provider>
  );
}

function Lobby({ snapshot, myId, isHost, tv, error, onExit, reconnecting }: {
  snapshot: RoomSnapshot;
  myId: string;
  isHost: boolean;
  tv: boolean;
  error: string | null;
  onExit: () => void;
  reconnecting: React.ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const [leaving, setLeaving] = useState(false);
  const wide = width > 760;
  const game = snapshot.gameId ? getGame(snapshot.gameId) : undefined;
  const players = snapshot.members.filter((m) => m.role === 'player');
  const total = players.length + snapshot.bots;
  const url = joinUrl(snapshot.code);
  const leader = snapshot.members.find((m) => m.id === snapshot.hostId && m.role === 'player') ?? players[0];
  const allowed = game ? playerCounts(game.meta) : [];
  const canStart = !!game && allowed.includes(total);
  const meIndex = players.findIndex((p) => p.id === myId);
  const [picking, setPicking] = useState(false);
  // Le maschere di tutti al tavolo: chi non ha scelto ne riceve una libera, come in partita.
  const avatars = assignAvatars([...players.map((m) => ({ name: m.name, bot: false, avatar: m.avatar })), ...snapshot.botNames.map((name) => ({ name, bot: true }))]);
  // Codice della stanza almeno all'8% dell'altezza della TV (V-PTY-1).
  const codeSize = Math.max(56, Math.round(height * (tv ? 0.12 : 0.07)));

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Button small kind="ghost" color={colors.muted} label="‹ Esci dalla stanza" onPress={() => setLeaving(true)} />
        {!tv && meIndex >= 0 && (
          <View style={styles.joined} accessibilityLiveRegion="polite">
            <T size={14} weight="800" color={colors.onAccent}>
              ✓ Sei dentro
            </T>
          </View>
        )}
      </Row>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
        <Panel style={{ flex: 1, alignItems: 'center' }}>
          <T size={14} weight="800" color={colors.muted}>
            CODICE STANZA
          </T>
          <Text accessibilityLabel={`Codice stanza ${snapshot.code.split('').join(' ')}`} style={{ color: colors.accent, fontSize: codeSize, fontFamily: font.display, letterSpacing: codeSize * 0.15, textShadowColor: colors.line, textShadowOffset: { width: 0, height: 5 }, textShadowRadius: 0 }}>
            {snapshot.code}
          </Text>
          {url && tv && (
            <>
              <QrCode value={url} size={Math.min(height * 0.28, 260)} />
              <T size={13} color={colors.muted} center>
                Inquadra il QR o apri {url.replace(/\/room\/join.*/, '')} → «Entra con un codice»
              </T>
            </>
          )}
          {!tv && (
            <T size={14} color={colors.muted} center>
              Dillo agli altri: entrano da «Entra con un codice».
            </T>
          )}
        </Panel>

        <Panel style={{ flex: 1 }}>
          <T size={18} weight="900">
            Al tavolo · {players.length + snapshot.bots}
          </T>
          <SeatAvatars.Provider value={avatars}>
          {players.map((m, i) => (
            <Row key={m.id} gap={10} wrap style={styles.playerRow}>
              <Pressable
                style={{ flexShrink: 1, minWidth: 140 }}
                disabled={m.id !== myId}
                accessibilityRole={m.id === myId ? 'button' : undefined}
                accessibilityLabel={m.id === myId ? 'Cambia il tuo personaggio' : undefined}
                onPress={() => {
                  tap();
                  setPicking(true);
                }}
              >
                <PlayerTag seat={i} name={m.name} size={18} suffix={m.id === myId ? ' (tu) ✎' : ''} />
              </Pressable>
              {!m.connected && (
                <T size={13} color={colors.danger} weight="800">
                  📡 si sta ricollegando
                </T>
              )}
              {leader?.id === m.id && (
                <T size={12} color={colors.accent} weight="900">
                  👑 CAPOTAVOLA
                </T>
              )}
            </Row>
          ))}
          {snapshot.botNames.length > 0 && (
            // Le maschere in lobby a figura intera (SPEC §9).
            <Row gap={12} wrap style={{ alignItems: 'flex-end' }}>
              {snapshot.botNames.map((name, i) => (
                <View key={name} style={{ alignItems: 'center', gap: 4 }}>
                  <BotFigure name={name} height={tv ? 200 : 130} />
                  <PlayerTag seat={players.length + i} name={name} size={14} />
                </View>
              ))}
            </Row>
          )}
          </SeatAvatars.Provider>
          {players.length === 0 && (
            <T color={colors.muted} size={16}>
              ⏳ Aspetto i telefoni…
            </T>
          )}
          {isHost && (
            <Row gap={8}>
              <Button small kind="ghost" color={colors.muted} label="− computer" a11y="Togli un computer" disabled={snapshot.bots === 0} onPress={() => send('setBots', { count: snapshot.bots - 1 })} />
              <Button small kind="ghost" color={colors.muted} label="+ computer" a11y="Aggiungi un computer" disabled={!!game && total >= game.meta.maxPlayers} onPress={() => send('setBots', { count: snapshot.bots + 1 })} />
            </Row>
          )}
        </Panel>
      </View>

      <Panel>
        <T size={18} weight="900">
          {isHost ? 'Scegli il gioco' : game ? `Si gioca a ${game.meta.name}` : `${leader?.name ?? 'Il capotavola'} sta scegliendo il gioco…`}
        </T>
        {isHost ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {GAMES.map((g) => {
              const fits = total === 0 || playerCounts(g.meta).includes(total) || total < g.meta.minPlayers;
              const active = g.meta.id === snapshot.gameId;
              return (
                <Pressable
                  key={g.meta.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${g.meta.name}, ${g.meta.minPlayers}–${g.meta.maxPlayers} giocatori`}
                  onPress={() => {
                    tap();
                    send('setGame', { gameId: g.meta.id });
                  }}
                  style={(state) => [styles.gameChoice, { opacity: fits ? 1 : 0.45 }, active && { borderColor: colors.accent }, focusRing((state as { focused?: boolean }).focused ?? false)]}
                >
                  {GAME_ART[g.meta.id] && <Image source={GAME_ART[g.meta.id]} style={styles.gameArt} />}
                  <View style={{ flex: 1, gap: 2 }}>
                    <T weight="900" size={16} lines={2}>
                      {active ? '✓ ' : ''}
                      {g.meta.name}
                    </T>
                    <T size={12} weight="800" color={colors.accent} lines={1}>
                      👤 {g.meta.minPlayers === g.meta.maxPlayers ? g.meta.minPlayers : `${g.meta.minPlayers}–${g.meta.maxPlayers}`}
                    </T>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          game && (
            <Row gap={14}>
              {GAME_ART[game.meta.id] && <Image source={GAME_ART[game.meta.id]} style={[styles.gameArt, { width: 96, height: 96 }]} />}
              <T color={colors.muted} style={{ flex: 1 }}>
                {game.meta.tagline}
              </T>
            </Row>
          )
        )}
      </Panel>

      {error && (
        <T color={colors.danger} weight="800">
          ⚠ {error}
        </T>
      )}
      {isHost ? (
        <Button
          label={!game ? 'Scegli un gioco' : canStart ? `Inizia ${game.meta.name}` : `Servono ${allowed.join(' o ')} giocatori (ora ${total})`}
          disabled={!canStart}
          onPress={() => send('start')}
        />
      ) : (
        <T center color={colors.muted} size={16}>
          ⏳ La partita parte quando {leader?.name ?? 'il capotavola'} preme «Inizia».
        </T>
      )}
      {reconnecting}
      <CharacterPickerModal
        visible={picking}
        title="Il tuo personaggio"
        value={meIndex >= 0 ? avatars[meIndex] : null}
        taken={avatars.filter((_, j) => j !== meIndex)}
        onPick={(avatar) => {
          send('avatar', { avatar });
          setSettings({ ...getSettings(), avatar });
        }}
        onClose={() => setPicking(false)}
      />
      <Confirm visible={leaving} title="Uscire dalla stanza?" message="Potrai rientrare con lo stesso codice." confirmLabel="Esci" onCancel={() => setLeaving(false)} onConfirm={onExit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  joined: { backgroundColor: colors.success, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  playerRow: { minHeight: 40 },
  gameChoice: { width: '47%', minWidth: 150, flexGrow: 1, flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: radius.m, borderWidth: 3, borderColor: 'transparent', backgroundColor: colors.surface2, gap: 10, minHeight: MIN_TOUCH },
  gameArt: { width: 52, height: 52, borderRadius: radius.s, borderWidth: 2, borderColor: colors.line },
  reconnect: { position: 'absolute', top: 8, alignSelf: 'center', backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
});
