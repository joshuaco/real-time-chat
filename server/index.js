import express from "express";
import logger from "morgan";
import dotenv from "dotenv";

import { Server } from "socket.io";
import { createServer } from "node:http";
import { createClient } from "@libsql/client";

dotenv.config();

const port = process.env.PORT ?? 3000;

const app = express();
const server = createServer(app); // Create http server

const io = new Server(server, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 10000,
  },
});

const db = createClient({
  url: process.env.DB_URL,
  authToken: process.env.DB_TOKEN,
});

await db.execute(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    user TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

io.on("connection", async (socket) => {
  console.log("A wild user appeared!");

  socket.on("disconnect", () => {
    console.log("An user has disconnected");
  });

  socket.on("chat message", async (msg) => {
    let result;
    const username = socket.handshake.auth.username ?? "Anonymous";
    const date = new Date().toLocaleString();

    try {
      result = await db.execute({
        sql: "INSERT INTO messages (content, user, created_at) VALUES (:content, :user, :created_at)",
        args: {
          content: msg,
          user: username,
          created_at: date,
        },
      });
    } catch (err) {
      console.log(err);
      return;
    }

    io.emit(
      "chat message",
      msg,
      result.lastInsertRowid.toString(),
      username,
      date.split(" ")[1]
    );
  });

  console.log("Auth: ", socket.handshake.auth);

  if (!socket.recovered) {
    // Recuperar los mensajes
    try {
      const results = await db.execute({
        sql: "SELECT id, content, user, created_at FROM messages WHERE id > ?",
        args: [socket.handshake.auth.serverOffset ?? 0],
      });

      results.rows.forEach((row) => {
        socket.emit(
          "chat message",
          row.content,
          row.id.toString(),
          row.user,
          // Retrieve only the time part with the AM/PM indicator
          row.created_at.split(" ")[1]
        );
      });
    } catch (err) {
      console.log(err);
    }
  }
});

app.use(logger("dev"));

app.use(express.static("client"));

app.get("/", () => {});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
