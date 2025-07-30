"""
Custom TorchServe handler for Intent Classification model
Handles preprocessing, inference, and postprocessing for DeBERTa-based intent classifier
"""

import json
import logging
import torch
from abc import ABC
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from ts.torch_handler.base_handler import BaseHandler

logger = logging.getLogger(__name__)


class IntentClassifierHandler(BaseHandler, ABC):
    """
    Custom handler for intent classification using DeBERTa model
    """
    
    def __init__(self):
        super(IntentClassifierHandler, self).__init__()
        self.tokenizer = None
        self.model = None
        self.device = None
        self.intent_labels = None
        
    def initialize(self, context):
        """Initialize function loads the model and tokenizer"""
        properties = context.system_properties
        self.manifest = context.manifest
        
        model_dir = properties.get("model_dir")
        self.device = torch.device("cuda:" + str(properties.get("gpu_id")) 
                                  if torch.cuda.is_available() 
                                  else "cpu")
        
        # Load model and tokenizer
        logger.info(f"Loading model from {model_dir}")
        self.tokenizer = AutoTokenizer.from_pretrained(model_dir)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_dir)
        self.model.to(self.device)
        self.model.eval()
        
        # Load intent labels
        labels_file = f"{model_dir}/intent_labels.json"
        try:
            with open(labels_file, 'r') as f:
                self.intent_labels = json.load(f)
        except FileNotFoundError:
            logger.warning(f"Intent labels file not found at {labels_file}")
            self.intent_labels = {
                "0": "question_answering",
                "1": "code_generation", 
                "2": "creative_writing",
                "3": "analysis",
                "4": "conversation",
                "5": "task_planning",
                "6": "education",
                "7": "debugging",
                "8": "translation",
                "9": "summarization"
            }
        
        logger.info("Model loaded successfully")
        
    def preprocess(self, data):
        """Preprocess the input data"""
        inputs = []
        
        for row in data:
            if isinstance(row, dict):
                text = row.get("text", "") or row.get("data", "") or row.get("body", "")
            else:
                text = row.decode('utf-8') if isinstance(row, bytes) else str(row)
            
            if not text:
                logger.warning("Empty text received")
                text = ""
                
            inputs.append(text)
        
        # Tokenize inputs
        encoded = self.tokenizer(
            inputs,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt"
        )
        
        return encoded
    
    def inference(self, model_input):
        """Run inference on the model"""
        with torch.no_grad():
            model_input = {k: v.to(self.device) for k, v in model_input.items()}
            outputs = self.model(**model_input)
            predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)
            
        return predictions
    
    def postprocess(self, data):
        """Postprocess the model output"""
        predictions = data.cpu().numpy()
        results = []
        
        for pred in predictions:
            # Get top prediction
            intent_idx = pred.argmax()
            confidence = float(pred[intent_idx])
            
            # Get top 3 predictions for additional context
            top_3_indices = pred.argsort()[-3:][::-1]
            top_3_intents = []
            
            for idx in top_3_indices:
                intent_name = self.intent_labels.get(str(idx), f"unknown_{idx}")
                top_3_intents.append({
                    "intent": intent_name,
                    "confidence": float(pred[idx])
                })
            
            result = {
                "intent": self.intent_labels.get(str(intent_idx), f"unknown_{intent_idx}"),
                "confidence": confidence,
                "top_intents": top_3_intents
            }
            
            results.append(result)
        
        return results
    
    def handle(self, data, context):
        """Entry point for TorchServe"""
        self._context = context
        
        try:
            # Preprocess
            model_input = self.preprocess(data)
            
            # Inference
            model_output = self.inference(model_input)
            
            # Postprocess
            return self.postprocess(model_output)
            
        except Exception as e:
            logger.error(f"Error in handle: {str(e)}", exc_info=True)
            return [{"error": str(e)}]