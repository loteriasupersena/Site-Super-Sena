import pg from "pg";

const { Client } = pg;
const expectedPurpose = "benefits-platform-empty";

if (process.env.DATABASE_PURPOSE !== expectedPurpose) {
  throw new Error(`Bloqueado: defina DATABASE_PURPOSE=${expectedPurpose} somente para o banco novo da plataforma.`);
}

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error("DATABASE_URL não foi definida.");

let parsed;
try {
  parsed = new URL(connectionString);
} catch {
  throw new Error("DATABASE_URL inválida.");
}

if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
  throw new Error("DATABASE_URL precisa usar PostgreSQL.");
}

const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, "").split("/")[0] ?? "");
if (!databaseName) throw new Error("DATABASE_URL não informa o nome do banco.");
if (/(^|[-_])(super.?sena|placas?|production|prod)([-_]|$)/i.test(databaseName)) {
  throw new Error("Bloqueado: o nome do banco parece pertencer ao sistema anterior ou à produção.");
}

const client = new Client({ connectionString, connectionTimeoutMillis: 8_000 });
try {
  await client.connect();
  const result = await client.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name
  `);

  if (result.rows.length > 0) {
    const names = result.rows.slice(0, 10).map((row) => `${row.table_schema}.${row.table_name}`);
    throw new Error(`Banco não está vazio. Encontradas ${result.rows.length} tabelas: ${names.join(", ")}. Nenhum dado foi alterado.`);
  }

  console.info("Banco acessível e sem tabelas de aplicação. Nenhuma alteração foi realizada.");
} finally {
  await client.end().catch(() => {});
}
