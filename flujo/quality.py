"""Validación de calidad semántica de especificaciones.

Dos niveles de validación:
1. Programática: detecta errores obvios (duplicados exactos, contradicciones directas)
2. Semántica (LLM): detecta errores sutiles (paráfrasis, contradicciones lógicas)

Se ejecuta ANTES del análisis de impacto en el flujo de edición manual.
"""

from typing import List

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from schemas.product_brief import ProductBrief
from schemas.requirements import Requirements
from schemas.quality import QualityIssue, QualityReport


_llm = None

def _get_llm():
    """Inicialización lazy del LLM para evitar error de API key al importar."""
    global _llm
    if _llm is None:
        _llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.1)
    return _llm


# ============================================================
# PROMPTS PARA VALIDACIÓN SEMÁNTICA
# ============================================================

QUALITY_PRODUCT_SYSTEM = """Eres un analista de calidad de documentos de especificación de software. Tu tarea es detectar ERRORES SEMÁNTICOS y LÓGICOS dentro de un ProductBrief.

TIPOS DE ERRORES A DETECTAR:

1. **DUPLICADOS PARAFRASEADOS**: Ítems que dicen lo mismo con palabras distintas.
   - Ejemplo: in_scope tiene "Gestión de usuarios" y "Administración de cuentas de usuario" → son lo mismo
   - Ejemplo: capabilities tiene "Autenticación de usuarios" y "Login de usuarios" → son equivalentes
   - Aplica a: core_capabilities, in_scope, out_of_scope, primary_objectives, success_metrics, business_rules, technical_constraints

2. **CONTRADICCIONES DIRECTAS**:
   - Un ítem está en in_scope Y out_of_scope (exacto o parafraseado)
   - Una capability que contradice el out_of_scope
   - Una business_rule que contradice otra business_rule
   - Un objective que contradice otro objective
   - Ejemplo: capability "Pagos online" pero out_of_scope dice "Procesamiento de pagos"

3. **INCOHERENCIAS LÓGICAS**:
   - Una business_rule que no tiene relación con ninguna capability
   - Un objetivo que es inalcanzable dado el scope
   - Restricciones técnicas que contradicen las capabilities
   - Ejemplo: capability "IA avanzada con GPT-4" pero technical_constraint "Sin dependencias externas de API"

4. **CAMPOS VACÍOS CRÍTICOS**:
   - core_capabilities vacía o con menos de 2 ítems
   - in_scope vacía
   - problem_statement muy corto (menos de 20 caracteres)

REGLAS:
- Solo reporta problemas REALES, no inventes problemas donde no los hay.
- Usa severity "error" para contradicciones claras y duplicados obvios.
- Usa severity "advertencia" para posibles paráfrasis o incoherencias sutiles.
- Cada suggestion debe ser CONCRETA: "Eliminar X de out_of_scope" no "Revisar el scope".
- Si el documento está bien, devuelve is_valid=true con issues vacío.
- Responde SIEMPRE en español."""

QUALITY_REQUIREMENTS_SYSTEM = """Eres un analista de calidad de documentos de requisitos en formato EARS. Tu tarea es detectar ERRORES SEMÁNTICOS y LÓGICOS dentro de un documento de Requirements.

TIPOS DE ERRORES A DETECTAR:

1. **DUPLICADOS PARAFRASEADOS**: Ítems que expresan lo mismo con palabras distintas.
   - Ejemplo: Requisito 1 "Autenticación de usuarios" y Requisito 4 "Login del sistema" → son equivalentes
   - Ejemplo: Criterio 1.1 "CUANDO el usuario ingresa su email" y criterio 3.1 "CUANDO el usuario escribe su correo electrónico" → misma acción
   - Aplica a: títulos de requisitos, criterios EARS (comparar condition+response), boundary in_scope, NFRs

2. **CONTRADICCIONES EN CRITERIOS EARS**:
   - Dos criterios sobre el mismo subject con respuestas contradictorias
   - Ejemplo: "SI el usuario tiene más de 18 años, el Sistema debe permitir acceso" vs "SI el usuario tiene menos de 21, el Sistema debe bloquear acceso" → se contradicen para edades 18-20
   - Condiciones mutuamente excluyentes que deberían ser complementarias

3. **INCONSISTENCIAS DE SCOPE**:
   - Un ítem en boundary in_scope Y out_of_scope (exacto o parafraseado)
   - Un requisito funcional que cubre algo del out_of_scope
   - Un requisito que no tiene relación con ningún ítem del in_scope

4. **PROBLEMAS DE IDs**:
   - IDs de requisitos duplicados
   - IDs de criterios que no corresponden a su requisito padre (ej: criterio "5.1" dentro de requisito "3")
   - IDs de criterios duplicados dentro del mismo requisito

5. **SUBJECTS INCONSISTENTES**:
   - El mismo servicio/componente con nombres distintos en diferentes criterios
   - Ejemplo: "ServicioAuth" en criterio 1.1 y "SistemaAutenticacion" en criterio 3.2 → probablemente el mismo componente

6. **CRITERIOS VAGOS O INCOMPLETOS**:
   - Criterios con condition vacía (excepto patrón "siempre")
   - Criterios con response genérica como "procesar correctamente" o "funcionar bien"
   - Criterios sin subject específico

REGLAS:
- Solo reporta problemas REALES, no inventes problemas donde no los hay.
- Usa severity "error" para contradicciones claras, IDs duplicados, y errores de estructura.
- Usa severity "advertencia" para posibles paráfrasis, subjects inconsistentes, y criterios vagos.
- Cada suggestion debe ser CONCRETA y accionable.
- Si el documento está bien, devuelve is_valid=true con issues vacío.
- Responde SIEMPRE en español."""


