require("dotenv").config();
const express = require("express");
const { Client } = require("pg");
const OpenAI = require("openai");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// OpenAI API Configuration
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// PostgreSQL Connection
const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});
client.connect();

// Function to get table schema
async function getTableSchema(table) {
  const res = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`,
    [table]
  );
  return res.rows;
}

// Generate SQL Query using OpenAI
async function generateSQL(prompt) {
  const tableMatches = prompt.match(/\[(.*?)\]/g) || [];
  const tables = tableMatches.map((t) => t.replace(/\[|\]/g, ""));

  let schemaInfo = "";
  for (const table of tables) {
    const schema = await getTableSchema(table);
    schemaInfo += `Table: ${table}, Columns: ${JSON.stringify(schema)}\n`;
  }

  const aiPrompt = `
  Generate a highly optimized, production-ready SQL query based on the following prompt: "${prompt}". 
  Here is the schema information: ${schemaInfo} 
  
  **Ensure the query follows these guidelines:**
  - Use **WITH (NOLOCK)** for all applicable tables in SELECT statements to improve concurrency and reduce locking issues.
  - Ensure indexes are considered in JOIN conditions.
  - Optimize query execution by avoiding unnecessary subqueries or redundant conditions.
  - Follow best practices for performance, including proper use of indexing, CTEs, and appropriate filtering.
  
  Provide only the SQL script without any explanations or comments.
  `;
  

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an AI SQL assistant." },
      { role: "user", content: aiPrompt },
    ],
  });

  return response.choices[0].message.content.trim();
}

app.post("/generate-query", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });
  const tableMatches = prompt.match(/\[(.*?)\]/g) || [];
  const tables = tableMatches.map((t) => t.replace(/\[|\]/g, ""));
  try {
    // Validate if all tables exist
    for (const table of tables) {
      const tableCheck = await client.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS exists`,
        [table]
      );
      if (!tableCheck.rows[0].exists) {
        return res
          .status(400)
          .json({ error: `Table "${table}" does not exist in the database.` });
      }
    }
    const query = await generateSQL(prompt);
    res.json({ query });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(3001, () => console.log("Server running on port 3001"));
