const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();

dotenv.config();

// Has a websocket port issue when deployed to GCP -> 
// TypeError: One and only one of the "port", "server", or "noServer" options must be specified
// at new WebSocketServer
/* const server = new WebSocket.Server({ port: process.env.WS_PORT });

console.log("WS server listening on port " + process.env.WS_PORT);
console.log("WS server: " + server);

server.on('connection', (ws) => {
    ws.on('message', (message) => {
        console.log(message);
        ws.send('Hello! Message received!');
    });
    ws.on('close', () => {
       console.log("WS closing!")
    })
}); */

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('API is running...');
});

const PORT = process.env.PORT;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
