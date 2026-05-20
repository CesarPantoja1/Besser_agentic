"""Flujo LangGraph para el pipeline SDD (Spec-Driven Development).

Arquitectura:
- Grafo principal: router → create/modify(staging) → impact_check → END
- Funciones auxiliares: apply_pending(), propagate_changes()
- main.py orquesta la decisión del usuario entre análisis y aplicación.

Modo CREACIÓN: el cambio se aplica directamente (no hay specs afectadas).
Modo MODIFICACIÓN: el cambio se genera en staging (pending_modification),
  se analiza impacto, y main.py decide si aplicar.
"""

import json
from typing import Annotated, Optional, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from schemas.product_brief import ProductBrief
from schemas.requirements import Requirements
from schemas.class_diagram import (
    AttributeSpec,
    ClassDiagramDesign,
    ClassModificationResponse,
    DesignPhaseOutput,
    MethodParameterSpec,
    MethodSpec,
    RelationshipSpec,
    SingleClassSpec,
)
from schemas.impact import ImpactAnalysisResult

from prompts import (
    PRODUCT_BRIEF_CREATION_SYSTEM,
    PRODUCT_BRIEF_MODIFICATION_SYSTEM,
    REQUIREMENTS_CREATION_SYSTEM,
    REQUIREMENTS_MODIFICATION_SYSTEM,
    DESIGN_CREATION_SYSTEM,
    DESIGN_MODIFICATION_SYSTEM,
    IMPACT_ANALYSIS_SYSTEM,
    MARKDOWN_PARSER_PRODUCT_SYSTEM,
    MARKDOWN_PARSER_REQUIREMENTS_SYSTEM,
)


# ============================================================
# ESTADO GLOBAL
# ============================================================

class SDDState(TypedDict):
    """Estado global del flujo SDD en LangGraph."""

    # Input del usuario
    user_prompt: str
    target_phase: str                           # "product" | "requirements" | "design"

    # Artefactos (guardados como dicts serializados)
    product_brief: Optional[dict]
    requirements: Optional[dict]
    class_diagram: Optional[dict]               # ClassDiagramDesign.model_dump()
    traceability: Optional[dict]                # List[ClassRequirementTrace] como list[dict]

    # Banderas de creación
    product_created: bool
    requirements_created: bool
    design_created: bool

    # Staging: cambio pendiente generado pero NO aplicado
    pending_modification: Optional[dict]        # Spec completa generada (staging)

    # Análisis de impacto
    impact_analysis: Optional[dict]             # ImpactAnalysisResult.model_dump()
    skip_impact: bool                           # True si no hay specs afectadas

    # Control
    phase: str
    mode: str                                   # "create" | "modify"
    error: Optional[str]
    response: Optional[str]


# ============================================================
# LLM PROVIDER
# ============================================================

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)


# ============================================================
# HELPERS: Contexto selectivo por fase
# ============================================================

def _product_context_for_requirements(pb: ProductBrief) -> str:
    """Contexto SELECTIVO del ProductBrief para el agente de Requirements."""
    return (
        f"CONTEXTO DEL PRODUCTO (selectivo):\n"
        f"- Target Users: {pb.target_users}\n"
        f"- Core Capabilities: {json.dumps(pb.core_capabilities, ensure_ascii=False)}\n"
        f"- Scope IN: {json.dumps(pb.scope.in_scope, ensure_ascii=False)}\n"
        f"- Scope OUT: {json.dumps(pb.scope.out_of_scope, ensure_ascii=False)}\n"
        f"- Constraints: {json.dumps(pb.constraints.model_dump(), ensure_ascii=False)}\n"
        f"- Primary Objectives: {json.dumps(pb.goals_and_objectives.primary_objectives, ensure_ascii=False)}\n"
    )