# ============================================================
# VALIDACIONES PROGRAMÁTICAS
# ============================================================

def _programmatic_product_checks(pb: ProductBrief) -> List[QualityIssue]:
    """Validaciones determinísticas para ProductBrief."""
    issues: List[QualityIssue] = []

    # 1. Duplicados exactos en scope (in ∩ out)
    in_set = set(s.strip().lower() for s in pb.scope.in_scope)
    out_set = set(s.strip().lower() for s in pb.scope.out_of_scope)
    overlap = in_set & out_set
    for item in overlap:
        # Buscar el texto original (no el lowercase)
        original_in = next(s for s in pb.scope.in_scope if s.strip().lower() == item)
        issues.append(QualityIssue(
            severity="error",
            field="scope",
            description=f"'{original_in}' aparece en Incluido Y Excluido simultáneamente",
            suggestion=f"Eliminar '{original_in}' de una de las dos listas (in_scope o out_of_scope)",
        ))

    # 2. Duplicados exactos dentro de cada lista
    for field_name, items in [
        ("core_capabilities", pb.core_capabilities),
        ("scope.in_scope", pb.scope.in_scope),
        ("scope.out_of_scope", pb.scope.out_of_scope),
        ("primary_objectives", pb.goals_and_objectives.primary_objectives),
        ("success_metrics", pb.goals_and_objectives.success_metrics),
        ("business_rules", pb.constraints.business_rules or []),
        ("technical_constraints", pb.constraints.technical_constraints or []),
    ]:
        seen = {}
        for item in items:
            key = item.strip().lower()
            if key in seen:
                issues.append(QualityIssue(
                    severity="error",
                    field=field_name,
                    description=f"Duplicado exacto: '{item}' aparece más de una vez",
                    suggestion=f"Eliminar la entrada duplicada de {field_name}",
                ))
            else:
                seen[key] = item

    # 3. Campos críticos vacíos
    if len(pb.core_capabilities) < 2:
        issues.append(QualityIssue(
            severity="error",
            field="core_capabilities",
            description=f"Solo hay {len(pb.core_capabilities)} capability(ies). Se necesitan al menos 2",
            suggestion="Añadir más capabilities que describan las funcionalidades principales",
        ))
    if len(pb.problem_statement.strip()) < 20:
        issues.append(QualityIssue(
            severity="advertencia",
            field="problem_statement",
            description="El problem_statement es muy corto (menos de 20 caracteres)",
            suggestion="Ampliar la descripción del problema a 2-4 oraciones claras",
        ))
    if not pb.scope.in_scope:
        issues.append(QualityIssue(
            severity="error",
            field="scope.in_scope",
            description="El scope incluido está vacío",
            suggestion="Añadir los ítems que definen qué incluye el producto",
        ))

    return issues


