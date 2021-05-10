import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { Server } from "socket.io";
import birds from "./games/birds";
import drawWithFriends from "./games/draw";
import polls from "./games/polls";
import randomMember from "./games/random";
import trivia from "./games/trivia";
import werewolf from "./games/werewolf";
import wouldYouRather from "./games/would-you-rather";

require("dotenv").config();

const app = express();

/**
 * App Middleware
 */

app.use(cors());
app.use(compression());
app.use(helmet());

/**
 * App Routes
 */

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

polls(io);

birds(io);

wouldYouRather(io);

trivia(io);

werewolf(io);
