const http = require('http');
const env = require('./src/config/env');
const connectDB = require('./src/config/db');
const app = require('./src/app');
const { initSocket } = require('./src/sockets');
const registerListeners = require('./src/listeners');

(async () => {
  await connectDB();
  const server = http.createServer(app);
  const io = initSocket(server);          
  registerListeners(io);                  
  server.listen(env.port, () =>
    console.log(`Server running on port ${env.port} (${env.nodeEnv}). Demo client: http://localhost:${env.port}/demo.html`)
  );

  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err);
    server.close(() => process.exit(1));
  });
})();
