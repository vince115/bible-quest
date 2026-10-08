// All tunable battle numbers live here.
export const RULES = {
  baseEnergy: 3,
  maxEnergyCarry: 1,
  openingHand: 4,
  drawPerTurn: 2,
  maxHand: 6,

  startCourage: 2,
  maxCourage: 10,
  emboldenedAt: 5,
  emboldenedBonus: 2,

  maxFaith: 10,
  maxFear: 3,

  goliathHp: 130,
  armoredMaxDamage: 1,

  /** David's passive "Against the Giant": bonus damage vs Goliath at this much Faith. */
  giantFaith: 5,
  giantBonus: 3,

  slingDamage: 6,
  slingStoneDamage: 20,
  samuelFaith: 3,
  samuelFearRemoval: 1,
  jonathanCourage: 2,
  jonathanShield: 5,

  /** Delay between end-turn resolution steps (ms). */
  stepDelay: 850,
} as const;
