import { ThreeManateeGame } from "./three/ThreeManateeGame";

export function createGame(parent: HTMLElement): ThreeManateeGame {
  return new ThreeManateeGame(parent);
}
