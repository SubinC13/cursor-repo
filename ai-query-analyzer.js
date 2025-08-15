const { DbSchema } = require("../../utils/dbSchema");
const { tryRequest } = require("../../utils/GeminiInit");

// Restricted operations to prevent data modification or exposure
const hasRestrictedIntent = (text) => {
  const lowered = text.toLowerCase();
  return [
    "delete",
    "update",
    "drop",
    "insert",
    "alter",
    "truncate",
    "password",
    "credential",
  ].some((term) => lowered.includes(term));
};

// More robust extraction of only the SQL query part
function extractQuery(response) {
  return response
    .replace(/```sql/gi, "")
    .replace(/```/g, "")
    .replace(/^[^S]*SELECT/i, "SELECT") // remove pre-text before SELECT
    .trim();
}

// Format conversation history for AI context
function formatHistory(history) {
  return history
    .map((msg) => `${msg.role === "user" ? "User" : "AI"}: ${msg.text}`)
    .join("\n");
}

// Generic Gemini API call
const callGeminiAI = async (prompt) => {
  return await tryRequest(async (genAI) => {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent(prompt);
    return (await result.response).text();
  });
};

// Detect "what can you do" intent
function isCapabilitiesQuestion(text) {
  const lowered = text.toLowerCase();
  return (
    lowered.includes("what can you do") ||
    lowered.includes("can you do") ||
    lowered.includes("your abilities") ||
    lowered.includes("help me with") ||
    lowered.includes("features") ||
    lowered.includes("what are you")
  );
}

/**
 * FIRST PROMPT: Analyzes user input and chat history to determine response type
 * Returns either a direct response or a SQL query to be executed
 */
const analyzeAndPrepareQuery = async (data) => {
  try {
    const { prompt, history } = data;

    if (!prompt || !prompt.trim()) {
      return { 
        type: "error", 
        response: "Prompt is required.",
        needsDbQuery: false 
      };
    }

    // History formatted for context
    const formattedHistory = formatHistory(history || []);

    // Step 1: Initial restriction check
    if (hasRestrictedIntent(prompt)) {
      return {
        type: "direct_response",
        response: "Sorry, I can't process requests that modify or expose sensitive data.",
        needsDbQuery: false
      };
    }

    // Step 2: Check for capabilities question
    if (isCapabilitiesQuestion(prompt)) {
      const CAPABILITIES_HTML = `<p>As now I can give you the information about the employees and leave balance, and the status of the leave applied also I can do the general tasks like I can:\n\n<ul>\n<li>Answer your questions – Try asking me anything, from factual information to creative writing prompts!</li>\n<li>Help you brainstorm ideas – Stuck on a project? Let's work through it together.</li>\n<li>Generate different creative text formats (poems, code, scripts, musical pieces, email, letters, etc.) – I can even try to translate languages.</li>\n<li>Give you summaries of factual topics or create stories – Just tell me what you'd like!</li>\n</ul>\n\nBasically, I'm here to help you with anything you need assistance with, within reason! Just ask away</p>`;
      
      return { 
        type: "direct_response", 
        response: CAPABILITIES_HTML, 
        needsDbQuery: false 
      };
    }

    // Step 3: Classify prompt to determine if DB access is needed
    const classificationPrompt = `
      You are a classification assistant.
      Rules:
      1. Respond ONLY with "DB" or "GENERAL" — no other words.
      2. "DB" ONLY if the user is asking about business/company data stored in the given database.
      3. "GENERAL" for unrelated or public information.
      4. Never classify as "DB" unless it's directly related to this schema: ${DbSchema}

      Conversation so far:
      ${formattedHistory}

      User's question:
      "${prompt}"
    `;
    
    const classification = (await callGeminiAI(classificationPrompt))
      .trim()
      .toUpperCase();

    // Step 4: Handle GENERAL classification
    if (classification === "GENERAL") {
      const generalResponse = await callGeminiAI(`
        You are a friendly assistant.
        Conversation so far:
        ${formattedHistory}
        User asked: "${prompt}"
        Reply conversationally, avoid technical or DB references.
        If listing items, use <ul><li>. For single answers, use <p>.
      `);
      
      return { 
        type: "direct_response", 
        response: generalResponse, 
        needsDbQuery: false 
      };
    }

    // Step 5: Generate SQL query for DB-related requests
    const sqlQueryPrompt = `
      You are an SQL generator. Your task:
      1. Generate ONLY a safe, read-only SELECT query.
      2. Use the schema below.
      3. Never generate queries that modify data (UPDATE, DELETE, INSERT, DROP, ALTER, TRUNCATE).
      4. Do not return explanations, only the query.

      Schema:
      ${DbSchema}

      Conversation history:
      ${formattedHistory}

      User's request:
      "${prompt}"
    `;
    
    const sqlQueryResponse = await callGeminiAI(sqlQueryPrompt);
    const generatedQuery = extractQuery(sqlQueryResponse);

    // Step 6: Double-check SQL safety
    if (hasRestrictedIntent(generatedQuery)) {
      return {
        type: "direct_response",
        response: "The generated query appears unsafe and was blocked.",
        needsDbQuery: false
      };
    }

    return {
      type: "db_query_needed",
      sqlQuery: generatedQuery,
      needsDbQuery: true,
      originalPrompt: prompt,
      formattedHistory: formattedHistory
    };

  } catch (error) {
    console.error("Error in analyze and prepare query:", error);
    return { 
      type: "error", 
      response: "Failed to analyze the request.",
      needsDbQuery: false 
    };
  }
};

module.exports = { 
  analyzeAndPrepareQuery,
  callGeminiAI,
  formatHistory,
  hasRestrictedIntent,
  extractQuery,
  isCapabilitiesQuestion
};