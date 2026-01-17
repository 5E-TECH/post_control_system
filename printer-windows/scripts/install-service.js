/**
 * Windows Service o'rnatish scripti
 * node-windows kutubxonasi orqali
 */

const Service = require('node-windows').Service;
const path = require('path');

// Service yaratish
const svc = new Service({
  name: 'Beepost Printer Service',
  description: 'Beepost thermal printer service - MQTT based',
  script: path.join(__dirname, '../dist/index.js'),
  nodeOptions: [],
  workingDirectory: path.join(__dirname, '..'),
  allowServiceLogon: true,
});

// O'rnatish eventlari
svc.on('install', () => {
  console.log('Service installed successfully!');
  svc.start();
});

svc.on('start', () => {
  console.log('Service started!');
  console.log('');
  console.log('Service status:');
  console.log('  Name: Beepost Printer Service');
  console.log('  Status: Running');
  console.log('');
  console.log('To check status: sc query "Beepost Printer Service"');
  console.log('To stop service: sc stop "Beepost Printer Service"');
  console.log('To uninstall: npm run uninstall-service');
});

svc.on('alreadyinstalled', () => {
  console.log('Service is already installed.');
});

svc.on('error', (err) => {
  console.error('Error:', err);
});

// O'rnatishni boshlash
console.log('Installing Beepost Printer Service...');
svc.install();
