#!/usr/bin/env python3
"""
BetterPrompts API - Python SDK Example

This example demonstrates how to use the BetterPrompts API with Python.

Installation:
    pip install requests

Usage:
    python example.py
"""

import os
import time
import json
import hmac
import hashlib
from typing import Dict, List, Optional, Any
from datetime import datetime
import requests
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry


class BetterPromptsClient:
    """BetterPrompts API Client for Python"""
    
    def __init__(self, api_key: str, base_url: str = "https://api.betterprompts.io/v1"):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.session = self._create_session()
    
    def _create_session(self) -> requests.Session:
        """Create a session with retry logic"""
        session = requests.Session()
        
        # Set default headers
        session.headers.update({
            'Content-Type': 'application/json',
            'X-API-Key': self.api_key,
            'User-Agent': 'BetterPrompts-Python-SDK/1.0'
        })
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "PUT", "DELETE", "OPTIONS", "TRACE", "POST"]
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        return session
    
    def _handle_response(self, response: requests.Response) -> Dict:
        """Handle API response and errors"""
        try:
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            if response.status_code == 429:
                # Handle rate limiting
                retry_after = response.headers.get('Retry-After', 60)
                print(f"Rate limited. Retry after {retry_after} seconds")
                time.sleep(int(retry_after))
                # Could implement retry here
            
            error_data = response.json() if response.content else {}
            error_message = error_data.get('message', str(e))
            raise Exception(f"API Error ({response.status_code}): {error_message}")
    
    def enhance(self, 
                text: str,
                context: Optional[Dict] = None,
                prefer_techniques: Optional[List[str]] = None,
                exclude_techniques: Optional[List[str]] = None,
                target_complexity: Optional[str] = None) -> Dict:
        """Enhance a single prompt"""
        
        payload = {"text": text}
        
        if context:
            payload["context"] = context
        if prefer_techniques:
            payload["prefer_techniques"] = prefer_techniques
        if exclude_techniques:
            payload["exclude_techniques"] = exclude_techniques
        if target_complexity:
            payload["target_complexity"] = target_complexity
        
        response = self.session.post(f"{self.base_url}/enhance", json=payload)
        return self._handle_response(response)
    
    def batch_enhance(self, requests: List[Dict], bearer_token: str) -> Dict:
        """Submit batch enhancement job (requires authentication)"""
        headers = {'Authorization': f'Bearer {bearer_token}'}
        
        response = self.session.post(
            f"{self.base_url}/batch",
            json={"requests": requests},
            headers=headers
        )
        return self._handle_response(response)
    
    def get_techniques(self, category: Optional[str] = None, 
                      complexity: Optional[int] = None) -> List[Dict]:
        """Get available techniques"""
        params = {}
        if category:
            params['category'] = category
        if complexity:
            params['complexity'] = complexity
        
        response = self.session.get(f"{self.base_url}/techniques", params=params)
        return self._handle_response(response)
    
    def get_history(self, bearer_token: str, **params) -> Dict:
        """Get enhancement history (requires authentication)"""
        headers = {'Authorization': f'Bearer {bearer_token}'}
        
        response = self.session.get(
            f"{self.base_url}/history",
            params=params,
            headers=headers
        )
        return self._handle_response(response)
    
    def get_stats(self, bearer_token: str) -> Dict:
        """Get usage statistics (requires authentication)"""
        headers = {'Authorization': f'Bearer {bearer_token}'}
        
        response = self.session.get(
            f"{self.base_url}/stats",
            headers=headers
        )
        return self._handle_response(response)


