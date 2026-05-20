"""Funciones para convertir las especificaciones a formatos legibles.

- ProductBrief → Markdown
- Requirements → Markdown
- Design (ClassDiagram) → JSON
"""

import json
from typing import Optional

from schemas.product_brief import ProductBrief
from schemas.requirements import Requirements
from schemas.class_diagram import DesignPhaseOutput


def product_brief_to_markdown(product: ProductBrief) -> str:
    """Convierte un ProductBrief a formato Markdown legible."""
    lines = []
    lines.append("# Product Brief")
    lines.append("")
    
    # Product Name
    lines.append("## Nombre del Producto")
    lines.append(product.product_name)
    lines.append("")

    # Problem Statement
    lines.append("## Declaración del Problema")
    lines.append(product.problem_statement)
    lines.append("")

    # Goals & Objectives
    lines.append("## Metas y Objetivos")
    lines.append("")
    lines.append("### Objetivos Principales")
    for obj in product.goals_and_objectives.primary_objectives:
        lines.append(f"- {obj}")
    lines.append("")
    lines.append("### Métricas de Éxito")
    for metric in product.goals_and_objectives.success_metrics:
        lines.append(f"- {metric}")
    lines.append("")

    # Target Users
    lines.append("## Usuarios Objetivo")
    lines.append(product.target_users)
    lines.append("")

    # Core Capabilities
    lines.append("## Capacidades Principales")
    for i, cap in enumerate(product.core_capabilities, 1):
        lines.append(f"{i}. {cap}")
    lines.append("")

    # Scope
    lines.append("## Alcance y Límites")
    lines.append("")
    lines.append("### Incluido")
    for item in product.scope.in_scope:
        lines.append(f"- {item}")
    lines.append("")
    lines.append("### Excluido")
    for item in product.scope.out_of_scope:
        lines.append(f"- {item}")
    if product.scope.adjacent_expectations:
        lines.append("")
        lines.append("### Expectativas Adyacentes")
        lines.append(product.scope.adjacent_expectations)
    lines.append("")

    # Constraints
    lines.append("## Restricciones y Supuestos")
    if product.constraints.technical_constraints:
        lines.append("")
        lines.append("### Restricciones Técnicas")
        for c in product.constraints.technical_constraints:
            lines.append(f"- {c}")
    if product.constraints.business_rules:
        lines.append("")
        lines.append("### Reglas de Negocio")
        for c in product.constraints.business_rules:
            lines.append(f"- {c}")
    if product.constraints.assumptions:
        lines.append("")
        lines.append("### Supuestos")
        for a in product.constraints.assumptions:
            lines.append(f"- {a}")
    lines.append("")

    return "\n".join(lines)


def requirements_to_markdown(reqs: Requirements) -> str:
    """Convierte Requirements a formato Markdown legible."""
    lines = []
    lines.append("# Requirements")
    lines.append("")

    # Introduction
    lines.append("## Introducción")
    lines.append(reqs.introduction)
    lines.append("")

    # Boundary Context
    lines.append("## Contexto de Límites")
    lines.append("")
    lines.append("### Incluido")
    for item in reqs.boundary_context.in_scope:
        lines.append(f"- {item}")
    lines.append("")
    lines.append("### Excluido")
    for item in reqs.boundary_context.out_of_scope:
        lines.append(f"- {item}")
    if reqs.boundary_context.adjacent_expectations:
        lines.append("")
        lines.append("### Expectativas Adyacentes")
        lines.append(reqs.boundary_context.adjacent_expectations)
    lines.append("")

    # Functional Requirements
    lines.append("## Requisitos Funcionales")
    lines.append("")
    for req in reqs.functional_requirements:
        lines.append(f"### Requisito {req.id}: {req.title}")
        lines.append("")
        lines.append(f"**Prioridad:** `{req.priority}`")
        if req.derived_from_capability:
            lines.append(f"**Derivado de:** {req.derived_from_capability}")
        lines.append("")
        lines.append(f"**Objetivo:** {req.objective.to_story()}")
        lines.append("")
        lines.append("**Criterios de Aceptación (EARS):**")
        lines.append("")
        for ac in req.acceptance_criteria:
            lines.append(f"- **[{ac.id}]** `{ac.pattern.upper()}` → {ac.to_ears()}")
        lines.append("")
        lines.append("---")
        lines.append("")

    # Non-Functional Requirements
    if reqs.non_functional_requirements:
        lines.append("## Requisitos No Funcionales")
        lines.append("")
        for nfr in reqs.non_functional_requirements:
            lines.append(f"- {nfr}")
        lines.append("")

    return "\n".join(lines)


def design_to_json(design: DesignPhaseOutput) -> str:
    """Convierte el DesignPhaseOutput a JSON formateado.

    El diagrama se exporta en formato compatible con BESSER.
    La trazabilidad se incluye como campo adicional.
    """
    output = {
        "diagram": design.diagram.model_dump(),
        "traceability": [t.model_dump() for t in design.traceability],
    }
    return json.dumps(output, indent=2, ensure_ascii=False)
