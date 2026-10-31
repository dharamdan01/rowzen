
# Data Rehearsal Web App
## Functional Requirements Test Scenarios

**Document:** test-scenarios.md  
**Version:** 1.0  
**Project:** Data Rehearsal Web App  
**Document Type:** Software Testing Documentation  
**Status:** Draft - Not Executed  

---

# 1. Introduction

## 1.1 Purpose

This document defines test scenarios for the functional requirements of the Data Rehearsal Web App.

The purpose is to verify that each feature behaves correctly under valid, invalid, boundary, and security-related conditions.

## 1.2 Testing Objectives

- Verify all functional requirements.
- Identify defects before deployment.
- Validate CSV parsing and schema configuration.
- Verify data integrity checks.
- Test dependency analysis.
- Validate rehearsal reports.
- Verify authentication and authorization.
- Protect user data and uploaded CSV content.
- Ensure predictable error handling.
- Maintain traceability between requirements and tests.

## 1.3 Scope

This document covers functional requirements FR-01 through FR-11 as defined in `SRS.md`.

The application uses static, schema-based CSV import simulation.

Tests must not require actual data imports into a production database.

## 1.4 Test Scenario Format

Each test scenario contains:

| Field | Description |
|---|---|
| Test ID | Unique test scenario identifier |
| Requirement ID | Associated functional requirement |
| Test Scenario | Functionality being tested |
| Test Type | Positive, Negative, Boundary, or Security |
| Preconditions | Conditions required before execution |
| Test Steps | Actions performed during testing |
| Test Data | Input values or test files |
| Expected Result | Required system behavior |

## 1.5 Testing Levels

- Unit Testing
- Integration Testing
- End-to-End Testing
- Security Testing
- Regression Testing

## 1.6 Test Status

All scenarios are initially marked **Not Executed**.

Possible execution statuses:

- Not Executed
- Passed
- Failed
- Blocked
- Not Applicable

---

# 2. Test Environment

## 2.1 Technology Stack

| Component | Technology |
|---|---|
| Frontend | Next.js and React |
| Language | TypeScript |
| Backend | Next.js Route Handlers |
| Authentication | Better Auth |
| Database | PostgreSQL |
| ORM | Prisma |
| Unit Testing | Vitest |
| E2E Testing | Playwright |
| Development OS | Windows 11 |
| Browser | Chromium-based browser |

## 2.2 Test Configuration

The following limits must be defined in the application configuration before executing boundary tests:

- `MAX_CSV_FILE_SIZE`
- `MAX_CSV_ROWS`
- `MAX_CSV_COLUMNS`
- Supported CSV encodings
- Supported schema data types
- Supported report export formats

These names represent test configuration references, not existing environment variables.

Tests must use actual configured values rather than assuming arbitrary limits.

---

# 3. Sample Test Data

Reusable test fixtures should be stored inside a dedicated test fixtures directory.

## 3.1 Valid Users Dataset

File: `users-valid.csv`

```csv
id,name,email
1,Alice,alice@example.com
2,Bob,bob@example.com
3,Charlie,charlie@example.com
```

Schema:

- id: Integer, Primary Key, Required
- name: String, Required
- email: String, Required

## 3.2 Valid Orders Dataset

File: `orders-valid.csv`

```csv
order_id,user_id,amount
101,1,500
102,2,1200
103,3,750
```

Schema:

- order_id: Integer, Primary Key, Required
- user_id: Integer, Foreign Key, Required
- amount: Integer, Required

Relationship:

`orders.user_id -> users.id`

## 3.3 Invalid Users Dataset

File: `users-invalid.csv`

```csv
id,name,email
1,Alice,alice@example.com
1,Bob,bob@example.com
3,,charlie@example.com
abc,David,david@example.com
```

Expected problems:

- Duplicate primary key
- Missing required name
- Invalid integer value

## 3.4 Invalid Orders Dataset

File: `orders-invalid.csv`

```csv
order_id,user_id,amount
101,1,500
102,99,1200
103,,750
```

Expected problems:

- Missing foreign key reference for user 99
- Missing required user_id

## 3.5 Test Accounts

Create two independent users:

- User A: `tester-a@example.com`
- User B: `tester-b@example.com`

Use test-only passwords managed securely by the test environment.

These users are required for ownership and authorization testing.

---

# 4. FR-01: User Authentication

## Requirement

The system shall allow users to register, sign in, and sign out securely.

### TS-01-01: Successful User Registration

**Type:** Positive

**Preconditions:**
- Registration page is accessible.
- Email address is not registered.

**Test Steps:**
1. Open registration page.
2. Enter valid registration information.
3. Submit the registration form.

**Test Data:**
- Email: newuser@example.com
- Password: Valid password meeting configured requirements

**Expected Result:**
- Account is created successfully.
- The user receives an appropriate confirmation.
- Authentication state follows the configured registration flow.

### TS-01-02: Duplicate Email Registration

**Type:** Negative

**Preconditions:**
- An account already exists with the given email.

**Test Steps:**
1. Open registration page.
2. Enter an existing email.
3. Submit the form.

**Test Data:**
- Existing email: tester-a@example.com

**Expected Result:**
- Duplicate account registration is rejected.
- An appropriate error is displayed.
- No duplicate user account is created.

### TS-01-03: Successful Login

