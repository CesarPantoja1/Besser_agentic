"""Aplicación de terminal para probar el flujo SDD.

Flujo interactivo:
1. Interactuar con una fase (crear/modificar con LLM)
2. Editar manualmente (Markdown) con detección de cambios y análisis de impacto
3. Ver markdown/JSON de cada especificación
"""

import json
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flujo import (
    graph,
    SDDState,
    apply_pending,
    propagate_changes,
    parse_markdown_to_product,
    parse_markdown_to_requirements,
    impact_node,
)
from converters import product_brief_to_markdown, requirements_to_markdown, design_to_json
from diff import diff_product, diff_requirements, format_diff_summary
from schemas.product_brief import ProductBrief
from schemas.requirements import Requirements
from schemas.class_diagram import ClassDiagramDesign, DesignPhaseOutput, ClassRequirementTrace
from schemas.impact import ImpactAnalysisResult
from quality import (
    check_product_quality,
    check_requirements_quality,
    fix_product_quality,
    fix_requirements_quality,
)
from layout import layout_class_diagram


def print_separator():
    print("\n" + "=" * 70 + "\n")


def print_header(title: str):
    print_separator()
    print(f"  {title}")
    print_separator()


def show_menu():
    print("\n┌──────────────────────────────────────────┐")
    print("│        SDD Pipeline - Menú              │")
    print("├──────────────────────────────────────────┤")
    print("│  1. Interactuar con una fase (LLM)      │")
    print("│  2. Editar manualmente (Markdown)       │")
    print("│  3. Ver ProductBrief (Markdown)         │")
    print("│  4. Ver Requirements (Markdown)         │")
    print("│  5. Ver Design (JSON)                   │")
    print("│  6. Layout del Diagrama de Clases       │")
    print("│  7. Ver estado de banderas              │")
    print("│  8. Salir                               │")
    print("└──────────────────────────────────────────┘")


def get_phase_input() -> str:
    print("\n¿A qué fase quieres ir?")
    print("  [p] ProductBrief")
    print("  [r] Requirements")
    print("  [d] Design")
    choice = input("\nFase (p/r/d): ").strip().lower()
    return {"p": "product", "r": "requirements", "d": "design"}.get(choice, "")


def get_edit_phase_input() -> str:
    """Selección de fase para edición manual (solo product y requirements)."""
    print("\n¿Qué especificación quieres editar manualmente?")
    print("  [p] ProductBrief")
    print("  [r] Requirements")
    choice = input("\nFase (p/r): ").strip().lower()
    return {"p": "product", "r": "requirements"}.get(choice, "")


def show_impact_and_decide(impact_analysis: dict) -> str:
    """Muestra el análisis de impacto y pide decisión al usuario."""
    analysis = ImpactAnalysisResult.model_validate(impact_analysis)

    print_header("📊 Análisis de Impacto (ANTES de aplicar)")

    print(f"📋 Resumen: {analysis.summary}")

    if analysis.warnings:
        print(f"\n⚠️  Advertencias ({len(analysis.warnings)}):")
        for i, w in enumerate(analysis.warnings, 1):
            print(f"   {i}. {w}")
    else:
        print("\n✅ No se detectaron inconsistencias.")

    has_propagation = False
    if analysis.product_impact:
        print(f"\n🔄 Cambios sugeridos para ProductBrief:")
        print(f"   {analysis.product_impact}")
        has_propagation = True
    if analysis.requirements_impact:
        print(f"\n🔄 Cambios sugeridos para Requirements:")
        print(f"   {analysis.requirements_impact}")
        has_propagation = True
    if analysis.design_impact:
        print(f"\n🔄 Cambios sugeridos para Design:")
        print(f"   {analysis.design_impact}")
        has_propagation = True

    print("\n" + "-" * 50)
    print("¿Qué deseas hacer?")
    print("  [A] ❌ Anular cambio (no se modifica nada)")
    print("  [B] ✅ Aplicar SOLO en esta especificación")
    if has_propagation:
        print("  [C] 🔄 Aplicar + propagar a todas las specs afectadas")

    while True:
        decision = input("\nDecisión (A/B/C): ").strip().upper()
        if decision in ("A", "B"):
            return decision
        if decision == "C" and has_propagation:
            return decision
        if decision == "C" and not has_propagation:
            print("   No hay cambios para propagar. Elige A o B.")
        else:
            print("   Opción no válida.")


