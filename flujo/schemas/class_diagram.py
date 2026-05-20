"""Esquemas Pydantic para la fase de Design (Diagrama de Clases UML).

Basado en el schema de BESSER modeling-agent con ajustes para SDD:
- Se eliminó implementationType y code de MethodSpec (diseño ≠ implementación)
- Se eliminó add_ocl_constraint de las modificaciones (complejidad innecesaria para MVP)
- Se añadió ClassRequirementTrace y DesignPhaseOutput como envoltorio de trazabilidad
"""

from __future__ import annotations

from typing import List, Literal, Optional
from pydantic import BaseModel, Field


# ============================================================
# SCHEMAS DE CREACIÓN (generación inicial del diagrama)
# ============================================================

class MethodParameterSpec(BaseModel):
    """Parámetro de un método UML."""

    name: str = Field(
        min_length=1, max_length=50,
        description="Nombre del parámetro en camelCase"
    )
    type: str = Field(
        default="String",
        description="Tipo del parámetro: String, int, boolean, float, Date, o nombre de clase custom"
    )


class AttributeSpec(BaseModel):
    """Atributo de una clase UML."""

    name: str = Field(
        min_length=1, max_length=50,
        description="Nombre del atributo en camelCase"
    )
    type: Optional[str] = Field(
        default=None,
        description="Tipo de dato (String, int, bool, float, Date, o PascalCase clase/enum). Null para enum literals."
    )
    visibility: Literal["public", "private", "protected", "package"] = Field(
        default="public",
        description="Visibilidad UML del atributo"
    )
    isDerived: bool = Field(
        default=False,
        description="Si es un atributo derivado/calculado"
    )
    defaultValue: Optional[str] = Field(
        default=None,
        description="Valor por defecto del atributo"
    )
    isOptional: bool = Field(
        default=False,
        description="Si el atributo es opcional/nullable"
    )


class MethodSpec(BaseModel):
    """Método de una clase UML (solo firma, sin código)."""

    name: str = Field(
        min_length=1, max_length=50,
        description="Nombre del método en camelCase (ej: getName, calculateTotal)"
    )
    returnType: str = Field(
        default="void",
        description="Tipo de retorno (ej: str, int, void)"
    )
    visibility: Literal["public", "private", "protected", "package"] = Field(
        default="public",
        description="Visibilidad UML del método"
    )
    parameters: List[MethodParameterSpec] = Field(
        default_factory=list,
        description="Parámetros del método, vacío si no tiene"
    )
    isAbstract: bool = Field(
        default=False,
        description="Si es un método abstracto"
    )


class SingleClassSpec(BaseModel):
    """Una clase UML individual con atributos y métodos."""

    className: str = Field(
        min_length=1, max_length=30,
        description="Nombre de la clase en PascalCase (ej: User, Order, Payment)"
    )
    attributes: List[AttributeSpec] = Field(
        default_factory=list,
        description="Atributos de la clase"
    )
    methods: List[MethodSpec] = Field(
        default_factory=list,
        description="Métodos de la clase"
    )
    isAbstract: bool = Field(
        default=False,
        description="Si es una clase abstracta"
    )
    isEnumeration: bool = Field(
        default=False,
        description="Si es una enumeración"
    )


class RelationshipSpec(BaseModel):
    """Relación entre dos clases UML."""

    type: Literal[
        "Association", "Inheritance", "Composition",
        "Aggregation", "Realization", "Dependency",
    ] = Field(
        default="Association",
        description="Tipo de relación UML"
    )
    source: str = Field(description="Nombre de la clase origen")
    target: str = Field(description="Nombre de la clase destino")
    sourceMultiplicity: str = Field(
        default="1",
        description="Multiplicidad origen: 1, 0..1, 0..*, o 1..*"
    )
    targetMultiplicity: str = Field(
        default="*",
        description="Multiplicidad destino: 1, 0..1, 0..*, o 1..*"
    )
    name: Optional[str] = Field(
        default=None,
        description="Nombre opcional de la relación"
    )


