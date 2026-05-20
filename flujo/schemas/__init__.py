from .product_brief import (
    GoalsAndObjectives,
    ScopeAndBoundaries,
    ConstraintsAndAssumptions,
    ProductBrief,
)
from .requirements import (
    UserStoryObjective,
    EARSCriterion,
    FunctionalRequirement,
    BoundaryContext,
    Requirements,
)
from .impact import ImpactAnalysisResult
from .quality import QualityIssue, QualityReport

from .class_diagram import (
    AttributeSpec,
    MethodParameterSpec,
    MethodSpec,
    SingleClassSpec,
    RelationshipSpec,
    ClassDiagramDesign,
    ClassRequirementTrace,
    DesignPhaseOutput,
    ClassModificationTarget,
    ClassModificationChanges,
    ClassModification,
    ClassModificationResponse,
)

__all__ = [
    # Product Brief
    "GoalsAndObjectives", "ScopeAndBoundaries", "ConstraintsAndAssumptions", "ProductBrief",
    # Requirements
    "UserStoryObjective", "EARSCriterion", "FunctionalRequirement", "BoundaryContext", "Requirements",
    # Class Diagram
    "AttributeSpec", "MethodParameterSpec", "MethodSpec", "SingleClassSpec",
    "RelationshipSpec", "ClassDiagramDesign", "ClassRequirementTrace", "DesignPhaseOutput",
    "ClassModificationTarget", "ClassModificationChanges", "ClassModification", "ClassModificationResponse",
]