def _programmatic_requirements_checks(reqs: Requirements) -> List[QualityIssue]:
    """Validaciones determinísticas para Requirements."""
    issues: List[QualityIssue] = []

    # 1. Duplicados exactos en boundary scope
    in_set = set(s.strip().lower() for s in reqs.boundary_context.in_scope)
    out_set = set(s.strip().lower() for s in reqs.boundary_context.out_of_scope)
    overlap = in_set & out_set
    for item in overlap:
        original = next(s for s in reqs.boundary_context.in_scope if s.strip().lower() == item)
        issues.append(QualityIssue(
            severity="error",
            field="boundary_context",
            description=f"'{original}' aparece en Incluido Y Excluido del boundary context",
            suggestion=f"Eliminar '{original}' de una de las dos listas",
        ))

    # 2. IDs de requisitos duplicados
    req_ids = [r.id for r in reqs.functional_requirements]
    seen_ids = set()
    for rid in req_ids:
        if rid in seen_ids:
            issues.append(QualityIssue(
                severity="error",
                field=f"requirement.{rid}",
                description=f"ID de requisito duplicado: '{rid}'",
                suggestion=f"Asignar un ID único al requisito duplicado",
            ))
        seen_ids.add(rid)

    # 3. IDs de criterios inconsistentes con su requisito padre
    for req in reqs.functional_requirements:
        seen_criteria = set()
        for ac in req.acceptance_criteria:
            # Verificar que el criterio pertenece al requisito
            if not ac.id.startswith(f"{req.id}."):
                issues.append(QualityIssue(
                    severity="error",
                    field=f"requirement.{req.id}.criteria.{ac.id}",
                    description=(
                        f"El criterio '{ac.id}' está dentro del requisito '{req.id}' "
                        f"pero su ID no empieza con '{req.id}.'"
                    ),
                    suggestion=f"Cambiar el ID del criterio a '{req.id}.X'",
                ))
            # Verificar duplicados de criterios dentro del mismo requisito
            if ac.id in seen_criteria:
                issues.append(QualityIssue(
                    severity="error",
                    field=f"requirement.{req.id}.criteria.{ac.id}",
                    description=f"ID de criterio duplicado: '{ac.id}' dentro del requisito '{req.id}'",
                    suggestion="Asignar un ID único a cada criterio",
                ))
            seen_criteria.add(ac.id)

    # 4. Criterios vacíos
    for req in reqs.functional_requirements:
        if not req.acceptance_criteria:
            issues.append(QualityIssue(
                severity="error",
                field=f"requirement.{req.id}",
                description=f"El requisito '{req.id}: {req.title}' no tiene criterios de aceptación",
                suggestion="Añadir al menos un criterio EARS",
            ))
        for ac in req.acceptance_criteria:
            if ac.pattern != "siempre" and not ac.condition.strip():
                issues.append(QualityIssue(
                    severity="advertencia",
                    field=f"requirement.{req.id}.criteria.{ac.id}",
                    description=(
                        f"El criterio '{ac.id}' tiene patrón '{ac.pattern.upper()}' "
                        f"pero la condición está vacía"
                    ),
                    suggestion="Añadir una condición específica al criterio",
                ))

    return issues


# ============================================================
# VALIDACIÓN SEMÁNTICA (LLM)
# ============================================================

def _semantic_product_check(pb: ProductBrief) -> QualityReport:
    """Validación semántica con LLM para ProductBrief."""
    import json
    doc = (
        f"PRODUCTBRIEF A ANALIZAR:\n\n"
        f"product_name: {pb.product_name}\n"
        f"problem_statement: {pb.problem_statement}\n"
        f"target_users: {pb.target_users}\n"
        f"primary_objectives: {json.dumps(pb.goals_and_objectives.primary_objectives, ensure_ascii=False)}\n"
        f"success_metrics: {json.dumps(pb.goals_and_objectives.success_metrics, ensure_ascii=False)}\n"
        f"core_capabilities: {json.dumps(pb.core_capabilities, ensure_ascii=False)}\n"
        f"scope.in_scope: {json.dumps(pb.scope.in_scope, ensure_ascii=False)}\n"
        f"scope.out_of_scope: {json.dumps(pb.scope.out_of_scope, ensure_ascii=False)}\n"
        f"technical_constraints: {json.dumps(pb.constraints.technical_constraints, ensure_ascii=False)}\n"
        f"business_rules: {json.dumps(pb.constraints.business_rules, ensure_ascii=False)}\n"
        f"assumptions: {json.dumps(pb.constraints.assumptions, ensure_ascii=False)}\n"
    )
    return _get_llm().with_structured_output(QualityReport).invoke([
        SystemMessage(content=QUALITY_PRODUCT_SYSTEM),
        HumanMessage(content=doc),
    ])


def _semantic_requirements_check(reqs: Requirements) -> QualityReport:
    """Validación semántica con LLM para Requirements."""
    import json
    lines = [f"REQUIREMENTS A ANALIZAR:\n"]
    lines.append(f"introduction: {reqs.introduction}\n")
    lines.append(f"boundary.in_scope: {json.dumps(reqs.boundary_context.in_scope, ensure_ascii=False)}")
    lines.append(f"boundary.out_of_scope: {json.dumps(reqs.boundary_context.out_of_scope, ensure_ascii=False)}\n")

    for req in reqs.functional_requirements:
        lines.append(f"--- Requisito {req.id}: {req.title} (prioridad: {req.priority}) ---")
        lines.append(f"  derived_from: {req.derived_from_capability}")
        lines.append(f"  objective: {req.objective.to_story()}")
        for ac in req.acceptance_criteria:
            lines.append(f"  [{ac.id}] {ac.pattern.upper()}: {ac.to_ears()}")
        lines.append("")

    if reqs.non_functional_requirements:
        lines.append(f"NFRs: {json.dumps(reqs.non_functional_requirements, ensure_ascii=False)}")

    return _get_llm().with_structured_output(QualityReport).invoke([
        SystemMessage(content=QUALITY_REQUIREMENTS_SYSTEM),
        HumanMessage(content="\n".join(lines)),
    ])


