/**
 * BetterPrompts API JavaScript/Node.js Client Example
 * 
 * This example demonstrates how to use the BetterPrompts API from JavaScript
 * in both Node.js and browser environments.
 */

class BetterPromptsClient {
  constructor(baseUrl = 'http://localhost:8080/api/v1', apiKey = null, jwtToken = null) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
    };
    
    if (apiKey) {
      this.headers['X-API-Key'] = apiKey;
    } else if (jwtToken) {
      this.headers['Authorization'] = `Bearer ${jwtToken}`;
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error || response.statusText}`);
    }

    return response.json();
  }

  async enhance(text, options = {}) {
    const data = {
      text,
      ...options,
    };

    return this.request('/enhance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async analyze(text, context = {}) {
    return this.request('/analyze', {
      method: 'POST',
      body: JSON.stringify({ text, context }),
    });
  }

  async getTechniques() {
    return this.request('/techniques');
  }

  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    this.headers['Authorization'] = `Bearer ${response.token}`;
    return response.token;
  }

  async getHistory(page = 1, perPage = 20) {
    return this.request(`/history?page=${page}&per_page=${perPage}`);
  }
}

// Example usage
async function runExamples() {
  const client = new BetterPromptsClient();
  
  console.log('=== BetterPrompts API Examples ===\n');

  try {
    // Example 1: Basic enhancement
    console.log('1. Basic Enhancement');
    console.log('-'.repeat(40));
    const basicResult = await client.enhance('Explain how neural networks work');
    console.log(`Original: ${basicResult.original_text}`);
    console.log(`Enhanced: ${basicResult.enhanced_text.substring(0, 200)}...`);
    console.log(`Techniques: ${basicResult.techniques_used.join(', ')}`);
    console.log();

    // Example 2: Enhancement with preferences
    console.log('2. Enhancement with Preferences');
    console.log('-'.repeat(40));
    const advancedResult = await client.enhance(
      'Help me debug a memory leak in my application',
      {
        prefer_techniques: ['step_by_step', 'problem_solving'],
        context: { programming_language: 'JavaScript' }
      }
    );
    console.log(`Enhanced: ${advancedResult.enhanced_text.substring(0, 200)}...`);
    console.log(`Techniques: ${advancedResult.techniques_used.join(', ')}`);
    console.log();

    // Example 3: Analyze intent
    console.log('3. Intent Analysis');
    console.log('-'.repeat(40));
    const analysis = await client.analyze('Create a marketing strategy for a startup');
    console.log(`Intent: ${analysis.intent}`);
    console.log(`Complexity: ${analysis.complexity}`);
    console.log(`Suggested techniques: ${analysis.suggested_techniques.join(', ')}`);
    console.log();

    // Example 4: Get techniques
    console.log('4. Available Techniques');
    console.log('-'.repeat(40));
    const { techniques } = await client.getTechniques();
    techniques.slice(0, 5).forEach(tech => {
      console.log(`- ${tech.name}: ${tech.description}`);
    });
    console.log(`... and ${techniques.length - 5} more techniques`);
    console.log();

    // Example 5: Batch processing with async/await
    console.log('5. Batch Processing Example');
    console.log('-'.repeat(40));
    const prompts = [
      'Explain blockchain technology',
      'How to improve public speaking skills',
      'Design a mobile app for fitness tracking'
    ];

    const batchResults = await Promise.all(
      prompts.map(async (prompt) => {
        const start = Date.now();
        const result = await client.enhance(prompt);
        const elapsed = Date.now() - start;
        return { prompt, elapsed, result };
      })
    );

    batchResults.forEach(({ prompt, elapsed }) => {
      console.log(`✓ Enhanced '${prompt.substring(0, 30)}...' in ${elapsed}ms`);
    });
    console.log();

    // Example 6: Error handling
    console.log('6. Error Handling Example');
    console.log('-'.repeat(40));
    try {
      await client.enhance(''); // Empty prompt should fail
    } catch (error) {
      console.log(`Expected error: ${error.message}`);
    }
    console.log();

    // Example 7: Browser-specific example (if running in browser)
    if (typeof window !== 'undefined') {
      console.log('7. Browser Integration Example');
      console.log('-'.repeat(40));
      
      // Create a simple UI element
      const button = document.createElement('button');
      button.textContent = 'Enhance Prompt';
      button.onclick = async () => {
        const input = prompt('Enter your prompt:');
        if (input) {
          const result = await client.enhance(input);
          alert(`Enhanced: ${result.enhanced_text}`);
        }
      };
      document.body.appendChild(button);
      console.log('Button added to page - click to test enhancement');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('\n=== Examples Complete ===');
}

// Run examples if in Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BetterPromptsClient;
  
  // Run examples if this file is executed directly
  if (require.main === module) {
    runExamples();
  }
} else {
  // Browser environment - attach to window
  window.BetterPromptsClient = BetterPromptsClient;
  
  // Auto-run examples when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runExamples);
  } else {
    runExamples();
  }
}