**Type:** Positive

**Preconditions:**
- A valid user account exists.

**Test Steps:**
1. Open login page.
2. Enter valid credentials.
3. Submit the form.

**Test Data:**
- Valid registered email
- Correct password

**Expected Result:**
- User is authenticated.
- A valid session is established.
- User can access the dashboard.

### TS-01-04: Invalid Login Credentials

**Type:** Negative

**Preconditions:**
- Login page is accessible.

**Test Steps:**
1. Enter a registered email.
2. Enter an incorrect password.
3. Attempt to log in.

**Test Data:**
- Valid email
- Incorrect password

**Expected Result:**
- Authentication fails.
- Protected resources remain inaccessible.
- A safe authentication error is displayed.

### TS-01-05: Missing Authentication Fields

**Type:** Boundary

**Preconditions:**
- Login page is accessible.

**Test Steps:**
1. Leave email or password empty.
2. Submit the form.

**Test Data:**
- Empty email
- Empty password

**Expected Result:**
- Validation prevents invalid submission.
- Required field errors are displayed.
- No authenticated session is created.

### TS-01-06: Protected Route Without Authentication

**Type:** Security

**Preconditions:**
- User is logged out.

**Test Steps:**
1. Open a protected dashboard URL directly.
2. Attempt to request a protected API.

**Test Data:**
- No authenticated session

**Expected Result:**
- Protected page access is prevented.
- API rejects unauthorized requests.
- Private data is not returned.

### TS-01-07: User Logout

**Type:** Positive

**Preconditions:**
- User is authenticated.

**Test Steps:**
1. Select Logout.
2. Attempt to revisit a protected page.
3. Attempt to access a protected API.

**Test Data:**
- Active session

**Expected Result:**
- Session is invalidated.
- Protected resources become inaccessible.
- User must authenticate again.

---

# 5. FR-02: CSV File Upload

## Requirement

The system shall allow users to select, parse, and preview supported CSV files.

### TS-02-01: Upload Valid CSV

**Type:** Positive

**Preconditions:**
- User has opened a rehearsal.
- Upload interface is accessible.

**Test Steps:**
1. Select a valid CSV file.
2. Upload or load the file.
3. View the data preview.

**Test Data:**
- users-valid.csv

**Expected Result:**
- CSV is parsed successfully.
- Three data records are displayed.
- Column headers are identified correctly.

### TS-02-02: Upload Unsupported File Type

**Type:** Negative

**Preconditions:**
- Upload interface is accessible.

**Test Steps:**
1. Select an unsupported file.
2. Attempt to process it.

**Test Data:**
- document.pdf

**Expected Result:**
- File is rejected.
- An appropriate format error is displayed.
- No CSV validation begins.

### TS-02-03: Upload Empty CSV

**Type:** Boundary

**Preconditions:**
- Upload interface is accessible.

**Test Steps:**
1. Create an empty CSV file.
2. Upload the file.

**Test Data:**
- 0-byte CSV file

**Expected Result:**
- Application does not crash.
- File is identified as empty or invalid.
- User receives a meaningful message.

### TS-02-04: Upload Malformed CSV

**Type:** Negative

**Preconditions:**
- Upload interface is accessible.

**Test Steps:**
1. Create a CSV with an unclosed quoted field.
2. Upload the file.

**Test Data:**

```csv
id,name
1,"Alice
2,Bob
```

**Expected Result:**
- Malformed CSV is detected.
- Parsing error is displayed.
- Invalid data is not silently accepted.

### TS-02-05: Upload File Exceeding Size Limit

**Type:** Boundary

**Preconditions:**
- Maximum file size is configured.

**Test Steps:**
1. Generate a CSV exceeding the configured limit.
2. Attempt to upload it.

**Test Data:**
- File size: MAX_CSV_FILE_SIZE + 1 byte

**Expected Result:**
- File is rejected.
- Limit-related error is displayed.
- Excessive processing is prevented.

### TS-02-06: Upload File at Maximum Size

**Type:** Boundary

**Preconditions:**
- Maximum file size is configured.

**Test Steps:**
1. Generate a structurally valid CSV at the exact size limit.
2. Upload the file.

**Test Data:**
- File size: MAX_CSV_FILE_SIZE

**Expected Result:**
- File passes the size-limit check.
- Parsing proceeds if all other constraints are satisfied.

### TS-02-07: CSV with Quoted Commas

**Type:** Positive

**Preconditions:**
- Upload interface is accessible.

**Test Steps:**
1. Upload a CSV containing quoted commas.
2. Inspect parsed columns.

**Test Data:**

```csv
id,name
1,"Smith, John"
```

**Expected Result:**
- Quoted comma is treated as part of the field.
- Two columns are identified.
- No incorrect extra column is generated.

### TS-02-08: CSV Containing Only Headers

**Type:** Boundary

**Preconditions:**
- Upload interface is accessible.

**Test Steps:**
1. Upload a CSV containing only a header row.
2. Inspect the preview.

**Test Data:**

```csv
id,name,email
```

**Expected Result:**
- Headers are recognized.
- Zero data records are reported.
- The system handles the empty dataset gracefully.

---

# 6. FR-03: Schema Configuration

## Requirement

The system shall allow users to define table structures and relationships.

### TS-03-01: Create Valid Schema