def build_invoke_state(current_state: dict, user_msg: str, phase: str) -> dict:
    return {
        **current_state,
        "user_prompt": user_msg,
        "target_phase": phase,
        "pending_modification": None,
        "impact_analysis": None,
        "skip_impact": False,
        "error": None,
        "response": None,
    }


def edit_in_editor(current_markdown: str) -> str:
    """Abre un archivo temporal con el MD actual en notepad, espera edición."""
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".md", delete=False, encoding="utf-8"
    ) as f:
        f.write(current_markdown)
        temp_path = f.name

    print(f"\n📝 Abriendo editor... Edita, guarda (Ctrl+S) y cierra para continuar.")
    print(f"   Archivo: {temp_path}")

    try:
        subprocess.run(["notepad.exe", temp_path], check=True)
    except FileNotFoundError:
        print("   notepad.exe no encontrado, intentando con 'code --wait'...")
        try:
            subprocess.run(["code", "--wait", temp_path], check=True)
        except FileNotFoundError:
            print("   ❌ No se encontró un editor. Edita manualmente el archivo y presiona Enter.")
            input("   Presiona Enter cuando hayas terminado de editar: ")

    with open(temp_path, "r", encoding="utf-8") as f:
        modified = f.read()

    os.unlink(temp_path)
    return modified


def show_quality_and_decide(report) -> str:
    """Muestra errores de calidad y pide decisión al usuario."""
    print_header("🔍 Validación de Calidad del Documento")

    n_errors = sum(1 for i in report.issues if i.severity == "error")
    n_warnings = sum(1 for i in report.issues if i.severity == "advertencia")
    print(f"  Encontrados: {n_errors} error(es), {n_warnings} advertencia(s)\n")

    for idx, issue in enumerate(report.issues, 1):
        icon = "❌" if issue.severity == "error" else "⚠️"
        label = issue.severity.upper()
        print(f"  {idx}. [{label}] {icon} {issue.field}")
        print(f"     {issue.description}")
        print(f"     → Sugerencia: {issue.suggestion}")
        print()

    print("-" * 50)
    print("¿Qué deseas hacer?")
    print("  [A] ❌ Cancelar cambios (volver al estado anterior)")
    print("  [B] 🔧 Corregir errores automáticamente y continuar")
    print("  [C] ⚠️  Ignorar errores y continuar con los cambios")

    while True:
        decision = input("\nDecisión (A/B/C): ").strip().upper()
        if decision in ("A", "B", "C"):
            return decision
        print("   Opción no válida.")


