"""FastAPI server for the SDD pipeline.

Exposes REST endpoints for session and configuration management,
and a WebSocket server for multi-step interactive generation and gates.
"""

import os
import sys
import uuid
import json
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add current folder to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import flujo
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

# FastAPI Application
app = FastAPI(title="BESSER WME SDD Backend Server")

# Allow all origins for development with WebSocket support
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active connections map: session_id -> WebSocket
active_connections: Dict[str, WebSocket] = {}

# Session persistence helpers
SESSIONS_DIR = Path(__file__).parent / ".sessions"
SESSIONS_DIR.mkdir(exist_ok=True)


def _save_generated_files_to_output_dir(data: dict):
    config = data.get("config", {})
    if not config:
        return
    output_dir = config.get("outputDir")
    if not output_dir:
        return

    sdd_state = data.get("sdd_state", {})
    if not sdd_state:
        return

    try:
        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)

        # 1. Save Product Brief if created
        if sdd_state.get("product_created") and sdd_state.get("product_brief"):
            pb = ProductBrief.model_validate(sdd_state["product_brief"])
            markdown = product_brief_to_markdown(pb)
            file_path = out_path / "product_brief.md"
            file_path.write_text(markdown, encoding="utf-8")

        # 2. Save Requirements if created
        if sdd_state.get("requirements_created") and sdd_state.get("requirements"):
            reqs = Requirements.model_validate(sdd_state["requirements"])
            markdown = requirements_to_markdown(reqs)
            file_path = out_path / "requirements.md"
            file_path.write_text(markdown, encoding="utf-8")

        # 3. Save Class Diagram if created
        if sdd_state.get("design_created") and sdd_state.get("class_diagram"):
            file_path = out_path / "class_diagram.json"
            file_path.write_text(json.dumps(sdd_state["class_diagram"], indent=2, ensure_ascii=False), encoding="utf-8")

    except Exception as e:
        print(f"Error saving generated files to outputDir '{output_dir}': {e}")


def save_session(session_id: str, data: dict):
    file_path = SESSIONS_DIR / f"{session_id}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    # Auto-save generated artifacts to designated output directory
    _save_generated_files_to_output_dir(data)


def load_session(session_id: str) -> Optional[dict]:
    file_path = SESSIONS_DIR / f"{session_id}.json"
    if file_path.exists():
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


def delete_session(session_id: str):
    file_path = SESSIONS_DIR / f"{session_id}.json"
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception:
            pass


# Pydantic Schemas for Requests
class ConfigModel(BaseModel):
    apiKey: str
    model: str
    provider: str  # "openai" | "gemini"
    outputDir: Optional[str] = None


class SessionCreateRequest(BaseModel):
    config: Optional[ConfigModel] = None


class ModelsRequest(BaseModel):
    provider: str
    apiKey: str


# Helpers
def _bind_llm(provider: str, api_key: str, model_name: str):
    """Dynamically re-bind the global flujo.llm object to user specifications."""
    if not api_key:
        if provider == "openai":
            api_key = os.environ.get("OPENAI_API_KEY", "")
        elif provider == "gemini":
            api_key = os.environ.get("GEMINI_API_KEY", "")

    if provider == "openai":
        os.environ["OPENAI_API_KEY"] = api_key
        from langchain_openai import ChatOpenAI
        flujo.llm = ChatOpenAI(model=model_name, temperature=0.2, api_key=api_key)
    elif provider == "gemini":
        os.environ["GEMINI_API_KEY"] = api_key
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            flujo.llm = ChatGoogleGenerativeAI(model=model_name, temperature=0.2, google_api_key=api_key)
        except ImportError:
            # Fallback to OpenAI-compatible endpoint of Google AI Studio
            from langchain_openai import ChatOpenAI
            flujo.llm = ChatOpenAI(
                model=model_name,
                temperature=0.2,
                api_key=api_key,
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
            )


