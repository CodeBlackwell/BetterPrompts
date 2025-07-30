"""
Base handler class for BetterPrompts TorchServe handlers
Provides common functionality for all model handlers
"""

import json
import logging
import time
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Union

logger = logging.getLogger(__name__)


class BetterPromptsBaseHandler(ABC):
    """
    Base handler class with common functionality for BetterPrompts models
    """
    
    def __init__(self):
        self.model = None
        self.device = None
        self.context = None
        self.manifest = None
        self.metrics = {}
        
    @abstractmethod
    def initialize(self, context):
        """Initialize the model handler"""
        pass
    
    @abstractmethod
    def preprocess(self, data: List[Any]) -> Any:
        """Preprocess input data"""
        pass
    
    @abstractmethod
    def inference(self, model_input: Any) -> Any:
        """Run model inference"""
        pass
    
    @abstractmethod
    def postprocess(self, data: Any) -> List[Dict[str, Any]]:
        """Postprocess model output"""
        pass
    
    def log_metrics(self, metrics: Dict[str, float]):
        """Log custom metrics"""
        for name, value in metrics.items():
            logger.info(f"METRIC {name}={value}")
            
    def extract_text_from_request(self, data: Union[str, bytes, dict]) -> str:
        """
        Extract text from various request formats
        """
        if isinstance(data, dict):
            # Try common field names
            for field in ["text", "data", "body", "input", "prompt"]:
                if field in data and data[field]:
                    return str(data[field])
            return ""
        elif isinstance(data, bytes):
            return data.decode('utf-8')
        else:
            return str(data)
    
    def create_error_response(self, error_message: str, status_code: int = 500) -> Dict[str, Any]:
        """
        Create standardized error response
        """
        return {
            "error": error_message,
            "status_code": status_code,
            "timestamp": time.time()
        }
    
    def validate_input(self, text: str, max_length: int = 10000) -> tuple[bool, str]:
        """
        Validate input text
        Returns (is_valid, error_message)
        """
        if not text:
            return False, "Empty input text"
        
        if len(text) > max_length:
            return False, f"Input text too long: {len(text)} > {max_length}"
        
        return True, ""
    
    def handle(self, data: List[Any], context: Any) -> List[Dict[str, Any]]:
        """
        Main entry point for TorchServe
        """
        self.context = context
        start_time = time.time()
        
        try:
            # Log request
            batch_size = len(data) if isinstance(data, list) else 1
            logger.info(f"Processing batch of size: {batch_size}")
            
            # Preprocess
            preprocess_start = time.time()
            model_input = self.preprocess(data)
            preprocess_time = time.time() - preprocess_start
            
            # Inference
            inference_start = time.time()
            model_output = self.inference(model_input)
            inference_time = time.time() - inference_start
            
            # Postprocess
            postprocess_start = time.time()
            results = self.postprocess(model_output)
            postprocess_time = time.time() - postprocess_start
            
            # Log metrics
            total_time = time.time() - start_time
            self.log_metrics({
                "batch_size": batch_size,
                "preprocess_time_ms": preprocess_time * 1000,
                "inference_time_ms": inference_time * 1000,
                "postprocess_time_ms": postprocess_time * 1000,
                "total_time_ms": total_time * 1000
            })
            
            return results
            
        except Exception as e:
            logger.error(f"Error in handler: {str(e)}", exc_info=True)
            total_time = time.time() - start_time
            self.log_metrics({
                "error": 1,
                "total_time_ms": total_time * 1000
            })
            return [self.create_error_response(str(e))]