**Type:** Positive

**Preconditions:**
- A valid CSV dataset is loaded.

**Test Steps:**
1. Open schema configuration.
2. Assign table name.
3. Define columns and data types.
4. Configure primary key.
5. Apply configuration.

**Test Data:**
- Table: users
- id: Integer, Primary Key
- name: String
- email: String

**Expected Result:**
- Schema is accepted.
- Configuration is available for validation.

### TS-03-02: Missing Table Name

**Type:** Negative

**Preconditions:**
- Schema editor is open.

**Test Steps:**
1. Leave table name empty.
2. Attempt to apply schema.

**Test Data:**
- Table name: Empty

**Expected Result:**
- Invalid schema is rejected.
- Required field error is displayed.

### TS-03-03: Unsupported Data Type

**Type:** Negative

**Preconditions:**
- Schema editor is open.

**Test Steps:**
1. Configure a column with an unsupported data type.
2. Submit the schema.

**Test Data:**
- Type: UNKNOWN_TYPE

**Expected Result:**
- Unsupported data type is rejected.
- User receives a meaningful error.

### TS-03-04: Define Foreign Key Relationship

**Type:** Positive

**Preconditions:**
- Users and Orders datasets are loaded.
- Relevant columns are configured.

**Test Steps:**
1. Select orders.user_id.
2. Configure its reference to users.id.
3. Apply the relationship.

**Test Data:**
- orders.user_id -> users.id

**Expected Result:**
- Relationship is accepted.
- Relationship is included in dependency analysis.

### TS-03-05: Foreign Key to Unknown Table

**Type:** Negative

**Preconditions:**
- Schema editor is open.

**Test Steps:**
1. Configure a foreign key.
2. Select or submit a nonexistent parent table.

**Test Data:**
- orders.user_id -> customers.id
- customers table does not exist.

**Expected Result:**
- Invalid reference is rejected or explicitly flagged.
- User is informed that the referenced table is missing.

### TS-03-06: Reference Nonexistent Column

**Type:** Negative

**Preconditions:**
- Valid dataset is loaded.

**Test Steps:**
1. Define a schema column that does not exist in the CSV.
2. Attempt schema validation.

**Test Data:**
- Schema column: phone
- CSV columns: id, name, email

**Expected Result:**
- Column mismatch is detected.
- The system does not silently map the missing column.

### TS-03-07: Duplicate Schema Column Definition

**Type:** Negative

**Preconditions:**
- Schema editor is open.

**Test Steps:**
1. Define the same column name twice.
2. Submit the schema.

**Test Data:**
- id
- id

**Expected Result:**
- Duplicate schema column definition is rejected.
- Clear feedback is displayed.

---

# 7. FR-04: Required Field Validation

## Requirement

The system shall identify missing values in required columns.

### TS-04-01: All Required Fields Present

**Type:** Positive

**Preconditions:**
- Valid schema is configured.

**Test Steps:**
1. Load users-valid.csv.
2. Mark id, name, and email as required.
3. Run validation.

**Test Data:**
- users-valid.csv

**Expected Result:**
- No required-field errors are generated.

### TS-04-02: Missing Required String Value

**Type:** Negative

**Preconditions:**
- name is marked as required.

**Test Steps:**
1. Load a CSV with an empty name.
2. Run validation.

**Test Data:**

```csv
id,name
1,
```

**Expected Result:**
- Missing required value is detected.
- Affected row and column are identified.

### TS-04-03: Missing Required Numeric Value

**Type:** Negative

**Preconditions:**
- id is required.

**Test Steps:**
1. Load a record with an empty ID.
2. Run validation.

**Test Data:**

```csv
id,name
,Alice
```

**Expected Result:**
- Missing required ID is detected.
- Clear validation error is generated.

### TS-04-04: Optional Field Is Empty

**Type:** Positive

**Preconditions:**
- email is configured as optional.

**Test Steps:**
1. Load a record with an empty email.
2. Run validation.

**Test Data:**

```csv
id,name,email
1,Alice,
```

**Expected Result:**
- Empty optional field is accepted.
- No required-field error is generated for email.

### TS-04-05: Whitespace-Only Required Value

**Type:** Boundary

**Preconditions:**
- name is required.
- Empty-value normalization treats whitespace-only text as missing.

**Test Steps:**
1. Load a record containing spaces in the name field.
2. Run validation.

**Test Data:**

```csv
id,name
1,"   "
```

**Expected Result:**
- Value is treated as missing.
- Required-field error is generated.

### TS-04-06: Multiple Missing Required Values

**Type:** Negative

**Preconditions:**
- id and name are required.

**Test Steps:**
1. Load records containing multiple missing values.
2. Run validation.
3. Inspect report.

**Test Data:**

```csv
id,name
,
2,
```

**Expected Result:**
- All missing required values are identified.
- Correct row and column references are included.

---

# 8. FR-05: Data Type Validation

## Requirement

The system shall validate record values against configured column data types.

### TS-05-01: Valid Integer Value

**Type:** Positive

**Preconditions:**
- id is configured as Integer.

**Test Steps:**
1. Load a CSV containing a valid integer.
2. Run validation.

**Test Data:**
- id = 100

**Expected Result:**
- Integer value passes type validation.

### TS-05-02: String in Integer Column

