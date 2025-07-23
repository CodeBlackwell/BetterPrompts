export interface TestPrompt {
  input: string;
  category: string;
  expectedTechniques: string[];
  enhancementPatterns: RegExp[];
  complexity: 'simple' | 'moderate' | 'complex';
}

export const testPrompts: Record<string, TestPrompt> = {
  // Simple prompts
  simpleSummary: {
    input: 'Write a summary of this article',
    category: 'text_summarization',
    expectedTechniques: ['zero_shot', 'simple_instruction'],
    enhancementPatterns: [
      /summary|summarize/i,
      /key points|main ideas/i,
      /concise|brief/i
    ],
    complexity: 'simple'
  },
  
  simpleQuestion: {
    input: 'What is machine learning?',
    category: 'question_answering',
    expectedTechniques: ['zero_shot', 'educational_prompting'],
    enhancementPatterns: [
      /explain|definition/i,
      /simple terms|clear/i,
      /examples/i
    ],
    complexity: 'simple'
  },

  // Moderate prompts
  codeGeneration: {
    input: 'Write a Python function to implement binary search',
    category: 'code_generation',
    expectedTechniques: ['few_shot', 'chain_of_thought', 'code_generation'],
    enhancementPatterns: [
      /algorithm|implementation/i,
      /example|sample/i,
      /complexity|efficiency/i,
      /edge cases/i
    ],
    complexity: 'moderate'
  },

  dataAnalysis: {
    input: 'Analyze sales trends and provide insights on seasonal patterns',
    category: 'data_analysis',
    expectedTechniques: ['chain_of_thought', 'structured_output', 'analytical_reasoning'],
    enhancementPatterns: [
      /step.?by.?step|systematic/i,
      /metrics|indicators/i,
      /visualization|charts/i,
      /insights|conclusions/i
    ],
    complexity: 'moderate'
  },

  creativeWriting: {
    input: 'Write a short story about a time traveler',
    category: 'creative_writing',
    expectedTechniques: ['creative_prompting', 'storytelling', 'narrative_structure'],
    enhancementPatterns: [
      /character|protagonist/i,
      /plot|narrative/i,
      /setting|world/i,
      /conflict|tension/i
    ],
    complexity: 'moderate'
  },

  // Complex prompts
  businessPlan: {
    input: 'Create a comprehensive business plan for a sustainable tech startup focusing on renewable energy solutions',
    category: 'business_strategy',
    expectedTechniques: ['chain_of_thought', 'tree_of_thoughts', 'structured_output', 'strategic_planning'],
    enhancementPatterns: [
      /executive summary|overview/i,
      /market analysis|competitor/i,
      /financial projections|revenue/i,
      /strategy|roadmap/i,
      /swot|risks/i
    ],
    complexity: 'complex'
  },

  researchProposal: {
    input: 'Design a research study to investigate the effects of social media on teenage mental health',
    category: 'research_design',
    expectedTechniques: ['chain_of_thought', 'methodological_reasoning', 'structured_output'],
    enhancementPatterns: [
      /hypothesis|research questions/i,
      /methodology|methods/i,
      /sample|participants/i,
      /variables|measures/i,
      /ethical considerations/i
    ],
    complexity: 'complex'
  },

  systemDesign: {
    input: 'Design a scalable microservices architecture for an e-commerce platform',
    category: 'technical_design',
    expectedTechniques: ['chain_of_thought', 'architectural_thinking', 'system_design'],
    enhancementPatterns: [
      /microservices|services/i,
      /scalability|performance/i,
      /database|storage/i,
      /api|integration/i,
      /security|authentication/i
    ],
    complexity: 'complex'
  },

  // Edge cases
  veryShort: {
    input: 'Help',
    category: 'general',
    expectedTechniques: ['clarification_request', 'context_gathering'],
    enhancementPatterns: [
      /clarify|specify/i,
      /more.?information|details/i,
      /what.?kind|which.?type/i
    ],
    complexity: 'simple'
  },

  multilingual: {
    input: 'Translate this to Spanish and French: Hello, how are you?',
    category: 'translation',
    expectedTechniques: ['translation', 'multilingual'],
    enhancementPatterns: [
      /spanish|español/i,
      /french|français/i,
      /formal|informal/i,
      /context|usage/i
    ],
    complexity: 'simple'
  },

  mathematical: {
    input: 'Solve this calculus problem: find the derivative of x^3 + 2x^2 - 5x + 3',
    category: 'mathematics',
    expectedTechniques: ['chain_of_thought', 'mathematical_reasoning', 'step_by_step'],
    enhancementPatterns: [
      /step.?by.?step|process/i,
      /derivative|differentiation/i,
      /rules|formula/i,
      /solution|answer/i
    ],
    complexity: 'moderate'
  }
};

// Helper function to get prompts by complexity
export function getPromptsByComplexity(complexity: 'simple' | 'moderate' | 'complex'): TestPrompt[] {
  return Object.values(testPrompts).filter(prompt => prompt.complexity === complexity);
}

// Helper function to get prompts by category
export function getPromptsByCategory(category: string): TestPrompt[] {
  return Object.values(testPrompts).filter(prompt => prompt.category === category);
}

// Random prompt generator for stress testing
export function generateRandomPrompt(): string {
  const templates = [
    'Write a {adjective} {noun} about {topic}',
    'Explain how to {action} in {context}',
    'Create a {type} for {purpose}',
    'Analyze the {aspect} of {subject}',
    'Design a {thing} that {capability}'
  ];

  const adjectives = ['detailed', 'comprehensive', 'simple', 'creative', 'technical'];
  const nouns = ['guide', 'analysis', 'report', 'summary', 'plan'];
  const topics = ['technology', 'education', 'business', 'science', 'art'];
  const actions = ['implement', 'optimize', 'manage', 'develop', 'improve'];
  const contexts = ['production', 'startup', 'enterprise', 'academic', 'personal'];
  const types = ['system', 'process', 'strategy', 'framework', 'solution'];
  const purposes = ['efficiency', 'growth', 'learning', 'automation', 'innovation'];
  const aspects = ['impact', 'benefits', 'challenges', 'future', 'trends'];
  const subjects = ['AI', 'climate change', 'remote work', 'blockchain', 'healthcare'];
  const things = ['application', 'platform', 'tool', 'service', 'product'];
  const capabilities = ['scales automatically', 'saves time', 'reduces costs', 'improves quality', 'enhances security'];

  const template = templates[Math.floor(Math.random() * templates.length)];
  
  return template
    .replace('{adjective}', adjectives[Math.floor(Math.random() * adjectives.length)])
    .replace('{noun}', nouns[Math.floor(Math.random() * nouns.length)])
    .replace('{topic}', topics[Math.floor(Math.random() * topics.length)])
    .replace('{action}', actions[Math.floor(Math.random() * actions.length)])
    .replace('{context}', contexts[Math.floor(Math.random() * contexts.length)])
    .replace('{type}', types[Math.floor(Math.random() * types.length)])
    .replace('{purpose}', purposes[Math.floor(Math.random() * purposes.length)])
    .replace('{aspect}', aspects[Math.floor(Math.random() * aspects.length)])
    .replace('{subject}', subjects[Math.floor(Math.random() * subjects.length)])
    .replace('{thing}', things[Math.floor(Math.random() * things.length)])
    .replace('{capability}', capabilities[Math.floor(Math.random() * capabilities.length)]);
}