def _context_for_design(reqs: Requirements, pb: ProductBrief) -> str:
    """Contexto SELECTIVO de Requirements + ProductBrief para el agente de Design."""
    reqs_detail = []
    for r in reqs.functional_requirements:
        criteria = "\n".join(
            f"      [{ac.id}] {ac.pattern}: {ac.to_ears()}"
            for ac in r.acceptance_criteria
        )
        reqs_detail.append(
            f"  Req {r.id} - {r.title} (priority: {r.priority}):\n"
            f"    Objective: {r.objective.to_story()}\n"
            f"    Criteria:\n{criteria}"
        )
    return (
        f"REQUISITOS FUNCIONALES:\n" + "\n\n".join(reqs_detail) + "\n\n"
        f"BOUNDARY CONTEXT:\n"
        f"  IN: {json.dumps(reqs.boundary_context.in_scope, ensure_ascii=False)}\n"
        f"  OUT: {json.dumps(reqs.boundary_context.out_of_scope, ensure_ascii=False)}\n\n"
        f"NFRs: {json.dumps(reqs.non_functional_requirements, ensure_ascii=False)}\n\n"
        f"CONSTRAINTS TÉCNICOS: {json.dumps(pb.constraints.technical_constraints, ensure_ascii=False)}\n"
    )


def _diagram_summary(diagram: ClassDiagramDesign) -> str:
    """Resumen compacto del diagrama para contexto de modificación."""
    class_lines = []
    for c in diagram.classes:
        attrs = ", ".join(f"{a.name}:{a.type}" for a in c.attributes)
        methods = ", ".join(f"{m.name}()" for m in c.methods)
        class_lines.append(f"  - {c.className}: attrs=[{attrs}] methods=[{methods}]")
    rels = "\n".join(
        f"  - {r.source} --{r.type}({r.sourceMultiplicity}..{r.targetMultiplicity})--> {r.target}"
        for r in diagram.relationships
    )
    return f"Clases:\n" + "\n".join(class_lines) + f"\n\nRelaciones:\n{rels}"


def _product_summary(pb: ProductBrief) -> str:
    """Resumen del ProductBrief para contexto de modificación."""
    return (
        f"- Problem: {pb.problem_statement}\n"
        f"- Capabilities: {pb.core_capabilities}\n"
        f"- Scope IN: {pb.scope.in_scope}\n"
        f"- Scope OUT: {pb.scope.out_of_scope}\n"
        f"- Constraints técnicos: {pb.constraints.technical_constraints}\n"
        f"- Constraints negocio: {pb.constraints.business_constraints}\n"
        f"- Target users: {pb.target_users}\n"
        f"- Goals: {pb.goals_and_objectives.primary_objectives}\n"
    )


def _requirements_summary(reqs: Requirements) -> str:
    """Resumen de Requirements para contexto de modificación."""
    req_lines = "\n".join(
        f"  - Req {r.id}: {r.title} (priority: {r.priority}, derived: {r.derived_from_capability})"
        for r in reqs.functional_requirements
    )
    return (
        f"REQUISITOS:\n{req_lines}\n\n"
        f"BOUNDARY IN: {reqs.boundary_context.in_scope}\n"
        f"BOUNDARY OUT: {reqs.boundary_context.out_of_scope}\n"
    )


# ============================================================
# NODO: ROUTER
# ============================================================

def router_node(state: SDDState) -> dict:
    """Valida prerrequisitos y decide modo (create/modify)."""
    target = state["target_phase"]
    p_ok = state.get("product_created", False)
    r_ok = state.get("requirements_created", False)
    d_ok = state.get("design_created", False)

    if target == "requirements" and not p_ok:
        return {"error": "❌ Primero debes crear el ProductBrief.", "phase": "error"}
    if target == "design" and not r_ok:
        return {"error": "❌ Primero debes crear los Requirements.", "phase": "error"}

    mode = "create"
    if target == "product" and p_ok:
        mode = "modify"
    elif target == "requirements" and r_ok:
        mode = "modify"
    elif target == "design" and d_ok:
        mode = "modify"

    return {"phase": target, "mode": mode, "error": None}