**Type:** Negative

**Preconditions:**
- id is configured as Integer.

**Test Steps:**
1. Load a CSV containing alphabetic text in id.
2. Run validation.

**Test Data:**
- id = abc

**Expected Result:**
- Invalid integer is detected.
- Expected data type is reported.

### TS-05-03: Decimal in Integer Column

**Type:** Boundary

**Preconditions:**
- id is configured as Integer.

**Test Steps:**
1. Load a fractional numeric value.
2. Run validation.

**Test Data:**
- id = 10.5

**Expected Result:**
- Value is rejected as an integer.
- Appropriate type error is generated.

### TS-05-04: Valid String Value

**Type:** Positive

**Preconditions:**
- name is configured as String.

**Test Steps:**
1. Load a valid string value.
2. Run validation.

**Test Data:**
- name = Alice

**Expected Result:**
- Value passes string type validation.

### TS-05-05: Empty Optional Typed Field

**Type:** Boundary

**Preconditions:**
- age is configured as an optional Integer.

**Test Steps:**
1. Load a record with an empty age.
2. Run validation.

**Test Data:**
- age = Empty

**Expected Result:**
- Empty optional value is accepted under configured null rules.
- No incorrect integer type error is generated.

### TS-05-06: Multiple Invalid Data Types

**Type:** Negative

**Preconditions:**
- id and amount are configured as Integer.

**Test Steps:**
1. Load records containing incompatible values.
2. Run validation.
3. Inspect all issues.

**Test Data:**

```csv
id,amount
abc,500
2,xyz
```

**Expected Result:**
- Both invalid values are detected.
- Each error identifies its row, column, and expected type.

---

# 9. FR-06: Primary Key Validation

## Requirement

The system shall detect duplicate or missing primary key values.

### TS-06-01: Unique Primary Keys

**Type:** Positive

**Preconditions:**
- id is configured as Primary Key.

**Test Steps:**
1. Load users-valid.csv.
2. Run validation.

**Test Data:**
- IDs: 1, 2, 3

**Expected Result:**
- No primary key uniqueness errors are generated.

### TS-06-02: Duplicate Primary Key

**Type:** Negative

**Preconditions:**
- id is configured as Primary Key.

**Test Steps:**
1. Load a CSV with repeated IDs.
2. Run validation.

**Test Data:**

```csv
id,name
1,Alice
1,Bob
```

**Expected Result:**
- Duplicate primary key is detected.
- The report identifies the conflicting value and affected records.

### TS-06-03: Missing Primary Key

**Type:** Negative

**Preconditions:**
- id is configured as Primary Key.

**Test Steps:**
1. Load a record without an ID.
2. Run validation.

**Test Data:**

```csv
id,name
,Alice
```

**Expected Result:**
- Missing primary key is reported.
- Record does not pass primary key validation.

### TS-06-04: Multiple Duplicate Groups

**Type:** Negative

**Preconditions:**
- id is configured as Primary Key.

**Test Steps:**
1. Load multiple repeated ID values.
2. Run validation.

**Test Data:**
- IDs: 1, 1, 2, 2, 3

**Expected Result:**
- Both duplicate groups are identified.
- No duplicate group is silently ignored.

### TS-06-05: Single Record Dataset

**Type:** Boundary

**Preconditions:**
- Primary key schema is configured.

**Test Steps:**
1. Load one valid record.
2. Run validation.

**Test Data:**
- id = 1

**Expected Result:**
- Record passes primary key validation.

### TS-06-06: Invalid Primary Key Data Type

**Type:** Negative

**Preconditions:**
- id is an Integer Primary Key.

**Test Steps:**
1. Load an invalid ID value.
2. Run validation.

**Test Data:**
- id = abc

**Expected Result:**
- Data type violation is reported.
- Invalid value is not treated as a valid integer key.

### TS-06-07: No Records in Dataset

**Type:** Boundary

**Preconditions:**
- Primary key schema is configured.

**Test Steps:**
1. Load a CSV containing only headers.
2. Run validation.

**Test Data:**
- Zero records

**Expected Result:**
- No false duplicate errors are generated.
- Empty dataset is handled safely.

---

# 10. FR-07: Foreign Key Validation

## Requirement

The system shall validate foreign key references against uploaded parent datasets.

### TS-07-01: Valid Foreign Key References

**Type:** Positive

**Preconditions:**
- Users and Orders schemas are configured.
- orders.user_id references users.id.

**Test Steps:**
1. Load users-valid.csv.
2. Load orders-valid.csv.
3. Run validation.

**Test Data:**
- Parent IDs: 1, 2, 3
- Referenced IDs: 1, 2, 3

**Expected Result:**
- All foreign key references are valid.
- No foreign key integrity errors are reported.

### TS-07-02: Missing Parent Reference

**Type:** Negative

**Preconditions:**
- Foreign key relationship is configured.

**Test Steps:**
1. Load parent dataset.
2. Load child dataset containing an unknown user ID.
3. Run validation.

**Test Data:**
- Parent IDs: 1, 2, 3
- Referenced ID: 99

**Expected Result:**
- Missing parent reference is detected.
- Affected child row and foreign key column are reported.

### TS-07-03: Nullable Foreign Key

**Type:** Positive

**Preconditions:**
- user_id is configured as nullable.

