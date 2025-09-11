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
    console.log('Socket IO initialized');
  }

  handleConnection(client: any, ...args: any[]) {
    console.log('Client connected!');
  }

  handleDisconnect(client: any) {
    console.log('Client disconnected!');
  }

  @SubscribeMessage('order_sold')
  handleOrderSold(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    console.log('Order sold');

    this.server.emit('order_update', {
      message: 'Order updated',
      order: data,
    });
  }
}
