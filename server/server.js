const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        methods: ['GET', 'POST']
    }
});

io.on('connection', (socket) => {
    socket.on('send_location', (data) => {
        console.log(data);
        io.emit('receive_location', data);
    });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
});