# ============================================================
# NODOS: CREACIÓN (aplica directamente)
# ============================================================

def product_create_node(state: SDDState) -> dict:
    result = llm.with_structured_output(ProductBrief).invoke([
        SystemMessage(content=PRODUCT_BRIEF_CREATION_SYSTEM),
        HumanMessage(content=state["user_prompt"]),
    ])
    return {
        "product_brief": result.model_dump(),
        "product_created": True,
        "response": "✅ ProductBrief creado exitosamente.",
        "phase": "done",
    }


def requirements_create_node(state: SDDState) -> dict:
    pb = ProductBrief.model_validate(state["product_brief"])
    context = _product_context_for_requirements(pb)
    result = llm.with_structured_output(Requirements).invoke([
        SystemMessage(content=REQUIREMENTS_CREATION_SYSTEM),
        HumanMessage(content=f"{context}\n\nINSTRUCCIÓN:\n{state['user_prompt']}"),
    ])
    return {
        "requirements": result.model_dump(),
        "requirements_created": True,
        "response": "✅ Requirements creados exitosamente.",
        "phase": "done",
    }


def design_create_node(state: SDDState) -> dict:
    reqs = Requirements.model_validate(state["requirements"])
    pb = ProductBrief.model_validate(state["product_brief"])
    context = _context_for_design(reqs, pb)
    result = llm.with_structured_output(DesignPhaseOutput).invoke([
        SystemMessage(content=DESIGN_CREATION_SYSTEM),
        HumanMessage(content=f"{context}\n\nGenera el diagrama de clases UML completo con trazabilidad."),
    ])
    return {
        "class_diagram": result.diagram.model_dump(),
        "traceability": [t.model_dump() for t in result.traceability],
        "design_created": True,
        "response": "✅ Diagrama de clases creado exitosamente.",
        "phase": "done",
    }


# ============================================================
# NODOS: MODIFICACIÓN (staging, NO aplica)
# ============================================================

def product_modify_node(state: SDDState) -> dict:
    """Genera el ProductBrief modificado en staging."""
    pb = ProductBrief.model_validate(state["product_brief"])
    context = f"PRODUCTBRIEF ACTUAL:\n{_product_summary(pb)}"
    result = llm.with_structured_output(ProductBrief).invoke([
        SystemMessage(content=PRODUCT_BRIEF_MODIFICATION_SYSTEM),
        HumanMessage(content=f"{context}\n\nINSTRUCCIÓN:\n{state['user_prompt']}"),
    ])
    # Determinar si hay specs downstream que analizar
    has_downstream = state.get("requirements_created", False) or state.get("design_created", False)
    return {
        "pending_modification": result.model_dump(),
        "skip_impact": not has_downstream,
        "response": "📝 Modificación de ProductBrief generada (pendiente de aplicar).",
        "phase": "impact_check",
    }


def requirements_modify_node(state: SDDState) -> dict:
    """Genera los Requirements modificados en staging."""
    reqs = Requirements.model_validate(state["requirements"])
    pb = ProductBrief.model_validate(state["product_brief"])
    context = (
        f"REQUISITOS ACTUALES:\n{_requirements_summary(reqs)}\n"
        f"CAPABILITIES: {pb.core_capabilities}\n"
        f"SCOPE IN: {pb.scope.in_scope}\n"
        f"SCOPE OUT: {pb.scope.out_of_scope}\n"
    )
    result = llm.with_structured_output(Requirements).invoke([
        SystemMessage(content=REQUIREMENTS_MODIFICATION_SYSTEM),
        HumanMessage(content=f"{context}\n\nINSTRUCCIÓN:\n{state['user_prompt']}"),
    ])
    # Specs afectadas: siempre product (arriba) + design si existe (abajo)
    has_affected = True  # Product siempre existe si estamos aquí
    return {
        "pending_modification": result.model_dump(),
        "skip_impact": False,  # Siempre hay product arriba
        "response": "📝 Modificación de Requirements generada (pendiente de aplicar).",
        "phase": "impact_check",
    }


