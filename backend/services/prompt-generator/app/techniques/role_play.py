from typing import Dict, Any, Optional
from .base import BaseTechnique


class RolePlayTechnique(BaseTechnique):
    """
    Role-playing technique implementation.
    
    This technique assigns a specific role or persona to the model
    to influence its responses and expertise. It enhances responses
    with domain-specific knowledge, appropriate tone, and perspective-aware insights.
    """
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.default_template = """You are {{ role }}. {{ role_description }}

{{ additional_context }}

With this expertise and perspective in mind, please address the following:

{{ text }}"""
        
        self.enhanced_template = """You are {{ role }}, {{ role_description }}

Key traits and approach:
{% for trait in traits %}
- {{ trait }}
{% endfor %}

{{ domain_context }}

{{ additional_context }}

Drawing upon your expertise and unique perspective, please provide a {{ approach_style }} response to:

{{ text }}

Remember to:
- Leverage your specialized knowledge and experience
- Maintain the perspective and voice of {{ role }}
- Apply domain-specific insights where relevant
- Provide {{ deliverable_type }} guidance"""
        
        if not self.template:
            self.template = self.default_template
            
        self.default_roles = {
            "expert": {
                "description": "an expert in the relevant field with deep knowledge and years of experience",
                "traits": ["analytical", "precise", "authoritative", "evidence-based"],
                "approach": "comprehensive and technical",
                "deliverable": "detailed and authoritative"
            },
            "teacher": {
                "description": "an experienced teacher who excels at explaining complex concepts simply",
                "traits": ["patient", "clear", "encouraging", "structured"],
                "approach": "step-by-step and accessible",
                "deliverable": "educational and easy-to-understand"
            },
            "consultant": {
                "description": "a professional consultant who provides strategic advice and solutions",
                "traits": ["strategic", "practical", "results-oriented", "efficient"],
                "approach": "solution-focused and actionable",
                "deliverable": "practical and implementable"
            },
            "researcher": {
                "description": "a meticulous researcher who values accuracy and evidence-based approaches",
                "traits": ["thorough", "objective", "data-driven", "methodical"],
                "approach": "systematic and well-referenced",
                "deliverable": "evidence-based and comprehensive"
            },
            "creative": {
                "description": "a creative professional who thinks outside the box and generates innovative ideas",
                "traits": ["imaginative", "original", "unconventional", "inspiring"],
                "approach": "creative and exploratory",
                "deliverable": "innovative and thought-provoking"
            },
            "analyst": {
                "description": "a data analyst who excels at finding patterns and insights in complex information",
                "traits": ["data-driven", "logical", "detail-oriented", "systematic"],
                "approach": "quantitative and analytical",
                "deliverable": "data-backed and insightful"
            },
            "mentor": {
                "description": "an experienced mentor who guides others toward growth and success",
                "traits": ["supportive", "wise", "encouraging", "insightful"],
                "approach": "guidance-oriented and empowering",
                "deliverable": "actionable and growth-focused"
            },
            "critic": {
                "description": "a constructive critic who provides balanced and thoughtful analysis",
                "traits": ["objective", "fair", "thorough", "constructive"],
                "approach": "balanced and analytical",
                "deliverable": "honest and improvement-focused"
            },
            "innovator": {
                "description": "an innovation specialist who transforms ideas into breakthrough solutions",
                "traits": ["visionary", "bold", "experimental", "forward-thinking"],
                "approach": "disruptive and transformative",
                "deliverable": "groundbreaking and future-oriented"
            },
            "practitioner": {
                "description": "a hands-on practitioner with real-world experience and practical wisdom",
                "traits": ["experienced", "pragmatic", "realistic", "skilled"],
                "approach": "practical and experience-based",
                "deliverable": "actionable and realistic"
            }
        }
        
    def apply(self, text: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Apply role-playing technique with enhanced or basic mode"""
        text = self.clean_text(text)
        
        # Extract context information
        enhanced_mode = context.get("enhanced", False) if context else False
        intent = context.get("intent", "") if context else ""
        domain = context.get("domain", "") if context else ""
        custom_role = context.get("role") if context else None
        custom_traits = context.get("traits", []) if context else []
        
        # Determine role and characteristics
        if custom_role:
            # Use custom role if provided
            role = custom_role
            if custom_role.lower() in self.default_roles:
                role_info = self.default_roles[custom_role.lower()]
                role_description = role_info["description"]
                traits = custom_traits or role_info["traits"]
                approach_style = role_info["approach"]
                deliverable_type = role_info["deliverable"]
            else:
                # Custom role without predefined info
                role_description = context.get("role_description", f"{role} with specialized knowledge")
                traits = custom_traits or ["knowledgeable", "professional", "helpful"]
                approach_style = "comprehensive and helpful"
                deliverable_type = "practical and valuable"
        else:
            # Auto-select role based on intent and content
            role_key = self._determine_role_from_context(text, intent, domain)
            role_info = self.default_roles[role_key]
            role = self._get_role_article(role_key)
            role_description = role_info["description"]
            traits = role_info["traits"]
            approach_style = role_info["approach"]
            deliverable_type = role_info["deliverable"]
        
        # Build additional context
        additional_context = self._build_additional_context(domain, context)
        domain_context = f"Your expertise specifically covers {domain}." if domain else ""
        
        # Select and render template
        if enhanced_mode:
            template = self.enhanced_template
            template_vars = {
                "text": text,
                "role": role,
                "role_description": role_description,
                "traits": traits,
                "approach_style": approach_style,
                "deliverable_type": deliverable_type,
                "domain_context": domain_context,
                "additional_context": additional_context
            }
        else:
            template = self.template
            template_vars = {
                "text": text,
                "role": role,
                "role_description": role_description,
                "additional_context": additional_context
            }
        
        return self.render_template(template, template_vars)
    
    def validate_input(self, text: str, context: Optional[Dict[str, Any]] = None) -> bool:
        """Validate if role-playing is appropriate"""
        # Role-playing can enhance most prompts
        # But it's particularly useful for certain types
        
        # Check for expertise-requiring keywords
        expertise_keywords = [
            "expert", "professional", "analyze", "advise", "recommend",
            "evaluate", "assess", "review", "critique", "guide"
        ]
        
        text_lower = text.lower()
        benefits_from_role = any(keyword in text_lower for keyword in expertise_keywords)
        
        if benefits_from_role:
            self.logger.info("Input would benefit from role-playing")
            
        return True  # Can be applied to most prompts
    
    def _determine_role_from_context(self, text: str, intent: str, domain: str) -> str:
        """Determine appropriate role based on context, intent, and content"""
        text_lower = text.lower()
        intent_lower = intent.lower()
        domain_lower = domain.lower()
        
        # Check intent-based mapping first
        intent_role_mapping = {
            "educational": "teacher",
            "analytical": "analyst", 
            "creative": "creative",
            "technical": "expert",
            "business": "consultant",
            "scientific": "researcher",
            "writing": "creative",
            "debugging": "practitioner",
            "design": "creative",
            "strategy": "consultant",
            "research": "researcher",
            "innovation": "innovator",
            "review": "critic",
            "guidance": "mentor"
        }
        
        for intent_key, role_key in intent_role_mapping.items():
            if intent_key in intent_lower:
                return role_key
        
        # Check domain-based mapping
        domain_role_mapping = {
            "technical": "expert",
            "business": "consultant",
            "education": "teacher",
            "science": "researcher",
            "creative": "creative",
            "data": "analyst"
        }
        
        for domain_key, role_key in domain_role_mapping.items():
            if domain_key in domain_lower:
                return role_key
        
        # Content-based analysis
        keyword_role_mapping = {
            "teacher": ["teach", "explain", "learn", "understand", "educate"],
            "analyst": ["analyze", "data", "metrics", "statistics", "patterns"],
            "consultant": ["strategy", "advice", "recommend", "solution", "optimize"],
            "researcher": ["research", "study", "investigate", "experiment", "hypothesis"],
            "creative": ["create", "design", "imagine", "innovate", "brainstorm"],
            "mentor": ["guide", "help", "develop", "grow", "improve"],
            "critic": ["review", "evaluate", "assess", "critique", "feedback"],
            "innovator": ["transform", "disrupt", "revolutionize", "breakthrough"],
            "practitioner": ["implement", "build", "fix", "debug", "deploy"],
            "expert": ["technical", "complex", "advanced", "specialized"]
        }
        
        # Count keyword matches for each role
        role_scores = {}
        for role, keywords in keyword_role_mapping.items():
            score = sum(1 for keyword in keywords if keyword in text_lower)
            if score > 0:
                role_scores[role] = score
        
        # Return role with highest score, or default to expert
        if role_scores:
            return max(role_scores, key=role_scores.get)
        
        return "expert"
    
    def _get_role_article(self, role_key: str) -> str:
        """Get the appropriate article and role name"""
        role_articles = {
            "expert": "an expert",
            "teacher": "a teacher",
            "consultant": "a consultant",
            "researcher": "a researcher",
            "creative": "a creative professional",
            "analyst": "an analyst",
            "mentor": "a mentor",
            "critic": "a critic",
            "innovator": "an innovator",
            "practitioner": "a practitioner"
        }
        return role_articles.get(role_key, "an expert")
    
    def _build_additional_context(self, domain: str, context: Optional[Dict[str, Any]]) -> str:
        """Build additional context string from various context elements"""
        parts = []
        
        if context:
            # Add specific requirements
            if "requirements" in context:
                reqs = context["requirements"]
                if isinstance(reqs, list):
                    parts.append(f"Key requirements: {', '.join(reqs)}")
                else:
                    parts.append(f"Key requirement: {reqs}")
            
            # Add constraints
            if "constraints" in context:
                constraints = context["constraints"]
                if isinstance(constraints, list):
                    parts.append(f"Important constraints: {', '.join(constraints)}")
                else:
                    parts.append(f"Important constraint: {constraints}")
            
            # Add target audience
            if "audience" in context:
                parts.append(f"Target audience: {context['audience']}")
            
            # Add specific goals
            if "goals" in context:
                goals = context["goals"]
                if isinstance(goals, list):
                    parts.append(f"Goals: {', '.join(goals)}")
                else:
                    parts.append(f"Goal: {goals}")
        
        return " ".join(parts) if parts else ""