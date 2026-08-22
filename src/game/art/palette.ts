// Cohesive aquatic palette for River Manatee (Manatee Feast lineage).
export const PAL = {
  riverNavy: 0x073b4c,
  waterDeep: 0x0b5a75,
  waterMid: 0x118ab2,
  waterLight: 0x2ba9cf,
  aqua: 0x48cae4,
  foam: 0xe9fbff,

  manatee: 0xa8b8bd,
  manateeDark: 0x76888f,
  manateeBelly: 0xd6e2e6,
  manateeBlush: 0xe89aa4,

  lettuce: 0x7ed957,
  lettuceDark: 0x3f8a2a,
  lettuceLight: 0xb9f08b,
  seaweed: 0x2d6a4f,
  seaweedLight: 0x52b788,
  shrimp: 0xffb085,
  shrimpDark: 0xe8763f,
  fish: 0xf77f00,
  fishDark: 0xb95a00,
  jelly: 0xd96ad9,
  jellyLight: 0xf3b6f3,
  jellyDeep: 0x7b3f9d,

  hazard: 0xef476f,
  hazardWarm: 0xff8c42,
  metal: 0x5b6670,
  metalLight: 0xa9b4bd,

  rope: 0xd6a85a,
  ropeLight: 0xf0cd92,
  ropeDark: 0x9c7231,
  wood: 0x8b5a2b,
  woodDark: 0x5b3a1a,
  woodLight: 0xb98252,

  hudNavy: 0x102a43,
  hudNavyLight: 0x1c4066,
  hudAccent: 0x48cae4,

  leaf: 0x2f8f4e,
  leafLight: 0x63c476,
  ink: 0x0a1a24,
  white: 0xffffff,
} as const;

export const BOAT_HULLS: number[] = [0xe23c47, 0x2f9ad6, 0xf5c542];
export const BOAT_TRIMS: number[] = [0xffffff, 0xffffff, 0x8b5a2b];

export const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
