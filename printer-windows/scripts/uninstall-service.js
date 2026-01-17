/**
 * Windows Service o'chirish scripti
 */

const Service = require('node-windows').Service;
const path = require('path');

// Service yaratish (o'chirish uchun ham kerak)
const svc = new Service({
  name: 'Beepost Printer Service',
  script: path.join(__dirname, '../dist/index.js'),
});

// O'chirish eventlari
svc.on('uninstall', () => {
  console.log('Service uninstalled successfully!');
});

svc.on('error', (err) => {
  console.error('Error:', err);
});

// O'chirishni boshlash
console.log('Uninstalling Beepost Printer Service...');
svc.uninstall();
