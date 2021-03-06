import type { User } from "@soapboxsocial/minis.js";
import type { Namespace, Server } from "socket.io";
import { birdsLogger } from "../../config/winston";
import { ServerStateEnum } from "./constants";
import Birds from "./game";
import type { PipeTinyObject } from "./pipe";
import type { PlayerTinyObject } from "./player";

const games = new Map<string, Birds>();

function getOrCreateGame(
  roomID: string,
  nsp: Namespace<BirdsListenEvents, BirdsEmitEvents>
) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    const game = new Birds(roomID, nsp);

    game.start();

    games.set(roomID, game);

    return game;
  }

  return instance;
}

async function deleteGame(roomID: string) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    return;
  }

  await instance.stop();

  games.delete(roomID);
}

export interface BirdsListenEvents {
  close_game: () => void;
  say_hi: (
    user: User,
    floor: number,
    fn: (gameState: ServerStateEnum, playerId: string) => void
  ) => void;
  player_jump: () => void;
  change_ready_state: (readyState: boolean) => void;
}

export interface BirdsEmitEvents {
  player_disconnect: (socketID: string) => void;
  update_game_state: (newState: ServerStateEnum) => void;
  game_loop_update: (update: {
    players: PlayerTinyObject[];
    pipes: PipeTinyObject[];
  }) => void;
  player_ready_state: (player: PlayerTinyObject) => void;
  player_list: (players: PlayerTinyObject[]) => void;
  new_player: (player: PlayerTinyObject) => void;
  ranking: (ranking: {
    score: number;
    bestScore: number;
    rank: number;
    nbPlayers: number;
    highscores: { player: string; score: number }[];
  }) => void;
}

export default function birds(io: Server<BirdsListenEvents, BirdsEmitEvents>) {
  const nsp = io.of("/birds");

  nsp.on("connection", (socket) => {
    const roomID = socket.handshake.query.roomID as string;

    const socketID = socket.id;

    socket.join(roomID);

    birdsLogger.info(`[connection] new socket connected with id ${socketID}`);

    const game = getOrCreateGame(roomID, nsp);

    game.playersManager.addNewPlayer(socket, socketID);

    socket.on("say_hi", (user, floor, fn) => {
      fn(game.state, socketID);

      game.playerLog(socket, user, floor);
    });

    socket.on("disconnect", (reason) => {
      birdsLogger.info(
        `[disconnect] socket disconnected with reason ${reason}`
      );

      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.playersManager.removePlayer(socketID);

      socket.to(roomID).emit("player_disconnect", socketID);
    });

    socket.on("close_game", async () => {
      birdsLogger.info(`[close_game] deleting game with roomID of ${roomID}`);

      await deleteGame(roomID);

      nsp.in(roomID).disconnectSockets();
    });
  });
}