**Test Steps:**
1. Load a record with an empty user_id.
2. Run validation.

**Test Data:**
- user_id = Empty

**Expected Result:**
- Nullable foreign key passes validation.
- No missing-reference error is generated for the null value.

### TS-07-04: Required Foreign Key Is Missing

**Type:** Negative

**Preconditions:**
- user_id is required.

**Test Steps:**
1. Load a record with an empty user_id.
2. Run validation.

**Test Data:**
- user_id = Empty

**Expected Result:**
- Missing required value is detected.
- Record does not pass the configured foreign key field constraints.

### TS-07-05: Multiple Invalid References

**Type:** Negative

**Preconditions:**
- Foreign key relationship is configured.

**Test Steps:**
1. Load a child dataset with multiple unknown references.
2. Run validation.

**Test Data:**
- Parent IDs: 1, 2
- Referenced IDs: 1, 50, 99

**Expected Result:**
- Invalid references 50 and 99 are detected.
- Valid reference 1 passes.

### TS-07-06: Empty Parent Dataset

**Type:** Boundary

**Preconditions:**
- Parent and child tables are configured.

**Test Steps:**
1. Load an empty parent dataset.
2. Load child records containing non-null references.
3. Run validation.

**Test Data:**
- Parent IDs: None
- Child user_id: 1

**Expected Result:**
- Non-null child reference is identified as unresolved.
- Validation does not crash.

### TS-07-07: Foreign Key Type Mismatch

**Type:** Negative

**Preconditions:**
- Parent ID uses Integer.
- Child foreign key expects Integer.

**Test Steps:**
1. Load a child record with an incompatible foreign key value.
2. Run validation.

**Test Data:**
- user_id = abc

**Expected Result:**
- Invalid foreign key type is detected.
- The system does not incorrectly accept the reference.

---

# 11. FR-08: Dependency Analysis

## Requirement

The system shall analyze table relationships and recommend a valid import order.

### TS-08-01: Two-Table Dependency

**Type:** Positive

**Preconditions:**
- Users and Orders tables are configured.

**Test Steps:**
1. Define Orders as dependent on Users.
2. Run dependency analysis.

**Test Data:**
- Orders -> Users dependency

**Expected Result:**
- Users appears before Orders in the recommended import order.

### TS-08-02: Multi-Level Dependency

**Type:** Positive

**Preconditions:**
- Three related tables exist.

**Test Steps:**
1. Configure Users, Orders, and OrderItems.
2. Define foreign key relationships.
3. Run dependency analysis.

**Test Data:**
- Orders depends on Users.
- OrderItems depends on Orders.

**Expected Result:**
- Valid import order is:
  1. Users
  2. Orders
  3. OrderItems

### TS-08-03: Independent Tables

**Type:** Positive

**Preconditions:**
- Multiple unrelated tables exist.

**Test Steps:**
1. Configure two independent tables.
2. Run dependency analysis.

**Test Data:**
- Products
- Categories
- No relationship defined

**Expected Result:**
- Both tables are included.
- Either order is accepted because no dependency exists.

### TS-08-04: Circular Dependency

**Type:** Negative

**Preconditions:**
- Two tables reference each other.

**Test Steps:**
1. Configure a dependency from A to B.
2. Configure a dependency from B to A.
3. Run analysis.

**Test Data:**
- A depends on B
- B depends on A

**Expected Result:**
- Circular dependency is detected.
- Affected tables are identified.
- System does not incorrectly claim that a valid simple import order exists.

### TS-08-05: Self-Referencing Table

**Type:** Boundary

**Preconditions:**
- A table references itself.

**Test Steps:**
1. Configure Employees.
2. Define manager_id referencing Employees.id.
3. Run dependency analysis.

**Test Data:**
- Employees.manager_id -> Employees.id

**Expected Result:**
- Self-reference is detected.
- System explains that row-level ordering or additional handling may be required.

### TS-08-06: Large Acyclic Dependency Graph

**Type:** Boundary

**Preconditions:**
- Multiple related tables are configured.

**Test Steps:**
1. Generate a valid acyclic dependency graph.
2. Run import order calculation.
3. Verify ordering constraints.

**Test Data:**
- Multiple tables with non-circular relationships

**Expected Result:**
- A valid topological order is produced.
- Every parent table appears before its dependent tables.
- All configured tables are included.

### TS-08-07: Repeat Dependency Analysis

**Type:** Positive

**Preconditions:**
- A valid dependency graph exists.

**Test Steps:**
1. Run dependency analysis.
2. Run the same analysis again.
3. Compare results.

**Test Data:**
- Identical graph and configuration

**Expected Result:**
- Results remain valid and deterministic.
- No dependencies are lost or duplicated.

---

# 12. FR-09: Rehearsal Report Generation

## Requirement

The system shall generate understandable validation and import simulation reports.

### TS-09-01: Report for Valid Dataset

**Type:** Positive

**Preconditions:**
- Valid CSV and schema are available.

**Test Steps:**
1. Load valid dataset.
2. Run rehearsal.
3. Open results.

**Test Data:**
- users-valid.csv

**Expected Result:**
- Report is generated.
- Total records = 3.
- No validation errors are reported.

### TS-09-02: Report for Invalid Dataset

**Type:** Negative

**Preconditions:**
- Invalid dataset is available.