def design_modify_node(state: SDDState) -> dict:
    """Genera la modificación del diagrama en staging."""
    diagram = ClassDiagramDesign.model_validate(state["class_diagram"])
    context = f"DIAGRAMA ACTUAL:\n{_diagram_summary(diagram)}"
    mod_response = llm.with_structured_output(ClassModificationResponse).invoke([
        SystemMessage(content=DESIGN_MODIFICATION_SYSTEM),
        HumanMessage(content=f"{context}\n\nINSTRUCCIÓN:\n{state['user_prompt']}"),
    ])
    # Aplicar modificaciones a una copia (staging)
    updated = _apply_modifications(diagram, mod_response)
    return {
        "pending_modification": updated.model_dump(),
        "skip_impact": False,  # Siempre hay reqs arriba
        "response": f"📝 Modificación del diagrama generada ({len(mod_response.modifications)} cambios, pendiente de aplicar).",
        "phase": "impact_check",
    }


# ============================================================
# NODO: IMPACT ANALYZER
# ============================================================

def impact_node(state: SDDState) -> dict:
    """Analiza el impacto de la modificación pendiente contra specs existentes."""
    target = state["target_phase"]
    user_prompt = state["user_prompt"]

    context_parts = [
        f"ESPECIFICACIÓN MODIFICADA: {target.upper()}",
        f"CAMBIO SOLICITADO POR USUARIO: {user_prompt}",
    ]

    # Solo incluir specs que EXISTEN (banderas en True)
    if target == "product":
        if state.get("requirements_created") and state.get("requirements"):
            reqs = Requirements.model_validate(state["requirements"])
            context_parts.append(f"\n--- REQUIREMENTS (existente) ---\n{_requirements_summary(reqs)}")
        if state.get("design_created") and state.get("class_diagram"):
            diagram = ClassDiagramDesign.model_validate(state["class_diagram"])
            context_parts.append(f"\n--- DESIGN (existente) ---\n{_diagram_summary(diagram)}")
            if state.get("traceability"):
                context_parts.append(f"TRAZABILIDAD: {json.dumps(state['traceability'], ensure_ascii=False)}")

    elif target == "requirements":
        if state.get("product_created") and state.get("product_brief"):
            pb = ProductBrief.model_validate(state["product_brief"])
            context_parts.append(
                f"\n--- PRODUCTBRIEF (existente) ---\n"
                f"Capabilities: {pb.core_capabilities}\n"
                f"Scope IN: {pb.scope.in_scope}\nScope OUT: {pb.scope.out_of_scope}"
            )
        if state.get("design_created") and state.get("class_diagram"):
            diagram = ClassDiagramDesign.model_validate(state["class_diagram"])
            class_names = [c.className for c in diagram.classes]
            context_parts.append(f"\n--- DESIGN (existente) ---\nClases: {class_names}")
            if state.get("traceability"):
                context_parts.append(f"TRAZABILIDAD: {json.dumps(state['traceability'], ensure_ascii=False)}")

    elif target == "design":
        if state.get("requirements_created") and state.get("requirements"):
            reqs = Requirements.model_validate(state["requirements"])
            req_ids = ", ".join(f"Req {r.id}: {r.title}" for r in reqs.functional_requirements)
            context_parts.append(
                f"\n--- REQUIREMENTS (existente) ---\n{req_ids}\n"
                f"Boundary IN: {reqs.boundary_context.in_scope}\n"
                f"Boundary OUT: {reqs.boundary_context.out_of_scope}"
            )
        if state.get("product_created") and state.get("product_brief"):
            pb = ProductBrief.model_validate(state["product_brief"])
            context_parts.append(
                f"\n--- PRODUCTBRIEF (existente) ---\n"
                f"Scope OUT: {pb.scope.out_of_scope}\nCapabilities: {pb.core_capabilities}"
            )
        if state.get("traceability"):
            context_parts.append(f"TRAZABILIDAD: {json.dumps(state['traceability'], ensure_ascii=False)}")

    full_context = "\n".join(context_parts)
    result = llm.with_structured_output(ImpactAnalysisResult).invoke([
        SystemMessage(content=IMPACT_ANALYSIS_SYSTEM),
        HumanMessage(content=full_context),
    ])

    return {
        "impact_analysis": result.model_dump(),
        "phase": "awaiting_decision",
    }


