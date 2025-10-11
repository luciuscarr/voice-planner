const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  
  return 'localhost';
}

const ip = getLocalIP();
console.log(`\n🌐 Your computer's IP address: ${ip}`);
console.log(`📱 Access the app on your iPhone at: http://${ip}:3000`);
console.log(`🔧 Update server/app.js with this IP address\n`);
