"""Esquemas Pydantic para la fase de Requirements (EARS en español)."""

from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class UserStoryObjective(BaseModel):
    """User story en formato: As a [role], I want [capability], so that [benefit]."""

    role: str = Field(
        description="Rol del usuario (ej: administrador, cliente, visitante)"
    )
    capability: str = Field(
        description="Lo que el usuario quiere poder hacer"
    )
    benefit: str = Field(
        description="El beneficio que obtiene al hacerlo"
    )

    def to_story(self) -> str:
        return f"Como {self.role}, Quiero {self.capability}, Para {self.benefit}"


class EARSCriterion(BaseModel):
    """Criterio de aceptación en formato EARS (Easy Approach to Requirements Syntax) en español."""

    id: str = Field(
        description="ID jerárquico del criterio (ej: '1.1', '1.2', '2.1')"
    )
    pattern: Literal["cuando", "mientras", "si", "donde", "siempre"] = Field(
        description="Patrón EARS: cuando (evento), mientras (estado), si (condición), donde (feature), siempre (ubicuo)"
    )
    condition: str = Field(
        description="La condición, evento o precondición del patrón EARS"
    )
    subject: str = Field(
        description="El sistema, servicio o componente responsable"
    )
    response: str = Field(
        description="La acción o respuesta que debe ejecutar el sistema"
    )

    def to_ears(self) -> str:
        """Genera la oración EARS con palabra clave en MAYÚSCULAS."""
        if self.pattern == "siempre":
            return f"El {self.subject} SIEMPRE debe {self.response}"
        keyword = self.pattern.upper()
        return f"{keyword} {self.condition}, el {self.subject} debe {self.response}"


class FunctionalRequirement(BaseModel):
    """Un requisito funcional con user story y criterios de aceptación EARS."""

    id: str = Field(
        description="ID numérico del requisito (ej: '1', '2', '3')"
    )
    title: str = Field(
        description="Nombre descriptivo del área funcional"
    )
    objective: UserStoryObjective = Field(
        description="User story que describe el objetivo del requisito"
    )
    acceptance_criteria: List[EARSCriterion] = Field(
        min_length=1,
        description="Criterios de aceptación en formato EARS (mínimo 1)"
    )
    priority: Literal["must", "should", "could"] = Field(
        default="must",
        description="Prioridad MoSCoW del requisito"
    )
    derived_from_capability: Optional[str] = Field(
        default=None,
        description="Capability de ProductBrief que originó este requisito (trazabilidad)"
    )


class BoundaryContext(BaseModel):
    """Contexto de límites refinado desde ProductBrief.scope para esta feature."""

    in_scope: List[str] = Field(
        description="Funcionalidades incluidas en esta feature (refinamiento de ProductBrief.scope)"
    )
    out_of_scope: List[str] = Field(
        description="Funcionalidades excluidas de esta feature"
    )
    adjacent_expectations: Optional[str] = Field(
        default=None,
        description="Expectativas sobre sistemas adyacentes o externos"
    )


class Requirements(BaseModel):
    """Fase 2: Requisitos funcionales estructurados con formato EARS.

    Cada requisito tiene una user story (objetivo) y criterios de aceptación
    en formato EARS para garantizar testabilidad y precisión.
    """

    introduction: str = Field(
        description="Breve descripción del propósito del feature (2-3 oraciones)"
    )
    boundary_context: BoundaryContext = Field(
        description="Contexto de límites refinado desde ProductBrief.scope"
    )
    functional_requirements: List[FunctionalRequirement] = Field(
        min_length=1,
        description="Lista de requisitos funcionales con EARS"
    )
    non_functional_requirements: Optional[List[str]] = Field(
        default=None,
        description="Requisitos no funcionales (performance, seguridad, escalabilidad, etc.)"
    )
