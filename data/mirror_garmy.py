"""Mirror every garmy sqlite table into Supabase `garmy` schema verbatim."""
import sqlite3, subprocess, os, tempfile, csv, sys

GARMY = os.path.expanduser("~/.garmy/health.db")
PG = "postgresql://postgres.vssciljnilrgqcrnandl:elyssaisawesome@aws-1-us-east-2.pooler.supabase.com:5432/postgres"

# SQLite type → Postgres type
TYPE_MAP = {
    'INTEGER': 'NUMERIC',  # SQLite is flexible — INTEGER columns can hold floats
    'INT': 'NUMERIC',
    'REAL': 'DOUBLE PRECISION',
    'FLOAT': 'DOUBLE PRECISION',
    'TEXT': 'TEXT',
    'DATE': 'DATE',
    'DATETIME': 'TIMESTAMP',
    'BLOB': 'BYTEA',
    '': 'TEXT',
}

def pg_type(sqlite_type):
    t = (sqlite_type or '').upper().split('(')[0].strip()
    return TYPE_MAP.get(t, 'TEXT')

def psql_run(*args):
    cmd = ["psql", PG, "-v", "ON_ERROR_STOP=1"] + list(args)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("ERR:", r.stderr, file=sys.stderr); sys.exit(1)
    return r.stdout

psql_run("-c", "CREATE SCHEMA IF NOT EXISTS garmy;")

g = sqlite3.connect(GARMY)
g.row_factory = sqlite3.Row
tables = [r[0] for r in g.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]

for tbl in tables:
    print(f"\n== {tbl} ==")
    # Inspect schema
    cols = list(g.execute(f"PRAGMA table_info({tbl})"))
    col_defs = []
    pk_cols = []
    col_names = []
    for c in cols:
        name = c[1]
        ct = pg_type(c[2])
        col_defs.append(f'"{name}" {ct}')
        if c[5]:  # pk
            pk_cols.append(f'"{name}"')
        col_names.append(name)
    ddl = f'DROP TABLE IF EXISTS garmy."{tbl}" CASCADE; CREATE TABLE garmy."{tbl}" ({", ".join(col_defs)}'
    if pk_cols:
        ddl += f', PRIMARY KEY ({", ".join(pk_cols)})'
    ddl += ");"
    psql_run("-c", ddl)

    # Dump rows to CSV
    rows = list(g.execute(f'SELECT * FROM "{tbl}"'))
    if not rows:
        print(f"  empty")
        continue

    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='') as f:
        w = csv.writer(f)
        for row in rows:
            out = [r'\N' if v is None else v for v in row]
            w.writerow(out)
        path = f.name

    quoted_cols = ','.join(f'"{c}"' for c in col_names)
    copy_cmd = r"\copy garmy.\"" + tbl + r"\" (" + quoted_cols + r") FROM '" + path + r"' WITH (FORMAT csv, NULL '\N')"
    copy_cmd = copy_cmd.replace(r'\"', '"')
    r = subprocess.run(
        ["psql", PG, "-v", "ON_ERROR_STOP=1", "-c", copy_cmd],
        capture_output=True, text=True
    )
    os.unlink(path)
    if r.returncode != 0:
        print(f"  COPY ERR: {r.stderr}")
    else:
        print(f"  copied {len(rows)} rows")

psql_run("-c", "GRANT USAGE ON SCHEMA garmy TO anon, authenticated;")
psql_run("-c", "GRANT SELECT ON ALL TABLES IN SCHEMA garmy TO anon, authenticated;")
print("\nDone.")
