import { useState } from "react";
import axios from "axios";

export default function SQLQueryGenerator() {
  const [prompt, setPrompt] = useState("");
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleGenerateQuery = async () => {
    if (!prompt.trim()) return;
    const tableMatches = prompt.match(/\[(.*?)\]/g) || [];
    const tables = tableMatches.map((t) => t.replace(/\[|\]/g, ""));
    if (tables.length == 0) {
      alert(
        "Invalid prompt: Table names not found in your prompt. Eg. Fetch All [users]"
      );
    }
    setLoading(true);
    try {
      const response = await axios.post<{ query: string }>(
        "https://sqlquerygenerator-uzkx.onrender.com/generate-query",
        { prompt }
      );
      setQuery(
        response.data.query
          .replace("```", "")
          .replace("```", "")
          .replace("sql\n", "")
      );
    } catch (error: any) {
      console.error("Error generating query:", error);

      if (error.response && error.response.data.error) {
        alert(error.response.data.error); // Show alert for specific errors
      } else {
        alert(
          "An error occurred while generating the query. Please try again."
        );
      }

      setQuery(""); // Clear the query if an error occurs
    } finally {
      setLoading(false);
    }
  };
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(query).then(() => {
      alert("Query copied to clipboard!");
    }).catch(err => {
      console.error("Failed to copy:", err);
    });
  };
  return (
    <div className="flex flex-col items-center p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">SQL Query Generator</h1>
      <textarea
        className="w-full p-2 border rounded mb-4"
        placeholder="Enter your prompt (e.g., Join [users] and [orders] on user_id)"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        onClick={handleGenerateQuery}
        disabled={loading}
      >
        {loading ? "Generating..." : "Generate SQL Query"}
      </button>
      {query && (
        <div className="mt-4 w-full">
          <pre className="p-2 border rounded bg-gray-100 overflow-auto">
            {query}
          </pre>
          <button
            className="mt-2 bg-green-500 text-white px-4 py-2 rounded"
            onClick={handleCopyToClipboard}
          >
            Copy to Clipboard
          </button>
        </div>
      )}
    </div>
  );
}
