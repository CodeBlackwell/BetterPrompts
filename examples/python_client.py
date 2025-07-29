#!/usr/bin/env python3
"""
BetterPrompts API Python Client Example

This example demonstrates how to use the BetterPrompts API to enhance prompts
using various techniques and authentication methods.
"""

import requests
import json
import time
from typing import Dict, List, Optional, Any


class BetterPromptsClient:
    """A simple client for the BetterPrompts API."""
    
    def __init__(self, base_url: str = "http://localhost:8080/api/v1", 
                 api_key: Optional[str] = None,
                 jwt_token: Optional[str] = None):
        """
        Initialize the BetterPrompts client.
        
        Args:
            base_url: The base URL of the API
            api_key: Optional API key for authentication
            jwt_token: Optional JWT token for authentication
        """
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        if api_key:
            self.session.headers["X-API-Key"] = api_key
        elif jwt_token:
            self.session.headers["Authorization"] = f"Bearer {jwt_token}"
    
    def enhance(self, 
                text: str,
                context: Optional[Dict[str, Any]] = None,
                prefer_techniques: Optional[List[str]] = None,
                exclude_techniques: Optional[List[str]] = None,
                target_complexity: Optional[str] = None) -> Dict[str, Any]:
        """
        Enhance a prompt using AI techniques.
        
        Args:
            text: The prompt text to enhance
            context: Additional context for enhancement
            prefer_techniques: List of preferred techniques
            exclude_techniques: List of techniques to exclude
            target_complexity: Target complexity level
            
        Returns:
            Enhanced prompt response
        """
        data = {"text": text}
        
        if context:
            data["context"] = context
        if prefer_techniques:
            data["prefer_techniques"] = prefer_techniques
        if exclude_techniques:
            data["exclude_techniques"] = exclude_techniques
        if target_complexity:
            data["target_complexity"] = target_complexity
        
        response = self.session.post(f"{self.base_url}/enhance", json=data)
        response.raise_for_status()
        return response.json()
    
    def analyze(self, text: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Analyze a prompt without enhancement.
        
        Args:
            text: The prompt text to analyze
            context: Additional context
            
        Returns:
            Analysis results
        """
        data = {"text": text}
        if context:
            data["context"] = context
        
        response = self.session.post(f"{self.base_url}/analyze", json=data)
        response.raise_for_status()
        return response.json()
    
    def get_techniques(self) -> Dict[str, Any]:
        """Get list of available techniques."""
        response = self.session.get(f"{self.base_url}/techniques")
        response.raise_for_status()
        return response.json()
    
    def login(self, email: str, password: str) -> str:
        """
        Login and get JWT token.
        
        Args:
            email: User email
            password: User password
            
        Returns:
            JWT token
        """
        response = self.session.post(
            f"{self.base_url}/auth/login",
            json={"email": email, "password": password}
        )
        response.raise_for_status()
        data = response.json()
        token = data["token"]
        self.session.headers["Authorization"] = f"Bearer {token}"
        return token
    
    def get_history(self, page: int = 1, per_page: int = 20) -> Dict[str, Any]:
        """
        Get enhancement history (requires authentication).
        
        Args:
            page: Page number
            per_page: Items per page
            
        Returns:
            History response
        """
        params = {"page": page, "per_page": per_page}
        response = self.session.get(f"{self.base_url}/history", params=params)
        response.raise_for_status()
        return response.json()


def main():
    """Example usage of the BetterPrompts client."""
    
    # Initialize client
    client = BetterPromptsClient()
    
    print("=== BetterPrompts API Examples ===\n")
    
    # Example 1: Basic enhancement
    print("1. Basic Enhancement")
    print("-" * 40)
    result = client.enhance("Explain how photosynthesis works")
    print(f"Original: {result['original_text']}")
    print(f"Enhanced: {result['enhanced_text'][:200]}...")
    print(f"Techniques: {', '.join(result['techniques_used'])}")
    print(f"Intent: {result['intent']}")
    print()
    
    # Example 2: Enhancement with preferences
    print("2. Enhancement with Preferences")
    print("-" * 40)
    result = client.enhance(
        "Help me understand recursion in programming",
        prefer_techniques=["step_by_step", "visual_thinking", "analogical"],
        context={"audience": "beginner_programmer"}
    )
    print(f"Enhanced: {result['enhanced_text'][:200]}...")
    print(f"Techniques: {', '.join(result['techniques_used'])}")
    print()
    
    # Example 3: Analyze without enhancement
    print("3. Intent Analysis")
    print("-" * 40)
    analysis = client.analyze("Write a story about a time traveler")
    print(f"Intent: {analysis['intent']}")
    print(f"Complexity: {analysis['complexity']}")
    print(f"Suggested techniques: {', '.join(analysis['suggested_techniques'])}")
    print()
    
    # Example 4: Get available techniques
    print("4. Available Techniques")
    print("-" * 40)
    techniques_response = client.get_techniques()
    techniques = techniques_response.get("techniques", [])
    for tech in techniques[:5]:  # Show first 5
        print(f"- {tech['name']}: {tech['description']}")
    print(f"... and {len(techniques) - 5} more techniques")
    print()
    
    # Example 5: Batch processing
    print("5. Batch Processing Example")
    print("-" * 40)
    prompts = [
        "Explain quantum computing",
        "How to start a small business",
        "Write a haiku about coding"
    ]
    
    for prompt in prompts:
        start_time = time.time()
        result = client.enhance(prompt)
        elapsed = (time.time() - start_time) * 1000
        print(f"✓ Enhanced '{prompt[:30]}...' in {elapsed:.0f}ms")
    print()
    
    # Example 6: Error handling
    print("6. Error Handling Example")
    print("-" * 40)
    try:
        client.enhance("")  # Empty prompt should fail
    except requests.HTTPError as e:
        print(f"Expected error: {e.response.status_code} - {e.response.json()['error']}")
    print()
    
    # Example 7: Different complexity levels
    print("7. Complexity Targeting")
    print("-" * 40)
    base_prompt = "Explain artificial intelligence"
    
    for complexity in ["beginner", "intermediate", "advanced"]:
        result = client.enhance(
            base_prompt,
            target_complexity=complexity,
            context={"audience": f"{complexity}_level"}
        )
        print(f"{complexity.capitalize()}: {result['enhanced_text'][:100]}...")
    
    print("\n=== Examples Complete ===")


if __name__ == "__main__":
    main()