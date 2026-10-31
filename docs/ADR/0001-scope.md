
# ADR-0001: MVP Scope and Static Import Simulation

## Status
Accepted for the proposed MVP architecture.

## Date
2026-10-15

## Context
The Data Rehearsal Web App aims to help users detect data integrity problems before importing CSV datasets into relational databases.

Two implementation approaches were considered:

### Option A: Static Import Simulation
Validate CSV datasets against user-defined schemas without connecting to or modifying a real database.

### Option B: Live Database Simulation
Connect to an actual database and execute test imports or transactions in an isolated environment.

## Decision
The MVP will implement static, schema-based CSV validation and dependency analysis.

Direct database connections and actual import execution will remain outside the MVP scope.

## Reasons
1. Reduces implementation complexity.
2. Avoids requiring production database credentials.
3. Improves privacy by limiting data transfer.
4. Eliminates database modification risks during rehearsal.
5. Reduces hosting and infrastructure requirements.
6. Supports faster development and automated testing.
7. Fits the initial Final Year Project scope.

## Implementation Approach
The MVP will include:
- Browser-side CSV parsing
- User-defined schemas
- Required field validation
- Data type validation
- Primary key validation
- Foreign key validation
- Dependency graph generation
- Recommended import order
- Validation reports

## Positive Consequences
- Simpler architecture
- Lower infrastructure cost
- Safer initial validation
- Easier automated testing
- No production database access required

## Negative Consequences
- Cannot fully simulate database triggers.
- Cannot guarantee real import success.
- Cannot reproduce every database-specific constraint.
- Cannot validate against live database records.
- Does not execute real transactions.

## Alternatives Considered

### Direct Production Database Connection
Rejected for the MVP because it introduces additional security, access control, and infrastructure concerns.

### Temporary Database Sandbox
Deferred because it requires additional database provisioning, resource management, and cleanup mechanisms.

## Future Considerations
Future versions may support:
- Isolated database environments
- Database-specific validation
- Transaction-based simulations
- Live schema inspection
- Real migration testing

## Final Decision
Use static, schema-based import simulation for the MVP while keeping the architecture modular enough to support more advanced simulation methods later.
