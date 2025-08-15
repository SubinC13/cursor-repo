const DB = require("../../db");
const { analyzeAndPrepareQuery } = require("./ai-query-analyzer");
const { generateUserFriendlyResponseWithNormalization } = require("./ai-response-generator");

/**
 * INTEGRATED HANDLER: Combines both prompt functions to provide complete AI query handling
 * This replaces the original monolithic aiQueryResponse function
 */
const aiQueryResponse = async (data) => {
  try {
    // STEP 1: Use first prompt to analyze input and determine action
    const analysisResult = await analyzeAndPrepareQuery(data);
    
    // Handle direct responses (no DB query needed)
    if (!analysisResult.needsDbQuery) {
      return {
        response: analysisResult.response,
        query: null,
        type: analysisResult.type
      };
    }

    // Handle errors from analysis
    if (analysisResult.type === "error") {
      return {
        error: analysisResult.response,
        query: null
      };
    }

    // STEP 2: Execute the SQL query if one was generated
    let queryResult;
    try {
      console.log("Executing query:", analysisResult.sqlQuery);
      queryResult = await DB.raw(analysisResult.sqlQuery);
    } catch (err) {
      console.error("SQL execution error:", err);
      return {
        response: "Sorry, I couldn't process that request due to an issue with retrieving the information.",
        query: analysisResult.sqlQuery,
        error: "SQL execution failed"
      };
    }

    // STEP 3: Use second prompt to convert results to user-friendly response
    const friendlyResponseResult = await generateUserFriendlyResponseWithNormalization({
      queryResult: queryResult,
      originalPrompt: analysisResult.originalPrompt,
      formattedHistory: analysisResult.formattedHistory,
      sqlQuery: analysisResult.sqlQuery
    });

    // Handle errors from response generation
    if (friendlyResponseResult.type === "error") {
      return {
        response: friendlyResponseResult.response,
        query: analysisResult.sqlQuery,
        error: "Response generation failed"
      };
    }

    // Return successful result
    return {
      response: friendlyResponseResult.response,
      query: analysisResult.sqlQuery
    };

  } catch (error) {
    console.error("Error in integrated AI query handler:", error);
    return { 
      error: "Failed to get AI reply.",
      query: null 
    };
  }
};

/**
 * EXAMPLE USAGE: How to use the two separate functions independently
 */
const exampleSeparateUsage = async () => {
  const userData = {
    prompt: "Show me all employees with pending leave requests",
    history: [
      { role: "user", text: "Hello" },
      { role: "assistant", text: "Hi! How can I help you today?" }
    ]
  };

  try {
    console.log("=== STEP 1: Analyzing user input ===");
    const analysisResult = await analyzeAndPrepareQuery(userData);
    console.log("Analysis result:", analysisResult);

    if (analysisResult.needsDbQuery) {
      console.log("\n=== STEP 2: Executing database query ===");
      const queryResult = await DB.raw(analysisResult.sqlQuery);
      console.log("Query result:", queryResult);

      console.log("\n=== STEP 3: Generating user-friendly response ===");
      const friendlyResponse = await generateUserFriendlyResponseWithNormalization({
        queryResult: queryResult,
        originalPrompt: analysisResult.originalPrompt,
        formattedHistory: analysisResult.formattedHistory,
        sqlQuery: analysisResult.sqlQuery
      });
      console.log("Final response:", friendlyResponse);
    } else {
      console.log("No database query needed. Direct response:", analysisResult.response);
    }

  } catch (error) {
    console.error("Example usage error:", error);
  }
};

/**
 * LIGHTWEIGHT USAGE: For cases where you only need analysis without DB execution
 */
const analyzeOnly = async (data) => {
  return await analyzeAndPrepareQuery(data);
};

/**
 * RESPONSE ONLY: For cases where you already have query results and just need friendly formatting
 */
const formatResponseOnly = async (queryResult, originalPrompt, history = []) => {
  const { formatHistory } = require("./ai-query-analyzer");
  
  return await generateUserFriendlyResponseWithNormalization({
    queryResult: queryResult,
    originalPrompt: originalPrompt,
    formattedHistory: formatHistory(history)
  });
};

module.exports = {
  aiQueryResponse,           // Main integrated function (drop-in replacement)
  exampleSeparateUsage,      // Example of using functions separately
  analyzeOnly,               // First prompt only
  formatResponseOnly         // Second prompt only
};