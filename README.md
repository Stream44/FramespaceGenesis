<table>
  <tr>
    <td><a href="https://Stream44.Studio"><img src=".o/stream44.studio/assets/Icon-v1.svg" width="42" height="42"></a></td>
    <td><strong><a href="https://Stream44.Studio">Stream44 Studio</a></strong><br/>Open Development Project</td>
    <td>Preview release for community feedback.<br/>Get in touch on <a href="https://discord.gg/9eBcQXEJAN">discord</a>.</td>
    <td>Hand Designed<br/><b>AI Coded Alpha</a></td>
  </tr>
</table>

⚠️ **Disclaimer:** Under active development. Code has not been audited. APIs and interfaces are subject to change!

Framespace Genesis
===

Framespace Genesis is an ontology-driven structural modeling tool for declaratively building multi-dimensional models with layered reactive functional data processing resulting in a realtime interactive visualization.

Usage
--

[bun.sh](https://bun.sh) is required. Disable engines in `framespace.yaml` if one fails to run for you.

After cloning run:

```
bun install

# Start the workbench
bun run dev

# Open browser
open http://localhost:3000

# Run tests (optional)
bun run test
```

Modeling Layers
---

Visual models running in the workbench are constructed by calling model APIs implemented in various lower layers.

### L3: Model Server

Exposes model APIs for querying data. In the process model layers are linked into reactive data processing graphs.

### L4: Space Models

Space models are modular & self-contained graph models with strict boundaries.

They are infinite data substrates constructed from simple repeating primitives.

- **Capsular**
 - A model that encodes component-based implementation architectures into capsule spines.
 - The schema is dictated by https://github.com/Stream44/encapsulate

### L6: Semantic Models

Semantic models define dimensions in a space by structuring primitives into linked objects with specific properties.

- **Capsular / Capsule Spine**
 - Conveniently query *Spine Instance Trees*, *Capsule Source Trees* and *Membrane Events* in **Capsular** spaces.

### L8: View Models

View models structure one or more semantic models into derived layout visual canvases.

### L13: Workbench

The framespace workbench UI SPA implementation that connects to the **Model Server**.

Provenance
===

[![Gordian Open Integrity](https://github.com/Stream44/FramespaceGenesis/actions/workflows/gordian-open-integrity.yaml/badge.svg)](https://github.com/Stream44/FramespaceGenesis/actions/workflows/gordian-open-integrity.yaml?query=branch%3Amain) [![DCO Signatures](https://github.com/Stream44/FramespaceGenesis/actions/workflows/dco.yaml/badge.svg)](https://github.com/Stream44/FramespaceGenesis/actions/workflows/dco.yaml?query=branch%3Amain)

Repository DID: `did:repo:e7b46f0978c2cc02461b480b99a6589a2b6fa888`

<table>
  <tr>
    <td><strong>Inception Mark</strong></td>
    <td><img src=".o/GordianOpenIntegrity-InceptionLifehash.svg" width="64" height="64"></td>
    <td><strong>Current Mark</strong></td>
    <td><img src=".o/GordianOpenIntegrity-CurrentLifehash.svg" width="64" height="64"></td>
    <td>Trust established using<br/><a href="https://github.com/Stream44/t44-blockchaincommons.com">Stream44/t44-BlockchainCommons.com</a></td>
  </tr>
</table>

(c) 2026 [Christoph.diy](https://christoph.diy) • Code: [LGPL](./LICENSE.txt) • Text: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) • Created with [Stream44.Studio](https://Stream44.Studio)
