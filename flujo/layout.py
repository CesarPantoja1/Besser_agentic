"""Layout Engine para diagramas de clases UML.

Adaptado del layout_engine.py de BESSER modeling-agent.
Solo incluye las funciones necesarias para ClassDiagram.

Usa el algoritmo Sugiyama (hierarchical layout) con 4 fases:
  0. Construcción del grafo dirigido desde relaciones UML
  1. Eliminación de ciclos (DFS + back-edge reversal)
  2. Asignación de capas (longest-path + Kahn's topological sort)
  3. Minimización de cruces (barycenter heuristic)
  4. Asignación de coordenadas (pixel positions, centering, snap to grid)
"""

from __future__ import annotations

import math
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set, Tuple


# ---------------------------------------------------------------------------
# Canvas & sizing constants
# ---------------------------------------------------------------------------

_BASE_CANVAS_MIN_X = -900
_BASE_CANVAS_MAX_X = 900
_BASE_CANVAS_MIN_Y = -500
_BASE_CANVAS_MAX_Y = 500

CLASS_WIDTH = 220
CLASS_HEADER_HEIGHT = 50
CLASS_ATTR_ROW = 25
CLASS_METHOD_ROW = 25
CLASS_MIN_HEIGHT = 90

H_GAP = 100
V_GAP = 80
MARGIN = 40
GRID_SNAP = 20


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _dynamic_canvas_bounds(num_elements: int) -> tuple:
    if num_elements <= 6:
        return _BASE_CANVAS_MIN_X, _BASE_CANVAS_MAX_X, _BASE_CANVAS_MIN_Y, _BASE_CANVAS_MAX_Y
    extra = num_elements - 6
    expand_x = (extra // 4 + 1) * 300
    expand_y = (extra // 4 + 1) * 200
    return (
        _BASE_CANVAS_MIN_X - expand_x,
        _BASE_CANVAS_MAX_X + expand_x,
        _BASE_CANVAS_MIN_Y - expand_y,
        _BASE_CANVAS_MAX_Y + expand_y,
    )


@dataclass
class Rect:
    x: int
    y: int
    width: int
    height: int

    @property
    def right(self) -> int:
        return self.x + self.width

    @property
    def bottom(self) -> int:
        return self.y + self.height

    def expanded(self, margin: int) -> Rect:
        return Rect(self.x - margin, self.y - margin,
                     self.width + 2 * margin, self.height + 2 * margin)

    def overlaps(self, other: Rect) -> bool:
        return not (self.right <= other.x or other.right <= self.x or
                    self.bottom <= other.y or other.bottom <= self.y)


def _snap(value: int) -> int:
    return round(value / GRID_SNAP) * GRID_SNAP


def _collides(rect: Rect, occupied: List[Rect]) -> bool:
    expanded = rect.expanded(MARGIN)
    return any(expanded.overlaps(occ) for occ in occupied)


def estimate_class_size(spec: Dict[str, Any]) -> Tuple[int, int]:
    n_attrs = len(spec.get("attributes", []))
    n_methods = len(spec.get("methods", []))
    height = CLASS_HEADER_HEIGHT + n_attrs * CLASS_ATTR_ROW + n_methods * CLASS_METHOD_ROW
    return CLASS_WIDTH, max(height, CLASS_MIN_HEIGHT)


def _find_free_position(
    width: int,
    height: int,
    occupied: List[Rect],
    preferred_x: int = _BASE_CANVAS_MIN_X,
    preferred_y: int = _BASE_CANVAS_MIN_Y,
    canvas_bounds: Optional[Tuple[int, int, int, int]] = None,
) -> Tuple[int, int]:
    c_min_x, c_max_x, c_min_y, c_max_y = canvas_bounds or (
        _BASE_CANVAS_MIN_X, _BASE_CANVAS_MAX_X, _BASE_CANVAS_MIN_Y, _BASE_CANVAS_MAX_Y,
    )
    step_x = width + H_GAP
    step_y = height + V_GAP

    candidate = Rect(_snap(preferred_x), _snap(preferred_y), width, height)
    if not _collides(candidate, occupied):
        return candidate.x, candidate.y

    for ring in range(1, 60):
        for dx_mult in range(-ring, ring + 1):
            for dy_mult in range(-ring, ring + 1):
                if abs(dx_mult) != ring and abs(dy_mult) != ring:
                    continue
                cx = _snap(preferred_x + dx_mult * step_x)
                cy = _snap(preferred_y + dy_mult * step_y)
                if cx < c_min_x or cx + width > c_max_x:
                    continue
                if cy < c_min_y or cy + height > c_max_y:
                    continue
                candidate = Rect(cx, cy, width, height)
                if not _collides(candidate, occupied):
                    return cx, cy

    return _snap(preferred_x), _snap(preferred_y)


# ---------------------------------------------------------------------------
# Sugiyama Phase 0: Graph Construction
# ---------------------------------------------------------------------------

def _build_graph(
    class_names: Dict[str, Dict[str, Any]],
    relationships: List[Dict[str, Any]],
) -> Tuple[
    Dict[str, Set[str]],
    Dict[str, Set[str]],
    Dict[str, str],
    Dict[str, str],
    List[Tuple[str, str, int]],
]:
    successors: Dict[str, Set[str]] = defaultdict(set)
    predecessors: Dict[str, Set[str]] = defaultdict(set)
    parent_of: Dict[str, str] = {}
    owner_of: Dict[str, str] = {}
    directed_edges: List[Tuple[str, str, int]] = []

    degree: Dict[str, int] = defaultdict(int)
    for rel in relationships:
        src = rel.get("source", "")
        tgt = rel.get("target", "")
        if src in class_names and tgt in class_names:
            degree[src] += 1
            degree[tgt] += 1

    for rel in relationships:
        src = rel.get("source", "")
        tgt = rel.get("target", "")
        rtype = (rel.get("type") or "").lower()
        if src not in class_names or tgt not in class_names or src == tgt:
            continue

        if rtype in ("inheritance", "generalization"):
            parent_of[src] = tgt
            successors[tgt].add(src)
            predecessors[src].add(tgt)
            directed_edges.append((tgt, src, 0))
        elif rtype in ("composition", "aggregation"):
            owner_of[tgt] = src
            successors[src].add(tgt)
            predecessors[tgt].add(src)
            directed_edges.append((src, tgt, 1))
        else:
            if degree[src] >= degree[tgt]:
                successors[src].add(tgt)
                predecessors[tgt].add(src)
                directed_edges.append((src, tgt, 2))
            else:
                successors[tgt].add(src)
                predecessors[src].add(tgt)
                directed_edges.append((tgt, src, 2))

    return successors, predecessors, parent_of, owner_of, directed_edges


# ---------------------------------------------------------------------------
# Sugiyama Phase 1: Cycle Removal
# ---------------------------------------------------------------------------

def _remove_cycles(
    nodes: List[str],
    successors: Dict[str, Set[str]],
    predecessors: Dict[str, Set[str]],
) -> None:
    WHITE, GRAY, BLACK = 0, 1, 2
    color: Dict[str, int] = {n: WHITE for n in nodes}
    back_edges: List[Tuple[str, str]] = []

    start_order = sorted(nodes, key=lambda n: (len(predecessors.get(n, set())), n))

    for start in start_order:
        if color[start] != WHITE:
            continue
        stack: List[Tuple[str, List[str], int]] = []
        color[start] = GRAY
        neighbors = sorted(successors.get(start, set()))
        stack.append((start, neighbors, 0))

        while stack:
            node, nbrs, idx = stack[-1]
            if idx < len(nbrs):
                stack[-1] = (node, nbrs, idx + 1)
                nxt = nbrs[idx]
                if color.get(nxt, WHITE) == GRAY:
                    back_edges.append((node, nxt))
                elif color.get(nxt, WHITE) == WHITE:
                    color[nxt] = GRAY
                    nxt_nbrs = sorted(successors.get(nxt, set()))
                    stack.append((nxt, nxt_nbrs, 0))
            else:
                color[node] = BLACK
                stack.pop()

    for u, v in back_edges:
        if v in successors.get(u, set()):
            successors[u].discard(v)
            predecessors[v].discard(u)
            successors[v].add(u)
            predecessors[u].add(v)


# ---------------------------------------------------------------------------
# Sugiyama Phase 2: Layer Assignment
# ---------------------------------------------------------------------------

def _assign_layers(
    nodes: List[str],
    successors: Dict[str, Set[str]],
    predecessors: Dict[str, Set[str]],
) -> Dict[str, int]:
    in_degree: Dict[str, int] = {n: 0 for n in nodes}
    for n in nodes:
        for s in successors.get(n, set()):
            if s in in_degree:
                in_degree[s] += 1

    queue: deque = deque()
    for n in sorted(nodes):
        if in_degree[n] == 0:
            queue.append(n)

    topo_order: List[str] = []
    layer: Dict[str, int] = {}

    while queue:
        n = queue.popleft()
        topo_order.append(n)
        pred_layers = [layer[p] for p in predecessors.get(n, set()) if p in layer]
        layer[n] = (max(pred_layers) + 1) if pred_layers else 0
        for s in sorted(successors.get(n, set())):
            if s in in_degree:
                in_degree[s] -= 1
                if in_degree[s] == 0:
                    queue.append(s)

    for n in nodes:
        if n not in layer:
            layer[n] = 0

    # Compact
    for n in topo_order:
        if n not in layer:
            continue
        pred_layers = [layer[p] for p in predecessors.get(n, set()) if p in layer]
        min_allowed = (max(pred_layers) + 1) if pred_layers else 0
        layer[n] = min_allowed

    # Isolated nodes → middle layer
    max_layer = max(layer.values()) if layer else 0
    mid_layer = max_layer // 2
    for n in nodes:
        has_edges = bool(successors.get(n, set())) or bool(predecessors.get(n, set()))
        if not has_edges:
            layer[n] = mid_layer

    # Layer balancing
    max_per_layer = max(3, int(math.ceil(math.sqrt(len(nodes)))))
    layers_tmp: Dict[int, List[str]] = defaultdict(list)
    for n, li in layer.items():
        layers_tmp[li].append(n)

    changed = True
    iterations = 0
    while changed and iterations < 10:
        changed = False
        iterations += 1
        for li in sorted(layers_tmp.keys()):
            if len(layers_tmp[li]) <= max_per_layer:
                continue
            movable = []
            for n in layers_tmp[li]:
                succs_in_next = [s for s in successors.get(n, set())
                                 if layer.get(s) == li + 1]
                if not succs_in_next:
                    movable.append(n)
            if not movable:
                continue
            n_to_move = len(layers_tmp[li]) - max_per_layer
            movable.sort(key=lambda n: (
                len([p for p in predecessors.get(n, set()) if layer.get(p, -1) == li]),
                n
            ))
            moved = movable[:n_to_move]
            if not moved:
                continue
            for n2 in list(layer.keys()):
                if layer[n2] > li:
                    layer[n2] += 1
            for m in moved:
                layer[m] = li + 1
            layers_tmp = defaultdict(list)
            for n2, l2 in layer.items():
                layers_tmp[l2].append(n2)
            changed = True
            break

    return layer


# ---------------------------------------------------------------------------
# Sugiyama Phase 3: Crossing Minimization
# ---------------------------------------------------------------------------

def _minimize_crossings(
    layers: Dict[int, List[str]],
    successors: Dict[str, Set[str]],
    predecessors: Dict[str, Set[str]],
    parent_of: Dict[str, str],
    num_sweeps: int = 8,
) -> Dict[int, List[str]]:
    if not layers:
        return layers

    layer_indices = sorted(layers.keys())

    def _pos_map(ld: Dict[int, List[str]]) -> Dict[str, int]:
        pm: Dict[str, int] = {}
        for _li, nodes_in_layer in ld.items():
            for idx, nd in enumerate(nodes_in_layer):
                pm[nd] = idx
        return pm

    for sweep in range(num_sweeps):
        if sweep % 2 == 0:
            for li_idx in range(1, len(layer_indices)):
                li = layer_indices[li_idx]
                prev_li = layer_indices[li_idx - 1]
                pos = _pos_map(layers)
                barycenters: Dict[str, float] = {}
                for node in layers[li]:
                    upper = [p for p in predecessors.get(node, set())
                             if p in pos and p in set(layers.get(prev_li, []))]
                    if upper:
                        barycenters[node] = sum(pos[p] for p in upper) / len(upper)
                    else:
                        barycenters[node] = float(pos.get(node, 0))
                layers[li] = sorted(layers[li], key=lambda nd: barycenters.get(nd, 0.0))
        else:
            for li_idx in range(len(layer_indices) - 2, -1, -1):
                li = layer_indices[li_idx]
                next_li = layer_indices[li_idx + 1]
                pos = _pos_map(layers)
                barycenters: Dict[str, float] = {}
                for node in layers[li]:
                    lower = [s for s in successors.get(node, set())
                             if s in pos and s in set(layers.get(next_li, []))]
                    if lower:
                        barycenters[node] = sum(pos[s] for s in lower) / len(lower)
                    else:
                        barycenters[node] = float(pos.get(node, 0))
                layers[li] = sorted(layers[li], key=lambda nd: barycenters.get(nd, 0.0))

    # Group inheritance siblings
    children_of: Dict[str, List[str]] = defaultdict(list)
    for child, parent in parent_of.items():
        children_of[parent].append(child)

    for li in layer_indices:
        current = layers[li]
        sibling_groups: Dict[str, List[str]] = defaultdict(list)
        for node in current:
            p = parent_of.get(node)
            if p and p in children_of:
                sibling_groups[p].append(node)

        if not sibling_groups:
            continue

        pos = _pos_map(layers)
        for parent, children in sibling_groups.items():
            if len(children) < 2:
                continue
            parent_pos = pos.get(parent, 0)
            others = [n for n in current if n not in children]
            best_insert = 0
            if others:
                for i in range(len(others) + 1):
                    best_insert = i
                    if i < len(others) and pos.get(others[i], 0) > parent_pos:
                        break
            children_sorted = sorted(children, key=lambda c: pos.get(c, 0))
            new_layer = others[:best_insert] + children_sorted + others[best_insert:]
            layers[li] = new_layer

    return layers


# ---------------------------------------------------------------------------
# Sugiyama Phase 4: Coordinate Assignment
# ---------------------------------------------------------------------------

def _assign_coordinates(
    layers: Dict[int, List[str]],
    sizes: Dict[str, Tuple[int, int]],
    parent_of: Dict[str, str],
    owner_of: Dict[str, str],
    default_size: Tuple[int, int],
    successors: Dict[str, Set[str]],
    predecessors: Dict[str, Set[str]],
) -> Dict[str, Tuple[int, int]]:
    if not layers:
        return {}

    h_gap = 60
    v_gap = 50
    layer_indices = sorted(layers.keys())

    # Per-layer heights
    layer_heights: Dict[int, int] = {}
    for li in layer_indices:
        max_h = 0
        for node in layers[li]:
            _, h = sizes.get(node, default_size)
            max_h = max(max_h, h)
        layer_heights[li] = max_h

    # Y offsets
    layer_y: Dict[int, int] = {}
    cum_y = 0
    for li in layer_indices:
        layer_y[li] = cum_y
        cum_y += layer_heights[li] + v_gap

    # X positions
    positions: Dict[str, Tuple[int, int]] = {}
    layer_widths: Dict[int, int] = {}

    for li in layer_indices:
        nodes = layers[li]
        if not nodes:
            continue
        layer_h_gap = h_gap if len(nodes) <= 3 else max(30, h_gap - (len(nodes) - 3) * 8)
        x_positions: List[int] = []
        cur_x = 0
        for node in nodes:
            w, _ = sizes.get(node, default_size)
            x_positions.append(cur_x)
            cur_x += w + layer_h_gap
        last_w, _ = sizes.get(nodes[-1], default_size)
        total_layer_width = x_positions[-1] + last_w if x_positions else 0
        layer_widths[li] = total_layer_width

        for idx, node in enumerate(nodes):
            _, h = sizes.get(node, default_size)
            y_offset = (layer_heights[li] - h) // 2
            positions[node] = (x_positions[idx], layer_y[li] + y_offset)

    # Center layers
    max_width = max(layer_widths.values()) if layer_widths else 0
    for li in layer_indices:
        lw = layer_widths.get(li, 0)
        offset = (max_width - lw) // 2
        for node in layers[li]:
            old_x, old_y = positions[node]
            positions[node] = (old_x + offset, old_y)

    # Shift inheritance children under parent
    children_of: Dict[str, List[str]] = defaultdict(list)
    for child, parent in parent_of.items():
        if child in positions and parent in positions:
            children_of[parent].append(child)

    for parent, children in children_of.items():
        if not children:
            continue
        parent_x, _ = positions[parent]
        parent_w, _ = sizes.get(parent, default_size)
        parent_center = parent_x + parent_w // 2
        child_xs = [positions[c][0] for c in children]
        child_ws = [sizes.get(c, default_size)[0] for c in children]
        children_min_x = min(child_xs)
        children_max_x = max(child_xs[i] + child_ws[i] for i in range(len(children)))
        children_center = (children_min_x + children_max_x) // 2
        shift = parent_center - children_center
        if abs(shift) > 5:
            child_layer = None
            for li, ns in layers.items():
                if children[0] in ns:
                    child_layer = li
                    break
            if child_layer is not None:
                layer_nodes = layers[child_layer]
                child_set = set(children)
                can_shift = True
                for c in children:
                    new_cx = positions[c][0] + shift
                    cw, _ = sizes.get(c, default_size)
                    for other in layer_nodes:
                        if other in child_set:
                            continue
                        other_x, _ = positions[other]
                        other_w, _ = sizes.get(other, default_size)
                        if new_cx < other_x + other_w + h_gap and new_cx + cw + h_gap > other_x:
                            can_shift = False
                            break
                    if not can_shift:
                        break
                if can_shift:
                    for c in children:
                        old_x, old_y = positions[c]
                        positions[c] = (old_x + shift, old_y)

    # Overlap resolution
    for li in layer_indices:
        layer_nodes = [n for n in layers[li] if n in positions]
        if len(layer_nodes) < 2:
            continue
        layer_nodes.sort(key=lambda n: positions[n][0])
        for idx in range(1, len(layer_nodes)):
            prev_name = layer_nodes[idx - 1]
            curr_name = layer_nodes[idx]
            prev_x, _ = positions[prev_name]
            curr_x, curr_y = positions[curr_name]
            prev_w = sizes.get(prev_name, default_size)[0]
            needed_x = prev_x + prev_w + h_gap
            if curr_x < needed_x:
                positions[curr_name] = (needed_x, curr_y)

    # Center entire layout on origin
    if positions:
        all_xs = [x for x, _ in positions.values()]
        all_ys = [y for _, y in positions.values()]
        all_ws = [sizes.get(n, default_size)[0] for n in positions]
        all_hs = [sizes.get(n, default_size)[1] for n in positions]
        min_x = min(all_xs)
        max_x = max(all_xs[i] + all_ws[i] for i in range(len(all_xs)))
        min_y = min(all_ys)
        max_y = max(all_ys[i] + all_hs[i] for i in range(len(all_ys)))
        center_x = (min_x + max_x) // 2
        center_y = (min_y + max_y) // 2
        for node in list(positions.keys()):
            old_x, old_y = positions[node]
            positions[node] = (_snap(old_x - center_x), _snap(old_y - center_y))

    return positions


# ---------------------------------------------------------------------------
# Edge direction computation
# ---------------------------------------------------------------------------

def _compute_edge_directions(
    relationships: List[Dict[str, Any]],
    element_info: Dict[str, Tuple[Dict[str, Any], Tuple[int, int]]],
) -> None:
    for edge in relationships:
        src_name = edge.get("source", "")
        tgt_name = edge.get("target", "")
        src_info = element_info.get(src_name)
        tgt_info = element_info.get(tgt_name)
        if not src_info or not tgt_info:
            continue

        src_pos, (src_w, src_h) = src_info
        tgt_pos, (tgt_w, tgt_h) = tgt_info

        src_cx = src_pos.get("x", 0) + src_w / 2
        src_cy = src_pos.get("y", 0) + src_h / 2
        tgt_cx = tgt_pos.get("x", 0) + tgt_w / 2
        tgt_cy = tgt_pos.get("y", 0) + tgt_h / 2

        dx = tgt_cx - src_cx
        dy = tgt_cy - src_cy

        etype = (edge.get("type") or "").lower()
        if etype in ("inheritance", "generalization"):
            if dy < 0:
                edge["sourceDirection"] = "Up"
                edge["targetDirection"] = "Down"
            else:
                edge["sourceDirection"] = "Down"
                edge["targetDirection"] = "Up"
        else:
            if abs(dx) >= abs(dy):
                if dx >= 0:
                    edge["sourceDirection"] = "Right"
                    edge["targetDirection"] = "Left"
                else:
                    edge["sourceDirection"] = "Left"
                    edge["targetDirection"] = "Right"
            else:
                if dy >= 0:
                    edge["sourceDirection"] = "Down"
                    edge["targetDirection"] = "Up"
                else:
                    edge["sourceDirection"] = "Up"
                    edge["targetDirection"] = "Down"


# ============================================================
# FUNCIÓN PÚBLICA: layout_class_diagram
# ============================================================

def layout_class_diagram(diagram_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Aplica layout Sugiyama al diagrama de clases.

    Recibe el dict del ClassDiagramDesign (classes + relationships)
    y retorna una COPIA con 'position' en cada clase y
    'sourceDirection'/'targetDirection' en cada relación.
    """
    import copy
    result = copy.deepcopy(diagram_dict)

    classes: List[Dict[str, Any]] = result.get("classes", [])
    relationships: List[Dict[str, Any]] = result.get("relationships", [])

    if not classes:
        return result

    n_classes = len(classes)
    canvas_bounds = _dynamic_canvas_bounds(n_classes)

    # Build lookup
    class_names: Dict[str, Dict[str, Any]] = {
        c.get("className", ""): c for c in classes
    }
    all_nodes = list(class_names.keys())

    # Compute element sizes
    sizes: Dict[str, Tuple[int, int]] = {}
    for c in classes:
        name = c.get("className", "")
        sizes[name] = estimate_class_size(c)

    # Phase 0: Graph Construction
    successors, predecessors, parent_of, owner_of, directed_edges = \
        _build_graph(class_names, relationships)

    # Phase 1: Cycle Removal
    _remove_cycles(all_nodes, successors, predecessors)

    # Phase 2: Layer Assignment
    node_layer = _assign_layers(all_nodes, successors, predecessors)
    layers: Dict[int, List[str]] = defaultdict(list)
    for node, li in node_layer.items():
        layers[li].append(node)
    for li in layers:
        layers[li] = sorted(layers[li])

    # Phase 3: Crossing Minimization
    layers = _minimize_crossings(
        layers, successors, predecessors, parent_of, num_sweeps=8,
    )

    # Phase 4: Coordinate Assignment
    positions = _assign_coordinates(
        layers, sizes, parent_of, owner_of,
        default_size=(CLASS_WIDTH, CLASS_MIN_HEIGHT),
        successors=successors,
        predecessors=predecessors,
    )

    # Place elements with collision avoidance
    occupied: List[Rect] = []
    for name, (px, py) in positions.items():
        spec = class_names.get(name)
        if not spec:
            continue
        w, h = sizes.get(name, (CLASS_WIDTH, CLASS_MIN_HEIGHT))
        x, y = _find_free_position(
            w, h, occupied,
            preferred_x=px, preferred_y=py,
            canvas_bounds=canvas_bounds,
        )
        spec["position"] = {"x": x, "y": y}
        occupied.append(Rect(x, y, w, h))

    # Compute edge directions
    _compute_edge_directions(
        relationships,
        {name: (spec.get("position", {}), sizes.get(name, (CLASS_WIDTH, CLASS_MIN_HEIGHT)))
         for name, spec in class_names.items()},
    )

    return result
