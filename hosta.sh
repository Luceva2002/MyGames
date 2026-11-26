#!/usr/bin/env bash
# Tavolata sul server di casa, con Docker.
#
#   ./hosta.sh              prepara tutto, aggiorna il codice, costruisce e avvia; controlla che risponda
#   ./hosta.sh --no-update  come sopra ma senza scaricare il codice nuovo da GitHub
#   ./hosta.sh --stop       ferma Tavolata
#   ./hosta.sh --logs       mostra i log dal vivo
#
# Dopo il primo avvio Tavolata riparte da sola quando il server si riaccende (Docker resta abilitato all'avvio).
# Porte: il sito su WEB_PORT (8080, o la prima libera dopo), le stanze sulla 2567. Si cambiano nel file .env.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Luceva2002/MyGames.git}"
TAVOLATA_DIR="${TAVOLATA_DIR:-$HOME/tavolata}"
SERVER_PORT=2567
WAIT_SECONDS=240

say()  { printf '\033[1;33m▸\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

UPDATE=1
ACTION=up
for arg in "$@"; do
  case "$arg" in
    --no-update) UPDATE=0 ;;
    --stop) ACTION=stop ;;
    --logs) ACTION=logs ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) fail "Opzione sconosciuta: $arg (usa --help)" ;;
  esac
done

SUDO=""
if [ "$(id -u)" -ne 0 ] && have sudo; then SUDO="sudo"; fi

# ---------- 1. il codice ----------
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$HERE/docker-compose.yml" ] && [ -f "$HERE/Dockerfile" ]; then
  cd "$HERE"
else
  # Lo script è stato copiato da solo sul server: scarica il progetto e riparte da lì.
  have git || { say "Installo git…"; if have apt-get; then $SUDO apt-get update -qq && $SUDO apt-get install -y -qq git; elif have dnf; then $SUDO dnf install -y -q git; else fail "Installa git e riprova."; fi; }
  if [ -d "$TAVOLATA_DIR/.git" ]; then
    say "Uso il progetto già scaricato in $TAVOLATA_DIR"
  else
    say "Scarico Tavolata in $TAVOLATA_DIR"
    git clone --depth 1 "$REPO_URL" "$TAVOLATA_DIR" || fail "Non riesco a scaricare $REPO_URL. Se il repository è privato, fai prima 'gh auth login' o usa un URL con il token."
  fi
  exec bash "$TAVOLATA_DIR/hosta.sh" "$@"
fi

# ---------- 2. Docker ----------
if ! have docker; then
  [ "$(uname -s)" = "Linux" ] || fail "Docker non c'è: installa Docker Desktop e riprova."
  say "Docker non c'è: lo installo (serve la password di amministratore)…"
  if have curl; then curl -fsSL https://get.docker.com | $SUDO sh; else wget -qO- https://get.docker.com | $SUDO sh; fi
  if [ -n "$SUDO" ]; then $SUDO usermod -aG docker "$USER" || true; fi
fi
if have systemctl && [ "$(uname -s)" = "Linux" ]; then
  # Acceso adesso e a ogni riavvio del server, così Tavolata riparte da sola.
  $SUDO systemctl enable --now docker >/dev/null 2>&1 || true
fi

DOCKER="docker"
if ! docker info >/dev/null 2>&1; then
  if [ -n "$SUDO" ] && $SUDO docker info >/dev/null 2>&1; then
    DOCKER="$SUDO docker"
  elif [ "$(uname -s)" = "Darwin" ]; then
    say "Avvio Docker Desktop…"
    open -a Docker || true
    for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 2; done
    docker info >/dev/null 2>&1 || fail "Docker Desktop non risponde: aprilo a mano e riprova."
  else
    fail "Docker è installato ma non risponde: controlla con 'sudo systemctl status docker'."
  fi
fi

if $DOCKER compose version >/dev/null 2>&1; then
  COMPOSE="$DOCKER compose"
elif have docker-compose; then
  COMPOSE="${SUDO:+$SUDO }docker-compose"
