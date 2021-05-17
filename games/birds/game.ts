import { Namespace, Socket } from "socket.io";
import { BirdsEmitEvents, BirdsListenEvents } from ".";
import { checkCollision } from "./collisionEngine";
import {
  constants as Const,
  PlayerStateEnum,
  ServerStateEnum,
} from "./constants";
import PipeManager from "./pipeManager";
import { PlayerTinyObject } from "./player";
import PlayersManager from "./playersManager";

export default class Birds {
  public readonly roomID: string;
  public state: ServerStateEnum;
  public playersManager: PlayersManager;

  private nsp: Namespace<BirdsListenEvents, BirdsEmitEvents>;
  private pipeManager: PipeManager;
  private timeStartGame: number;
  private lastTime: number | null;
  private timer: NodeJS.Timeout | null;

  constructor(
    roomID: string,
    nsp: Namespace<BirdsListenEvents, BirdsEmitEvents>
  ) {
    this.nsp = nsp;
    this.roomID = roomID;
    this.playersManager = new PlayersManager();
    this.pipeManager = new PipeManager();
    this.state = ServerStateEnum.WaitingForPlayers;
    this.lastTime = null;
    this.timer = null;
    this.timeStartGame = 0;
  }

  public stop = async () => {};

  public start = () => {
    this.playersManager.on("players-ready", () => {
      console.log("[birds]", "players ready, start game!");

      this.startGameLoop();
    });

    this.pipeManager.on("need_new_pipe", () => {
      console.log("[birds]", "generate new pipe!");

      // Create a pipe and send it to clients
      this.pipeManager.newPipe();
    });
  };

  private updateGameState = (
    newState: ServerStateEnum,
    notifyClients: boolean
  ) => {
    this.state = newState;

    switch (this.state) {
      case ServerStateEnum.WaitingForPlayers:
        console.log("[birds]", "[updateGameState]", "waiting for players");
        break;
      case ServerStateEnum.OnGame:
        console.log("[birds]", "[updateGameState]", "playing game");
        break;
      case ServerStateEnum.Ranking:
        console.log("[birds]", "[updateGameState]", "displaying scoreboard");
        break;
      default:
        console.log("[birds]", "[updateGameState]", "server is dead");
    }

    // If requested, inform clients about the change
    if (notifyClients) {
      this.nsp.in(this.roomID).emit("update_game_state", newState);
    }
  };

  public playerLog = (
    socket: Socket<BirdsListenEvents, BirdsEmitEvents>,
    nick: string,
    floor: number
  ) => {
    const player = this.playersManager.getPlayer(socket.id);

    if (typeof player === "undefined") {
      console.error(
        "[birds]",
        "[playerLog]",
        `player with id: ${socket.id} not found!`
      );

      return;
    }

    socket.on("change_ready_state", (readyState) => {
      // If the server is currently waiting for players, update ready state
      if (this.state === ServerStateEnum.WaitingForPlayers) {
        console.log("[birds]", "[change_ready_state]", "waiting for players");

        this.playersManager.changeLobbyState(socket.id, readyState);

        this.nsp
          .in(this.roomID)
          .emit("player_ready_state", player.getPlayerObject());
      }
    });

    // Handle player jumping
    socket.on("player_jump", () => player.jump());

    // Set player's nickname and prepare him for the next game
    this.playersManager.prepareNewPlayer(player, nick, floor);

    // Notify new client about other players AND notify other about the new one ;)
    socket.emit("player_list", this.playersManager.getPlayerList());

    this.nsp.in(this.roomID).emit("new_player", player.getPlayerObject());
  };

  private gameOver = () => {
    // Stop game loop
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.lastTime = null;

    // Change server state
    this.updateGameState(ServerStateEnum.Ranking, true);

    // Send players score
    this.playersManager.sendPlayerScore();

    // After 5s, create a new game
    setTimeout(() => {
      let players: PlayerTinyObject[];

      // Flush pipe list
      this.pipeManager.flushPipeList();

      // Reset players state and send it
      players = this.playersManager.resetPlayersForNewGame();

      for (let i = 0; i < players.length; i++) {
        this.nsp.in(this.roomID).emit("player_ready_state", players[i]);
      }

      // Notify players of the new game state
      this.updateGameState(ServerStateEnum.WaitingForPlayers, true);
    }, Const.TIME_BETWEEN_GAMES);
  };

  private startGameLoop = () => {
    // Change server state
    this.updateGameState(ServerStateEnum.OnGame, true);

    // Create the first pipe
    this.pipeManager.newPipe();

    // Start timer
    this.timer = setInterval(() => {
      let now = new Date().getTime();
      let elapsedTime = 0;

      // get time difference between the last call and now
      if (this.lastTime) {
        elapsedTime = now - this.lastTime;
      } else {
        this.timeStartGame = now;
      }

      this.lastTime = now;

      // If everyone has quit the game, exit it
      if (this.playersManager.getNumberOfPlayers() === 0) {
        this.gameOver();
      }

      // Update players position
      this.playersManager.updatePlayers(elapsedTime);

      // Update pipes
      this.pipeManager.updatePipes(elapsedTime);

      // Check collisions
      if (
        checkCollision(
          this.pipeManager.getPotentialPipeHit(),
          this.playersManager.getPlayersListByState(PlayerStateEnum.Playing)
        )
      ) {
        if (!this.playersManager.arePlayersStillAlive()) {
          this.gameOver();
        }
      }

      this.nsp.in(this.roomID).emit("game_loop_update", {
        players: this.playersManager.getOnGamePlayerList(),
        pipes: this.pipeManager.getPipeList(),
      });
    }, 1000 / 60);
  };
}