**Test Steps:**
1. Load users-invalid.csv.
2. Run rehearsal.
3. Inspect report.

**Test Data:**
- users-invalid.csv

**Expected Result:**
- Report contains relevant validation errors.
- Invalid records are identifiable.
- Each issue includes an understandable explanation.

### TS-09-03: Correct Record Count

**Type:** Positive

**Preconditions:**
- Dataset contains three data records.

**Test Steps:**
1. Load CSV.
2. Run rehearsal.
3. Inspect summary.

**Test Data:**
- Three data rows and one header row

**Expected Result:**
- Total records analyzed = 3.
- Header row is not counted as a data record.

### TS-09-04: Error Row and Column Identification

**Type:** Positive

**Preconditions:**
- Dataset includes a known invalid value.

**Test Steps:**
1. Load invalid dataset.
2. Run rehearsal.
3. Locate reported issue.

**Test Data:**
- id = abc in the fourth data record of users-invalid.csv

**Expected Result:**
- Report identifies the correct data record and id column.
- Row numbering follows the documented convention.

### TS-09-05: Multiple Error Categories

**Type:** Negative

**Preconditions:**
- Dataset contains different validation problems.

**Test Steps:**
1. Load invalid users and orders datasets.
2. Configure relationships.
3. Run rehearsal.

**Test Data:**
- Duplicate primary key
- Missing required field
- Invalid data type
- Missing foreign key reference

**Expected Result:**
- All applicable error categories are reported.
- Report does not silently omit relevant issues.

### TS-09-06: Empty Dataset Report

**Type:** Boundary

**Preconditions:**
- Dataset contains headers but no records.

**Test Steps:**
1. Load header-only CSV.
2. Run rehearsal if permitted.
3. Inspect report or validation feedback.

**Test Data:**
- Zero data records

**Expected Result:**
- Empty dataset is handled safely.
- No false validation issues are generated.
- Result or blocking message clearly explains the empty dataset.

### TS-09-07: Repeated Report Generation

**Type:** Positive

**Preconditions:**
- Dataset and schema are unchanged.

**Test Steps:**
1. Generate a report.
2. Repeat the rehearsal.
3. Compare validation results.

**Test Data:**
- Identical CSV and schema

**Expected Result:**
- Validation findings are identical.
- No duplicate issues are introduced by rerunning the analysis.

---

# 13. FR-10: Report Export

## Requirement

The system shall allow users to export validation reports.

### TS-10-01: Export Valid Report

**Type:** Positive

**Preconditions:**
- A rehearsal report is available.

**Test Steps:**
1. Complete rehearsal.
2. Select an available export format.
3. Download the report.

**Test Data:**
- Valid rehearsal report

**Expected Result:**
- Report downloads successfully.
- Exported file uses the selected supported format.

### TS-10-02: Export Report With Errors

**Type:** Positive

**Preconditions:**
- Report contains validation errors.

**Test Steps:**
1. Generate an invalid-data report.
2. Export results.
3. Open exported file.

**Test Data:**
- users-invalid.csv rehearsal result

**Expected Result:**
- Validation findings are preserved.
- Relevant issue types and locations are included.
- Export follows the configured privacy policy.

### TS-10-03: Export Without a Report

**Type:** Negative

**Preconditions:**
- No rehearsal result exists.

**Test Steps:**
1. Open a new rehearsal.
2. Attempt to export before running validation.

**Test Data:**
- No generated report

**Expected Result:**
- Invalid export action is prevented.
- User receives appropriate feedback.

### TS-10-04: CSV Formula Injection Protection

**Type:** Security

**Preconditions:**
- CSV report export is supported.
- Exported content may contain user-controlled text.

**Test Steps:**
1. Use an untrusted value beginning with a spreadsheet formula character.
2. Generate a report containing the value.
3. Export as CSV.
4. Open in a spreadsheet application.

**Test Data:**
- A value beginning with `=`

**Expected Result:**
- Untrusted value is safely escaped or neutralized.
- Spreadsheet does not execute it as a formula.

### TS-10-05: Export Sensitive Data Protection

**Type:** Security

**Preconditions:**
- A report contains data derived from uploaded CSV files.

**Test Steps:**
1. Use a dataset with sensitive field values.
2. Generate a report.
3. Export the report.
4. Inspect exported content.

**Test Data:**
- Sensitive test-only personal information

**Expected Result:**
- Sensitive values are omitted or sanitized according to the report privacy policy.
- No unintended raw CSV records are exposed.

### TS-10-06: Export Special Characters

**Type:** Boundary

**Preconditions:**
- Report contains special characters.

**Test Steps:**
1. Generate a report with commas, quotes, and line breaks in permitted text.
2. Export the report.
3. Reopen or parse exported content.

**Test Data:**
- Quoted text
- Commas
- Newlines

**Expected Result:**
- Exported file remains structurally valid.
- Special characters do not corrupt the report.

---

# 14. FR-11: Rehearsal History

## Requirement

The system shall allow authenticated users to access their own saved rehearsal metadata and reports.

### TS-11-01: Save Rehearsal Report

**Type:** Positive

**Preconditions:**
- User A is authenticated.
- A rehearsal report exists.

**Test Steps:**
1. Complete rehearsal.
2. Select Save Report.
3. Open rehearsal history.

