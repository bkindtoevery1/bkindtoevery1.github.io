// Generated from completed private-kan simulation results; no Q-value or neural model.
export const PRIVATE_KAN_TRAINING={
  "id": "H-private-kan-20261011-v1",
  "rulesetId": "H-2026-private-kan-v1",
  "rules": {
    "id": "H-2026-private-kan-v1",
    "ronPassAllowed": true,
    "passRonLock": "none",
    "selfDiscardFuriten": false,
    "pinfuClosedOnly": false,
    "peikouClosedOnly": false,
    "ryanpeikouDistinctSuits": true,
    "concealedKanBreaksMenzen": true,
    "concealedKanPrivate": true,
    "menzenRequiresTsumo": false,
    "sevenPairsQuadAsTwo": false,
    "greenTiles": [
      18,
      19,
      20,
      21,
      22,
      23,
      24,
      25,
      26,
      32
    ],
    "kanBonus": 100,
    "dragonBonus": 100,
    "roundWindBonus": 100,
    "seatWindBonus": 100,
    "tsumoBonusPerPayer": 100,
    "drawIncludesBonuses": false,
    "drawWaitAvailability": "structural",
    "deadWallTiles": 0,
    "maxKans": 32,
    "kanReplacement": "live-tail",
    "addedKanRobAllowed": true,
    "multipleRon": "all",
    "chiFrom": "next-active",
    "allowKuikae": true,
    "revealWinnerHand": true,
    "revealTsumoWinningTile": false,
    "roundWind": 27,
    "greenRequiresDragon": true,
    "fourOfAKindBonus": true,
    "ronContinuation": "last-winner"
  },
  "status": "complete",
  "completedGames": 34372,
  "tuningSeeds": 252,
  "validationSeeds": 504,
  "versions": [
    {
      "id": "V1",
      "name": "고득점·속도 유지",
      "description": "고득점 가치와 완성 속도를 함께 높임",
      "policy": "D",
      "candidate": "V1-2",
      "weights": {
        "speed": 60,
        "ukeire": 1,
        "value": 0.24,
        "maxShantenLoss": 1
      },
      "tuningMean": 69.39484126984127,
      "improved": false,
      "validation": {
        "meanNet": 64.2609126984127,
        "ci95Low": 49.15674603174603,
        "ci95High": 80.10974702380952,
        "meanDifference": 6.894841269841265,
        "simultaneousLow": -7.135416666666667,
        "simultaneousHigh": 21.644035218253922
      }
    },
    {
      "id": "V2",
      "name": "고득점·강한 추구",
      "description": "한 샨텐 손해까지 감수하며 고득점 형태 추구",
      "policy": "D",
      "candidate": "V2-1",
      "weights": {
        "speed": 35,
        "ukeire": 0.7,
        "value": 0.28,
        "maxShantenLoss": 1
      },
      "tuningMean": 72.0734126984127,
      "improved": false,
      "validation": {
        "meanNet": 63.56646825396825,
        "ci95Low": 48.16468253968254,
        "ci95High": 79.66269841269842,
        "meanDifference": 6.2003968253968225,
        "simultaneousLow": -11.05375744047619,
        "simultaneousHigh": 24.90916418650793
      }
    },
    {
      "id": "V3",
      "name": "고득점·속도 보존",
      "description": "최소 샨텐을 유지하는 후보 안에서 고득점 추구",
      "policy": "D",
      "candidate": "V3-1",
      "weights": {
        "speed": 65,
        "ukeire": 1,
        "value": 0.2,
        "maxShantenLoss": 0
      },
      "tuningMean": 69.84126984126983,
      "improved": false,
      "validation": {
        "meanNet": 60.267857142857146,
        "ci95Low": 44.717261904761905,
        "ci95High": 75.94246031746032,
        "meanDifference": 2.9017857142857153,
        "simultaneousLow": -13.302021329365079,
        "simultaneousHigh": 19.601624503968246
      }
    },
    {
      "id": "G1",
      "name": "0·1판 수비·약",
      "description": "저판수 손에 약한 수비, 2판 이상은 공격",
      "policy": "E",
      "candidate": "G1-1",
      "weights": {
        "speed": 65,
        "ukeire": 1,
        "value": 0.14,
        "risk": 5,
        "lowValueThreshold": 100,
        "lowValueRisk": 35,
        "maxShantenLoss": 1
      },
      "tuningMean": -22.470238095238095,
      "improved": false,
      "validation": {
        "meanNet": -22.767857142857142,
        "ci95Low": -38.78968253968254,
        "ci95High": -6.496155753968281,
        "meanDifference": -50.89285714285714,
        "simultaneousLow": -73.01587301587301,
        "simultaneousHigh": -28.777901785714306
      }
    },
    {
      "id": "G2",
      "name": "0·1판 수비·중",
      "description": "저판수 손에 중간 수비, 2판 이상은 공격",
      "policy": "E",
      "candidate": "G2-1",
      "weights": {
        "speed": 60,
        "ukeire": 1,
        "value": 0.18,
        "risk": 8,
        "lowValueThreshold": 100,
        "lowValueRisk": 70,
        "maxShantenLoss": 1
      },
      "tuningMean": -138.4920634920635,
      "improved": false,
      "validation": {
        "meanNet": -133.06051587301587,
        "ci95Low": -149.578373015873,
        "ci95High": -116.44345238095238,
        "meanDifference": -161.18551587301587,
        "simultaneousLow": -188.64118303571428,
        "simultaneousHigh": -132.72972470238096
      }
    },
    {
      "id": "G3",
      "name": "0·1판 수비·강",
      "description": "저판수 손에 강한 수비, 두 샨텐까지 후퇴 허용",
      "policy": "E",
      "candidate": "G3-1",
      "weights": {
        "speed": 55,
        "ukeire": 0.9,
        "value": 0.2,
        "risk": 12,
        "lowValueThreshold": 100,
        "lowValueRisk": 110,
        "maxShantenLoss": 2
      },
      "tuningMean": -188.29365079365078,
      "improved": false,
      "validation": {
        "meanNet": -190.50099206349208,
        "ci95Low": -207.04427083333331,
        "ci95High": -173.70969742063494,
        "meanDifference": -218.62599206349208,
        "simultaneousLow": -246.80896577380952,
        "simultaneousHigh": -191.36904761904762
      }
    }
  ]
};
