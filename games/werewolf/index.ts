import { User } from "@soapboxsocial/minis.js";
import { Namespace, Server } from "socket.io";
import Werewolf, { GameAct } from "./werewolf";
import Player from "./player";
import sample from "../../util/sample";

export interface WerewolfListenEvents {
  CLOSE_GAME: () => void;
  JOIN_GAME: (user: User) => void;
  MARK_KILL: (id: string) => void;
  KILL_MARKED: () => void;
  HEAL: (id: string) => void;
  SCRY: (id: string) => void;
  SUGGEST_WEREWOLF: (id: string) => void;
}

export interface WerewolfEmitEvents {
  TIME: (timeLeft: number) => void;
  WINNER: (winner: "VILLAGER" | "WEREWOLF") => void;
  PLAYERS: (players: { [id: string]: Player }) => void;
  ACT: (act: GameAct) => void;
  PLAYER: (player: Player) => void;
  MARKED_KILLS: (marked: string[]) => void;
  SCRY_RESULT: ({
    id,
    isWerewolf,
  }: {
    id: string;
    isWerewolf: boolean;
  }) => void;
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
    console.log(
      "[werewolf]",
      "[connection] socket connected with id",
      socket.id
    );

    const roomID = socket.handshake.query.roomID as string;

    const socketID = socket.id;

    socket.on("JOIN_GAME", async (user) => {
      console.log("[werewolf]", "[JOIN_GAME]");

      try {
        socket.join(roomID);

        const game = getOrStartGame(roomID, nsp);

        game.addPlayer(socketID, user);

        const players = Object.fromEntries(game.players.entries());

        socket.emit("PLAYER", players[socketID]);

        socket.emit("ACT", game.act);

        nsp.in(roomID).emit("PLAYERS", players);
      } catch (error) {
        console.error(error);
      }
    });

    socket.on("CLOSE_GAME", () => {
      console.log("[draw]", "[CLOSE_GAME]");

      nsp.in(roomID).disconnectSockets(true);

      deleteGame(roomID);
    });

    socket.on("MARK_KILL", async (id) => {
      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.markPlayer(id);

      const werewolfIDs = game.werewolfIDs;

      const markedIDs = game.markedIDs;

      nsp.in(roomID).to(werewolfIDs).emit("MARKED_KILLS", markedIDs);
    });

    socket.on("KILL_MARKED", async () => {
      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.killMarked();

      const werewolfIDs = game.werewolfIDs;

      nsp.in(roomID).to(werewolfIDs).emit("MARKED_KILLS", []);

      game.updateAct(GameAct.DOCTOR);

      nsp.in(roomID).emit("ACT", GameAct.DOCTOR);
    });

    socket.on("HEAL", async (id) => {
      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.healPlayer(id);

      game.updateAct(GameAct.SEER);

      nsp.in(roomID).emit("ACT", GameAct.SEER);
    });

    socket.on("SCRY", async (id) => {
      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      const isWerewolf = game.scryPlayer(id);

      socket.emit("SCRY_RESULT", { id, isWerewolf });

      game.startDay();
    });

    socket.on("disconnect", (reason) => {
      console.log(
        "[werewolf]",
        "[disconnect] socket disconnected with reason",
        reason
      );

      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.removePlayer(socketID);

      socket.leave(roomID);
    });
  });
}
