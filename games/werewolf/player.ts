import { User } from "@soapboxsocial/minis.js";

export enum PlayerStatus {
  ALIVE = "ALIVE",
  DEAD = "DEAD",
  SAVED = "SAVED",
}

export enum PlayerRole {
  WEREWOLF = "WEREWOLF",
  SEER = "SEER",
  DOCTOR = "DOCTOR",
  VILLAGER = "VILLAGER",
}

export default class Player {
  public readonly user: User;
  public role!: PlayerRole;
  public status: PlayerStatus;

  constructor(user: User) {
    this.user = user;

    this.status = PlayerStatus.ALIVE;
  }

  public kill = () => {
    this.status = PlayerStatus.DEAD;
  };

  public heal = () => {
    this.status = PlayerStatus.SAVED;
  };

  public assignRole = (role: PlayerRole) => {
    this.role = role;
  };
}