def _extract_spec_data(phase: str, sdd_state: dict):
    """Helper to extract markdown, structural payload, and layout for a phase."""
    markdown = ""
    data_payload = None
    layout = None

    if phase == "product" and sdd_state.get("product_brief"):
        pb = ProductBrief.model_validate(sdd_state["product_brief"])
        markdown = product_brief_to_markdown(pb)
        data_payload = sdd_state["product_brief"]
    elif phase == "requirements" and sdd_state.get("requirements"):
        reqs = Requirements.model_validate(sdd_state["requirements"])
        markdown = requirements_to_markdown(reqs)
        data_payload = sdd_state["requirements"]
    elif phase == "design" and sdd_state.get("class_diagram"):
        data_payload = sdd_state["class_diagram"]
        try:
            layout = layout_class_diagram(sdd_state["class_diagram"])
        except Exception:
            layout = sdd_state["class_diagram"]

    return markdown, data_payload, layout


async def _process_manual_edit_model(websocket: WebSocket, session_id: str, session: dict, phase: str, new_model_dict: dict):
    """Compares manual edits, raises quality/impact gates, or applies directly."""
    sdd_state = session["sdd_state"]

    if phase == "product":
        old_model = ProductBrief.model_validate(sdd_state["product_brief"])
        new_model = ProductBrief.model_validate(new_model_dict)
        changes = diff_product(old_model, new_model)
        diff_summary = format_diff_summary(phase, changes)
        diff_changes = changes
    else:
        old_model = Requirements.model_validate(sdd_state["requirements"])
        new_model = Requirements.model_validate(new_model_dict)
        changes = diff_requirements(old_model, new_model)
        diff_summary = format_diff_summary(phase, changes)
        diff_changes = changes

    if not diff_changes:
        # No semantic changes, save directly
        sdd_state["product_brief" if phase == "product" else "requirements"] = new_model_dict
        session["sdd_state"] = sdd_state
        session["pending_new_model"] = None
        session["pending_phase"] = None
        session["pending_quality_report"] = None
        save_session(session_id, session)

        markdown, data_payload, layout = _extract_spec_data(phase, sdd_state)
        await websocket.send_json({
            "type": "spec_updated",
            "phase": phase,
            "data": data_payload,
            "markdown": markdown,
            "layout": layout,
            "propagated_specs": [],
            "flags": {
                "productCreated": sdd_state["product_created"],
                "requirementsCreated": sdd_state["requirements_created"],
                "designCreated": sdd_state["design_created"]
            }
        })
        return

    # Send diff result to client
    await websocket.send_json({
        "type": "diff_result",
        "changes": diff_changes,
        "diff_summary": diff_summary
    })

    # Check downstream specs
    has_specs_to_check = False
    if phase == "product":
        has_specs_to_check = sdd_state.get("requirements_created") or sdd_state.get("design_created")
    elif phase == "requirements":
        has_specs_to_check = True

    if not has_specs_to_check:
        # No downstream specs, apply directly
        sdd_state["product_brief" if phase == "product" else "requirements"] = new_model_dict
        session["sdd_state"] = sdd_state
        session["pending_new_model"] = None
        session["pending_phase"] = None
        session["pending_quality_report"] = None
        save_session(session_id, session)

        markdown, data_payload, layout = _extract_spec_data(phase, sdd_state)
        await websocket.send_json({
            "type": "spec_updated",
            "phase": phase,
            "data": data_payload,
            "markdown": markdown,
            "layout": layout,
            "propagated_specs": [],
            "flags": {
                "productCreated": sdd_state["product_created"],
                "requirementsCreated": sdd_state["requirements_created"],
                "designCreated": sdd_state["design_created"]
            }
        })
        return

    # Downstream checks exist, run impact analyzer
    await websocket.send_json({"type": "status", "message": "⏳ Analizando impacto en otras especificaciones..."})

    impact_state = {
        **sdd_state,
        "user_prompt": diff_summary,
        "target_phase": phase,
    }

    loop = asyncio.get_running_loop()
    try:
        impact_result = await loop.run_in_executor(None, lambda: impact_node(impact_state))

        # Save staging
        session["pending_state"] = {
            "pending_modification": new_model_dict,
            "impact_analysis": impact_result["impact_analysis"]
        }
        session["pending_phase"] = phase
        session["pending_new_model"] = None
        session["pending_quality_report"] = None
        save_session(session_id, session)

        await websocket.send_json({
            "type": "impact_analysis",
            "analysis": impact_result["impact_analysis"],
            "awaiting_decision": True,
            "options": {
                "A": "Anular cambio",
                "B": "Aplicar solo aquí",
                "C": "Aplicar + propagar"
            }
        })
    except Exception as e:
        await websocket.send_json({"type": "error", "message": f"Error de análisis de impacto: {str(e)}"})


