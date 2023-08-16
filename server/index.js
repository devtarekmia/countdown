const http = require('http');
const WebSocket = require('ws');
const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, '../')));
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

class Countdown {
  constructor() {
    this.count = 10;
    this.interval = null;
    this.isPaused = false;
    this.isStarted = false;
    this.isRunning = false;
    this.lots = [];
    this.copyLots = []; // will loop the lots again on next start. remove it
    this.currentLot;
    this.clients = new Set();
  }

  run() {
    this.isStarted = true;
    this.isRunning = true;
    this.isPaused = false;
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

  start() {

    if (!this.isStarted) {
      this.currentLot = this.lots.shift();
      this.run();
    } else if (this.isPaused) {
      this.run();
    } else if (!this.isRunning) {
      this.run();
    } else {
      return;
    }
  }

  pause() {
    clearInterval(this.interval);
    this.isPaused = true;
    this.isRunning = false;
    this.broadcastCountdown();
  }

  resume() {
    this.start();
    this.broadcastCountdown();
  }

  stop() {
    clearInterval(this.interval);
    this.interval = null;
    this.count = -1;
    this.lots = [];
    this.isStarted = false;
    this.isRunning = false;
    this.broadcastCountdown();
    setTimeout(() => {
      this.count = 10;
      this.lots = [...this.copyLots]; // will loop the lots again on next start. remove it
    }, 20)
  }

  broadcastCountdown() {
    this.clients.forEach(client => {
      let d = { count: this.count.toString(), lot: this.currentLot || null, status: this.isStarted ? (this.isPaused ? 'paused' : 'running') : 'stopped' }
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

const lots_arr = ['1', '2', '3', '4'];
const countdown = new Countdown();
countdown.lots = [...lots_arr];
countdown.copyLots = [...lots_arr]; //copy lots for just testing purpose, it will restart with these lots again.


wss.on('connection', (ws) => {
  countdown.addClient(ws);
  ws.send(JSON.stringify({ count: countdown.count.toString(), lot: countdown.currentLot || null, status: countdown.isStarted ? (countdown.isPaused ? 'paused' : 'running') : 'stopped' }));
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

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
