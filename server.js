const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();

dotenv.config();

const server = new WebSocket.Server({ port: process.env.WS_PORT });

server.on('connection', (ws) => {
    ws.on('message', (message) => {
        console.log(message);
        ws.send('Hello! Message received!');
    });
    ws.on('close', () => {
       console.log("WS closing!")
    })
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('API is running...');
});

const PORT = process.env.PORT;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
