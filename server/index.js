const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

class Countdown {
  constructor() {
    this.count = 10;
    this.interval = null;
    this.isPaused = false;
    this.isStarted = false;
    this.lots = [];
    this.currentLot;
    this.clients = new Set();
  }

  start() {

    if (this.isStarted && this.lots.length > 1) {
      return;
    }
    this.isStarted = true;
    this.currentLot = this.lots.shift();
    this.interval = setInterval(() => {
      if (!this.isPaused) {
        this.count--;
      }

      if (this.count >= 0) {
        this.broadcastCountdown();
      } else if (this.lots.length > 0) {
        this.count = 10;
        this.currentLot = this.lots.shift();
        this.broadcastCountdown();
      } else {
        this.stop();
      }
    }, 1000);
  }

  pause() {
    clearInterval(this.interval);
    this.isPaused = true;
    this.isStarted = false;
  }

  resume() {
    this.isPaused = false;
    this.start();
  }

  stop() {
    clearInterval(this.interval);
    this.interval = null;
    this.count = -1;
    this.lots = [];
    this.isPaused = false;
    this.isStarted = false;
    this.broadcastCountdown();
    setTimeout(() => {
      this.count = 10;
    }, 30)
  }

  broadcastCountdown() {
    this.clients.forEach(client => {
      let d = { count: this.count.toString(), lot: this.currentLot }
      client.send(JSON.stringify(d));
    });
  }

  addClient(client) {
    this.clients.add(client);
  }

  removeClient(client) {
    this.clients.delete(client);
    if (this.clients.size === 0) {
      this.stop();
    }
  }
}

const lots = ['1', '2', '3', '4'];
const countdown = new Countdown();
countdown.lots = lots;


wss.on('connection', (ws) => {
  countdown.addClient(ws);
  ws.on('message', (message) => {
    switch (message.toString()) {
      case 'start':
        countdown.start();
        break;

      case 'pause':
        countdown.pause();
        break;

      case 'resume':
        countdown.resume();
        break;

      default:
        countdown.stop();
        break;
    }
  });

  ws.on('close', () => {
    countdown.removeClient(ws);
  });
});

server.listen(6080);