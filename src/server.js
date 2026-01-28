import express from "express"
import cors from "cors"
import 'dotenv/config';
import app from "./app.js"

const server = express()
const PORT = process.env.PORT || 3000

/*middlewares */
server.use(cors())
server.use(express.json())
server.use(express.static("public"));

/*rotte principali */
server.get("/", (req, res) => { res.send("Home Page"); });
server.get("/home", (req, res) => { res.send("Home Page"); });

/*tutte le altre rotte */
server.use((req, res) => {
    res.send("SONO TUTTE LE ROTTE")
})




/*collegamento al server */
server.listen(PORT, () => { console.log(`Server is running on http://localhost:${PORT})}`); });