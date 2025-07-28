/**
 * Educational content fixtures for prompt engineering techniques
 * Used in technique education tests
 */

export interface TechniqueEducationalContent {
  id: string;
  name: string;
  description: string;
  examples: string[];
  benefits: string[];
  useCases: string[];
  alternatives: string[];
  learnMoreUrl: string;
  category: string;
}

export const techniqueEducationalContent: TechniqueEducationalContent[] = [
  {
    id: 'chain-of-thought',
    name: 'Chain of Thought',
    description: 'Chain of Thought (CoT) prompting encourages the AI to break down complex problems into step-by-step reasoning, making the thought process transparent and improving accuracy for multi-step tasks.',
    examples: [
      'Math problem: "Let\'s solve this step by step: First, calculate the base amount..."',
      'Logic puzzle: "To find the answer, I\'ll work through each clue systematically..."',
      'Analysis: "Breaking this down into components: 1) Identify the problem 2) Analyze causes..."'
    ],
    benefits: [
      'Improves accuracy for complex reasoning tasks',
      'Makes AI\'s thinking process transparent',
      'Reduces errors in multi-step problems',
      'Helps identify where reasoning might go wrong'
    ],
    useCases: [
      'Mathematical calculations',
      'Logic puzzles and riddles',
      'Complex analysis tasks',
      'Decision-making processes',
      'Scientific reasoning'
    ],
    alternatives: ['Tree of Thoughts', 'Step-by-Step Reasoning', 'Zero-Shot CoT'],
    learnMoreUrl: '/docs/techniques/chain-of-thought',
    category: 'reasoning'
  },
  {
    id: 'few-shot',
    name: 'Few-Shot Learning',
    description: 'Few-shot learning provides the AI with a small number of examples before asking it to perform a similar task, helping it understand the desired format and approach.',
    examples: [
      'Sentiment: "Happy birthday!" → Positive | "Traffic was terrible" → Negative | Now classify: "Great job!"',
      'Format: Name: John, Age: 25 | Name: Sarah, Age: 30 | Now format: Alice is 28 years old',
      'Translation: Cat → Gato | Dog → Perro | Now translate: Bird'
    ],
    benefits: [
      'Helps AI understand desired output format',
      'Improves consistency across responses',
      'Reduces ambiguity in instructions',
      'Works well for pattern recognition tasks'
    ],
    useCases: [
      'Data formatting and transformation',
      'Classification tasks',
      'Style matching',
      'Pattern completion',
      'Custom formatting requirements'
    ],
    alternatives: ['Zero-Shot', 'One-Shot', 'Chain of Thought'],
    learnMoreUrl: '/docs/techniques/few-shot-learning',
    category: 'learning'
  },
  {
    id: 'tree-of-thoughts',
    name: 'Tree of Thoughts',
    description: 'Tree of Thoughts (ToT) extends Chain of Thought by exploring multiple reasoning paths simultaneously, evaluating each branch, and selecting the most promising approach.',
    examples: [
      'Problem solving: "Let me explore three approaches: A) Direct calculation B) Working backwards C) Pattern recognition"',
      'Creative writing: "Three possible story directions: 1) Mystery angle 2) Romance subplot 3) Action sequence"',
      'Strategy: "Evaluating options: Option 1 (Pros: Fast, Cons: Risky), Option 2 (Pros: Safe, Cons: Slow)"'
    ],
    benefits: [
      'Explores multiple solution paths',
      'Compares different approaches systematically',
      'Reduces chance of getting stuck on one path',
      'Improves creative problem solving'
    ],
    useCases: [
      'Complex problem solving',
      'Strategic planning',
      'Creative writing',
      'Decision analysis',
      'Research exploration'
    ],
    alternatives: ['Chain of Thought', 'Graph of Thoughts', 'Beam Search'],
    learnMoreUrl: '/docs/techniques/tree-of-thoughts',
    category: 'reasoning'
  },
  {
    id: 'react',
    name: 'ReAct (Reasoning + Acting)',
    description: 'ReAct combines reasoning with action, allowing the AI to think about a problem, take an action, observe the result, and continue this cycle until reaching a solution.',
    examples: [
      'Search task: "Thought: I need to find the capital. Action: Search \'France capital\'. Observation: Paris is the capital."',
      'Calculation: "Thought: Break into steps. Action: Calculate 15% of 200. Observation: 30. Action: Add to base..."',
      'Research: "Thought: Need more context. Action: Look up definition. Observation: [result]. Thought: Now I can answer..."'
    ],
    benefits: [
      'Combines thinking with tool use',
      'Self-corrects based on observations',
      'Handles dynamic problems well',
      'Transparent decision process'
    ],
    useCases: [
      'Research tasks',
      'Information gathering',
      'Tool-assisted problem solving',
      'Interactive tasks',
      'Multi-step investigations'
    ],
    alternatives: ['Chain of Thought', 'Tool Use', 'Self-Reflection'],
    learnMoreUrl: '/docs/techniques/react',
    category: 'reasoning'
  },
  {
    id: 'role-prompting',
    name: 'Role Prompting',
    description: 'Role prompting assigns a specific role, expertise, or perspective to the AI, helping it adopt appropriate knowledge, tone, and approach for the task.',
    examples: [
      'Expert: "As a senior data scientist, analyze this dataset for patterns..."',
      'Teacher: "Explain quantum physics as if you were teaching a high school class..."',
      'Character: "As a detective from the 1940s, describe what you observe in this scene..."'
    ],
    benefits: [
      'Activates domain-specific knowledge',
      'Sets appropriate tone and style',
      'Improves contextual responses',
      'Enhances creative outputs'
    ],
    useCases: [
      'Expert consultations',
      'Educational content',
      'Creative writing',
      'Professional advice',
      'Perspective analysis'
    ],
    alternatives: ['Persona-based Prompting', 'Zero-Shot', 'Few-Shot'],
    learnMoreUrl: '/docs/techniques/role-prompting',
    category: 'perspective'
  },
  {
    id: 'zero-shot-cot',
    name: 'Zero-Shot Chain of Thought',
    description: 'Zero-Shot CoT triggers step-by-step reasoning without examples by simply adding "Let\'s think step by step" to the prompt.',
    examples: [
      'Simple: "What\'s 15% of 240? Let\'s think step by step."',
      'Logic: "If all roses are flowers and some flowers fade quickly, do all roses fade quickly? Let\'s think step by step."',
      'Planning: "How would you organize a conference for 500 people? Let\'s think step by step."'
    ],
    benefits: [
      'No examples needed',
      'Works across many domains',
      'Simple to implement',
      'Improves reasoning accuracy'
    ],
    useCases: [
      'Quick reasoning tasks',
      'When examples aren\'t available',
      'General problem solving',
      'Logical deduction',
      'Mathematical problems'
    ],
    alternatives: ['Chain of Thought', 'Few-Shot CoT', 'Direct Prompting'],
    learnMoreUrl: '/docs/techniques/zero-shot-cot',
    category: 'reasoning'
  },
  {
    id: 'self-consistency',
    name: 'Self-Consistency',
    description: 'Self-consistency generates multiple reasoning paths for the same problem and selects the most consistent answer, improving reliability.',
    examples: [
      'Math: "Solve this three different ways and verify the answer matches"',
      'Analysis: "Approach this problem from multiple angles and find the common conclusion"',
      'Verification: "Double-check this answer by solving it differently"'
    ],
    benefits: [
      'Reduces random errors',
      'Improves answer reliability',
      'Identifies edge cases',
      'Builds confidence in results'
    ],
    useCases: [
      'Critical calculations',
      'Important decisions',
      'Fact verification',
      'Quality assurance',
      'Research validation'
    ],
    alternatives: ['Chain of Thought', 'Tree of Thoughts', 'Ensemble Methods'],
    learnMoreUrl: '/docs/techniques/self-consistency',
    category: 'validation'
  },
  {
    id: 'prompt-chaining',
    name: 'Prompt Chaining',
    description: 'Prompt chaining breaks complex tasks into a series of simpler prompts, where each output feeds into the next prompt as input.',
    examples: [
      'Research: "1) List key points → 2) Organize by theme → 3) Write summary"',
      'Analysis: "1) Extract data → 2) Identify patterns → 3) Draw conclusions"',
      'Creation: "1) Generate outline → 2) Expand sections → 3) Polish final version"'
    ],
    benefits: [
      'Handles complex multi-stage tasks',
      'Maintains context between steps',
      'Easier to debug and refine',
      'Allows for human review between steps'
    ],
    useCases: [
      'Document generation',
      'Complex analysis',
      'Multi-stage workflows',
      'Report writing',
      'Data processing pipelines'
    ],
    alternatives: ['Single Complex Prompt', 'ReAct', 'Tool Chaining'],
    learnMoreUrl: '/docs/techniques/prompt-chaining',
    category: 'workflow'
  },
  {
    id: 'constrained-generation',
    name: 'Constrained Generation',
    description: 'Constrained generation sets specific rules, formats, or limitations on the AI\'s output to ensure it meets exact requirements.',
    examples: [
      'Format: "Generate a JSON object with exactly these fields: {name, age, city}"',
      'Length: "Write a summary in exactly 3 sentences, each 10-15 words long"',
      'Style: "Respond using only questions, no statements allowed"'
    ],
    benefits: [
      'Ensures consistent output format',
      'Prevents unwanted variations',
      'Easier to parse programmatically',
      'Meets strict requirements'
    ],
    useCases: [
      'API integrations',
      'Structured data generation',
      'Form filling',
      'Code generation',
      'Strict format requirements'
    ],
    alternatives: ['Few-Shot Learning', 'Template-Based', 'Structured Output'],
    learnMoreUrl: '/docs/techniques/constrained-generation',
    category: 'formatting'
  },
  {
    id: 'maieutic-prompting',
    name: 'Maieutic Prompting',
    description: 'Maieutic prompting uses a Socratic method of questioning to help the AI arrive at deeper insights through self-inquiry and explanation.',
    examples: [
      'Exploration: "Why do you think that\'s true? What evidence supports it? What might contradict it?"',
      'Learning: "Explain your reasoning. Now, what assumptions did you make? Are they valid?"',
      'Analysis: "What are the implications? How does this connect to the broader context?"'
    ],
    benefits: [
      'Encourages deeper analysis',
      'Reveals hidden assumptions',
      'Improves critical thinking',
      'Uncovers nuanced insights'
    ],
    useCases: [
      'Philosophical discussions',
      'Complex analysis',
      'Educational dialogue',
      'Critical thinking tasks',
      'Assumption testing'
    ],
    alternatives: ['Socratic Method', 'Chain of Thought', 'Self-Reflection'],
    learnMoreUrl: '/docs/techniques/maieutic-prompting',
    category: 'reasoning'
  }
];

