# SABLE COAST: AFTER HOURS

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/lastborn04/sable-coast-after-hours/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![Reward](https://make.fun/badge/gta6-01/lastborn04/sable-coast-after-hours/reward.svg)](https://make.fun/bounty/gta6-01)

An original third-person action game set in Marisol Bay. Recover a missing master tape, follow its trail from the waterfront to the harbor, and get the reel to a night-market broadcast. The four connected missions lead into free roam.

## Play locally

Run from the repository with Node.js 22.18 or newer.

```bash
node serve.ts
```

Open [http://localhost:8080](http://localhost:8080) in desktop Chromium with WebGL 2. The game loads its assets locally and supports keyboard and mouse. Use Lite in Settings to simplify materials and distant geometry at Balanced resolution, or Low to reduce resolution as well.

| Input | Action |
|---|---|
| WASD or arrow keys | Walk or drive |
| Shift | Sprint |
| Drag the mouse | Orbit the camera |
| E | Interact or enter and exit a vehicle |
| Space | Brake |
| F or click | Strike |
| M | Save |
| Esc | Pause |

Continue resumes the latest local save. Restart from checkpoint retries the current objective.

## Package locally

```bash
out=$(mktemp -d)
MAKEFUN_OUTPUT_DIR="$out" node main.ts
```

The package contains the static game, four Chromium gameplay captures, and the MakeFun dossier.
