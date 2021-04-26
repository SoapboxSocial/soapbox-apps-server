import { User } from "@soapboxsocial/minis.js";
import { Namespace, Server } from "socket.io";
import Werewolf from "./werewolf";
import Player from "./player";

export interface WerewolfListenEvents {
  JOIN_GAME: (user: User) => void;
  CLOSE_GAME: () => void;
  KILL: (id: string) => void;
  HEAL: (id: string) => void;
  SCRY: (id: string) => void;
}

export interface WerewolfEmitEvents {
  TIME: (timeLeft: number) => void;
  WINNER: (winner: "VILLAGER" | "WEREWOLF") => void;
  PLAYERS: (players: Map<string, Player>) => void;
  ACT: (act: "NIGHT" | "WEREWOLF" | "DOCTOR" | "SEER" | "DAY") => void;
}

const games = new Map<string, Werewolf>();

function getOrStartGame(
  roomID: string,
  nsp: Namespace<WerewolfListenEvents, WerewolfEmitEvents>
) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    const game = new Werewolf(roomID, nsp);

    games.set(roomID, game);

    return game;
  } else {
    return instance;
  }
}

function deleteGame(roomID: string) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    return;
  }

  games.delete(roomID);
}

export default function werewolf(
  io: Server<WerewolfListenEvents, WerewolfEmitEvents>
) {
  const nsp = io.of("/werewolf");

  nsp.on("connection", (socket) => {
    const roomID = socket.handshake.query.roomID as string;

    const socketID = socket.id;

    socket.on("JOIN_GAME", async (user) => {
      console.log("[werewolf]", "[JOIN_GAME]");

      try {
        socket.join(roomID);

        const game = getOrStartGame(roomID, nsp);

        game.addPlayer(socketID, user);

        socket.emit("PLAYERS", game.players);
      } catch (error) {
        console.error(error);
      }
    });

    socket.on("CLOSE_GAME", async () => {
      console.log("[draw]", "[CLOSE_GAME]");

      nsp.in(roomID).disconnectSockets(true);

      deleteGame(roomID);
    });

    socket.on("KILL", (id) => {
      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.killPlayer(id);

      // Next Act
      nsp.in(roomID).emit("ACT", "DOCTOR");
    });

    socket.on("HEAL", (id) => {
      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.healPlayer(id);

      // Next Act
      nsp.in(roomID).emit("ACT", "SEER");
    });

    socket.on("SCRY", (id) => {
      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.scryPlayer(id);

      // Start Cycle
      game.startDay();
    });

    socket.on("disconnect", (reason) => {
      console.log(
        "[werewolf]",
        "[disconnect] socket disconnected with reason",
        reason
      );

      socket.leave(roomID);
    });
  });
}
