"""Esquemas Pydantic para la fase de ProductBrief."""

from typing import List, Optional
from pydantic import BaseModel, Field


class GoalsAndObjectives(BaseModel):
    """Objetivos y métricas de éxito del producto."""

    primary_objectives: List[str] = Field(
        description="Objetivos principales de negocio (3-5 objetivos medibles)"
    )
    success_metrics: List[str] = Field(
        description="Métricas cuantificables de éxito del producto"
    )


class ScopeAndBoundaries(BaseModel):
    """Alcance y límites del producto."""

    in_scope: List[str] = Field(
        description="Funcionalidades incluidas explícitamente en el producto"
    )
    out_of_scope: List[str] = Field(
        description="Funcionalidades explícitamente excluidas del producto"
    )
    adjacent_expectations: Optional[str] = Field(
        default=None,
        description="Expectativas sobre sistemas externos o adyacentes"
    )


class ConstraintsAndAssumptions(BaseModel):
    """Restricciones técnicas, reglas de negocio y supuestos del proyecto."""

    technical_constraints: Optional[List[str]] = Field(
        default=None,
        description="Restricciones técnicas (lenguaje, base de datos, frameworks, etc.)"
    )
    business_rules: Optional[List[str]] = Field(
        default=None,
        description="Reglas de negocio del dominio (ej: 'Un médico atiende máximo 20 pacientes/día')"
    )
    assumptions: Optional[List[str]] = Field(
        default=None,
        description="Supuestos que si cambian, invalidan requisitos"
    )


class ProductBrief(BaseModel):
    """Fase 1: Contexto completo de negocio y visión del producto.

    Captura el QUÉ y el PARA QUIÉN del producto. Es el primer artefacto
    del flujo SDD y sirve como raíz de la trazabilidad.
    """
    
    product_name: str = Field(
        description="Nombre del producto o sistema a desarrollar, debe ser un nombre creativo y relacionado con la idea o necesidades del usuario (problemas del usuario)"
    )

    problem_statement: str = Field(
        description="Descripción del problema que el software resuelve (2-4 oraciones)"
    )
    goals_and_objectives: GoalsAndObjectives = Field(
        description="Objetivos de negocio y métricas de éxito"
    )
    target_users: str = Field(
        description="Descripción de los usuarios/actores principales del sistema"
    )
    core_capabilities: List[str] = Field(
        description="3-7 capacidades principales del sistema (alto nivel, sin detalles técnicos)"
    )
    scope: ScopeAndBoundaries = Field(
        description="Alcance y límites del producto"
    )
    constraints: ConstraintsAndAssumptions = Field(
        description="Restricciones y supuestos del proyecto"
    )