# ============================================================
# NODO: ERROR
# ============================================================

def error_node(state: SDDState) -> dict:
    return {"response": state.get("error", "Error desconocido"), "phase": "done"}


# ============================================================
# ROUTING
# ============================================================

def route_after_router(state: SDDState) -> str:
    if state.get("phase") == "error":
        return "error_node"
    phase = state["phase"]
    mode = state["mode"]
    if phase == "product":
        return "product_create_node" if mode == "create" else "product_modify_node"
    elif phase == "requirements":
        return "requirements_create_node" if mode == "create" else "requirements_modify_node"
    elif phase == "design":
        return "design_create_node" if mode == "create" else "design_modify_node"
    return "error_node"


def route_after_modify(state: SDDState) -> str:
    """Después de un nodo de modificación: ¿saltar impacto o analizarlo?"""
    if state.get("skip_impact", False):
        return "skip_impact_node"
    return "impact_node"


# ============================================================
# NODO: SKIP IMPACT (aplica directamente sin análisis)
# ============================================================

def skip_impact_node(state: SDDState) -> dict:
    """Cuando no hay specs afectadas, aplica directamente el pending."""
    target = state["target_phase"]
    pending = state["pending_modification"]

    updates = {"phase": "done", "impact_analysis": None, "skip_impact": False}

    if target == "product":
        updates["product_brief"] = pending
        updates["response"] = "✅ ProductBrief modificado (sin specs afectadas, aplicado directamente)."
    elif target == "requirements":
        updates["requirements"] = pending
        updates["response"] = "✅ Requirements modificados (sin specs afectadas, aplicado directamente)."
    elif target == "design":
        updates["class_diagram"] = pending
        updates["response"] = "✅ Diagrama modificado (sin specs afectadas, aplicado directamente)."

    updates["pending_modification"] = None
    return updates


# ============================================================
# FUNCIONES AUXILIARES (llamadas desde main.py)
# ============================================================

def apply_pending(state: dict) -> dict:
    """Aplica el pending_modification al state. Llamada desde main.py."""
    target = state["target_phase"]
    pending = state["pending_modification"]
    if not pending:
        return state

    new_state = {**state}
    if target == "product":
        new_state["product_brief"] = pending
    elif target == "requirements":
        new_state["requirements"] = pending
    elif target == "design":
        new_state["class_diagram"] = pending

    new_state["pending_modification"] = None
    return new_state


