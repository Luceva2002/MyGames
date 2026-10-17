import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { DEFAULT_PORT, ROOM_NAME } from '@giochi/engine';
import { TableRoom } from './TableRoom';

const port = Number(process.env.PORT ?? DEFAULT_PORT);
const server = new Server({ transport: new WebSocketTransport() });
server.define(ROOM_NAME, TableRoom);
await server.listen(port, '0.0.0.0');
console.log(`Server delle stanze in ascolto sulla porta ${port}`);
