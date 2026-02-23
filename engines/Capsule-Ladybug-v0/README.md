LadybugDB engine for Encapsulate
===

This engine integrates the [encapsulate](https://github.com/Stream44/encapsulate) library with the (ladybugdb.com)[https://ladybugdb.com/] embedded database engine.

Encapsulate *Capsule Source Trees* and *Membrane Events* are fed into **ladybug** for graph querying.

The engine defines a method-based query API for the **Capsule Spine Contract** model by implementing [Cypher](https://docs.ladybugdb.com/cypher/) queries for each method.
This abstraction allows for mapping the model used by the visualization layer to concrete queries treating the model as the contract boundary.