class ClassDiagramDesign(BaseModel):
    """Diagrama de clases UML completo (compatible con SystemClassSpec de BESSER)."""

    systemName: str = Field(
        default="",
        description="Nombre descriptivo del sistema"
    )
    classes: List[SingleClassSpec] = Field(
        min_length=1,
        description="Todas las clases del sistema"
    )
    relationships: List[RelationshipSpec] = Field(
        default_factory=list,
        description="Relaciones entre las clases"
    )


# ============================================================
# TRAZABILIDAD (envoltorio, no modifica schemas de BESSER)
# ============================================================

class ClassRequirementTrace(BaseModel):
    """Vincula una clase con los requisitos que satisface."""

    class_name: str = Field(description="Nombre de la clase")
    requirement_ids: List[str] = Field(
        description="IDs de los FunctionalRequirement que esta clase implementa"
    )


class DesignPhaseOutput(BaseModel):
    """Envoltorio: diagrama de clases + trazabilidad externa.

    No modifica los schemas de BESSER. El campo 'diagram' es compatible
    directamente con SystemClassSpec para renderizado en el frontend.
    """

    diagram: ClassDiagramDesign = Field(
        description="Diagrama de clases UML completo"
    )
    traceability: List[ClassRequirementTrace] = Field(
        description="Mapeo de clases a requisitos que satisfacen"
    )


# ============================================================
# SCHEMAS DE MODIFICACIÓN (vibemodeling iterativo)
# ============================================================

class ClassModificationTarget(BaseModel):
    """Elemento objetivo de una modificación."""

    className: Optional[str] = Field(
        default=None, description="Nombre de la clase objetivo"
    )
    attributeName: Optional[str] = Field(
        default=None, description="Nombre del atributo objetivo dentro de la clase"
    )
    methodName: Optional[str] = Field(
        default=None, description="Nombre del método objetivo dentro de la clase"
    )
    sourceClass: Optional[str] = Field(
        default=None, description="Clase origen para modificaciones de relaciones"
    )
    targetClass: Optional[str] = Field(
        default=None, description="Clase destino para modificaciones de relaciones"
    )


class ClassModificationChanges(BaseModel):
    """Cambios a aplicar en una modificación."""

    name: Optional[str] = Field(
        default=None, max_length=30,
        description="Nuevo nombre (PascalCase para clases, camelCase para atributos/métodos)"
    )
    type: Optional[str] = Field(
        default=None,
        description="Nuevo tipo para atributo/parámetro"
    )
    visibility: Optional[Literal["public", "private", "protected", "package"]] = None
    returnType: Optional[str] = None
    parameters: Optional[List[MethodParameterSpec]] = None
    relationshipType: Optional[Literal[
        "Association", "Inheritance", "Composition",
        "Aggregation", "Realization", "Dependency",
    ]] = None
    sourceMultiplicity: Optional[str] = None
    targetMultiplicity: Optional[str] = None
    className: Optional[str] = Field(
        default=None, max_length=30,
        description="Nombre de clase en PascalCase para acción add_class"
    )
    attributes: Optional[List[AttributeSpec]] = Field(
        default=None, description="Atributos para acción add_class"
    )
    methods: Optional[List[MethodSpec]] = Field(
        default=None, description="Métodos para acción add_class"
    )
    isDerived: Optional[bool] = None
    defaultValue: Optional[str] = None
    isOptional: Optional[bool] = None
    isAbstract: Optional[bool] = None
    isEnumeration: Optional[bool] = None


class ClassModification(BaseModel):
    """Una modificación individual al diagrama de clases."""

    action: Literal[
        "add_class", "modify_class",
        "add_attribute", "modify_attribute",
        "add_method", "modify_method",
        "add_relationship", "modify_relationship",
        "remove_element",
        "extract_class", "split_class", "merge_classes",
        "promote_attribute", "add_enum",
    ] = Field(description="Acción a realizar")
    target: ClassModificationTarget = Field(
        description="Elemento objetivo de la modificación"
    )
    changes: Optional[ClassModificationChanges] = Field(
        default=None,
        description="Cambios a aplicar. Requerido para todas las acciones excepto remove_element."
    )


class ClassModificationResponse(BaseModel):
    """Respuesta del agente de modificación con lista de cambios."""

    modifications: List[ClassModification] = Field(
        min_length=1,
        description="Lista de modificaciones a aplicar al diagrama"
    )
