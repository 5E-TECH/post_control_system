const { io } = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);

  // Buyurtma sotildi eventini jo'natamiz
  socket.emit('order_sold', { orderId: 123, status: 'sold' });
});

socket.on('order_update', (data) => {
  console.log('📢 Update received:', data);
});
