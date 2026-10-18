# Tavolata — comandi rapidi.
#   make          avvia tutto: server delle stanze + sito, e apre il browser
#   make telefono avvia tutto con Expo per aprire l'app su iPhone/Android (Expo Go)
#   make server   solo il server delle stanze
#   make web      solo il sito
#   make test     prove automatiche delle regole
#   make stop     ferma server e sito rimasti accesi

SERVER_PORT := 2567
WEB_PORT    := 8081
OPEN        ?= 1
IP          := $(shell ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | cut -d' ' -f1)

.DEFAULT_GOAL := gioca
.PHONY: gioca telefono server web test stop install

node_modules: package.json apps/app/package.json server/package.json packages/engine/package.json
	npm install
	@touch node_modules

install: node_modules

## Server + sito insieme; Ctrl+C li ferma entrambi.
gioca: node_modules
	@if lsof -ti :$(SERVER_PORT) -sTCP:LISTEN >/dev/null 2>&1 || lsof -ti :$(WEB_PORT) -sTCP:LISTEN >/dev/null 2>&1; then \
	  echo "Tavolata è già accesa: apri http://localhost:$(WEB_PORT)  (per riavviarla: make stop && make)"; \
	  open http://localhost:$(WEB_PORT) >/dev/null 2>&1 || true; \
	  exit 0; \
	fi; \
	echo ""; \
	echo "  Tavolata sta partendo…"; \
	echo "  Su questo computer:   http://localhost:$(WEB_PORT)"; \
	[ -n "$(IP)" ] && echo "  Dai telefoni (Wi-Fi): http://$(IP):$(WEB_PORT)"; \
	echo "  Per fermare tutto:    Ctrl+C"; \
	echo ""; \
	trap 'kill 0' INT TERM EXIT; \
	  (cd server && npx tsx src/index.ts) & \
	  (cd apps/app && EXPO_PUBLIC_LAN_HOST=$(IP) npx expo start --web --port $(WEB_PORT)) & \
	  ( [ "$(OPEN)" = 1 ] && sleep 12 && open http://localhost:$(WEB_PORT) >/dev/null 2>&1 ) & \
	  wait

## Come sopra ma con il QR di Expo Go per l'app sul telefono.
telefono: node_modules
	@if lsof -ti :$(SERVER_PORT) -sTCP:LISTEN >/dev/null 2>&1 || lsof -ti :$(WEB_PORT) -sTCP:LISTEN >/dev/null 2>&1; then \
	  echo "Tavolata è già accesa: prima make stop"; exit 1; \
	fi; \
	trap 'kill 0' INT TERM EXIT; \
	  (cd server && npx tsx src/index.ts) & \
	  (cd apps/app && EXPO_PUBLIC_LAN_HOST=$(IP) npx expo start --port $(WEB_PORT)) & \
	  wait

server: node_modules
	cd server && npx tsx watch src/index.ts

web: node_modules
	cd apps/app && EXPO_PUBLIC_LAN_HOST=$(IP) npx expo start --web --port $(WEB_PORT)

test: node_modules
	npm test

stop:
	@-lsof -ti :$(SERVER_PORT) -sTCP:LISTEN | xargs kill 2>/dev/null; true
	@-lsof -ti :$(WEB_PORT) -sTCP:LISTEN | xargs kill 2>/dev/null; true
	@echo "Fermati server ($(SERVER_PORT)) e sito ($(WEB_PORT))."