def handle_manual_edit(current_state: dict, phase: str) -> dict:
    """Maneja el flujo completo de edición manual con quality check."""

    # 1. Exportar a Markdown
    if phase == "product":
        pb = ProductBrief.model_validate(current_state["product_brief"])
        current_md = product_brief_to_markdown(pb)
    else:
        reqs = Requirements.model_validate(current_state["requirements"])
        current_md = requirements_to_markdown(reqs)

    # 2. Abrir editor
    modified_md = edit_in_editor(current_md)

    # 3. Verificar si hubo cambios en el texto
    if modified_md.strip() == current_md.strip():
        print("\n📋 No se detectaron cambios en el texto.")
        return current_state

    # 4. Parsear el Markdown editado a Pydantic
    print("\n⏳ Parseando cambios...")
    try:
        if phase == "product":
            new_model = parse_markdown_to_product(modified_md)
            old_model = pb
            changes = diff_product(old_model, new_model)
        else:
            new_model = parse_markdown_to_requirements(modified_md)
            old_model = reqs
            changes = diff_requirements(old_model, new_model)
    except Exception as e:
        print(f"\n❌ Error al parsear el Markdown editado: {e}")
        return current_state

    # 5. Verificar si hay cambios semánticos
    if not changes:
        print("\n📋 No se detectaron cambios semánticos (solo cambios de formato).")
        return current_state

    # 6. Mostrar cambios detectados
    diff_summary = format_diff_summary(phase, changes)
    print_header("🔍 Cambios Detectados")
    print(diff_summary)

    # ================================================================
    # 7. QUALITY CHECK: validar coherencia interna del documento editado
    # ================================================================
    print("\n⏳ Validando calidad del documento...")
    if phase == "product":
        quality_report = check_product_quality(new_model)
    else:
        quality_report = check_requirements_quality(new_model)

    if not quality_report.is_valid:
        quality_decision = show_quality_and_decide(quality_report)

        if quality_decision == "A":
            print("\n❌ Cambios cancelados. No se modificó nada.")
            return current_state

        elif quality_decision == "B":
            print("\n⏳ Corrigiendo errores automáticamente...")
            try:
                if phase == "product":
                    new_model = fix_product_quality(new_model, quality_report.issues)
                else:
                    new_model = fix_requirements_quality(new_model, quality_report.issues)
                print("✅ Errores corregidos.")
                # Recalcular diff con el modelo corregido
                if phase == "product":
                    changes = diff_product(old_model, new_model)
                else:
                    changes = diff_requirements(old_model, new_model)
                diff_summary = format_diff_summary(phase, changes)
                if changes:
                    print_header("🔍 Cambios Actualizados (post-corrección)")
                    print(diff_summary)
                else:
                    print("\n📋 Las correcciones revirtieron todos los cambios.")
                    return current_state
            except Exception as e:
                print(f"\n❌ Error al corregir: {e}")
                print("Continuando con el documento sin corregir...")

        elif quality_decision == "C":
            print("\n⚠️  Ignorando errores, continuando...")

    else:
        print("\n✅ Documento válido. No se detectaron errores de calidad.")

    # ================================================================
    # 8. IMPACT ANALYSIS: verificar coherencia con otras specs
    # ================================================================
    has_specs_to_check = False
    if phase == "product":
        has_specs_to_check = (
            current_state.get("requirements_created", False)
            or current_state.get("design_created", False)
        )
    elif phase == "requirements":
        has_specs_to_check = True  # Siempre hay product arriba

    # Si no hay specs que analizar, aplicar directamente
    if not has_specs_to_check:
        if phase == "product":
            current_state["product_brief"] = new_model.model_dump()
        else:
            current_state["requirements"] = new_model.model_dump()
        print("\n✅ Cambios aplicados directamente (no hay specs afectadas).")
        return current_state

    # Ejecutar análisis de impacto
    print("\n⏳ Analizando impacto en otras especificaciones...")
    impact_state = {
        **current_state,
        "user_prompt": diff_summary,
        "target_phase": phase,
    }
    impact_result = impact_node(impact_state)

    # Mostrar análisis y pedir decisión
    decision = show_impact_and_decide(impact_result["impact_analysis"])

    if decision == "A":
        print("\n❌ Cambios anulados. No se modificó nada.")
        return current_state

    elif decision == "B":
        if phase == "product":
            current_state["product_brief"] = new_model.model_dump()
        else:
            current_state["requirements"] = new_model.model_dump()
        print("\n✅ Cambios manuales aplicados (solo en esta especificación).")
        return current_state

    elif decision == "C":
        print("\n⏳ Aplicando cambios y propagando...")
        if phase == "product":
            current_state["product_brief"] = new_model.model_dump()
        else:
            current_state["requirements"] = new_model.model_dump()

        propagated = propagate_changes({
            **current_state,
            "impact_analysis": impact_result["impact_analysis"],
            "target_phase": phase,
        })
        for key in ["product_brief", "requirements", "class_diagram"]:
            if propagated.get(key) is not None:
                current_state[key] = propagated[key]

        print("\n✅ Cambios manuales aplicados y propagados a specs afectadas.")
        return current_state

    return current_state


# ============================================================
# APP PRINCIPAL
# ============================================================

