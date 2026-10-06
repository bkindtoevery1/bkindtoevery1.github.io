// Generated from completed independent validation. Regenerate with node training/export.mjs.
const value={
  "id": "H-20261006-expanded-v1",
  "weights": {
    "D": {
      "speed": 38,
      "value": 0.17
    },
    "E": {
      "speed": 90,
      "value": 0.075,
      "risk": 0
    }
  },
  "completedGames": 188100,
  "elapsedSeconds": 1451.881,
  "validationSeeds": 2000,
  "trainingSeeds": 1000,
  "analysisSha256": "4c4cd3877ea311d7fd8b588837ea126ffdfc10560889d6555b94804dd19a75a6",
  "selectionSha256": "2a6a9fc022c2fbfe92de694c42751f7e448f03cd0ba3bfb51e8d4d5e4d08f776"
};
for(const weights of Object.values(value.weights))Object.freeze(weights);
Object.freeze(value.weights);
export const TRAINING=Object.freeze(value);
