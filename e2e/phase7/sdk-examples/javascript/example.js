/**
 * BetterPrompts API - JavaScript SDK Example
 * 
 * This example demonstrates how to use the BetterPrompts API with JavaScript/Node.js
 * 
 * Installation:
 * npm install axios
 * 
 * Usage:
 * node example.js
 */

const axios = require('axios');
const crypto = require('crypto');

// Configuration
const API_KEY = process.env.BETTERPROMPTS_API_KEY || 'your-api-key-here';
const BASE_URL = process.env.BETTERPROMPTS_API_URL || 'https://api.betterprompts.io/v1';

// Create axios instance with default config
const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  },
  timeout: 30000
});

// Add response interceptor for error handling
client.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 429) {
      // Handle rate limiting
      const retryAfter = error.response.headers['retry-after'] || 60;
      console.log(`Rate limited. Retrying after ${retryAfter} seconds...`);
      await sleep(retryAfter * 1000);
      return client.request(error.config);
    }
    throw error;
  }
);

// Helper function for sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 1. Basic Enhancement
async function basicEnhancement() {
  console.log('\n=== Basic Enhancement ===');
  
  try {
    const response = await client.post('/enhance', {
      text: 'Write a function to sort an array'
    });

    console.log('Original:', response.data.original_text);
    console.log('Enhanced:', response.data.enhanced_text);
    console.log('Techniques used:', response.data.techniques_used.join(', '));
    console.log('Processing time:', response.data.processing_time_ms + 'ms');
    
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// 2. Enhancement with Options
async function enhancementWithOptions() {
  console.log('\n=== Enhancement with Options ===');
  
  try {
    const response = await client.post('/enhance', {
      text: 'Explain recursion to a beginner',
      context: {
        audience: 'beginner programmer',
        programming_language: 'python'
      },
      prefer_techniques: ['analogies', 'step_by_step', 'examples'],
      exclude_techniques: ['technical_jargon'],
      target_complexity: 'simple'
    });

    console.log('Enhanced text:', response.data.enhanced_text);
    console.log('Complexity:', response.data.complexity);
    console.log('Confidence:', response.data.confidence);
    
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// 3. Get Available Techniques
async function getAvailableTechniques() {
  console.log('\n=== Available Techniques ===');
  
  try {
    const response = await client.get('/techniques', {
      params: {
        category: 'reasoning',
        complexity: 2
      }
    });

    console.log(`Found ${response.data.length} techniques:`);
    response.data.forEach(technique => {
      console.log(`- ${technique.name} (${technique.id})`);
      console.log(`  Category: ${technique.category}`);
      console.log(`  Effectiveness: ${technique.effectiveness.overall}`);
    });
    
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// 4. Batch Processing (requires authentication)
async function batchProcessing(bearerToken) {
  console.log('\n=== Batch Processing ===');
  
  try {
    const response = await client.post('/batch', {
      requests: [
        {
          text: 'What is machine learning?',
          target_complexity: 'simple'
        },
        {
          text: 'Implement a neural network',
          prefer_techniques: ['step_by_step', 'code_examples']
        },
        {
          text: 'Explain gradient descent',
          context: { audience: 'data scientist' }
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`
      }
    });

    console.log('Batch job ID:', response.data.job_id);
    console.log('Status: Processing...');
    
    // In a real application, you would poll for results or use webhooks
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// 5. Get Enhancement History (requires authentication)
async function getHistory(bearerToken) {
  console.log('\n=== Enhancement History ===');
  
  try {
    const response = await client.get('/history', {
      params: {
        page: 1,
        limit: 5,
        sort_by: 'created_at',
        sort_order: 'desc'
      },
      headers: {
        'Authorization': `Bearer ${bearerToken}`
      }
    });

    console.log(`Total enhancements: ${response.data.total}`);
    console.log(`Showing ${response.data.items.length} recent items:`);
    
    response.data.items.forEach(item => {
      console.log(`\n- ${item.original_text.substring(0, 50)}...`);
      console.log(`  Intent: ${item.intent}`);
      console.log(`  Techniques: ${item.techniques_used.join(', ')}`);
      console.log(`  Created: ${new Date(item.created_at).toLocaleString()}`);
    });
    
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// 6. Webhook Example
function createWebhookHandler(secret) {
  return (req, res) => {
    // Verify webhook signature
    const signature = req.headers['x-webhook-signature'];
    const payload = JSON.stringify(req.body);
    
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Process webhook event
    const event = req.body;
    console.log(`Received webhook event: ${event.event}`);
    
    switch (event.event) {
      case 'enhancement.completed':
        console.log('Enhancement completed:', event.data.id);
        // Process enhancement result
        break;
        
      case 'batch.finished':
        console.log('Batch finished:', event.data.job_id);
        // Fetch batch results
        break;
        
      case 'error.occurred':
        console.error('Error occurred:', event.data);
        // Handle error
        break;
    }
    
    res.status(200).json({ received: true });
  };
}

// 7. Rate Limit Handling Example
async function handleRateLimits() {
  console.log('\n=== Rate Limit Handling ===');
  
  const requests = [];
  
  // Make multiple requests to demonstrate rate limiting
  for (let i = 0; i < 5; i++) {
    requests.push(
      client.post('/enhance', {
        text: `Test request ${i + 1}`
      }).then(response => {
        // Check rate limit headers
        const headers = response.headers;
        console.log(`Request ${i + 1} - Remaining: ${headers['x-ratelimit-remaining']}`);
        return response.data;
      }).catch(error => {
        if (error.response?.status === 429) {
          console.log(`Request ${i + 1} - Rate limited!`);
        }
        throw error;
      })
    );
  }
  
  try {
    await Promise.all(requests);
  } catch (error) {
    // Some requests may have been rate limited
  }
}

// 8. Error Handling Example
async function demonstrateErrorHandling() {
  console.log('\n=== Error Handling ===');
  
  // Test various error scenarios
  const errorScenarios = [
    {
      name: 'Validation Error',
      request: { text: '' }
    },
    {
      name: 'Text Too Long',
      request: { text: 'a'.repeat(5001) }
    },
    {
      name: 'Invalid Technique',
      request: { 
        text: 'Test',
        prefer_techniques: ['invalid_technique']
      }
    }
  ];
  
  for (const scenario of errorScenarios) {
    try {
      await client.post('/enhance', scenario.request);
    } catch (error) {
      console.log(`\n${scenario.name}:`);
      console.log('Status:', error.response?.status);
      console.log('Error:', error.response?.data?.error);
      console.log('Message:', error.response?.data?.message);
    }
  }
}

// Main function to run all examples
async function main() {
  console.log('BetterPrompts API - JavaScript Examples');
  console.log('=====================================');
  
  // Run basic examples
  await basicEnhancement();
  await enhancementWithOptions();
  await getAvailableTechniques();
  await handleRateLimits();
  await demonstrateErrorHandling();
  
  // For authenticated endpoints, you would need to login first:
  // const authResponse = await client.post('/auth/login', {
  //   email: 'user@example.com',
  //   password: 'password'
  // });
  // const bearerToken = authResponse.data.access_token;
  // 
  // await batchProcessing(bearerToken);
  // await getHistory(bearerToken);
}

// Run examples
if (require.main === module) {
  main().catch(console.error);
}

// Export for use as a module
module.exports = {
  client,
  basicEnhancement,
  enhancementWithOptions,
  getAvailableTechniques,
  batchProcessing,
  getHistory,
  createWebhookHandler,
  handleRateLimits
};