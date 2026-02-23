Framespace Genesis Workbench
===

The workbench hosts all visual models and connectes them with the backend modeling engine which provides REST apis to query the graph model.

When a [Capsule Spine Tree Instance](https://github.com/Stream44/encapsulate/tree/main/src/spine-contracts/CapsuleSpineContract.v0) is loaded, the visualizations update as controls are manipulated.

The UI is implemented using [SolidJS](https://www.solidjs.com/) allowing for rapid signal based selective re-rendering of entities.


Features
---

Visualization Libraries

- [x] [SolidJS](https://www.solidjs.com/) renderers for schema entities called **Reps** ([object] Representations)
  - [ ] Hardcoded reps for encapsulate model (**WIP**)
  - [ ] Projected reps from capsules
- [x] [Cytoscape.js](https://js.cytoscape.org/) - Graph theory (network) library for visualisation and analysis
  - [ ] https://github.com/iVis-at-Bilkent/cytoscape.js-fcose
- [ ] [d3js.org](https://d3js.org/)
- [ ] [Sigma.js])(https://github.com/jacomyal/sigma.js) - A JavaScript library aimed at visualizing graphs of thousands of nodes and edges
