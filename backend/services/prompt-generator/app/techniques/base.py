from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List, Type, Tuple
import re
import time
import asyncio
from datetime import datetime
from jinja2 import Template, Environment, meta
import structlog

logger = structlog.get_logger()


class BaseTechnique(ABC):
    """Base class for all prompt engineering techniques"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.name = config.get("name", self.__class__.__name__)
        self.template = config.get("template", "")
        self.parameters = config.get("parameters", {})
        self.priority = config.get("priority", 0)
        self.enabled = config.get("enabled", True)
        self.logger = logger.bind(technique=self.name)
        
        # Effectiveness tracking
        self._effectiveness_tracker = None
        self._enable_tracking = config.get("enable_tracking", True)
        self._last_application_metrics = None
        
    @abstractmethod
    def apply(self, text: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Apply the technique to the input text"""
        pass
    
    @abstractmethod
    def validate_input(self, text: str, context: Optional[Dict[str, Any]] = None) -> bool:
        """Validate if the technique can be applied to the input"""
        pass
    
    def apply_with_tracking(self, text: str, context: Optional[Dict[str, Any]] = None) -> Tuple[str, Optional[str]]:
        """Apply technique with effectiveness tracking
        
        Returns:
            Tuple of (result, tracking_id)
        """
        if not self._enable_tracking or not self._effectiveness_tracker:
            result = self.apply(text, context)
            return result, None
        
        # Start timing
        start_time = datetime.utcnow()
        start_perf = time.perf_counter()
        
        # Count tokens before
        tokens_before = self.estimate_tokens(text)
        
        # Initialize tracking context
        tracking_context = {
            "technique_id": self.name,
            "input_text": text,
            "start_time": start_time,
            "tokens_before": tokens_before,
            "session_id": context.get("session_id", "unknown") if context else "unknown",
            "user_id": context.get("user_id") if context else None,
            "intent_type": context.get("intent", {}).get("type") if context else None,
            "complexity_level": context.get("complexity") if context else None,
            "domain": context.get("domain") if context else None,
            "target_model": context.get("target_model") if context else None,
            "metadata": {}
        }
        
        success = True
        error_message = None
        retry_count = 0
        result = text
        
        try:
            # Apply the technique
            result = self.apply(text, context)
            
        except Exception as e:
            success = False
            error_message = str(e)
            self.logger.error("Error applying technique", error=error_message)
            
        finally:
            # End timing
            end_time = datetime.utcnow()
            end_perf = time.perf_counter()
            
            # Count tokens after
            tokens_after = self.estimate_tokens(result)
            
            # Update tracking context
            tracking_context.update({
                "output_text": result,
                "end_time": end_time,
                "tokens_after": tokens_after,
                "success": success,
                "error_message": error_message,
                "retry_count": retry_count
            })
            
            # Store metrics for later access
            self._last_application_metrics = {
                "application_time_ms": (end_perf - start_perf) * 1000,
                "tokens_before": tokens_before,
                "tokens_after": tokens_after,
                "token_increase_ratio": tokens_after / max(tokens_before, 1),
                "success": success
            }
            
            # Track asynchronously if possible
            tracking_id = None
            if hasattr(self._effectiveness_tracker, 'track_application'):
                try:
                    # Create metrics context
                    from ..models.effectiveness import MetricsCollectionContext
                    metrics_context = MetricsCollectionContext(**tracking_context)
                    
                    # Track application
                    if asyncio.iscoroutinefunction(self._effectiveness_tracker.track_application):
                        # Handle async tracking
                        loop = asyncio.get_event_loop()
                        if loop.is_running():
                            # Schedule for later execution
                            task = asyncio.create_task(
                                self._effectiveness_tracker.track_application(metrics_context)
                            )
                        else:
                            # Run synchronously
                            tracking_id = loop.run_until_complete(
                                self._effectiveness_tracker.track_application(metrics_context)
                            )
                    else:
                        # Synchronous tracking
                        tracking_id = self._effectiveness_tracker.track_application(metrics_context)
                        
                except Exception as e:
                    self.logger.error("Error tracking technique application", error=str(e))
            
            return result, tracking_id
    
    def set_effectiveness_tracker(self, tracker):
        """Set the effectiveness tracker instance"""
        self._effectiveness_tracker = tracker
    
    def get_last_application_metrics(self) -> Optional[Dict[str, Any]]:
        """Get metrics from the last application"""
        return self._last_application_metrics
    
    def render_template(self, template: str, variables: Dict[str, Any]) -> str:
        """Render a Jinja2 template with given variables"""
        try:
            jinja_template = Template(template)
            return jinja_template.render(**variables)
        except Exception as e:
            self.logger.error(f"Template rendering error: {e}", template=template, variables=variables)
            raise
    
    def extract_template_variables(self, template: str) -> List[str]:
        """Extract variable names from a Jinja2 template"""
        env = Environment()
        ast = env.parse(template)
        return list(meta.find_undeclared_variables(ast))
    
    def estimate_tokens(self, text: str) -> int:
        """Estimate token count for the text"""
        # Simple estimation: ~4 characters per token
        return len(text) // 4
    
    def clean_text(self, text: str) -> str:
        """Clean and normalize input text"""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove leading/trailing whitespace
        text = text.strip()
        return text
    
    def get_metadata(self) -> Dict[str, Any]:
        """Get technique metadata"""
        return {
            "name": self.name,
            "priority": self.priority,
            "enabled": self.enabled,
            "parameters": self.parameters,
        }
    
    def get_application_metadata(self) -> Dict[str, Any]:
        """Get metadata about the last application of this technique
        
        Override this method to provide custom metadata after technique application.
        This metadata can be used by subsequent techniques in the chain.
        """
        return {}
    
    def extract_context_updates(self, text: str, result: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Extract context updates to pass to subsequent techniques
        
        Override this method to provide context updates that should be accumulated
        and passed to subsequent techniques in the chain.
        
        Returns:
            Dict containing context updates that will be merged into accumulated context
        """
        return {}


class TechniqueRegistry:
    """Registry for managing prompt engineering techniques"""
    
    def __init__(self):
        self._techniques: Dict[str, Type[BaseTechnique]] = {}
        self._instances: Dict[str, BaseTechnique] = {}
        self.logger = structlog.get_logger()
        
    def register(self, technique_id: str, technique_class: Type[BaseTechnique]):
        """Register a technique class"""
        if technique_id in self._techniques:
            self.logger.warning(f"Overwriting existing technique: {technique_id}")
        self._techniques[technique_id] = technique_class
        self.logger.info(f"Registered technique: {technique_id}")
        
    def create_instance(self, technique_id: str, config: Dict[str, Any]) -> BaseTechnique:
        """Create an instance of a technique"""
        if technique_id not in self._techniques:
            raise ValueError(f"Unknown technique: {technique_id}")
            
        technique_class = self._techniques[technique_id]
        instance = technique_class(config)
        self._instances[technique_id] = instance
        return instance
        
    def get_instance(self, technique_id: str) -> Optional[BaseTechnique]:
        """Get a technique instance"""
        return self._instances.get(technique_id)
        
    def get_all_instances(self) -> Dict[str, BaseTechnique]:
        """Get all technique instances"""
        return self._instances.copy()
        
    def apply_technique(self, technique_id: str, text: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Apply a specific technique"""
        technique = self.get_instance(technique_id)
        if not technique:
            raise ValueError(f"Technique not initialized: {technique_id}")
            
        if not technique.enabled:
            self.logger.warning(f"Technique is disabled: {technique_id}")
            return text
            
        self.logger.info(f"Validating technique {technique_id} with context: {context}")
        validation_result = technique.validate_input(text, context)
        if not validation_result:
            self.logger.warning(f"Input validation failed for technique: {technique_id}")
            return text
        self.logger.info(f"Validation passed for technique: {technique_id}")
            
        try:
            result = technique.apply(text, context)
            self.logger.info(f"Successfully applied technique: {technique_id}")
            return result
        except Exception as e:
            self.logger.error(f"Error applying technique {technique_id}: {e}")
            raise
            
    def apply_multiple(self, technique_ids: List[str], text: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Apply multiple techniques in sequence"""
        result = text
        applied_techniques = []
        
        # Sort by priority
        sorted_ids = sorted(
            technique_ids,
            key=lambda x: self.get_instance(x).priority if self.get_instance(x) else 0,
            reverse=True
        )
        
        for technique_id in sorted_ids:
            try:
                result = self.apply_technique(technique_id, result, context)
                applied_techniques.append(technique_id)
            except Exception as e:
                self.logger.error(f"Failed to apply technique {technique_id}: {e}")
                continue
                
        self.logger.info(f"Applied techniques: {applied_techniques}")
        return result
        
    def list_available(self) -> List[str]:
        """List all available technique IDs"""
        return list(self._techniques.keys())
        
    def list_enabled(self) -> List[str]:
        """List all enabled technique IDs"""
        return [
            tid for tid, technique in self._instances.items()
            if technique.enabled
        ]


# Global registry instance
technique_registry = TechniqueRegistry()