# ============================================================
# REST ENDPOINTS
# ============================================================

@app.post("/api/session/create")
async def create_session(req: SessionCreateRequest):
    """Creates a new SDD session with persistent memory."""
    session_id = str(uuid.uuid4())
    default_config = {
        "apiKey": "",
        "model": "gpt-4o-mini",
        "provider": "openai",
        "outputDir": ""
    }
    
    if req.config:
        default_config = req.config.model_dump()

    initial_state = {
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

    session_data = {
        "session_id": session_id,
        "config": default_config,
        "sdd_state": initial_state,
        "pending_state": None,
        "pending_new_model": None,
        "pending_quality_report": None,
        "pending_phase": None
    }

    save_session(session_id, session_data)
    return {"sessionId": session_id, "config": default_config}


@app.post("/api/models")
async def fetch_available_models(req: ModelsRequest):
    """Fetches available chat models from the specified provider using the user's API key."""
    provider = req.provider.lower()
    api_key = req.apiKey.strip()
    
    if not api_key:
        if provider == "openai":
            return {"models": ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"]}
        elif provider == "gemini":
            return {"models": ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-flash"]}
        return {"models": []}

    models = []
    if provider == "openai":
        try:
            import openai
            client = openai.OpenAI(api_key=api_key)
            models_list = client.models.list()
            models = sorted(list(set([
                m.id for m in models_list.data 
                if "gpt" in m.id or m.id.startswith("o1") or m.id.startswith("o3")
            ])))
            if not models:
                models = ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "o1-mini", "o1-preview"]
        except Exception:
            models = ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"]
    elif provider == "gemini":
        try:
            import requests
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
            r = requests.get(url, timeout=5)
            if r.status_code == 200:
                data = r.json()
                for m in data.get("models", []):
                    name = m.get("name", "")
                    if name.startswith("models/"):
                        name = name.replace("models/", "")
                    
                    supported_methods = m.get("supportedGenerationMethods", [])
                    if "gemini" in name and ("generateContent" in supported_methods or "generateText" in supported_methods):
                        models.append(name)
                models = sorted(list(set(models)))
            if not models:
                models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-flash", "gemini-2.5-pro"]
        except Exception:
            models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-flash"]
            
    return {"models": models}


@app.post("/api/session/{session_id}/config")
async def set_session_config(session_id: str, config: ConfigModel):
    """Updates the model configuration for an active session."""
    session = load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session["config"] = config.model_dump()
    save_session(session_id, session)
    return {"status": "ok", "config": session["config"]}


@app.get("/api/session/{session_id}/state")
async def get_session_state(session_id: str):
    """Returns the full persistent state of the session."""
    session = load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    sdd_state = session.get("sdd_state", {})
    
    # Extract markdowns and layouts to resume cleanly on reload
    product_md, product_data, _ = _extract_spec_data("product", sdd_state)
    reqs_md, reqs_data, _ = _extract_spec_data("requirements", sdd_state)
    _, design_data, design_layout = _extract_spec_data("design", sdd_state)
    
    return {
        "sessionId": session_id,
        "config": session.get("config"),
        "flags": {
            "productCreated": sdd_state.get("product_created", False),
            "requirementsCreated": sdd_state.get("requirements_created", False),
            "designCreated": sdd_state.get("design_created", False)
        },
        "productMarkdown": product_md,
        "productData": product_data,
        "requirementsMarkdown": reqs_md,
        "requirementsData": reqs_data,
        "designData": design_data,
        "designLayout": design_layout
    }


@app.delete("/api/session/{session_id}")
async def end_session(session_id: str):
    """Terminates and purges the session data."""
    delete_session(session_id)
    active_connections.pop(session_id, None)
    return {"status": "deleted"}


# ============================================================
# WEBSOCKET ENDPOINT
# ============================================================

@app.websocket("/ws/sdd/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """Manages the real-time interactive generation loop and gates."""
    await websocket.accept()

    session = load_session(session_id)
    if not session:
        await websocket.send_json({"type": "error", "message": "Sesión no encontrada"})
        await websocket.close()
        return

    active_connections[session_id] = websocket

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            phase = data.get("phase")
            prompt = data.get("prompt", "")
            content = data.get("content")

            # Reload session in case it changed via REST
            session = load_session(session_id) or session
            config = session.get("config", {})
            api_key = config.get("apiKey", "")
            model_name = config.get("model", "gpt-4o-mini")
            provider = config.get("provider", "openai")

            # Re-bind LLM with dynamic user preferences
            try:
                _bind_llm(provider, api_key, model_name)
            except Exception as e:
                await websocket.send_json({"type": "error", "message": f"Error configurando LLM: {str(e)}"})
                continue

            sdd_state = session.get("sdd_state", {})

            if action == "create":
                await websocket.send_json({"type": "status", "message": f"⏳ Generando {phase.upper()}..."})

                invoke_state = {
                    **sdd_state,
                    "user_prompt": prompt,
                    "target_phase": phase,
                    "pending_modification": None,
                    "impact_analysis": None,
                    "skip_impact": False,
                    "error": None,
                    "response": None,
                }

                loop = asyncio.get_running_loop()
                try:
                    result = await loop.run_in_executor(None, lambda: graph.invoke(invoke_state))

                    if result.get("error"):
                        await websocket.send_json({"type": "error", "message": result["error"]})
                        continue

                    if result.get("phase") == "done":
                        for key in [
                            "product_brief", "requirements", "class_diagram", "traceability",
                            "product_created", "requirements_created", "design_created"
                        ]:
                            if result.get(key) is not None:
                                sdd_state[key] = result[key]

                        session["sdd_state"] = sdd_state
                        save_session(session_id, session)

                        markdown, data_payload, layout = _extract_spec_data(phase, sdd_state)
                        await websocket.send_json({
                            "type": "spec_created",
                            "phase": phase,
                            "data": data_payload,
                            "markdown": markdown,
                            "layout": layout,
                            "flags": {
                                "productCreated": sdd_state["product_created"],
                                "requirementsCreated": sdd_state["requirements_created"],
                                "designCreated": sdd_state["design_created"]
                            }
                        })
                except Exception as e:
                    await websocket.send_json({"type": "error", "message": f"Error de generación: {str(e)}"})

            elif action == "modify":
                await websocket.send_json({"type": "status", "message": f"⏳ Planificando cambios para {phase.upper()}..."})

                invoke_state = {
                    **sdd_state,
                    "user_prompt": prompt,
                    "target_phase": phase,
                    "pending_modification": None,
                    "impact_analysis": None,
                    "skip_impact": False,
                    "error": None,
                    "response": None,
                }

                loop = asyncio.get_running_loop()
                try:
                    result = await loop.run_in_executor(None, lambda: graph.invoke(invoke_state))

                    if result.get("error"):
                        await websocket.send_json({"type": "error", "message": result["error"]})
                        continue

                    if result.get("phase") == "done":
                        # Applied directly (skip impact)
                        for key in [
                            "product_brief", "requirements", "class_diagram",
                            "product_created", "requirements_created", "design_created"
                        ]:
                            if result.get(key) is not None:
                                sdd_state[key] = result[key]

                        session["sdd_state"] = sdd_state
                        save_session(session_id, session)

                        markdown, data_payload, layout = _extract_spec_data(phase, sdd_state)
                        await websocket.send_json({
                            "type": "spec_updated",
                            "phase": phase,
                            "data": data_payload,
                            "markdown": markdown,
                            "layout": layout,
                            "propagated_specs": [],
                            "flags": {
                                "productCreated": sdd_state["product_created"],
                                "requirementsCreated": sdd_state["requirements_created"],
                                "designCreated": sdd_state["design_created"]
                            }
                        })

                    elif result.get("phase") == "awaiting_decision":
                        # Staging
                        session["pending_state"] = result
                        session["pending_phase"] = phase
                        save_session(session_id, session)

                        await websocket.send_json({
                            "type": "impact_analysis",
                            "analysis": result["impact_analysis"],
                            "awaiting_decision": True,
                            "options": {
                                "A": "Anular cambio",
                                "B": "Aplicar solo aquí",
                                "C": "Aplicar + propagar"
                            }
                        })
                except Exception as e:
                    await websocket.send_json({"type": "error", "message": f"Error de modificación: {str(e)}"})

            elif action == "decide":
                gate = data.get("gate")
                decision = data.get("decision")

                if gate == "impact":
                    pending_state = session.get("pending_state")
                    pending_phase = session.get("pending_phase")

                    if not pending_state or not pending_phase:
                        await websocket.send_json({"type": "error", "message": "No hay cambio pendiente"})
                        continue

                    if decision == "A":
                        session["pending_state"] = None
                        session["pending_phase"] = None
                        save_session(session_id, session)
                        await websocket.send_json({"type": "status", "message": "❌ Cambio anulado."})

                    elif decision == "B":
                        await websocket.send_json({"type": "status", "message": "⏳ Aplicando cambio..."})
                        applied = apply_pending({
                            **sdd_state,
                            "pending_modification": pending_state["pending_modification"],
                            "target_phase": pending_phase,
                        })

                        for key in ["product_brief", "requirements", "class_diagram"]:
                            if applied.get(key) is not None:
                                sdd_state[key] = applied[key]

                        session["sdd_state"] = sdd_state
                        session["pending_state"] = None
                        session["pending_phase"] = None
                        save_session(session_id, session)

                        markdown, data_payload, layout = _extract_spec_data(pending_phase, sdd_state)
                        await websocket.send_json({
                            "type": "spec_updated",
                            "phase": pending_phase,
                            "data": data_payload,
                            "markdown": markdown,
                            "layout": layout,
                            "propagated_specs": [],
                            "flags": {
                                "productCreated": sdd_state["product_created"],
                                "requirementsCreated": sdd_state["requirements_created"],
                                "designCreated": sdd_state["design_created"]
                            }
                        })

                    elif decision == "C":
                        await websocket.send_json({"type": "status", "message": "⏳ Propagando cambios a especificaciones afectadas..."})

                        applied = apply_pending({
                            **sdd_state,
                            "pending_modification": pending_state["pending_modification"],
                            "target_phase": pending_phase,
                        })
                        for key in ["product_brief", "requirements", "class_diagram"]:
                            if applied.get(key) is not None:
                                sdd_state[key] = applied[key]

                        loop = asyncio.get_running_loop()
                        try:
                            propagated = await loop.run_in_executor(None, lambda: propagate_changes({
                                **applied,
                                "impact_analysis": pending_state["impact_analysis"],
                                "target_phase": pending_phase,
                            }))

                            propagated_specs = []
                            for key in ["product_brief", "requirements", "class_diagram"]:
                                if propagated.get(key) is not None:
                                    sdd_state[key] = propagated[key]
                                    if key != pending_phase and propagated[key] != applied.get(key):
                                        propagated_specs.append(key)

                            session["sdd_state"] = sdd_state
                            session["pending_state"] = None
                            session["pending_phase"] = None
                            save_session(session_id, session)

                            markdown, data_payload, layout = _extract_spec_data(pending_phase, sdd_state)
                            await websocket.send_json({
                                "type": "spec_updated",
                                "phase": pending_phase,
                                "data": data_payload,
                                "markdown": markdown,
                                "layout": layout,
                                "propagated_specs": propagated_specs,
                                "flags": {
                                    "productCreated": sdd_state["product_created"],
                                    "requirementsCreated": sdd_state["requirements_created"],
                                    "designCreated": sdd_state["design_created"]
                                }
                            })
                        except Exception as e:
                            await websocket.send_json({"type": "error", "message": f"Error de propagación: {str(e)}"})

                elif gate == "quality":
                    pending_new_model = session.get("pending_new_model")
                    pending_phase = session.get("pending_phase")

                    if not pending_new_model or not pending_phase:
                        await websocket.send_json({"type": "error", "message": "No hay cambio de calidad pendiente"})
                        continue

                    if decision == "A":
                        session["pending_new_model"] = None
                        session["pending_phase"] = None
                        session["pending_quality_report"] = None
                        save_session(session_id, session)
                        await websocket.send_json({"type": "status", "message": "❌ Edición manual cancelada."})

                    elif decision == "B":
                        await websocket.send_json({"type": "status", "message": "⏳ Corrigiendo errores de calidad..."})
                        issues = session.get("pending_quality_report", {}).get("issues", [])

                        try:
                            if pending_phase == "product":
                                model = ProductBrief.model_validate(pending_new_model)
                                fixed = fix_product_quality(model, issues)
                                fixed_dict = fixed.model_dump()
                            else:
                                model = Requirements.model_validate(pending_new_model)
                                fixed = fix_requirements_quality(model, issues)
                                fixed_dict = fixed.model_dump()

                            await _process_manual_edit_model(websocket, session_id, session, pending_phase, fixed_dict)
                        except Exception as e:
                            await websocket.send_json({"type": "error", "message": f"Error al corregir: {str(e)}"})

                    elif decision == "C":
                        await websocket.send_json({"type": "status", "message": "⚠️ Ignorando calidad, analizando impacto..."})
                        await _process_manual_edit_model(websocket, session_id, session, pending_phase, pending_new_model)

            elif action == "manual_edit":
                await websocket.send_json({"type": "status", "message": "⏳ Procesando edición manual..."})

                try:
                    if phase == "product":
                        new_model = parse_markdown_to_product(content)
                        new_model_dict = new_model.model_dump()

                        report = check_product_quality(new_model)
                        if not report.is_valid:
                            session["pending_new_model"] = new_model_dict
                            session["pending_phase"] = phase
                            session["pending_quality_report"] = report.model_dump()
                            save_session(session_id, session)

                            await websocket.send_json({
                                "type": "quality_report",
                                "report": report.model_dump(),
                                "awaiting_decision": True,
                                "options": {
                                    "A": "Cancelar",
                                    "B": "Corregir automáticamente",
                                    "C": "Ignorar"
                                }
                            })
                        else:
                            await _process_manual_edit_model(websocket, session_id, session, phase, new_model_dict)

                    elif phase == "requirements":
                        new_model = parse_markdown_to_requirements(content)
                        new_model_dict = new_model.model_dump()

                        report = check_requirements_quality(new_model)
                        if not report.is_valid:
                            session["pending_new_model"] = new_model_dict
                            session["pending_phase"] = phase
                            session["pending_quality_report"] = report.model_dump()
                            save_session(session_id, session)

                            await websocket.send_json({
                                "type": "quality_report",
                                "report": report.model_dump(),
                                "awaiting_decision": True,
                                "options": {
                                    "A": "Cancelar",
                                    "B": "Corregir automáticamente",
                                    "C": "Ignorar"
                                }
                            })
                        else:
                            await _process_manual_edit_model(websocket, session_id, session, phase, new_model_dict)

                    elif phase == "design":
                        # For design, content is directly a JSON object of class diagram design
                        sdd_state["class_diagram"] = content
                        session["sdd_state"] = sdd_state
                        save_session(session_id, session)

                        markdown, data_payload, layout = _extract_spec_data(phase, sdd_state)
                        await websocket.send_json({
                            "type": "spec_updated",
                            "phase": phase,
                            "data": data_payload,
                            "markdown": markdown,
                            "layout": layout,
                            "propagated_specs": [],
                            "flags": {
                                "productCreated": sdd_state["product_created"],
                                "requirementsCreated": sdd_state["requirements_created"],
                                "designCreated": sdd_state["design_created"]
                            }
                        })
                except Exception as e:
                    await websocket.send_json({"type": "error", "message": f"Error al parsear documento: {str(e)}"})

    except WebSocketDisconnect:
        active_connections.pop(session_id, None)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
