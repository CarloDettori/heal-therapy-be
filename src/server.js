import express from "express"
import cors from "cors"
import app from "./app.js"

const server = express
const PORT = process.env.PORT || 3000

/*middlewares */
server.use(express.static("public"));
server.use(cors())
server.use(express.json())

/*rotte principali */
server.get("/", (req, res) => { res.send("Home Page"); });
server.get("/home", (req, res) => { res.send("Home Page"); });

/*tutte le altre rotte */
server.get("*", (req, res) => { res.send("Tutte Le Rotte"); });


app.listen(3000, () => {
    console.log('Server avviato su http://localhost:3000');
});


/*collegamento al server */
server.listen(PORT, () => { console.log(`Server is running on http://localhost:${PORT})}`); });