# SSI Portable Employment Credential (Profile A: BBS+ Predicates)

## Purpose
This Model Captures A Portable Employment Duration Proof Flow.  
This Model Targets The Scenario Where A Candidate Proves Employment Experience >= 5 Years Without Revealing Employer Names.

## Scope
This Model Is Bounded To One End-To-End Flow.  
This Model Uses An Execution-Oriented Structure With Components, Actions, Invocations, Payloads, And Boundary Crossings.

## Files
- model.execution.v0.1.json: Execution-Oriented Model Pack For Framespace Visualisation.

## Main Components
- holder
- wallet
- issuer
- verifier
- didResolver
- statusService

## Key Privacy Controls
- Anti-Correlation Through Pairwise DIDs And Unlinkable Proofs.
- Data Minimisation Through Predicate Proofs.
- Nonce Binding Against Replay.

## Notes
This Model Is Designed To Be Mapped Directly Into UI Spaces And To Produce Risk Signals From Boundary Crossings.