def propagate_changes(state: dict) -> dict:
    """Propaga los cambios según el impact_analysis. Llamada desde main.py."""
    if not state.get("impact_analysis"):
        return state

    analysis = ImpactAnalysisResult.model_validate(state["impact_analysis"])
    new_state = {**state}
    target = state["target_phase"]

    # Propagar a ProductBrief si hay impacto y existe
    if analysis.product_impact and target != "product" and state.get("product_created"):
        pb = ProductBrief.model_validate(state["product_brief"])
        context = f"PRODUCTBRIEF ACTUAL:\n{_product_summary(pb)}"
        updated_pb = llm.with_structured_output(ProductBrief).invoke([
            SystemMessage(content=PRODUCT_BRIEF_MODIFICATION_SYSTEM),
            HumanMessage(content=(
                f"{context}\n\n"
                f"INSTRUCCIÓN DE PROPAGACIÓN (cambio automático por consistencia):\n"
                f"{analysis.product_impact}"
            )),
        ])
        new_state["product_brief"] = updated_pb.model_dump()

    # Propagar a Requirements si hay impacto y existe
    if analysis.requirements_impact and target != "requirements" and state.get("requirements_created"):
        reqs = Requirements.model_validate(state["requirements"])
        pb = ProductBrief.model_validate(new_state["product_brief"])
        context = (
            f"REQUISITOS ACTUALES:\n{_requirements_summary(reqs)}\n"
            f"CAPABILITIES: {pb.core_capabilities}\n"
            f"SCOPE IN: {pb.scope.in_scope}\nSCOPE OUT: {pb.scope.out_of_scope}\n"
        )
        updated_reqs = llm.with_structured_output(Requirements).invoke([
            SystemMessage(content=REQUIREMENTS_MODIFICATION_SYSTEM),
            HumanMessage(content=(
                f"{context}\n\n"
                f"INSTRUCCIÓN DE PROPAGACIÓN (cambio automático por consistencia):\n"
                f"{analysis.requirements_impact}"
            )),
        ])
        new_state["requirements"] = updated_reqs.model_dump()

    # Propagar a Design si hay impacto y existe
    if analysis.design_impact and target != "design" and state.get("design_created"):
        diagram = ClassDiagramDesign.model_validate(state["class_diagram"])
        context = f"DIAGRAMA ACTUAL:\n{_diagram_summary(diagram)}"
        mod_resp = llm.with_structured_output(ClassModificationResponse).invoke([
            SystemMessage(content=DESIGN_MODIFICATION_SYSTEM),
            HumanMessage(content=(
                f"{context}\n\n"
                f"INSTRUCCIÓN DE PROPAGACIÓN (cambio automático por consistencia):\n"
                f"{analysis.design_impact}"
            )),
        ])
        updated_diagram = _apply_modifications(diagram, mod_resp)
        new_state["class_diagram"] = updated_diagram.model_dump()

    new_state["impact_analysis"] = None
    return new_state


# ============================================================
# APPLY MODIFICATIONS (código puro)
# ============================================================

def _apply_modifications(
    diagram: ClassDiagramDesign,
    modifications: ClassModificationResponse,
) -> ClassDiagramDesign:
    """Aplica las modificaciones al diagrama de clases."""
    classes = list(diagram.classes)
    relationships = list(diagram.relationships)

    for mod in modifications.modifications:
        action = mod.action
        target = mod.target
        changes = mod.changes

        if action == "add_class" and changes:
            classes.append(SingleClassSpec(
                className=changes.className or target.className or "NewClass",
                attributes=changes.attributes or [],
                methods=changes.methods or [],
                isAbstract=changes.isAbstract or False,
                isEnumeration=changes.isEnumeration or False,
            ))

        elif action == "remove_element":
            if target.className and not target.attributeName and not target.methodName:
                classes = [c for c in classes if c.className != target.className]
                relationships = [
                    r for r in relationships
                    if r.source != target.className and r.target != target.className
                ]
            elif target.className and target.attributeName:
                for c in classes:
                    if c.className == target.className:
                        c.attributes = [a for a in c.attributes if a.name != target.attributeName]
            elif target.className and target.methodName:
                for c in classes:
                    if c.className == target.className:
                        c.methods = [m for m in c.methods if m.name != target.methodName]
            elif target.sourceClass and target.targetClass:
                relationships = [
                    r for r in relationships
                    if not (r.source == target.sourceClass and r.target == target.targetClass)
                ]

        elif action == "add_attribute" and changes and target.className:
            for c in classes:
                if c.className == target.className:
                    c.attributes.append(AttributeSpec(
                        name=changes.name or "newAttr",
                        type=changes.type or "String",
                        visibility=changes.visibility or "public",
                    ))

        elif action == "add_method" and changes and target.className:
            for c in classes:
                if c.className == target.className:
                    c.methods.append(MethodSpec(
                        name=changes.name or "newMethod",
                        returnType=changes.returnType or "void",
                        visibility=changes.visibility or "public",
                        parameters=changes.parameters or [],
                    ))

        elif action == "add_relationship" and changes and target.sourceClass and target.targetClass:
            relationships.append(RelationshipSpec(
                type=changes.relationshipType or "Association",
                source=target.sourceClass,
                target=target.targetClass,
                sourceMultiplicity=changes.sourceMultiplicity or "1",
                targetMultiplicity=changes.targetMultiplicity or "*",
            ))

        elif action == "modify_class" and changes and target.className:
            for c in classes:
                if c.className == target.className:
                    if changes.name:
                        old = c.className
                        c.className = changes.name
                        for r in relationships:
                            if r.source == old:
                                r.source = changes.name
                            if r.target == old:
                                r.target = changes.name
                    if changes.isAbstract is not None:
                        c.isAbstract = changes.isAbstract

        elif action == "add_enum" and changes:
            classes.append(SingleClassSpec(
                className=changes.className or target.className or "NewEnum",
                attributes=changes.attributes or [],
                methods=[],
                isEnumeration=True,
            ))

    return ClassDiagramDesign(
        systemName=diagram.systemName,
        classes=classes,
        relationships=relationships,
    )