/**
 * Get educational content for a specific technique
 */
export function getEducationalContent(techniqueId: string): TechniqueEducationalContent | undefined {
  return techniqueEducationalContent.find(content => content.id === techniqueId);
}

/**
 * Get techniques by category
 */
export function getTechniquesByCategory(category: string): TechniqueEducationalContent[] {
  return techniqueEducationalContent.filter(content => content.category === category);
}

/**
 * Get alternative techniques for a given technique
 */
export function getAlternativeTechniques(techniqueId: string): TechniqueEducationalContent[] {
  const technique = getEducationalContent(techniqueId);
  if (!technique) return [];
  
  return technique.alternatives
    .map(altId => techniqueEducationalContent.find(t => t.id === altId || t.name === altId))
    .filter((t): t is TechniqueEducationalContent => t !== undefined);
}

/**
 * Accessibility text for screen readers
 */
export const accessibilityContent = {
  tooltipInstructions: 'Press Enter or Space to learn more about this technique',
  modalInstructions: 'Press Escape to close this dialog',
  navigationInstructions: 'Use arrow keys to navigate between techniques',
  comparisonInstructions: 'Table comparing features of different techniques. Use arrow keys to navigate cells.',
};

/**
 * WCAG compliance checklist
 */
export const wcagChecklist = {
  perceivable: [
    'Color is not the only means of conveying information',
    'Contrast ratio of at least 4.5:1 for normal text',
    'Images have appropriate alt text',
    'Content is readable when zoomed to 200%'
  ],
  operable: [
    'All functionality available via keyboard',
    'No keyboard traps',
    'Skip links available for repetitive content',
    'Touch targets are at least 44x44 pixels'
  ],
  understandable: [
    'Labels clearly describe purpose',
    'Error messages are descriptive',
    'Consistent navigation throughout',
    'Context is clear without color/position'
  ],
  robust: [
    'Valid HTML markup',
    'ARIA attributes used correctly',
    'Works with screen readers',
    'Compatible with browser zoom'
  ]
};