"""Esquemas Pydantic para el reporte de calidad semántica."""

from typing import List, Literal
from pydantic import BaseModel, Field


class QualityIssue(BaseModel):
    """Un problema de calidad detectado en el documento."""

    severity: Literal["error", "advertencia"] = Field(
        description=(
            "Nivel de severidad: 'error' para contradicciones lógicas directas, "
            "'advertencia' para posibles inconsistencias o duplicados parafraseados"
        )
    )
    field: str = Field(
        description=(
            "Campo o sección afectada (ej: 'scope.in_scope', "
            "'core_capabilities', 'requirement.3.criteria.3.1')"
        )
    )
    description: str = Field(
        description="Descripción clara del problema detectado"
    )
    suggestion: str = Field(
        description="Sugerencia concreta y accionable para corregir el problema"
    )


class QualityReport(BaseModel):
    """Reporte completo de calidad del documento."""

    is_valid: bool = Field(
        description="True si no se detectaron problemas, False si hay al menos un issue"
    )
    issues: List[QualityIssue] = Field(
        default_factory=list,
        description="Lista de problemas detectados (vacía si is_valid es True)"
    )