**Test Data:**
- Valid rehearsal report

**Expected Result:**
- Permitted report metadata is saved.
- Saved report appears in User A's history.

### TS-11-02: View Own Rehearsal History

**Type:** Positive

**Preconditions:**
- User A has saved reports.

**Test Steps:**
1. Sign in as User A.
2. Open rehearsal history.
3. Select an existing report.

**Test Data:**
- Reports owned by User A

**Expected Result:**
- User A can view their own saved reports.
- Report information is displayed correctly.

### TS-11-03: Access Another User's Report

**Type:** Security

**Preconditions:**
- User A owns a saved report.
- User B is authenticated.

**Test Steps:**
1. Sign in as User B.
2. Attempt direct access to User A's report URL or API.
3. Inspect response.

**Test Data:**
- User A's report identifier

**Expected Result:**
- Access is denied.
- User A's report content is not exposed.
- Server enforces ownership independently of the UI.

### TS-11-04: Access History Without Login

**Type:** Security

**Preconditions:**
- User is unauthenticated.

**Test Steps:**
1. Open history page directly.
2. Attempt to call history API.

**Test Data:**
- No active session

**Expected Result:**
- Protected history is inaccessible.
- Private report metadata is not returned.

### TS-11-05: Empty Rehearsal History

**Type:** Boundary

**Preconditions:**
- User has no saved reports.

**Test Steps:**
1. Sign in with a new account.
2. Open rehearsal history.

**Test Data:**
- Zero saved reports

**Expected Result:**
- Empty history state is displayed.
- Application does not crash.

### TS-11-06: Raw CSV Privacy Verification

**Type:** Security

**Preconditions:**
- User has completed and saved a rehearsal.

**Test Steps:**
1. Upload CSV containing test-only sensitive values.
2. Run rehearsal.
3. Save report metadata.
4. Inspect persisted application records.

**Test Data:**
- CSV containing unique sensitive test values

**Expected Result:**
- Raw CSV rows are not persisted by default.
- Only permitted report metadata and sanitized results are retained.

### TS-11-07: Access Nonexistent Report

**Type:** Negative

**Preconditions:**
- User is authenticated.

**Test Steps:**
1. Request a report identifier that does not exist.
2. Inspect API and UI behavior.

**Test Data:**
- Nonexistent report identifier

**Expected Result:**
- Appropriate not-found response is returned.
- Application does not crash.
- No unrelated user information is exposed.

---

# 15. Additional Cross-Functional Test Scenarios

These scenarios verify behavior across multiple functional requirements.

## TS-CF-01: Complete Successful Rehearsal

**Type:** End-to-End

**Related Requirements:**
FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-08, FR-09, FR-10, FR-11

**Test Steps:**
1. Sign in.
2. Create a rehearsal.
3. Upload valid Users and Orders CSV files.
4. Configure schemas.
5. Define the foreign key relationship.
6. Run rehearsal.
7. Review import order.
8. Generate and export report.
9. Save report.
10. Open rehearsal history.

**Expected Result:**
- All operations complete successfully.
- No false integrity errors occur.
- Users appears before Orders in import order.
- Report can be exported and saved.
- Saved report is accessible to its owner.

## TS-CF-02: Complete Invalid Data Rehearsal

**Type:** End-to-End

**Related Requirements:**
FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-09

**Test Steps:**
1. Upload invalid CSV datasets.
2. Configure schemas and relationships.
3. Run rehearsal.
4. Inspect validation report.

**Expected Result:**
- All applicable integrity problems are detected.
- Errors include relevant row and column information.
- Application handles invalid data without crashing.

## TS-CF-03: Browser-Side CSV Privacy

**Type:** Security

**Related Requirements:**
FR-02, FR-09, FR-11

**Test Steps:**
1. Open browser network inspection tools.
2. Upload a CSV.
3. Configure schema and run local validation.
4. Inspect requests and payloads.

**Expected Result:**
- Raw CSV records are not automatically uploaded to application APIs.
- Only explicitly permitted data is transmitted for authentication or saved report functionality.

## TS-CF-04: Validation Determinism

**Type:** Regression

**Related Requirements:**
FR-04, FR-05, FR-06, FR-07, FR-08, FR-09

**Test Steps:**
1. Run validation using fixed datasets and schema.
2. Save the validation findings.
3. Repeat validation.
4. Compare the results.

**Expected Result:**
- Identical inputs produce identical validation findings.
- No random differences or duplicate findings appear.

## TS-CF-05: Malicious CSV Content

**Type:** Security

**Related Requirements:**
FR-02, FR-09, FR-10

**Test Steps:**
1. Upload a CSV containing HTML or script-like text.
2. Preview the data.
3. Generate a report.
4. Inspect rendered content and export.

**Expected Result:**
- Untrusted data is treated as text.
- No script executes in the browser.
- Export content is handled safely.

## TS-CF-06: Maximum Supported Dataset

**Type:** Boundary

**Related Requirements:**
FR-02, FR-04, FR-05, FR-06, FR-09

**Test Steps:**
1. Generate a CSV at the configured size and row limits.
2. Upload the file.
3. Configure schema.
4. Execute validation.
5. Inspect responsiveness and results.

**Expected Result:**
- Application enforces documented limits.
- Validation completes within approved performance criteria.
- Browser remains usable.
- No records are silently skipped.