def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify webhook HMAC signature"""
    expected_signature = 'sha256=' + hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)


# Example usage functions

def example_basic_enhancement(client: BetterPromptsClient):
    """Example: Basic enhancement"""
    print("\n=== Basic Enhancement ===")
    
    result = client.enhance("Write a function to calculate factorial")
    
    print(f"Original: {result['original_text']}")
    print(f"Enhanced: {result['enhanced_text']}")
    print(f"Techniques: {', '.join(result['techniques_used'])}")
    print(f"Processing time: {result['processing_time_ms']}ms")
    
    return result


def example_enhancement_with_options(client: BetterPromptsClient):
    """Example: Enhancement with all options"""
    print("\n=== Enhancement with Options ===")
    
    result = client.enhance(
        text="Explain neural networks",
        context={
            "audience": "high school student",
            "subject": "computer science"
        },
        prefer_techniques=["analogies", "visual_description"],
        exclude_techniques=["mathematical_formulas"],
        target_complexity="simple"
    )
    
    print(f"Enhanced text: {result['enhanced_text'][:200]}...")
    print(f"Intent: {result['intent']}")
    print(f"Complexity: {result['complexity']}")
    print(f"Confidence: {result['confidence']:.2f}")
    
    return result


def example_get_techniques(client: BetterPromptsClient):
    """Example: Get available techniques"""
    print("\n=== Available Techniques ===")
    
    # Get reasoning techniques
    techniques = client.get_techniques(category="reasoning")
    
    print(f"Found {len(techniques)} reasoning techniques:")
    for tech in techniques[:5]:  # Show first 5
        print(f"\n- {tech['name']} ({tech['id']})")
        print(f"  Description: {tech['description'][:100]}...")
        print(f"  Complexity: {tech['complexity']}/5")
        print(f"  Effectiveness: {tech['effectiveness']['overall']:.2f}")


def example_batch_processing(client: BetterPromptsClient, token: str):
    """Example: Batch processing"""
    print("\n=== Batch Processing ===")
    
    batch_requests = [
        {
            "text": "What is quantum computing?",
            "target_complexity": "moderate"
        },
        {
            "text": "How do I implement a REST API?",
            "prefer_techniques": ["step_by_step", "code_examples"]
        },
        {
            "text": "Explain blockchain technology",
            "context": {"audience": "business executives"}
        }
    ]
    
    result = client.batch_enhance(batch_requests, token)
    print(f"Batch job submitted: {result['job_id']}")
    print("Status: Processing (results will be delivered via webhook)")
    
    return result


def example_history_analysis(client: BetterPromptsClient, token: str):
    """Example: Analyze enhancement history"""
    print("\n=== History Analysis ===")
    
    # Get recent history
    history = client.get_history(
        bearer_token=token,
        page=1,
        limit=10,
        sort_by="created_at",
        sort_order="desc"
    )
    
    print(f"Total enhancements: {history['total']}")
    print(f"Recent enhancements:")
    
    for item in history['items']:
        created = datetime.fromisoformat(item['created_at'].replace('Z', '+00:00'))
        print(f"\n- {item['original_text'][:50]}...")
        print(f"  Intent: {item['intent']}")
        print(f"  Techniques: {', '.join(item['techniques_used'])}")
        print(f"  Created: {created.strftime('%Y-%m-%d %H:%M')}")
    
    # Get usage stats
    stats = client.get_stats(token)
    print(f"\n=== Usage Statistics ===")
    print(f"Total enhancements: {stats['total_enhancements']}")
    print(f"Average confidence: {stats['average_confidence']:.2f}")
    print(f"Average processing time: {stats['average_processing_time']:.1f}ms")
    
    print("\nTop techniques used:")
    sorted_techniques = sorted(
        stats['techniques_usage'].items(), 
        key=lambda x: x[1], 
        reverse=True
    )
    for technique, count in sorted_techniques[:5]:
        print(f"  - {technique}: {count} times")


def example_error_handling(client: BetterPromptsClient):
    """Example: Error handling"""
    print("\n=== Error Handling ===")
    
    error_cases = [
        ("Empty text", {"text": ""}),
        ("Text too long", {"text": "a" * 5001}),
        ("Invalid technique", {"text": "Test", "prefer_techniques": ["invalid"]})
    ]
    
    for name, payload in error_cases:
        try:
            client.enhance(**payload)
        except Exception as e:
            print(f"\n{name}: {str(e)}")


def example_webhook_handler():
    """Example: Webhook handler for Flask"""
    print("\n=== Webhook Handler Example ===")
    
    example_code = '''
from flask import Flask, request, jsonify

app = Flask(__name__)
WEBHOOK_SECRET = "your-webhook-secret"

@app.route('/webhook', methods=['POST'])
def handle_webhook():
    # Get signature from headers
    signature = request.headers.get('X-Webhook-Signature', '')
    
    # Verify signature
    if not verify_webhook_signature(request.data, signature, WEBHOOK_SECRET):
        return jsonify({'error': 'Invalid signature'}), 401
    
    # Process event
    event = request.json
    event_type = event.get('event')
    
    if event_type == 'enhancement.completed':
        # Handle enhancement completion
        enhancement_id = event['data']['id']
        print(f"Enhancement completed: {enhancement_id}")
        
    elif event_type == 'batch.finished':
        # Handle batch completion
        job_id = event['data']['job_id']
        print(f"Batch job finished: {job_id}")
        
    elif event_type == 'error.occurred':
        # Handle error
        error_data = event['data']
        print(f"Error occurred: {error_data}")
    
    return jsonify({'received': True}), 200
'''
    print(example_code)


def main():
    """Run all examples"""
    print("BetterPrompts API - Python Examples")
    print("===================================")
    
    # Initialize client
    api_key = os.environ.get('BETTERPROMPTS_API_KEY', 'your-api-key-here')
    client = BetterPromptsClient(api_key)
    
    # Run examples that don't require authentication
    try:
        example_basic_enhancement(client)
        example_enhancement_with_options(client)
        example_get_techniques(client)
        example_error_handling(client)
        example_webhook_handler()
        
        # For authenticated examples, you would need to login first:
        # login_response = requests.post(
        #     f"{client.base_url}/auth/login",
        #     json={"email": "user@example.com", "password": "password"}
        # )
        # token = login_response.json()['access_token']
        # 
        # example_batch_processing(client, token)
        # example_history_analysis(client, token)
        
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()