> **⚠️ AI Agent Instructions — Keep This Document Up To Date**
>
> This is a **living reference document** maintained by AI agents during development sessions.
> When you learn something new about the topics covered here — a gotcha, a pattern, a fix —
> **add it to the relevant section** (or create a new one). Keep entries concise and code-first.
> If you refactor or extend the engine, update the examples here so they stay accurate.
> Do **not** delete existing content unless it is provably wrong or obsolete.

---

# Cypher Query Language Reference (Ladybug Engine)

> **Purpose**: AI-consumable quick-reference for Cypher as implemented in the Ladybug graph engine.
> **Standard**: Based on [openCypher](https://opencypher.org/resources/).
> **Source docs**: `engines/Capsule-Ladybug-v0/___/ladybug-docs/src/content/docs/cypher`

---

## 1. Overview & SQL Analogy

Cypher is a declarative, high-level query language for the **property graph** data model.

| Concept | SQL | Cypher |
|---|---|---|
| Query | `SELECT`/`FROM`/`WHERE` | `MATCH`/`WHERE`/`RETURN` |
| Data manipulation | `INSERT`/`UPDATE`/`DELETE` | `CREATE`/`SET`/`DELETE` |

Key differences from SQL:
- Joins are expressed with **graph pattern syntax**: `(a:Person)-[:Follows]->(b:Person)`
- **Kleene star** `*` for variable-length / recursive joins
- **No explicit GROUP BY** — grouping is implicit based on bound variables in `RETURN`
- **Statements** end with `;` and can span multiple lines
- **Clauses** are parts of a statement (`MATCH`, `RETURN`, `WHERE`, etc.)

---

## 2. Syntax Fundamentals

### Encoding & Parsing
- Input is **ASCII or Unicode** — table names and values may contain Unicode characters
- Multiline queries allowed; the parser ignores leading/trailing whitespace
- Statements **terminate with `;`**

### Escaping Reserved Keywords
Wrap identifiers in **backticks** to escape reserved keywords:

```cypher
CREATE NODE TABLE `Return` (id INT64 PRIMARY KEY, date TIMESTAMP);
MATCH (n:`Return`) RETURN n.*;
```

### Comments

```cypher
// Single-line comment
/* Multi-line
   comment */
```

### Case Insensitivity
- **Table names**, **column names**, **keywords**, and **variable names** are all case-insensitive
- `MATCH (a:Person)` and `match (a:person)` are equivalent

### Naming Rules
- Must begin with an alphabetic character (Unicode OK)
- Must **not** begin with a number
- Must **not** contain whitespace or special characters (except underscores)

| Type | Convention | Do | Don't |
|---|---|---|---|
| Node tables | CamelCase | `CarOwner` | `car_owner` |
| Rel tables | CamelCase or UPPER_SNAKE | `IsPartOf` / `IS_PART_OF` | `isPartOf` |

### Parameters
Placeholders prefixed with `$` for runtime values — prevents injection:

```cypher
MATCH (u:User) WHERE u.name = $name RETURN u.*;
```

---

## 3. Data Types

### Numeric Types

| Type | Size | Description | Aliases |
|---|---|---|---|
| `INT8` | 1 byte | signed 8-bit integer | |
| `INT16` | 2 bytes | signed 16-bit integer | |
| `INT32` | 4 bytes | signed 32-bit integer | `INT` |
| `INT64` | 8 bytes | signed 64-bit integer | `SERIAL` |
| `INT128` | 16 bytes | signed 128-bit integer | |
| `UINT8` | 1 byte | unsigned 8-bit integer | |
| `UINT16` | 2 bytes | unsigned 16-bit integer | |
| `UINT32` | 4 bytes | unsigned 32-bit integer | |
| `UINT64` | 8 bytes | unsigned 64-bit integer | |
| `FLOAT` | 4 bytes | single precision float | `REAL`, `FLOAT4` |
| `DOUBLE` | 8 bytes | double precision float | `FLOAT8` |
| `DECIMAL(p,s)` | variable | fixed precision decimal | |

### Other Scalar Types

| Type | Size | Description | Aliases |
|---|---|---|---|
| `BOOLEAN` | 1 byte | true/false | |
| `STRING` | variable | UTF-8 character string | |
| `UUID` | 16 bytes | RFC 4122 UUID | |
| `BLOB` | variable | binary large object (≤4KB) | `BYTEA` |
| `DATE` | 4 bytes | ISO-8601 `YYYY-MM-DD` | |
| `TIMESTAMP` | 4 bytes | `YYYY-MM-DD hh:mm:ss[.zzzzzz][+-TT[:tt]]` | |
| `INTERVAL` | 4 bytes | date/time duration | `DURATION` |
| `NULL` | — | unknown data | |
| `SERIAL` | 8 bytes | auto-incrementing INT64 | |
| `JSON` | variable | native JSON type (v0.15.0+) | |

### Nested / Complex Types

| Type | DDL | Description |
|---|---|---|
| `STRUCT` | `STRUCT(first STRING, last STRING)` | Fixed-key mapping (keys are strings) |
| `MAP` | `MAP(STRING, INT64)` | Variable-key dictionary (same-type keys & values) |
| `UNION` | `UNION(price FLOAT, note STRING)` | Tagged variant (like C++ `std::variant`) |
| `LIST` | `STRING[]`, `INT64[]` | Variable-length list (homogeneous) |
| `ARRAY` | `INT64[256]` | Fixed-length list (homogeneous) |

### Graph-Specific Types

| Type | Description |
|---|---|
| `NODE` | Internally `STRUCT` with `_ID`, `_LABEL`, plus properties |
| `REL` | Internally `STRUCT` with `_SRC`, `_DST`, `_ID`, `_LABEL`, plus properties |
| `RECURSIVE_REL` | `STRUCT{LIST[NODE], LIST[REL]}` with `_NODES` and `_RELS` keys |

### Constructing Complex Types

```cypher
// STRUCT
RETURN {first: 'Adam', last: 'Smith'};
RETURN STRUCT_PACK(first := 'Adam', last := 'Smith');
// Extract: full_name.first  OR  struct_extract(full_name, 'first')

// MAP
RETURN map([1, 2], ['a', 'b']);

// LIST
RETURN [1, 2, 3];
RETURN list_creation(1, 2, 3);

// ARRAY (fixed-length LIST via CAST)
RETURN CAST([3,4,12,11], 'INT64[4]');

// CAST
RETURN CAST(2.3, "INT8");
RETURN CAST(2.3 AS INT8);
RETURN CAST("12" AS INT);
RETURN CAST("[1,2,3]" AS INT[]);
```

---

## 4. Data Definition Language (DDL)

### Create Node Table

```cypher
CREATE NODE TABLE User (
    name STRING PRIMARY KEY,
    age INT64 DEFAULT 0,
    reg_date DATE
);
```

- **Primary key** required — can be `STRING`, numeric, `DATE`, `BLOB`, or `SERIAL`
- Ladybug auto-generates an index on the primary key
- Properties default to `NULL` unless `DEFAULT` is specified
- Default values can be function calls: `DEFAULT current_timestamp()`

### Create Relationship Table

```cypher
CREATE REL TABLE Follows(FROM User TO User, since DATE);
```

- **Direction**: every relationship has a `FROM` (source) and `TO` (destination)
- **No comma** between `FROM` and `TO`; comma separates multiple node table pairs
- **No user-defined primary key** — each rel gets an internal edge ID
- Multiple node pairs: `CREATE REL TABLE Knows(FROM User TO User, FROM User TO City);`

#### Relationship Multiplicities

| Multiplicity | Meaning |
|---|---|
| `MANY_MANY` (default) | No constraints |
| `MANY_ONE` | Each source node has ≤1 forward edge |
| `ONE_MANY` | Each destination node has ≤1 backward edge |
| `ONE_ONE` | ≤1 in both directions |

```cypher
CREATE REL TABLE LivesIn(FROM User TO City, MANY_ONE);
```

### IF NOT EXISTS

```cypher
CREATE NODE TABLE IF NOT EXISTS User (name STRING PRIMARY KEY);
CREATE REL TABLE IF NOT EXISTS Follows(FROM User TO User, since DATE);
```

### CREATE TABLE AS

```cypher
// Node table from CSV
CREATE NODE TABLE Person AS
    LOAD FROM "person.csv"
    RETURN *;

// Node table from query
CREATE NODE TABLE YoungPerson AS
    MATCH (p:Person) WHERE p.age < 25
    RETURN p.*;

// Rel table from CSV
CREATE REL TABLE Knows(FROM Person TO Person) AS
    LOAD FROM "knows.csv" RETURN *;
```

### ALTER TABLE

```cypher
// Add column
ALTER TABLE User ADD grade INT64;
ALTER TABLE User ADD grade INT64 DEFAULT 40;
ALTER TABLE User ADD IF NOT EXISTS grade INT64;

// Drop column
ALTER TABLE User DROP age;
ALTER TABLE User DROP IF EXISTS grade;

// Add/drop relationship connections
ALTER TABLE Follows ADD FROM User TO Celebrity;
ALTER TABLE Follows DROP FROM User TO Celebrity;

// Rename table
ALTER TABLE User RENAME TO Student;

// Rename column
ALTER TABLE User RENAME age TO grade;

// Comment
COMMENT ON TABLE User IS 'User information';
```

### DROP TABLE

```cypher
DROP TABLE Follows;    // Must drop rel tables before their node tables
DROP TABLE User;
DROP TABLE IF EXISTS UW;
```

**Gotcha**: Cannot drop a node table that is referenced in any relationship table's `FROM`/`TO`.

### Subgraphs

```cypher
// Strictly typed (default)
CREATE GRAPH my_graph;
USE my_graph;

// Open type (Neo4j-compatible, no CREATE NODE TABLE needed)
CREATE GRAPH my_graph ANY;
USE my_graph;

// List / drop
CALL SHOW_GRAPHS() RETURN *;
DROP GRAPH my_graph;
```

---

## 5. Query Clauses

### MATCH — Pattern Matching

The core clause for finding graph patterns (analogous to SQL `FROM`).

#### Match Nodes

```cypher
// Single label
MATCH (a:User) RETURN a;

// Multiple labels (union of User and City)
MATCH (a:User:City) RETURN a;

// Any label
MATCH (a) RETURN a;
```

#### Match Relationships

```cypher
// Directed (outgoing)
MATCH (a:User)-[e:Follows]->(b:User) RETURN a.name, e, b.name;

// Directed (incoming)
MATCH (a:User)<-[e:Follows]-(b:User) RETURN a.name, b.name;

// Undirected
MATCH (a:User)-[e:Follows]-(b:User) WHERE a.name = 'Karissa' RETURN b.name;

// Multiple labels
MATCH (a:User)-[e:Follows|:LivesIn]->(b:User:City) RETURN a.name, e, b.name;

// Any label
MATCH ()-[e]->() RETURN e;
```

#### Omit Variables
You can omit variable names for nodes/rels you don't need later:

```cypher
MATCH (a:User)-[:Follows]->(:User)-[:LivesIn]->(c:City)
WHERE a.name = "Adam"
RETURN a, c.name;
```

#### Multiple Patterns (Cyclic Queries)

```cypher
MATCH (a:User)-[:Follows]->(b:User)-[:Follows]->(c:User), (a)-[:Follows]->(c)
RETURN a.name, b.name, c.name;
```

Labels only need to be specified the **first time** a variable appears.

#### Equality Predicates on Properties (Syntactic Sugar)

```cypher
// These are equivalent:
MATCH (a:User)-[e:Follows {since: 2020}]->(b:User {name: "Zhang"}) RETURN a;
MATCH (a:User)-[e:Follows]->(b:User) WHERE e.since = 2020 AND b.name = "Zhang" RETURN a;
```

### MATCH — Recursive (Variable-Length) Relationships

Syntax: `-[:Label*min..max]->`

```cypher
// 1-2 hop Follows paths from Adam
MATCH (a:User)-[e:Follows*1..2]->(b:User)
WHERE a.name = 'Adam'
RETURN b.name, length(e) AS length;
```

**Default max depth** is **30** if omitted. Configurable via `CALL var_length_extend_max_depth=N;`.

#### Walk Semantics (default)

By default, Ladybug uses **walk** semantics — nodes and edges **can be visited repeatedly**.

#### Trail Semantics (no repeated edges)

```cypher
MATCH (a:User)-[e:Follows* trail 4..4]-(b:User)
WHERE a.name = 'Zhang'
RETURN b.name, properties(nodes(e), 'name');
```

#### Acyclic Semantics (no repeated nodes)

```cypher
MATCH (a:User)-[e:Follows* acyclic 4..4]-(b:User)
WHERE a.name = 'Zhang'
RETURN b.name, properties(nodes(e), 'name');
```

#### Filter Recursive Relationships

```cypher
MATCH p = (a:User)-[:Follows*1..2 (r, n | WHERE r.since < 2022 AND n.age > 45)]->(b:User)
WHERE a.name = 'Adam'
RETURN b.name, COUNT(*);
```

**Gotcha**: Only conjunctive predicates on individual nodes/rels supported. Complex mixed predicates like `n.age > 45 OR r.since < 2022` are **not** supported.

#### Project Properties of Intermediate Nodes/Rels

Two `{}` blocks: first for rel properties, second for node properties:

```cypher
MATCH (a:User)-[e:Follows*1..2 (r, n | WHERE r.since > 2020 | {r.since}, {n.name})]->(b:User)
RETURN nodes(e), rels(e);
```

#### Shortest Path Algorithms

| Syntax | Description |
|---|---|
| `*SHORTEST 1..max` | Single shortest path |
| `*ALL SHORTEST 1..max` | All shortest paths |
| `*WSHORTEST(property) 1..max` | Weighted shortest (single) |
| `*ALL WSHORTEST(property) 1..max` | All weighted shortest paths |

```cypher
// Single shortest
MATCH (a:User)-[e* SHORTEST 1..4]->(b:City)
WHERE a.name = 'Adam'
RETURN b.name, length(e);

// All shortest
MATCH p = (a)-[* ALL SHORTEST 1..3]-(b)
WHERE a.name = 'Zhang' AND b.name = 'Waterloo'
RETURN COUNT(*) AS num_shortest_path;

// Weighted shortest
MATCH p=(a:User)-[e:Follows* WSHORTEST(score)]->(b:User)
WHERE a.name='Adam'
RETURN properties(nodes(p), 'name'), cost(e);
```

**Gotcha**: Lower bound of shortest path is forced to **1** to avoid ambiguity.

### Named Paths

```cypher
MATCH p = (a:User)-[:Follows]->(b:User)
WHERE a.name = 'Adam' AND b.name = 'Karissa'
RETURN p;

// Extract nodes/rels from a path
RETURN nodes(p), rels(p);
RETURN (rels(p)[1]).since AS since;
```

### OPTIONAL MATCH

Left outer join semantics — unmatched variables become `NULL`:

```cypher
MATCH (u:User)
OPTIONAL MATCH (u)-[:Follows]->(u1:User)
RETURN u.name, u1.name;
```

### WHERE — Filtering

```cypher
MATCH (a:User)
WHERE a.age > 45 OR starts_with(a.name, "Kar")
RETURN *;

// NULL handling — NULL evaluates to FALSE in WHERE
MATCH (a:User) WHERE a.age IS NOT NULL RETURN *;

// Subquery pattern in WHERE
MATCH (a:User)
WHERE (a)-[r1:Follows]->(b:User {name: "Noura"})-[r2:LivesIn]->(c:City {name: "Guelph"})
RETURN a;
```

### RETURN — Projections & Aggregations

```cypher
// Return node/rel variables (all properties)
MATCH (a:User)-[e:Follows]->(b:User) RETURN a, e;

// Return all variables
MATCH (a:User)-[:Follows]->(b:User) RETURN *;

// Return specific properties
MATCH (a:User) RETURN a.name, a.age;

// Return all properties of a variable (star expansion)
MATCH (a:User) RETURN a.*;
MATCH (a:User)-[e:Follows]->(b:User) RETURN e.*;

// DISTINCT
MATCH (a:User)-[e:Follows]->(b:User)
RETURN DISTINCT a.name, a.age, e.since;

// GROUP BY + aggregation (implicit grouping)
MATCH (a:User)-[:Follows]->(b:User)
RETURN a, avg(b.age) AS avgFriendAge;
```

**NULL handling in aggregation**: All NULL keys grouped together; NULL values ignored.

### WITH — Intermediate Projections

```cypher
// Use aggregation result in subsequent query
MATCH (a:User)
WITH avg(a.age) AS avgAge
MATCH (b:User) WHERE b.age > avgAge
RETURN *;

// Top-k pattern
MATCH (a:User)
WITH a ORDER BY a.age DESC LIMIT 1
MATCH (a)-[:Follows]->(b:User)
RETURN *;
```

**Gotcha**: `ORDER BY` after `WITH` requires `LIMIT` and/or `SKIP` — otherwise ordering has no effect.

### ORDER BY

```cypher
MATCH (u:User) RETURN u.name, u.age ORDER BY u.age;          // ASC (default)
MATCH (u:User) RETURN u.name, u.age ORDER BY u.age DESC;     // DESC
// Multiple keys
ORDER BY b.age DESC, a.name DESC;
```

Default: ascending, NULLs first.

### LIMIT & SKIP

```cypher
// Top 3
MATCH (u:User) RETURN u.name ORDER BY u.age DESC LIMIT 3;

// Skip first 2
MATCH (u:User) RETURN u.name ORDER BY u.age SKIP 2;

// Accepts expressions
LIMIT 1+2
SKIP 2+1
```

### UNION

```cypher
MATCH (a:User) WHERE a.age > 40 RETURN a.name
UNION ALL
MATCH (a:User) WHERE a.age < 30 RETURN a.name;

// UNION (without ALL) removes duplicates
```

### UNWIND — Explode Lists

```cypher
UNWIND ["Amy", "Bob", "Carol"] AS x RETURN x;

// Nested lists
UNWIND [["Amy"], ["Bob", "Carol"]] AS x RETURN x;

// Filter with WHERE (requires WITH)
UNWIND [1, 2, 3, 4, 5] AS x
WITH x WHERE x > 2
RETURN x;
```

**Gotcha**: `WHERE` directly after `UNWIND` is not allowed — use `WITH x WHERE ...`.

### LOAD FROM — Direct File Scan

Scans files **without** importing into the database:

```cypher
LOAD FROM "user.csv" (header = true) RETURN *;
LOAD FROM "data.parquet" RETURN *;
LOAD FROM 'data.tsv' (file_format='csv') RETURN *;
```

Supports: CSV, Parquet, Pandas, Polars, Arrow tables, JSON.

### CALL — Schema Functions

```cypher
CALL SHOW_TABLES() RETURN *;
CALL TABLE_INFO('User') RETURN *;
CALL DB_VERSION() RETURN *;
CALL CURRENT_SETTING('threads') RETURN *;
CALL SHOW_FUNCTIONS() RETURN *;
CALL SHOW_WARNINGS() RETURN *;
CALL CLEAR_WARNINGS() RETURN *;
CALL SHOW_ATTACHED_DATABASES() RETURN *;
CALL SHOW_OFFICIAL_EXTENSIONS RETURN *;
CALL SHOW_LOADED_EXTENSIONS RETURN *;
CALL SHOW_INDEXES RETURN *;
CALL SHOW_PROJECTED_GRAPHS RETURN *;
```

---

## 6. Data Manipulation Clauses

Use for **small modifications**. For bulk inserts, use `COPY FROM`.

### CREATE (Insert)

```cypher
// Insert node
CREATE (u:User {name: 'Alice', age: 35});

// Insert relationship (bind source & target first)
MATCH (u1:User), (u2:User)
WHERE u1.name = 'Adam' AND u2.name = 'Noura'
CREATE (u1)-[:Follows {since: 2011}]->(u2);

// Bulk create from pattern
MATCH (a:User), (b:User) WHERE a.name = "Zhang"
CREATE (a)-[:Follows {since:2022}]->(b);
```

**Gotcha**: Primary key property on node records **must** be non-NULL.

### SET (Update)

```cypher
// Update node property
MATCH (u:User) WHERE u.name = 'Adam'
SET u.age = 50 RETURN u.*;

// Set to NULL
SET u.age = NULL;

// Update relationship property
MATCH (u0:User)-[f:Follows]->(u1:User)
WHERE u0.name = 'Adam' AND u1.name = 'Karissa'
SET f.since = 2012 RETURN f;

// Multi-label update
MATCH (u) SET u.population = 0;
```

**Gotcha**: `+=` map operator for bulk property update is **not** supported. Update properties one by one.

### DELETE

```cypher
// Delete node (must have no relationships)
MATCH (u:User) WHERE u.name = 'Alice' DELETE u;

// Delete with relationships (DETACH)
MATCH (u:User) WHERE u.name = 'Adam' DETACH DELETE u;

// Delete everything
MATCH (n) DETACH DELETE n;

// Delete specific relationship
MATCH (u:User)-[f:Follows]->(u1:User)
WHERE u.name = 'Adam' AND u1.name = 'Karissa'
DELETE f;
```

### MERGE (Upsert)

`MERGE` = "If MATCH then RETURN, else CREATE". Entire pattern matched or entire pattern created.

```cypher
// Merge node (exists → returns; doesn't exist → creates)
MERGE (n:User {name: 'Adam'}) RETURN n.*;
MERGE (n:User {name: 'Bob', age: 45}) RETURN n.*;

// With ON MATCH / ON CREATE
MERGE (n:User {name: 'Adam'}) ON MATCH SET n.age = 35 RETURN n.*;
MERGE (n:User {name: 'Bob'}) ON CREATE SET n.age = 60 RETURN n.*;

// Merge relationships
MATCH (a:User), (b:User) WHERE a.name = 'Adam' AND b.name = 'Zhang'
MERGE (a)-[e:Follows {since:2020}]->(b) RETURN e;

// Complex patterns
MERGE (:User {name:'A'})-[:Follows]->(:User {name:'B'})-[:LivesIn]->(:City {name:'Toronto'});
```

### RETURN After Update

You can chain `RETURN` after `CREATE`, `SET`, `DELETE`, or `MERGE` to see results of the modification in the same statement.

---

## 7. Subqueries

### EXISTS

Checks if a pattern has at least one match:

```cypher
MATCH (a:User)
WHERE a.age < 100 AND EXISTS { MATCH (a)-[:Follows*3..3]->(b:User) }
RETURN a.name, a.age;

// Nested EXISTS
WHERE EXISTS { MATCH (a)-[:Follows*3..3]->(b:User) WHERE EXISTS { MATCH (b)-[:Follows]->(c:User) } }
```

### COUNT

Counts matches for a pattern:

```cypher
MATCH (a:User)
RETURN a.name, COUNT { MATCH (a)<-[:Follows]-(b:User) } AS num_follower
ORDER BY num_follower;

// In WHERE
WHERE COUNT { MATCH (a)<-[:Follows]-(b:User) } = 1

// With DISTINCT
MATCH (a:User)-[e:Follows*1..2]->(b:User) WHERE a.name = 'Karissa'
RETURN COUNT(DISTINCT b) AS num_unique;
```

**Gotcha**: `CALL <subquery>` (Neo4j-style) is **not** supported.

---

## 8. Macros

Define reusable Cypher expressions:

```cypher
// Basic macro
CREATE MACRO addWithDefault(a, b:=3) AS a + b;
RETURN addWithDefault(2);      // 5
RETURN addWithDefault(4, 7);   // 11

// Case expression macro
CREATE MACRO case_macro(x) AS CASE x WHEN 35 THEN x + 1 ELSE x - 5 END;

// Function expression macro
CREATE MACRO func_macro(x) AS x + 3 + 2.5 + to_float(2.1);

// Literal macro
CREATE MACRO str_literal() AS 'result';

// Property macro
CREATE MACRO prop_macro(x) AS x.ID;

// Variable macro
CREATE MACRO var_macro(x) AS x;
```

**Gotcha**: Parameters with defaults must come after parameters without defaults.

---

## 9. Expressions, Operators & Functions

### Comparison Operators

| Op | Description |
|---|---|
| `<`, `>`, `<=`, `>=` | Standard comparisons |
| `=` | Equal (NULL = NULL → NULL) |
| `<>` | Not equal |

### Logical Operators

| Op | Description |
|---|---|
| `AND` | Logical AND |
| `OR` | Logical OR |
| `XOR` | Exclusive OR |
| `NOT` | Negation |

All follow three-valued logic with NULL.

### Null Operators

| Expression | Description |
|---|---|
| `x IS NULL` | Check for NULL |
| `x IS NOT NULL` | Check for non-NULL |

### Numeric Operators

| Op | Description |
|---|---|
| `+`, `-`, `*`, `/`, `%` | Arithmetic |
| `^` | Power |

### CASE Expression

```cypher
// Simple form
CASE a.age WHEN 50 THEN a.name END

// General form
CASE WHEN a.age < 50 THEN a.name ELSE 'other' END
```

### Pattern Matching / Regex

```cypher
// =~ operator (must match entire string)
RETURN 'abc' =~ '.*(b|d).*';       // true
RETURN 'abc' =~ '(?i)A.*';          // true (case-insensitive)

// Functions
regexp_matches('aba', '^ab')                           // true
regexp_replace('ababbb', 'b.b', 'a')                   // 'aabb'
regexp_extract('abababab', 'b.b', 0)                   // 'bab'
regexp_extract_all('abababab', 'b.b', 0)               // ['bab','bab']
regexp_split_to_array('hello world 42', ' ')           // ['hello','world','42']
// Global replace
regexp_replace('20 main   street', '\\s+', '', 'g')   // '20mainstreet'
```

### Aggregate Functions

| Function | Description |
|---|---|
| `avg(arg)` | Average value |
| `count(arg)` | Count of tuples |
| `min(arg)` | Minimum value |
| `max(arg)` | Maximum value |
| `sum(arg)` | Sum of values |
| `collect(arg)` | Collect into a list |

### Node & Relationship Functions

| Function | Description |
|---|---|
| `ID(node/rel)` | Internal database ID |
| `LABEL(node/rel)` | Label name (alias: `LABELS`) |
| `OFFSET(id)` | Offset of internal ID |

### Recursive Relationship / Path Functions

| Function | Returns | Description |
|---|---|---|
| `nodes(p)` | `LIST[NODE]` | All nodes from a path |
| `rels(p)` | `LIST[REL]` | All relationships from a path |
| `properties(list, 'prop')` | `LIST[ANY]` | Extract property from node/rel list |
| `is_trail(p)` | `BOOLEAN` | True if no repeated edges |
| `is_acyclic(p)` | `BOOLEAN` | True if no repeated nodes |
| `length(p)` | `INT64` | Number of relationships in path |
| `cost(e)` | `DOUBLE` | Cost of weighted shortest path |

### Text Functions (commonly used)

| Function | Description |
|---|---|
| `concat(s1, s2, ...)` | Concatenate strings |
| `contains(s1, s2)` | Substring check |
| `starts_with(s1, s2)` / `prefix()` | Starts with check |
| `ends_with(s1, s2)` / `suffix()` | Ends with check |
| `lower(s)` / `upper(s)` | Case conversion |
| `size(s)` | Character count |
| `substring(s, start, len)` | Extract substring (1-based) |
| `trim(s)` / `ltrim(s)` / `rtrim(s)` | Whitespace removal |
| `left(s, n)` / `right(s, n)` | Left/right substring |
| `reverse(s)` | Reverse string |
| `lpad(s, n, ch)` / `rpad(s, n, ch)` | Pad string |
| `repeat(s, n)` | Repeat string |
| `string_split(s, sep)` | Split to list |
| `split_part(s, sep, idx)` | Split and pick (1-based) |
| `levenshtein(s1, s2)` | Edit distance (case-insensitive) |
| `initcap(s)` | Capitalize first letter |
| `s CONTAINS 'sub'` | Operator alias for `contains()` |

### Numeric Functions (commonly used)

| Function | Description |
|---|---|
| `abs(x)` | Absolute value |
| `ceil(x)` / `floor(x)` | Round up / down |
| `round(x, s)` | Round to `s` decimal places |
| `sqrt(x)` | Square root |
| `pow(x, y)` | Power |
| `ln(x)` / `log(x)` / `log2(x)` | Logarithms |
| `sin/cos/tan/asin/acos/atan(x)` | Trigonometric |
| `pi()` | Pi constant |
| `factorial(x)` | Factorial |
| `sign(x)` | Sign (-1, 0, 1) |

### List Functions (commonly used)

| Function | Description |
|---|---|
| `list_creation(a, b, c)` | Create list |
| `size(list)` | Length of list |
| `list_extract(list, idx)` | Get element (1-based) |
| `list_concat(l1, l2)` | Concatenate lists |
| `list_append(list, el)` | Append element |
| `list_prepend(list, el)` | Prepend element |
| `list_contains(list, el)` | Check membership |
| `list_position(list, el)` | Find position |
| `list_slice(list, begin, end)` | Sublist |
| `list_sort(list)` | Sort (ASC default) |
| `list_reverse(list)` | Reverse |
| `list_distinct(list)` | Remove duplicates + NULLs |
| `list_sum(list)` / `list_product(list)` | Aggregate |
| `range(start, stop[, step])` | Generate integer list |
| `list_transform(list, x->expr)` | Map lambda |
| `list_filter(list, x->pred)` | Filter lambda |
| `list_reduce(list, (x,y)->expr)` | Reduce lambda |
| `list_to_string(sep, list)` | Join to string |
| `coalesce(a, b, ...)` | First non-NULL |
| `ifnull(a, b)` | First non-NULL (2 args) |
| `all/any/none/single(x IN list WHERE ...)` | Quantifier predicates |

---

## 10. Transactions

Ladybug is **ACID-compliant** with atomic, durable, serializable transactions.

- Multiple **read** transactions can run concurrently
- Only **one write** transaction at a time

### Manual Transactions

```cypher
BEGIN TRANSACTION;           -- read-write
BEGIN TRANSACTION READ ONLY; -- read-only
COMMIT;                      -- persist changes
ROLLBACK;                    -- discard changes
```

### Auto Transactions
Any command without explicit `BEGIN` is auto-wrapped in a transaction.

### Checkpoint

```cypher
CHECKPOINT;  -- Manually merge WAL to data files
```

Automatically triggered when WAL exceeds `CHECKPOINT_THRESHOLD` (default 16MB) and no active transactions.

---

## 11. Configuration

Configuration is changed via standalone `CALL` statements (**not** usable with `RETURN`):

| Option | Description | Default |
|---|---|---|
| `THREADS` | Execution thread count | system max |
| `TIMEOUT` | Query timeout (ms) | N/A |
| `VAR_LENGTH_EXTEND_MAX_DEPTH` | Max recursive depth | 30 |
| `ENABLE_SEMI_MASK` | Semi mask optimization | true |
| `HOME_DIRECTORY` | System home directory | user home |
| `FILE_SEARCH_PATH` | File search path | N/A |
| `PROGRESS_BAR` | Enable CLI progress bar | false |
| `CHECKPOINT_THRESHOLD` | WAL size for auto-checkpoint (bytes) | 16777216 (16MB) |
| `WARNING_LIMIT` | Max warnings per connection | 8192 |
| `SPILL_TO_DISK` | Spill to disk on low memory | true |

```cypher
CALL THREADS=5;
CALL TIMEOUT=3000;
CALL var_length_extend_max_depth=10;
CALL progress_bar=true;
CALL checkpoint_threshold=16777216;
```

---

## 12. ATTACH / DETACH External Databases

Connect to external Ladybug databases or relational DBMSs:

```cypher
ATTACH '/work' AS work (dbtype lbug);
MATCH (a:Manager) RETURN *;
DETACH work;
```

- Local Ladybug databases: no extension required
- External RDBMSs: requires installing an extension

---

## 13. Differences from Neo4j

| Feature | Neo4j | Ladybug |
|---|---|---|
| **Schema** | Schema-optional | Schema-required (structured property graph) |
| **MATCH semantics** | Trail (no repeated edge) | Walk (repeated edge/node OK) |
| **Variable-length upper bound** | Unlimited | Default 30 (configurable) |
| **REMOVE** | Supported | Not supported — use `SET prop = NULL` |
| **SET +=** (map update) | Supported | Not supported — update props one by one |
| **WHERE in pattern** | `(n:Person WHERE ...)` | Not supported — use separate `WHERE` clause |
| **FOREACH** | Supported | Not supported — use `UNWIND` |
| **FINISH** | Supported | Not supported — use `RETURN COUNT(*)` |
| **LOAD CSV** | `LOAD CSV FROM` | `LOAD FROM` (supports CSV, Parquet, JSON, etc.) |
| **CALL subquery** | Supported | Not supported |
| **USE graph** | Supported | Not supported — open different databases |
| **labels()** | `labels()` | `label()` |
| **elementId** | `elementId` | `id()` |
| **toXXX** casting | `toInteger()`, etc. | `cast(input, targetType)` |
| **date/time** | `date()` | `current_date()` / `current_timestamp()` |
| **SHOW** commands | `SHOW FUNCTIONS` | `CALL show_functions() RETURN *` |
| **List functions** | `tail`, `head` | `list_slice()`, `list_extract()`, `list[]` |
| **Cosine similarity** | Built-in | `ARRAY_COSINE_SIMILARITY()` |
| **Euclidean distance** | Built-in | `ARRAY_DISTANCE()` |
| **Indexes** | Manual indexes on any property | Auto primary-key index only |

### Useful Ladybug Extras
- `is_trail(path)` / `is_acyclic(path)` — check path properties
- Filter inside variable-length relationships: `(r, n | WHERE ...)` syntax
- Property projection on recursive rels: `{r.prop}, {n.prop}` syntax
- `SHORTEST` / `ALL SHORTEST` / `WSHORTEST` / `ALL WSHORTEST` — built-in shortest path

---

## 14. Reserved Keywords

### Clauses
`COLUMN`, `CREATE`, `DBTYPE`, `DEFAULT`, `GROUP`, `HEADERS`, `INSTALL`, `MACRO`, `OPTIONAL`, `PROFILE`, `UNION`, `UNWIND`, `WITH`

### Subclauses
`LIMIT`, `ONLY`, `ORDER`, `WHERE`

### Expressions
`ALL`, `CASE`, `CAST`, `ELSE`, `END`, `ENDS`, `EXISTS`, `GLOB`, `SHORTEST`, `THEN`, `WHEN`

### Literals
`NULL`, `FALSE`, `TRUE`

### Modifiers
`ASC`, `ASCENDING`, `DESC`, `DESCENDING`, `ON`

### Operators
`AND`, `DISTINCT`, `IN`, `IS`, `NOT`, `OR`, `STARTS`, `XOR`

### Schema
`FROM`, `PRIMARY`, `TABLE`, `TO`

Use **backtick escaping** to use reserved keywords as identifiers: `` `Return` ``, `` `Table` ``.

---

## 15. Common Patterns & Recipes

### Full CRUD Cycle

```cypher
// Schema
CREATE NODE TABLE User (name STRING PRIMARY KEY, age INT64 DEFAULT 0);
CREATE REL TABLE Follows(FROM User TO User, since INT64);

// Create
CREATE (u:User {name: 'Alice', age: 30});

// Read
MATCH (u:User) WHERE u.name = 'Alice' RETURN u.*;

// Update
MATCH (u:User) WHERE u.name = 'Alice' SET u.age = 31;

// Delete
MATCH (u:User) WHERE u.name = 'Alice' DELETE u;
```

### Social Network — Find Friends of Friends

```cypher
MATCH (me:User)-[:Follows]->(friend:User)-[:Follows]->(fof:User)
WHERE me.name = 'Adam' AND fof.name <> me.name
RETURN DISTINCT fof.name;
```

### Shortest Path Between Two Nodes

```cypher
MATCH p = (a:User)-[* SHORTEST 1..10]->(b:User)
WHERE a.name = 'Adam' AND b.name = 'Noura'
RETURN properties(nodes(p), 'name'), length(p);
```

### Count Relationships per Node

```cypher
MATCH (u:User)
RETURN u.name,
    COUNT { MATCH (u)-[:Follows]->() } AS following,
    COUNT { MATCH (u)<-[:Follows]-() } AS followers;
```

### Conditional Upsert

```cypher
MERGE (u:User {name: 'Charlie'})
ON CREATE SET u.age = 25
ON MATCH SET u.age = u.age + 1
RETURN u.*;
```

### Bulk Import from CSV

```cypher
COPY User FROM 'users.csv';
COPY Follows FROM 'follows.csv';
// Or via CREATE TABLE AS
CREATE NODE TABLE Person AS LOAD FROM "person.csv" RETURN *;
```

### Inspect Schema

```cypher
CALL SHOW_TABLES() RETURN *;
CALL TABLE_INFO('User') RETURN *;
CALL SHOW_CONNECTION('Follows') RETURN *;
```