def run_app():
    """Ejecuta la aplicación interactiva de terminal."""

    current_state: dict = {
        "user_prompt": "",
        "target_phase": "",
        "product_brief": None,
        "requirements": None,
        "class_diagram": None,
        "traceability": None,
        "product_created": False,
        "requirements_created": False,
        "design_created": False,
        "pending_modification": None,
        "impact_analysis": None,
        "skip_impact": False,
        "phase": "",
        "mode": "",
        "error": None,
        "response": None,
    }

    print_header("SDD Pipeline - Spec-Driven Development con LangGraph")
    print("Bienvenido al pipeline SDD. Comienza creando un ProductBrief (opción 1).")

    while True:
        show_menu()
        choice = input("\nOpción: ").strip()

        # ========== OPCIÓN 1: Interactuar con LLM ==========
        if choice == "1":
            phase = get_phase_input()
            if not phase:
                print("❌ Fase no válida.")
                continue

            is_creation = (
                (phase == "product" and not current_state["product_created"])
                or (phase == "requirements" and not current_state["requirements_created"])
                or (phase == "design" and not current_state["design_created"])
            )

            if is_creation and phase in ("requirements", "design"):
                user_msg = ""
                print(f"\n⚙️  Creación automática de {phase} basada en especificaciones anteriores...")
            else:
                if is_creation:
                    user_msg = input(f"\nDescribe tu idea de software: ").strip()
                else:
                    user_msg = input(f"\n¿Qué cambio quieres hacer en {phase}?: ").strip()
                if not user_msg:
                    print("❌ Mensaje vacío.")
                    continue

            invoke_state = build_invoke_state(current_state, user_msg, phase)

            print(f"\n⏳ Procesando ({phase})...")
            try:
                result = graph.invoke(invoke_state)

                if result.get("error"):
                    print(f"\n{result['error']}")
                    continue

                if result.get("phase") == "done":
                    for key in [
                        "product_brief", "requirements", "class_diagram", "traceability",
                        "product_created", "requirements_created", "design_created",
                    ]:
                        if result.get(key) is not None:
                            current_state[key] = result[key]
                    print(f"\n{result.get('response', '✅ Operación completada.')}")
                    continue

                if result.get("phase") == "awaiting_decision":
                    print(f"\n{result.get('response', '')}")
                    decision = show_impact_and_decide(result["impact_analysis"])

                    if decision == "A":
                        print("\n❌ Cambio anulado. No se modificó nada.")
                        continue
                    elif decision == "B":
                        applied = apply_pending({
                            **current_state,
                            "pending_modification": result["pending_modification"],
                            "target_phase": phase,
                        })
                        for key in ["product_brief", "requirements", "class_diagram"]:
                            if applied.get(key) is not None:
                                current_state[key] = applied[key]
                        current_state["pending_modification"] = None
                        print("\n✅ Cambio aplicado (solo en esta especificación).")
                        continue
                    elif decision == "C":
                        print("\n⏳ Aplicando cambio y propagando a specs afectadas...")
                        applied = apply_pending({
                            **current_state,
                            "pending_modification": result["pending_modification"],
                            "target_phase": phase,
                        })
                        for key in ["product_brief", "requirements", "class_diagram"]:
                            if applied.get(key) is not None:
                                current_state[key] = applied[key]

                        propagated = propagate_changes({
                            **current_state,
                            "impact_analysis": result["impact_analysis"],
                            "target_phase": phase,
                        })
                        for key in ["product_brief", "requirements", "class_diagram"]:
                            if propagated.get(key) is not None:
                                current_state[key] = propagated[key]

                        current_state["pending_modification"] = None
                        current_state["impact_analysis"] = None
                        print("\n✅ Cambio aplicado y propagado a todas las specs afectadas.")
                        continue

            except Exception as e:
                print(f"\n❌ Error: {e}")
                import traceback
                traceback.print_exc()

        # ========== OPCIÓN 2: Edición manual ==========
        elif choice == "2":
            phase = get_edit_phase_input()
            if not phase:
                print("❌ Fase no válida.")
                continue

            if phase == "product" and not current_state.get("product_created"):
                print("\n⚠️ No hay ProductBrief creado aún. Usa la opción 1 primero.")
                continue
            if phase == "requirements" and not current_state.get("requirements_created"):
                print("\n⚠️ No hay Requirements creados aún. Usa la opción 1 primero.")
                continue

            try:
                current_state = handle_manual_edit(current_state, phase)
            except Exception as e:
                print(f"\n❌ Error: {e}")
                import traceback
                traceback.print_exc()

        # ========== OPCIONES 3-7: Ver y salir ==========
        elif choice == "3":
            if not current_state.get("product_brief"):
                print("\n⚠️ No hay ProductBrief generado aún.")
                continue
            pb = ProductBrief.model_validate(current_state["product_brief"])
            print_header("ProductBrief (Markdown)")
            print(product_brief_to_markdown(pb))

        elif choice == "4":
            if not current_state.get("requirements"):
                print("\n⚠️ No hay Requirements generados aún.")
                continue
            reqs = Requirements.model_validate(current_state["requirements"])
            print_header("Requirements (Markdown)")
            print(requirements_to_markdown(reqs))

        elif choice == "5":
            if not current_state.get("class_diagram"):
                print("\n⚠️ No hay Design generado aún.")
                continue
            diagram = ClassDiagramDesign.model_validate(current_state["class_diagram"])
            traces = [
                ClassRequirementTrace.model_validate(t)
                for t in (current_state.get("traceability") or [])
            ]
            design_output = DesignPhaseOutput(diagram=diagram, traceability=traces)
            print_header("Design - Diagrama de Clases (JSON)")
            print(design_to_json(design_output))

        elif choice == "6":
            if not current_state.get("class_diagram"):
                print("\n⚠️ No hay Design generado aún. Crea el diagrama primero (opción 1 → design).")
                continue
            print("\n⏳ Calculando layout del diagrama de clases...")
            try:
                laid_out = layout_class_diagram(current_state["class_diagram"])
                print_header("🗺️  Diagrama de Clases con Layout")
                import json
                print(json.dumps(laid_out, indent=2, ensure_ascii=False))
                print("\n📝 Las clases ahora tienen 'position': {x, y}")
                print("   Las relaciones tienen 'sourceDirection' y 'targetDirection'")
            except Exception as e:
                print(f"\n❌ Error al calcular layout: {e}")
                import traceback
                traceback.print_exc()

        elif choice == "7":
            print_header("Estado de Banderas")
            print(f"  ProductBrief creado:  {'✅' if current_state['product_created'] else '❌'}")
            print(f"  Requirements creados: {'✅' if current_state['requirements_created'] else '❌'}")
            print(f"  Design creado:        {'✅' if current_state['design_created'] else '❌'}")

        elif choice == "8":
            print("\n👋 ¡Hasta luego!")
            break
        else:
            print("❌ Opción no válida.")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="SDD Pipeline")
    parser.add_argument("--example", action="store_true", help="Ejecutar ejemplo programático")
    args = parser.parse_args()

    if args.example:
        from flujo import graph as g
        from schemas.impact import ImpactAnalysisResult as IAR

        base: SDDState = {
            "user_prompt": "", "target_phase": "", "product_brief": None,
            "requirements": None, "class_diagram": None, "traceability": None,
            "product_created": False, "requirements_created": False,
            "design_created": False, "pending_modification": None,
            "impact_analysis": None, "skip_impact": False,
            "phase": "", "mode": "", "error": None, "response": None,
        }

        print("⏳ Paso 1: Creando ProductBrief...")
        r1 = g.invoke({**base,
            "user_prompt": "App de gestión de tareas para equipos con login, dashboard y reportes",
            "target_phase": "product"})
        print(f"  → {r1['response']}")

        print("\n⏳ Paso 2: Creando Requirements (automático)...")
        r2 = g.invoke({**r1, "user_prompt": "", "target_phase": "requirements",
            "pending_modification": None, "impact_analysis": None,
            "error": None, "response": None})
        print(f"  → {r2['response']}")

        print("\n⏳ Paso 3: Creando Design (automático)...")
        r3 = g.invoke({**r2, "user_prompt": "", "target_phase": "design",
            "pending_modification": None, "impact_analysis": None,
            "error": None, "response": None})
        print(f"  → {r3['response']}")
    else:
        run_app()
