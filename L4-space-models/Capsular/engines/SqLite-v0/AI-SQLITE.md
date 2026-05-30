> **⚠️ AI Agent Instructions — Keep This Document Up To Date**
>
> This is a **living reference document** maintained by AI agents during development sessions.
> When you learn something new about the topics covered here — a gotcha, a pattern, a fix —
> **add it to the relevant section** (or create a new one). Keep entries concise and code-first.
> If you refactor or extend the engine, update the examples here so they stay accurate.
> Do **not** delete existing content unless it is provably wrong or obsolete.

---

# Bun SQLite Reference (SqLite Engine)

> **Purpose**: AI-consumable quick-reference for `bun:sqlite` as used in the Capsule-SqLite-v0 engine.
> **Standard**: Based on [Bun SQLite docs](https://bun.sh/docs/api/sqlite).
> **Runtime**: Bun's built-in native SQLite3 driver — no npm packages required.

---

## 1. Overview & Comparison to Ladybug Cypher

Bun's `bun:sqlite` is a **synchronous**, high-performance SQLite3 driver built into the Bun runtime.
It uses standard **SQL** instead of Cypher, and operates on **relational tables** instead of a property graph.

| Concept | Ladybug (Cypher) | SQLite (SQL) |
|---|---|---|
| Storage model | Property graph (nodes + edges) | Relational tables |
| Query language | Cypher | SQL |
| Node creation | `CREATE (n:Label {pk: val})` | `INSERT OR REPLACE INTO Label (pk, ...) VALUES (?, ...)` |
| Edge creation | `MERGE (a)-[:REL]->(b)` | `INSERT OR IGNORE INTO REL (from_id, to_id) VALUES (?, ?)` |
| Pattern matching | `MATCH (a)-[:REL]->(b)` | `SELECT ... FROM a JOIN REL ON ... JOIN b ON ...` |
| OPTIONAL MATCH | `OPTIONAL MATCH` | `LEFT JOIN` |
| API style | Async (`await conn.query()`) | Synchronous (`db.query().all()`) |

Key advantages of this engine:
- **Zero dependencies** — `bun:sqlite` is built into Bun
- **Synchronous API** — no async overhead for queries
- **File-based persistence** — DB file stored on disk, survives restarts
- **Familiar SQL** — standard SQLite3 syntax

---

## 2. Database Creation & Connection

```typescript
import { Database } from 'bun:sqlite'

// File-based (persistent)
const db = new Database('/path/to/db.sqlite', { create: true })

// In-memory (ephemeral)
const db = new Database(':memory:')

// Enable WAL mode for better concurrent read performance
db.run('PRAGMA journal_mode = WAL;')

// Close when done
db.close()
```

### Options

| Option | Type | Description |
|---|---|---|
| `readonly` | `boolean` | Open in read-only mode |
| `create` | `boolean` | Create file if it doesn't exist |
| `strict` | `boolean` | Throw on parameter binding mismatches |

---

## 3. Statements & Queries

### Preparing Statements

```typescript
// Cached (recommended for repeated queries)
const stmt = db.query('SELECT * FROM Capsule WHERE capsuleName = ?1')

// Uncached
const stmt = db.prepare('SELECT * FROM Capsule WHERE capsuleName = ?1')
```

### Executing Queries

| Method | Returns | Use Case |
|---|---|---|
| `.all(...params)` | `object[]` | All matching rows |
| `.get(...params)` | `object \| null` | First row or null |
| `.run(...params)` | `{ lastInsertRowid, changes }` | DDL / DML (CREATE, INSERT, UPDATE, DELETE) |
| `.values(...params)` | `unknown[][]` | Rows as arrays (no column names) |

```typescript
// All rows
const rows = db.query('SELECT * FROM Capsule').all()

// Single row
const row = db.query('SELECT * FROM Capsule WHERE capsuleName = ?1').get('myName')

// Execute DDL
db.run('CREATE TABLE IF NOT EXISTS Capsule (capsuleSourceLineRef TEXT PRIMARY KEY)')

// Parameterized query
db.query('SELECT * FROM Capsule WHERE capsuleName = ?1').all('myName')
```

### Parameter Binding Styles

```typescript
// Positional (?1, ?2, ...)
db.query('SELECT ?1, ?2').all('hello', 'world')

// Named ($param)
db.query('SELECT $name').all({ $name: 'hello' })
```

**Gotcha**: Named parameters require the `$` prefix in the binding object unless `strict: true` is set on the Database.

---

## 4. Data Types

| JS Type | SQLite Type |
|---|---|
| `string` | `TEXT` |
| `number` | `INTEGER` or `REAL` |
| `boolean` | `INTEGER` (0/1) |
| `bigint` | `INTEGER` |
| `null` | `NULL` |
| `Uint8Array` / `Buffer` | `BLOB` |

---

## 5. Transactions

```typescript
const insertMany = db.transaction((items) => {
    const stmt = db.prepare('INSERT INTO Capsule (capsuleSourceLineRef, capsuleName) VALUES (?, ?)')
    for (const item of items) {
        stmt.run(item.lineRef, item.name)
    }
})

// Execute as a transaction (auto BEGIN/COMMIT, ROLLBACK on error)
insertMany(items)

// Transaction modes
insertMany.deferred(items)    // BEGIN DEFERRED
insertMany.immediate(items)   // BEGIN IMMEDIATE
insertMany.exclusive(items)   // BEGIN EXCLUSIVE
```

**Gotcha**: Transactions in `bun:sqlite` are **synchronous**. Do not use `await` inside a transaction callback.

---

## 6. Schema Patterns for Capsule Graph

### Simulating Nodes as Tables

Each "node type" from the graph model maps to a SQLite table:

```sql
CREATE TABLE IF NOT EXISTS Capsule (
    capsuleSourceLineRef TEXT PRIMARY KEY,
    capsuleSourceNameRef TEXT,
    capsuleSourceNameRefHash TEXT,
    capsuleSourceUriLineRef TEXT,
    cacheBustVersion INTEGER,
    capsuleName TEXT,
    cstFilepath TEXT,
    spineInstanceUri TEXT
);
```

### Simulating Edges as Junction Tables

Each "edge type" maps to a junction table with foreign key references:

```sql
CREATE TABLE IF NOT EXISTS HAS_SOURCE (
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    PRIMARY KEY (from_id, to_id)
);
```

### Upsert (MERGE equivalent)

SQLite uses `INSERT OR REPLACE` or `INSERT ... ON CONFLICT` for upsert:

```sql
-- Simple upsert (replaces entire row on conflict)
INSERT OR REPLACE INTO Capsule (capsuleSourceLineRef, capsuleName, ...)
VALUES (?1, ?2, ...);

-- Selective upsert (update specific columns on conflict)
INSERT INTO Capsule (capsuleSourceLineRef, capsuleName)
VALUES (?1, ?2)
ON CONFLICT(capsuleSourceLineRef) DO UPDATE SET
    capsuleName = excluded.capsuleName;
```

### Edge Upsert

```sql
INSERT OR IGNORE INTO HAS_SOURCE (from_id, to_id) VALUES (?1, ?2);
```

---

## 7. Query Patterns for Graph Traversal

### Pattern: Node → Edge → Node (equivalent to Cypher MATCH)

```sql
-- Cypher: MATCH (cap:Capsule)-[:HAS_SOURCE]->(cs:CapsuleSource)
SELECT cap.*, cs.*
FROM Capsule cap
JOIN HAS_SOURCE hs ON hs.from_id = cap.capsuleSourceLineRef
JOIN CapsuleSource cs ON cs.id = hs.to_id;
```

### Pattern: Multi-hop Traversal

```sql
-- Cypher: MATCH (cap:Capsule)-[:IMPLEMENTS_SPINE]->(s:SpineContract)-[:HAS_PROPERTY_CONTRACT]->(pc:PropertyContract)
SELECT cap.capsuleName, s.contractUri, pc.contractKey
FROM Capsule cap
JOIN IMPLEMENTS_SPINE isp ON isp.from_id = cap.capsuleSourceLineRef
JOIN SpineContract s ON s.id = isp.to_id
JOIN HAS_PROPERTY_CONTRACT hpc ON hpc.from_id = s.id
JOIN PropertyContract pc ON pc.id = hpc.to_id;
```

### Pattern: OPTIONAL MATCH (LEFT JOIN)

```sql
-- Cypher: OPTIONAL MATCH (pc)-[:HAS_PROPERTY]->(p:CapsuleProperty)
SELECT s.*, pc.*, p.*
FROM SpineContract s
JOIN HAS_PROPERTY_CONTRACT hpc ON hpc.from_id = s.id
JOIN PropertyContract pc ON pc.id = hpc.to_id
LEFT JOIN HAS_PROPERTY hp ON hp.from_id = pc.id
LEFT JOIN CapsuleProperty p ON p.id = hp.to_id;
```

### Pattern: IN clause with parameter list

SQLite doesn't support array parameters directly. Build the IN clause dynamically:

```typescript
const names = ['a', 'b', 'c']
const placeholders = names.map((_, i) => `?${i + 1}`).join(', ')
const query = `SELECT * FROM Capsule WHERE capsuleName IN (${placeholders})`
db.query(query).all(...names)
```

---

## 8. Performance Tips

- **Use WAL mode** for concurrent reads: `PRAGMA journal_mode = WAL;`
- **Batch inserts in transactions** — dramatically faster than individual inserts
- **Use prepared statements** (`db.query()`) for repeated queries — Bun caches them
- **Create indexes** on frequently queried columns:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_capsule_name ON Capsule(capsuleName);
  CREATE INDEX IF NOT EXISTS idx_capsule_spine ON Capsule(spineInstanceUri);
  ```
- **Use `INSERT OR REPLACE`** instead of SELECT-then-INSERT for upserts

---

## 9. Differences from Ladybug Engine

| Feature | Ladybug | SQLite |
|---|---|---|
| **API** | Async (`await`) | Synchronous |
| **Query language** | Cypher | SQL |
| **Graph traversal** | Native pattern matching | JOINs |
| **Persistence** | In-memory only (`:memory:`) | File-based by default |
| **Dependencies** | `lbug` npm package | Built-in `bun:sqlite` |
| **MERGE (upsert)** | `MERGE ... ON CREATE SET ... ON MATCH SET` | `INSERT OR REPLACE` / `ON CONFLICT` |
| **Edge creation** | Implicit via `MERGE (a)-[:REL]->(b)` | Explicit `INSERT INTO edge_table` |
| **NULL filtering** | `WHERE x IS NOT NULL AND x <> ''` | Same syntax |
| **OPTIONAL MATCH** | `OPTIONAL MATCH` clause | `LEFT JOIN` |

---

## 10. Common Gotchas

1. **Synchronous API**: All `bun:sqlite` operations are synchronous. The EngineAPI wraps them
   in async functions for interface compatibility with other engines.

2. **No array parameters**: SQLite doesn't support `WHERE x IN ($array)`. Must build
   placeholder strings dynamically.

3. **TEXT for JSON**: Store JSON objects as TEXT columns, parse with `JSON.parse()` on read.

4. **Primary key = ROWID**: When using `INTEGER PRIMARY KEY`, SQLite aliases it to ROWID.
   We use `TEXT PRIMARY KEY` for string-based identifiers.

5. **Boolean storage**: SQLite stores booleans as `INTEGER` (0/1). Compare with `= 1` or `= 0`.

6. **File locking**: Only one writer at a time. WAL mode allows concurrent readers with one writer.

7. **String escaping**: Use parameterized queries (`?1`, `$param`) instead of string interpolation
   to avoid SQL injection and escaping issues.
