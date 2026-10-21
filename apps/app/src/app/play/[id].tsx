import { useEffect, useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useStayAwake } from '../../ui/keepAwake';
import { GameFrame, HandoffCurtain } from '../../games/GameFrame';
import { getPendingMatch, useLocalMatch, type MatchConfig } from '../../session/local';
import { Screen } from '../../ui/kit';
import { pickBots } from '@giochi/engine';
import { getSettings } from '../../ui/settings';

export default function PlayLocal() {
  // Con ?bots=N si parte subito contro il computer (comodo anche come link diretto a un gioco).
  const { id, bots } = useLocalSearchParams<{ id: string; bots?: string }>();
  const config = useMemo(() => {
    const pending = getPendingMatch();
    if (pending?.gameId === id && !bots) return pending;
    return bots ? { gameId: id, seats: [{ name: 'Io', bot: false, avatar: getSettings().avatar ?? undefined }, ...pickBots(Number(bots), Math.random, [getSettings().avatar]).map((b) => ({ name: b.name, bot: true }))] } : null;
  }, [id, bots]);
  useEffect(() => {
    if (!config) router.replace('/');
  }, [config]);
  if (!config) return null;
  return <LocalMatch config={config} />;
}

function LocalMatch({ config }: { config: MatchConfig }) {
  useStayAwake();
  const m = useLocalMatch(config);
  useEffect(() => {
    if (!m.error) return;
    const t = setTimeout(m.clearError, 2200);
    return () => clearTimeout(t);
  }, [m.error]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen scroll={false}>
      <GameFrame
        meta={m.game.meta}
        view={m.view}
        me={m.me}
        names={m.names}
        avatars={m.avatars}
        myTurn={m.myTurn}
        active={m.active}
        onMove={m.play}
        result={m.result}
        lastAction={m.lastAction}
        error={m.error}
        onExit={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        onRestart={m.restart}
        overlay={m.handoffTo !== null ? <HandoffCurtain seat={m.handoffTo} name={m.names[m.handoffTo]} onReady={m.confirmHandoff} /> : null}
      />
    </Screen>
  );
}
