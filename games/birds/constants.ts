export const constants = {
  SCREEN_WIDTH: 900,
  SCREEN_HEIGHT: 768,
  FLOOR_POS_Y: 672,
  LEVEL_SPEED: 0.3,
  TIME_BETWEEN_GAMES: 5000,

  BIRD_WIDTH: 52,
  BIRD_HEIGHT: 40,

  // Pipe Constants
  PIPE_WIDTH: 100,
  DISTANCE_BETWEEN_PIPES: 380,
  MIN_PIPE_HEIGHT: 60,
  MAX_PIPE_HEIGHT: 630,
  HEIGHT_BETWEEN_PIPES: 200,
};

export enum PlayerStateEnum {
  OnLoginScreen = 1,
  WaitingInLobby = 2,
  Playing = 3,
  Died = 4,
}

export enum ServerStateEnum {
  WaitingForPlayers = 1,
  OnGame = 2,
  Ranking = 3,
}
