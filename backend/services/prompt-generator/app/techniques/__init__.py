"""
Prompt engineering techniques implementation
"""

from .base import BaseTechnique, TechniqueRegistry, technique_registry
from .chain_of_thought import ChainOfThoughtTechnique
from .tree_of_thoughts import TreeOfThoughtsTechnique
from .few_shot import FewShotTechnique
from .zero_shot import ZeroShotTechnique
from .role_play import RolePlayTechnique
from .step_by_step import StepByStepTechnique
from .structured_output import StructuredOutputTechnique
from .emotional_appeal import EmotionalAppealTechnique
from .constraints import ConstraintsTechnique
from .analogical import AnalogicalTechnique
from .self_consistency import SelfConsistencyTechnique
from .react import ReactTechnique

__all__ = [
    "BaseTechnique",
    "TechniqueRegistry",
    "technique_registry",
    "ChainOfThoughtTechnique",
    "TreeOfThoughtsTechnique",
    "FewShotTechnique",
    "ZeroShotTechnique",
    "RolePlayTechnique",
    "StepByStepTechnique",
    "StructuredOutputTechnique",
    "EmotionalAppealTechnique",
    "ConstraintsTechnique",
    "AnalogicalTechnique",
    "SelfConsistencyTechnique",
    "ReactTechnique",
]