# ============================================================
# CONSTRUCCIÓN DEL GRAFO
# ============================================================

def build_graph() -> StateGraph:
    builder = StateGraph(SDDState)

    # Nodos
    builder.add_node("router", router_node)
    builder.add_node("error_node", error_node)
    # Creación
    builder.add_node("product_create_node", product_create_node)
    builder.add_node("requirements_create_node", requirements_create_node)
    builder.add_node("design_create_node", design_create_node)
    # Modificación (staging)
    builder.add_node("product_modify_node", product_modify_node)
    builder.add_node("requirements_modify_node", requirements_modify_node)
    builder.add_node("design_modify_node", design_modify_node)
    # Impact
    builder.add_node("impact_node", impact_node)
    builder.add_node("skip_impact_node", skip_impact_node)

    # Entry
    builder.set_entry_point("router")

    # Router → nodo correcto
    builder.add_conditional_edges("router", route_after_router, {
        "product_create_node": "product_create_node",
        "requirements_create_node": "requirements_create_node",
        "design_create_node": "design_create_node",
        "product_modify_node": "product_modify_node",
        "requirements_modify_node": "requirements_modify_node",
        "design_modify_node": "design_modify_node",
        "error_node": "error_node",
    })

    # Creación → END directo
    builder.add_edge("product_create_node", END)
    builder.add_edge("requirements_create_node", END)
    builder.add_edge("design_create_node", END)

    # Modificación → check si saltar impact o no
    for node in ["product_modify_node", "requirements_modify_node", "design_modify_node"]:
        builder.add_conditional_edges(node, route_after_modify, {
            "skip_impact_node": "skip_impact_node",
            "impact_node": "impact_node",
        })

    # Skip impact y impact → END
    builder.add_edge("skip_impact_node", END)
    builder.add_edge("impact_node", END)
    builder.add_edge("error_node", END)

    return builder.compile()


# ============================================================
# PARSERS: Markdown → Pydantic (para edición manual)
# ============================================================

def parse_markdown_to_product(markdown: str) -> ProductBrief:
    """Parsea un Markdown editado por el usuario a ProductBrief."""
    return llm.with_structured_output(ProductBrief).invoke([
        SystemMessage(content=MARKDOWN_PARSER_PRODUCT_SYSTEM),
        HumanMessage(content=markdown),
    ])


def parse_markdown_to_requirements(markdown: str) -> Requirements:
    """Parsea un Markdown editado por el usuario a Requirements."""
    return llm.with_structured_output(Requirements).invoke([
        SystemMessage(content=MARKDOWN_PARSER_REQUIREMENTS_SYSTEM),
        HumanMessage(content=markdown),
    ])


graph = build_graph()
