import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { Server } from "socket.io";
import drawWithFriends from "./lib/draw";
import randomMember from "./routes/random";
import trivia from "./routes/trivia";

require("dotenv").config();

const app = express();

/**
 * App Middleware
 */
app.use(cors());
app.use(express.json());
app.use(compression());
app.use(helmet());

/**
 * App Routes
 */
app.use("/trivia", trivia);

app.get("/", (req, res) => res.send("Soapbox Apps Server"));

/**
 * App Startup
 */

app.set("PORT", process.env.PORT || 8080);

const httpServer = app.listen(app.get("PORT"), () => {
  console.log(`🧼 [server]: listening at ${app.get("PORT")}`);
});

const io = new Server(httpServer, {
  cors: { origin: "*" },
});

/**
 * Socket.io Handlers
 */

drawWithFriends(io);

randomMember(io);
