const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

const app = express();


dotenv.config();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('API is running...');
});

const PORT = process.env.PORT;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
