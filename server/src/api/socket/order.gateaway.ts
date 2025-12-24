import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class OrderGateaway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private server: Server;

  afterInit(server: any) {
    this.server = server;
  }

  handleConnection(client: any, ...args: any[]) {
  }

  handleDisconnect(client: any) {
  }

  @SubscribeMessage('order_sold')
  handleOrderSold(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    this.server.emit('order_update', {
      message: 'Order updated',
      order: data,
    });
  }
}
