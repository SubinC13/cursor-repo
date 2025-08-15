const { callGeminiAI } = require("./ai-query-analyzer");

/**
 * SECOND PROMPT: Takes SQL query results and converts them to user-friendly response
 * Analyzes the SQL data and provides a natural language response without technical terms
 */
const generateUserFriendlyResponse = async (data) => {
  try {
    const { 
      queryResult, 
      originalPrompt, 
      formattedHistory = "", 
      sqlQuery = null 
    } = data;

    if (!queryResult) {
      return {
        type: "error",
        response: "No data was provided to analyze.",
      };
    }

    // Handle empty results
    if (!queryResult || (Array.isArray(queryResult) && queryResult.length === 0)) {
      const noDataResponse = await callGeminiAI(`
        You are a friendly assistant.
        User asked: "${originalPrompt}"
        The database search returned no results.
        
        Provide a helpful response explaining that no information was found for their request.
        Be empathetic and suggest they might try asking differently or check if the information exists.
        Use HTML formatting: <p> for paragraphs, <ul><li> for lists.
        Never mention SQL, databases, queries, or technical terms.
      `);
      
      return {
        type: "user_friendly_response",
        response: noDataResponse,
      };
    }

    // Convert query results to user-friendly response
    const responsePrompt = `
      You are a friendly and helpful assistant that explains information in simple, natural language.
      
      Context:
      - User originally asked: "${originalPrompt}"
      ${formattedHistory ? `- Previous conversation: ${formattedHistory}` : ""}
      
      Data retrieved:
      ${JSON.stringify(queryResult, null, 2)}
      
      Instructions:
      1. Analyze the data and provide a clear, friendly response to the user's question
      2. Use simple, everyday language - avoid ALL technical terms
      3. Never mention: SQL, database, query, table, rows, columns, records, etc.
      4. Format your response in HTML:
         - Use <p> tags for paragraphs
         - Use <ul><li> tags for lists
         - Use <strong> for emphasis when appropriate
      5. If the data shows multiple items, organize them clearly
      6. If the data is about people, use friendly terms like "Here's what I found about..." or "I can see that..."
      7. If showing numbers or dates, present them in a natural, conversational way
      8. Make sure your response directly answers what the user asked
      9. Be conversational and helpful, as if explaining to a friend
      
      Provide a complete, helpful response based on the information found.
    `;

    const userFriendlyResponse = await callGeminiAI(responsePrompt);

    return {
      type: "user_friendly_response", 
      response: userFriendlyResponse,
      sqlQuery: sqlQuery // Include for debugging/logging purposes if needed
    };

  } catch (error) {
    console.error("Error in generate user friendly response:", error);
    return {
      type: "error",
      response: "I'm sorry, I had trouble processing the information. Please try asking again.",
    };
  }
};

/**
 * Helper function to handle different types of query results
 * Normalizes various database result formats
 */
const normalizeQueryResult = (rawResult) => {
  // Handle different database library result formats
  if (rawResult && rawResult.rows) {
    return rawResult.rows; // PostgreSQL style
  }
  
  if (Array.isArray(rawResult)) {
    return rawResult; // MySQL/MariaDB style or already normalized
  }
  
  if (rawResult && typeof rawResult === 'object') {
    // Handle single object results
    return [rawResult];
  }
  
  return rawResult;
};

/**
 * Enhanced version that also handles result normalization
 */
const generateUserFriendlyResponseWithNormalization = async (data) => {
  const normalizedData = {
    ...data,
    queryResult: normalizeQueryResult(data.queryResult)
  };
  
  return await generateUserFriendlyResponse(normalizedData);
};

module.exports = { 
  generateUserFriendlyResponse,
  generateUserFriendlyResponseWithNormalization,
  normalizeQueryResult
};