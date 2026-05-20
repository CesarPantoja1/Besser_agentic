"""Funciones de diff programático para detectar cambios entre especificaciones.

Compara dos modelos Pydantic (old vs new) y genera una lista de cambios
legibles que se pasa al Impact Analyzer.
"""

from typing import List, Optional, Set

from schemas.product_brief import ProductBrief
from schemas.requirements import Requirements


# ============================================================
# HELPERS
# ============================================================

def _set_diff(
    old_items: Optional[List[str]],
    new_items: Optional[List[str]],
    label: str,
) -> List[str]:
    """Compara dos listas de strings como conjuntos. Retorna cambios detectados."""
    old_set: Set[str] = set(old_items or [])
    new_set: Set[str] = set(new_items or [])

    changes = []
    for item in sorted(new_set - old_set):
        changes.append(f"  - AÑADIDO en {label}: \"{item}\"")
    for item in sorted(old_set - new_set):
        changes.append(f"  - ELIMINADO de {label}: \"{item}\"")

    return changes


def _str_diff(
    old_val: Optional[str],
    new_val: Optional[str],
    label: str,
) -> List[str]:
    """Compara dos strings. Si cambiaron, reporta el cambio."""
    if (old_val or "") != (new_val or ""):
        return [f"  - MODIFICADO {label}"]
    return []


# ============================================================
# DIFF: PRODUCTBRIEF
# ============================================================

def diff_product(old: ProductBrief, new: ProductBrief) -> List[str]:
    """Genera una lista de cambios entre dos ProductBrief."""
    changes: List[str] = []

    # Product name
    changes.extend(_str_diff(old.product_name, new.product_name, "product_name"))

    # Problem statement
    changes.extend(_str_diff(
        old.problem_statement, new.problem_statement, "problem_statement"
    ))

    # Target users
    changes.extend(_str_diff(old.target_users, new.target_users, "target_users"))

    # Goals & Objectives
    changes.extend(_set_diff(
        old.goals_and_objectives.primary_objectives,
        new.goals_and_objectives.primary_objectives,
        "primary_objectives",
    ))
    changes.extend(_set_diff(
        old.goals_and_objectives.success_metrics,
        new.goals_and_objectives.success_metrics,
        "success_metrics",
    ))

    # Core capabilities
    changes.extend(_set_diff(
        old.core_capabilities, new.core_capabilities, "core_capabilities"
    ))

    # Scope
    changes.extend(_set_diff(
        old.scope.in_scope, new.scope.in_scope, "scope.in_scope"
    ))
    changes.extend(_set_diff(
        old.scope.out_of_scope, new.scope.out_of_scope, "scope.out_of_scope"
    ))
    changes.extend(_str_diff(
        old.scope.adjacent_expectations,
        new.scope.adjacent_expectations,
        "scope.adjacent_expectations",
    ))

    # Constraints
    changes.extend(_set_diff(
        old.constraints.technical_constraints,
        new.constraints.technical_constraints,
        "technical_constraints",
    ))
    changes.extend(_set_diff(
        old.constraints.business_rules,
        new.constraints.business_rules,
        "business_rules",
    ))
    changes.extend(_set_diff(
        old.constraints.assumptions,
        new.constraints.assumptions,
        "assumptions",
    ))

    return changes


# ============================================================
# DIFF: REQUIREMENTS
# ============================================================

