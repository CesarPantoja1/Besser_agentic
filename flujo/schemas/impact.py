"""Esquemas Pydantic para el análisis de impacto."""

from typing import List, Optional
from pydantic import BaseModel, Field


class ImpactAnalysisResult(BaseModel):
    """Resultado del análisis de impacto de una modificación."""

    summary: str = Field(
        description="Resumen general del análisis de impacto para mostrar al usuario"
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Lista de advertencias específicas sobre inconsistencias detectadas"
    )
    product_impact: Optional[str] = Field(
        default=None,
        description="Cambios sugeridos para ProductBrief. None si no se necesitan cambios."
    )
    requirements_impact: Optional[str] = Field(
        default=None,
        description="Cambios sugeridos para Requirements. None si no se necesitan cambios."
    )
    design_impact: Optional[str] = Field(
        default=None,
        description="Cambios sugeridos para el diagrama de clases. None si no se necesitan cambios."
    )
