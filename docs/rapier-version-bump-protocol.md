# Rapier Version Bump Protocol (Milestone 0.6)

- **Date**: 2026-07-01
- **Status**: ✅ LOCKED

Determinism is the core pillar of PINBALLZZZ's leaderboard validation and playability verification system. Because Rapier.js updates can introduce subtle changes in internal solver float representation or contact point resolution, **arbitrary version updates of the physics engine are forbidden**.

This protocol defines the strict steps required to change the physics package version.

---

## 1. Upgrade Windows

1. **Permitted**: Early prototype stages (M1 - M2).
2. **Restricted**: Campaign development phases (M3). Bumps require team sign-off.
3. **Frozen**: Post M4 (Release Candidate / Live). No bumps allowed unless a critical crash or engine-level security vulnerability is found.

---

## 2. Upgrade Step-by-Step

When a bump is requested (e.g. to access a new feature or fix a bug):

```
[Clean Branch] ──▶ [npm install new-version] ──▶ [Run npm run rapier-bump-check]
                                                          │
             ┌────────────────────────────────────────────┴─────────────┐
             ▼                                                          ▼
      [All Replays Match]                                       [Hash Mismatches]
             │                                                          │
             ▼                                                          ▼
      [Commit & Merge]                                          [Upgrade REJECTED]
                                                                        OR
                                                              [Full Replay Re-record]
```

1. **Create Clean Branch**: Checkout a fresh branch from `master`.
2. **Install Target Version**: Run `npm install @dimforge/rapier2d-compat@<target-version> --strict-ssl=false`.
3. **Execute Bump Check**: Run `npm run rapier-bump-check`.
4. **Evaluate Results**:
   - **All Pass**: The upgrade is safe. Commit changes and open a PR.
   - **Hash Mismatch**: A mismatch indicates that the new engine version changed physics calculations. 
     - *Action*: Either reject the upgrade, or re-record all golden replays, verify them manually, and update their expected hashes in the codebase.

---

## 3. The `rapier-bump-check` Script

This check is registered in `package.json` and runs as part of the regression pipeline. It performs a headless re-simulation of all golden replays stored in `tests/replays/` and compares the resulting position hashes against their recorded expected values.
