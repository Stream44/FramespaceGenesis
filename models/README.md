Framespace Genesis Models
====

Models together with visualizations are at the heart of framespace.

Models define:

- The components in the model that will be executed
- The schemas that the executing components map to
- The taxonomy and ontology that binds the schemas
- The object representations (reps) that will render entities
- How to map the model graph to one or more visualization graphs

Visualizations:

- Implement the the structure of a specific visual space driven from a visualization graph
- Defer rendering of entities to reps from the model

The same visualization is used by many models and the same model may target multiple visualizations.


Existing Models
---

The foundation model is the **Encapsulate/CapsuleSpine** model which makes [encapsulate](https://github.com/Stream44/encapsulate) *Capsule Source Trees* and *Membrane Events* available for querying using a high-level API.

The model API is backed by `Capsule-` query [engines](../engines) making the API available for different storage technologies.

The **Framespace/Workbench** model frames access into the **Encapsulate/CapsuleSpine** model for the purpose of driving a visual IDE to explore capsule graphs.

Upon this foundation, the following sets of models are being built:

- `./Exploratory/` - Initial drafts for community review (**warning: may or may not run**)
- `./PeerReview/` - Complete models for acceptance by community
- `./Accepted/` - Community maintained models


Building Models
---

Your participation is welcome in building models. We need to figure out how to create dense informational visualizations that are useful.

To build a model, duplicate an existing model and place it into a directory in `./Exploratory/` according to the conventions established there.

Run the model without modification to ensure it still works and then start making changes. Keep the UI working and the tests passing adding test coverage for changes as you go along.

When you are ready to share your model see [CONTRIBUTING.md](../CONTRIBUTING.md).

Evangelize your model and get others to look at it to move it along the peer review and acceptance process if you want your model to become widely used.


Reading
---

- [Semantic Linking: Managing Mappings](https://commonsensedata.substack.com/p/semantic-linking-managing-mappings)
 - Framespace models leverage *Option 3: Mappings are part of the (extended) Knowledge Plane* and go beyond my co-locating multiple layered knowledge planes in the same graph.

- [Sovereign Agentic AI (Volodymyrs View)](https://volodymyrpavlyshyn.substack.com/)
 - Many great posts about Knowledge Graphs

---

(c) 2026 [Christoph.diy](https://christoph.diy) • Code: [LGPL](../LICENSE.txt) • Text: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) • Created with [Stream44.Studio](https://Stream44.Studio)
