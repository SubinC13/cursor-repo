# AI Query Handler - Two-Prompt Architecture

This project converts a monolithic AI query handler into a clean two-prompt architecture that separates concerns and provides better modularity.

## Architecture Overview

### Original Single Function
The original `aiQueryResponse` function handled everything in one place:
- Input analysis
- SQL query generation
- Database execution
- Response formatting

### New Two-Prompt Architecture

#### 1. **First Prompt: Analysis & Query Generation** (`ai-query-analyzer.js`)
- Analyzes user input and chat history
- Determines if a database query is needed
- Generates SQL queries for database-related requests
- Returns direct responses for general questions
- Handles security checks and restrictions

#### 2. **Second Prompt: Response Generation** (`ai-response-generator.js`)
- Takes SQL query results
- Converts technical data into user-friendly responses
- Removes all technical jargon
- Formats responses in HTML
- Handles empty results gracefully

## File Structure

```
/workspace/
├── ai-query-analyzer.js      # First prompt - analysis & SQL generation
├── ai-response-generator.js  # Second prompt - user-friendly responses
├── integrated-ai-handler.js  # Integration layer with examples
└── README.md                # This documentation
```

## Usage Examples

### 1. Integrated Usage (Drop-in Replacement)

```javascript
const { aiQueryResponse } = require('./integrated-ai-handler');

const result = await aiQueryResponse({
  prompt: "Show me employees on leave today",
  history: [
    { role: "user", text: "Hello" },
    { role: "assistant", text: "Hi! How can I help?" }
  ]
});

console.log(result.response); // User-friendly HTML response
console.log(result.query);    // SQL query used (if any)
```

### 2. Separate Function Usage

```javascript
const { analyzeAndPrepareQuery } = require('./ai-query-analyzer');
const { generateUserFriendlyResponseWithNormalization } = require('./ai-response-generator');
const DB = require('../../db');

// Step 1: Analyze input
const analysis = await analyzeAndPrepareQuery({
  prompt: "Who is on vacation this week?",
  history: []
});

if (analysis.needsDbQuery) {
  // Step 2: Execute query
  const queryResult = await DB.raw(analysis.sqlQuery);
  
  // Step 3: Generate friendly response
  const response = await generateUserFriendlyResponseWithNormalization({
    queryResult: queryResult,
    originalPrompt: analysis.originalPrompt,
    formattedHistory: analysis.formattedHistory,
    sqlQuery: analysis.sqlQuery
  });
  
  console.log(response.response);
} else {
  console.log(analysis.response); // Direct response
}
```

### 3. Analysis Only (No Database Execution)

```javascript
const { analyzeOnly } = require('./integrated-ai-handler');

const analysis = await analyzeOnly({
  prompt: "What's the weather like?",
  history: []
});

// Returns: { type: "direct_response", response: "...", needsDbQuery: false }
```

### 4. Response Formatting Only

```javascript
const { formatResponseOnly } = require('./integrated-ai-handler');

const friendlyResponse = await formatResponseOnly(
  sqlQueryResults,
  "Show me employee details",
  chatHistory
);
```

## Function Return Types

### First Prompt (`analyzeAndPrepareQuery`)

```javascript
// For direct responses (no DB needed)
{
  type: "direct_response",
  response: "HTML formatted response",
  needsDbQuery: false
}

// For DB queries needed
{
  type: "db_query_needed", 
  sqlQuery: "SELECT * FROM employees...",
  needsDbQuery: true,
  originalPrompt: "user's original question",
  formattedHistory: "formatted chat history"
}

// For errors
{
  type: "error",
  response: "error message",
  needsDbQuery: false
}
```

### Second Prompt (`generateUserFriendlyResponse`)

```javascript
// Success
{
  type: "user_friendly_response",
  response: "HTML formatted user-friendly response",
  sqlQuery: "original SQL query" // for debugging
}

// Error
{
  type: "error",
  response: "error message"
}
```

## Benefits of Two-Prompt Architecture

### 1. **Separation of Concerns**
- First prompt focuses on understanding and query generation
- Second prompt focuses on response formatting
- Each prompt has a single, clear responsibility

### 2. **Better Testing**
- Test input analysis separately from response formatting
- Mock database results for response testing
- Easier unit testing of individual components

### 3. **Flexibility**
- Use only analysis without executing queries
- Format responses from cached or external data
- Different response styles for different contexts

### 4. **Performance Optimization**
- Cache analysis results
- Parallel processing opportunities
- Skip unnecessary steps based on analysis

### 5. **Maintainability**
- Easier to modify prompt logic
- Clear error handling boundaries
- Better code organization

## Security Features

Both functions maintain all security features from the original:
- Restricted operation detection
- SQL injection prevention
- Read-only query enforcement
- Input validation

## Error Handling

The architecture provides comprehensive error handling:
- Input validation errors
- SQL execution errors
- AI service errors
- Database connection errors
- Response generation errors

## Dependencies

- `../../db` - Database connection
- `../../utils/dbSchema` - Database schema information
- `../../utils/GeminiInit` - AI service initialization

## Migration Guide

To migrate from the original single function:

1. **Replace the import:**
   ```javascript
   // Old
   const aiQueryResponse = require('./original-file');
   
   // New
   const { aiQueryResponse } = require('./integrated-ai-handler');
   ```

2. **The API remains the same** - no code changes needed!

3. **For new projects**, consider using the separate functions for better modularity.

## Example Scenarios

### Scenario 1: Employee Information Query
```
User: "Show me John's leave balance"
→ First Prompt: Generates SQL query
→ Database: Executes query  
→ Second Prompt: "John has 15 vacation days remaining and 5 sick days available."
```

### Scenario 2: General Question
```
User: "What's the capital of France?"
→ First Prompt: Classifies as general, provides direct response
→ Result: "The capital of France is Paris."
```

### Scenario 3: Capabilities Question
```
User: "What can you do?"
→ First Prompt: Detects capabilities intent, returns predefined response
→ Result: HTML formatted capabilities list
```