else
  say "Manca Docker Compose: lo installo…"
  if have apt-get; then $SUDO apt-get update -qq && $SUDO apt-get install -y -qq docker-compose-plugin; elif have dnf; then $SUDO dnf install -y -q docker-compose-plugin; fi
  $DOCKER compose version >/dev/null 2>&1 || fail "Installa il plugin 'docker compose' e riprova."
  COMPOSE="$DOCKER compose"
fi

case "$ACTION" in
  stop) $COMPOSE down; ok "Tavolata è ferma."; exit 0 ;;
  logs) exec $COMPOSE logs -f --tail 100 ;;
esac

# ---------- 3. aggiornamento ----------
if [ "$UPDATE" = 1 ] && [ -d .git ] && have git; then
  if [ -z "$(git status --porcelain --untracked-files=no)" ]; then
    say "Scarico l'ultima versione da GitHub…"
    git pull --ff-only --quiet || say "Aggiornamento non riuscito: avvio la versione che c'è già."
  else
    say "Ci sono modifiche locali: non aggiorno il codice, avvio quello che c'è."
  fi
fi

# ---------- 4. porte ----------
port_busy() {
  if have ss; then ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1\$"
  elif have lsof; then lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
  else (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
  fi
}
running="$($COMPOSE ps --status running -q 2>/dev/null || true)"

touch .env
WEB_PORT="$(grep -E '^WEB_PORT=' .env | tail -1 | cut -d= -f2 || true)"
if [ -z "$WEB_PORT" ]; then
  WEB_PORT=8080
  # Al primo avvio si sceglie la prima porta libera da 8080 in su e la si ricorda nel file .env.
  while port_busy "$WEB_PORT"; do WEB_PORT=$((WEB_PORT + 1)); done
  echo "WEB_PORT=$WEB_PORT" >> .env
fi
if [ -z "$running" ]; then
  port_busy "$WEB_PORT" && fail "La porta $WEB_PORT è già usata da un altro programma: cambia WEB_PORT nel file .env."
  port_busy "$SERVER_PORT" && fail "La porta $SERVER_PORT (stanze) è già usata da un altro programma: liberala e riprova."
fi

# ---------- 5. costruzione e avvio ----------
say "Costruisco e avvio Tavolata (la prima volta ci vogliono alcuni minuti)…"
$COMPOSE up -d --build --remove-orphans

# ---------- 6. controllo ----------
fetch() { if have curl; then curl -fs -o /dev/null --max-time 5 "$1" 2>/dev/null; else wget -q -O /dev/null -T 5 "$1" 2>/dev/null; fi; }
say "Aspetto che sito e stanze rispondano…"
web_ok=0; srv_ok=0
for _ in $(seq 1 $((WAIT_SECONDS / 2))); do
  [ $web_ok = 1 ] || { fetch "http://127.0.0.1:$WEB_PORT/" && web_ok=1; } || true
  [ $srv_ok = 1 ] || { fetch "http://127.0.0.1:$SERVER_PORT/" && srv_ok=1; } || true
  [ $web_ok = 1 ] && [ $srv_ok = 1 ] && break
  sleep 2
done
if [ $web_ok != 1 ] || [ $srv_ok != 1 ]; then
  $COMPOSE ps
  $COMPOSE logs --tail 60
  [ $web_ok = 1 ] || fail "Il sito non risponde sulla porta $WEB_PORT (log qui sopra)."
  fail "Il server delle stanze non risponde sulla porta $SERVER_PORT (log qui sopra)."
fi

if [ "$(uname -s)" = "Darwin" ]; then
  IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
else
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi
echo
ok "Tavolata è accesa."
echo "   Da questo server:      http://localhost:$WEB_PORT"
[ -n "${IP:-}" ] && echo "   Da casa (Wi-Fi):       http://$IP:$WEB_PORT"
echo "   Stanze:                porta $SERVER_PORT"
echo "   Fermare:               ./hosta.sh --stop      Log: ./hosta.sh --logs"