## TS-CF-07: Report Save Failure

**Type:** Negative

**Related Requirements:**
FR-09, FR-11

**Test Steps:**
1. Complete a rehearsal.
2. Simulate a backend or database failure.
3. Attempt to save the report.

**Expected Result:**
- Save operation reports a failure.
- Application does not falsely claim the report was saved.
- Local rehearsal findings remain available when technically possible.
- No unauthorized data is exposed.

---

# 16. Requirements Traceability Matrix

| Requirement ID | Requirement | Test Scenarios |
|---|---|---|
| FR-01 | User Authentication | TS-01-01 to TS-01-07 |
| FR-02 | CSV Upload | TS-02-01 to TS-02-08 |
| FR-03 | Schema Configuration | TS-03-01 to TS-03-07 |
| FR-04 | Required Field Validation | TS-04-01 to TS-04-06 |
| FR-05 | Data Type Validation | TS-05-01 to TS-05-06 |
| FR-06 | Primary Key Validation | TS-06-01 to TS-06-07 |
| FR-07 | Foreign Key Validation | TS-07-01 to TS-07-07 |
| FR-08 | Dependency Analysis | TS-08-01 to TS-08-07 |
| FR-09 | Report Generation | TS-09-01 to TS-09-07 |
| FR-10 | Report Export | TS-10-01 to TS-10-06 |
| FR-11 | Rehearsal History | TS-11-01 to TS-11-07 |
| Multiple | Cross-Functional Testing | TS-CF-01 to TS-CF-07 |

**Total Functional Test Scenarios:** 75

**Additional Cross-Functional Scenarios:** 7

**Total Documented Test Scenarios:** 82

---

# 17. Test Execution Template

Each executed test should be recorded using the following format.

| Field | Value |
|---|---|
| Test Scenario ID | TS-XX-XX |
| Requirement ID | FR-XX |
| Test Date | YYYY-MM-DD |
| Tester | Tester Name |
| Environment | Development / Staging |
| Expected Result | Defined in scenario |
| Actual Result | To be recorded |
| Status | Not Executed / Passed / Failed / Blocked |
| Defect ID | If applicable |
| Evidence | Screenshot, log, or test report |

## Example

**Test Scenario ID:** TS-06-02

**Requirement ID:** FR-06

**Test Scenario:** Duplicate Primary Key Detection

**Expected Result:**
System identifies duplicate primary keys.

**Actual Result:**
To be recorded after execution.

**Status:** Not Executed

---

# 18. Entry Criteria

Testing may begin when:

1. The relevant functional requirement is implemented.
2. The test environment is configured.
3. Required test accounts are available.
4. Test CSV fixtures are prepared.
5. Relevant schema configurations exist.
6. The application can run in the test environment.

---

# 19. Exit Criteria

Testing for an MVP release can be considered complete when:

1. All approved functional requirements have been tested.
2. All critical test scenarios pass.
3. No unresolved critical security defects remain.
4. Important validation edge cases pass.
5. Report generation and export work correctly.
6. Authentication and authorization are verified.
7. Regression tests pass.
8. Known limitations are documented.
9. Test evidence and results are recorded.
10. Any remaining defects are reviewed and explicitly accepted or scheduled for correction.

---

# 20. Defect Reporting Guidelines

For each failed test, record:

- Defect ID
- Related test scenario
- Requirement ID
- Defect title
- Severity
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment
- Screenshot or logs
- Resolution status

## Severity Levels

| Severity | Description |
|---|---|
| Critical | Security breach or severe data exposure |
| High | Important functionality fails |
| Medium | Function works incorrectly with a workaround |
| Low | Minor defect with limited impact |

---

# 21. Test Automation Strategy

## Unit Testing - Vitest

Recommended unit test coverage:

- Required field validation
- Data type validation
- Duplicate primary key detection
- Foreign key reference checks
- Dependency graph generation
- Topological sorting
- Circular dependency detection
- Report summary calculations
- CSV export sanitization

## Integration Testing

Recommended integration coverage:

- Authentication and protected APIs
- Report saving through API and Prisma
- User ownership authorization
- Schema and validation engine integration
- Report metadata retrieval

## End-to-End Testing - Playwright

Recommended E2E coverage:

- User registration and login
- CSV upload and preview
- Schema configuration
- Complete rehearsal execution
- Error report display
- Report export
- Saved report history
- Unauthorized report access

---

# 22. Acceptance and Maintenance

This document should be updated whenever:

- A functional requirement changes.
- A new feature is approved.
- Validation behavior changes.
- A new edge case is discovered.
- A security issue requires additional coverage.
- A defect reveals missing test coverage.

Every new functional requirement should have:

1. A unique requirement ID.
2. At least one positive test.
3. At least one negative test where applicable.
4. Boundary tests where relevant.
5. Security tests where relevant.
6. Clearly defined expected results.
7. Automated tests where practical.

---

# 23. Final Testing Goal

The Data Rehearsal Web App must reliably detect supported CSV data integrity issues, analyze table dependencies, generate accurate reports, and protect user information.

Successful completion of the testing process demonstrates that the MVP satisfies its approved functional requirements within the documented limitations of static import simulation.

This document describes planned tests and does not claim that the application has passed them.