# ============================================================
# FUNCIÓN PRINCIPAL: QUALITY CHECK
# ============================================================

def check_product_quality(pb: ProductBrief) -> QualityReport:
    """Ejecuta validación programática + semántica para ProductBrief."""
    # 1. Validaciones programáticas (rápidas, determinísticas)
    prog_issues = _programmatic_product_checks(pb)

    # 2. Validación semántica (LLM: paráfrasis, contradicciones sutiles)
    sem_report = _semantic_product_check(pb)

    # 3. Combinar (evitar duplicados: si un issue programático ya cubre algo del LLM)
    all_issues = prog_issues + sem_report.issues
    is_valid = len(all_issues) == 0

    return QualityReport(is_valid=is_valid, issues=all_issues)


def check_requirements_quality(reqs: Requirements) -> QualityReport:
    """Ejecuta validación programática + semántica para Requirements."""
    # 1. Validaciones programáticas
    prog_issues = _programmatic_requirements_checks(reqs)

    # 2. Validación semántica (LLM)
    sem_report = _semantic_requirements_check(reqs)

    # 3. Combinar
    all_issues = prog_issues + sem_report.issues
    is_valid = len(all_issues) == 0

    return QualityReport(is_valid=is_valid, issues=all_issues)


# ============================================================
# CORRECCIÓN AUTOMÁTICA
# ============================================================

QUALITY_FIX_PRODUCT_SYSTEM = """Eres un corrector de documentos de especificación. Se te proporcionará un ProductBrief con ERRORES DETECTADOS y debes corregirlos.

Se te dará:
- El ProductBrief actual (completo)
- La lista de errores con sus sugerencias de corrección

REGLAS:
1. Aplica CADA corrección sugerida.
2. NO modifiques nada que no esté en la lista de errores.
3. Si la sugerencia dice "Eliminar X de out_of_scope", elimínalo.
4. Si la sugerencia dice "Unificar A y B", mantén solo uno y elimina el otro.
5. Devuelve el ProductBrief COMPLETO corregido.
6. Responde SIEMPRE en español."""

QUALITY_FIX_REQUIREMENTS_SYSTEM = """Eres un corrector de documentos de requisitos. Se te proporcionará un documento de Requirements con ERRORES DETECTADOS y debes corregirlos.

Se te dará:
- Los Requirements actuales (completos)
- La lista de errores con sus sugerencias de corrección

REGLAS:
1. Aplica CADA corrección sugerida.
2. NO modifiques nada que no esté en la lista de errores.
3. Si hay IDs duplicados, reasigna IDs secuenciales.
4. Si hay subjects inconsistentes, unifica al nombre más descriptivo.
5. Si hay criterios vagos, hazlos más específicos y accionables.
6. Devuelve los Requirements COMPLETOS corregidos.
7. Los patrones EARS deben estar en minúsculas en el campo pattern.
8. Responde SIEMPRE en español."""


def fix_product_quality(pb: ProductBrief, issues: List[QualityIssue]) -> ProductBrief:
    """Corrige automáticamente los problemas detectados en ProductBrief."""
    import json
    issues_text = "\n".join(
        f"- [{i.severity.upper()}] {i.field}: {i.description}\n  → Sugerencia: {i.suggestion}"
        for i in issues
    )
    context = (
        f"PRODUCTBRIEF ACTUAL:\n{json.dumps(pb.model_dump(), indent=2, ensure_ascii=False)}\n\n"
        f"ERRORES DETECTADOS:\n{issues_text}"
    )
    return _get_llm().with_structured_output(ProductBrief).invoke([
        SystemMessage(content=QUALITY_FIX_PRODUCT_SYSTEM),
        HumanMessage(content=context),
    ])


def fix_requirements_quality(reqs: Requirements, issues: List[QualityIssue]) -> Requirements:
    """Corrige automáticamente los problemas detectados en Requirements."""
    import json
    issues_text = "\n".join(
        f"- [{i.severity.upper()}] {i.field}: {i.description}\n  → Sugerencia: {i.suggestion}"
        for i in issues
    )
    context = (
        f"REQUIREMENTS ACTUALES:\n{json.dumps(reqs.model_dump(), indent=2, ensure_ascii=False)}\n\n"
        f"ERRORES DETECTADOS:\n{issues_text}"
    )
    return _get_llm().with_structured_output(Requirements).invoke([
        SystemMessage(content=QUALITY_FIX_REQUIREMENTS_SYSTEM),
        HumanMessage(content=context),
    ])