def diff_requirements(old: Requirements, new: Requirements) -> List[str]:
    """Genera una lista de cambios entre dos Requirements."""
    changes: List[str] = []

    # Introduction
    changes.extend(_str_diff(old.introduction, new.introduction, "introduction"))

    # Boundary context
    changes.extend(_set_diff(
        old.boundary_context.in_scope,
        new.boundary_context.in_scope,
        "boundary_context.in_scope",
    ))
    changes.extend(_set_diff(
        old.boundary_context.out_of_scope,
        new.boundary_context.out_of_scope,
        "boundary_context.out_of_scope",
    ))
    changes.extend(_str_diff(
        old.boundary_context.adjacent_expectations,
        new.boundary_context.adjacent_expectations,
        "boundary_context.adjacent_expectations",
    ))

    # Functional requirements (por ID)
    old_reqs = {r.id: r for r in old.functional_requirements}
    new_reqs = {r.id: r for r in new.functional_requirements}

    added_ids = sorted(set(new_reqs) - set(old_reqs))
    removed_ids = sorted(set(old_reqs) - set(new_reqs))
    common_ids = sorted(set(old_reqs) & set(new_reqs))

    for rid in added_ids:
        r = new_reqs[rid]
        n_criteria = len(r.acceptance_criteria)
        changes.append(
            f"  - AÑADIDO: Requisito {rid} \"{r.title}\" "
            f"(prioridad: {r.priority}, {n_criteria} criterios EARS, "
            f"derivado de: \"{r.derived_from_capability}\")"
        )
        # Detallar los criterios del nuevo requisito
        for ac in r.acceptance_criteria:
            changes.append(
                f"    └ Criterio {ac.id} ({ac.pattern.upper()}): {ac.to_ears()}"
            )

    for rid in removed_ids:
        r = old_reqs[rid]
        changes.append(
            f"  - ELIMINADO: Requisito {rid} \"{r.title}\" "
            f"(tenía prioridad: {r.priority})"
        )

    for rid in common_ids:
        old_r = old_reqs[rid]
        new_r = new_reqs[rid]

        # Título
        if old_r.title != new_r.title:
            changes.append(
                f"  - MODIFICADO: Req {rid} título: "
                f"\"{old_r.title}\" → \"{new_r.title}\""
            )

        # Prioridad
        if old_r.priority != new_r.priority:
            changes.append(
                f"  - MODIFICADO: Req {rid} prioridad: "
                f"{old_r.priority} → {new_r.priority}"
            )

        # Derived from
        if old_r.derived_from_capability != new_r.derived_from_capability:
            changes.append(
                f"  - MODIFICADO: Req {rid} derived_from: "
                f"\"{old_r.derived_from_capability}\" → \"{new_r.derived_from_capability}\""
            )

        # User story objective
        if old_r.objective.to_story() != new_r.objective.to_story():
            changes.append(
                f"  - MODIFICADO: Req {rid} objective actualizado"
            )

        # Criterios de aceptación (por sub-ID)
        old_criteria = {ac.id: ac for ac in old_r.acceptance_criteria}
        new_criteria = {ac.id: ac for ac in new_r.acceptance_criteria}

        added_ac = sorted(set(new_criteria) - set(old_criteria))
        removed_ac = sorted(set(old_criteria) - set(new_criteria))
        common_ac = sorted(set(old_criteria) & set(new_criteria))

        for acid in added_ac:
            ac = new_criteria[acid]
            changes.append(
                f"  - AÑADIDO: Req {rid}, criterio {acid} "
                f"({ac.pattern.upper()}): {ac.to_ears()}"
            )

        for acid in removed_ac:
            ac = old_criteria[acid]
            changes.append(
                f"  - ELIMINADO: Req {rid}, criterio {acid} "
                f"({ac.pattern.upper()}): {ac.to_ears()}"
            )

        for acid in common_ac:
            old_ac = old_criteria[acid]
            new_ac = new_criteria[acid]
            ac_changes = []

            if old_ac.pattern != new_ac.pattern:
                ac_changes.append(
                    f"patrón: {old_ac.pattern.upper()} → {new_ac.pattern.upper()}"
                )
            if old_ac.condition != new_ac.condition:
                ac_changes.append(
                    f"condición: \"{old_ac.condition}\" → \"{new_ac.condition}\""
                )
            if old_ac.subject != new_ac.subject:
                ac_changes.append(
                    f"sujeto: \"{old_ac.subject}\" → \"{new_ac.subject}\""
                )
            if old_ac.response != new_ac.response:
                ac_changes.append(
                    f"respuesta: \"{old_ac.response}\" → \"{new_ac.response}\""
                )

            if ac_changes:
                changes.append(
                    f"  - MODIFICADO: Req {rid}, criterio {acid}: "
                    + "; ".join(ac_changes)
                )

    # Non-functional requirements
    changes.extend(_set_diff(
        old.non_functional_requirements,
        new.non_functional_requirements,
        "non_functional_requirements",
    ))

    return changes


# ============================================================
# FORMATEO
# ============================================================

def format_diff_summary(phase: str, changes: List[str]) -> str:
    """Genera un resumen legible de los cambios para el Impact Analyzer."""
    if not changes:
        return ""

    phase_names = {
        "product": "PRODUCTBRIEF",
        "requirements": "REQUIREMENTS",
    }
    header = f"CAMBIOS MANUALES DETECTADOS EN {phase_names.get(phase, phase.upper())}:"
    return header + "\n" + "\n".join(changes)
