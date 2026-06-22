/**
 * ============================================================
 * OSPF核心算法模块 — 图论 + Dijkstra + 路由表计算
 * ============================================================
 *
 * 实现内容：
 * 1. 图数据结构（邻接表）
 * 2. Dijkstra最短路径算法
 * 3. OSPF路由表生成（每个节点的完整路由表）
 * 4. 链路状态数据库(LSDB)管理
 */

const OSPF = (function() {
    'use strict';

    // --- 图数据结构 ---

    function Graph() {
        this.nodes = new Map();       // id -> { id, label, x, y }
        this.edges = new Map();       // "from->to" -> { from, to, cost }
        this.adjList = new Map();     // nodeId -> [ { to, cost } ]
    }

    /**
     * 添加节点
     */
    Graph.prototype.addNode = function(id, label, x, y) {
        if (this.nodes.has(id)) return false;
        this.nodes.set(id, { id: id, label: label || id, x: x || 0, y: y || 0 });
        if (!this.adjList.has(id)) {
            this.adjList.set(id, []);
        }
        return true;
    };

    /**
     * 删除节点及其关联的所有边
     */
    Graph.prototype.removeNode = function(id) {
        if (!this.nodes.has(id)) return false;
        this.nodes.delete(id);
        // 删除所有涉及该节点的边
        var toDelete = [];
        this.edges.forEach(function(edge, key) {
            if (edge.from === id || edge.to === id) {
                toDelete.push(key);
            }
        });
        var self = this;
        toDelete.forEach(function(key) { self.edges.delete(key); });
        // 重建邻接表
        this._rebuildAdjList();
        return true;
    };

    /**
     * 添加边（无向图）
     */
    Graph.prototype.addEdge = function(from, to, cost) {
        if (from === to) return false;
        if (!this.nodes.has(from) || !this.nodes.has(to)) return false;
        cost = (cost === undefined || cost === null) ? 1 : Math.max(1, parseInt(cost) || 1);
        var key1 = from + '->' + to;
        var key2 = to + '->' + from;
        // 如果已存在则更新代价
        this.edges.set(key1, { from: from, to: to, cost: cost });
        this._rebuildAdjList();
        return true;
    };

    /**
     * 删除边
     */
    Graph.prototype.removeEdge = function(from, to) {
        var key1 = from + '->' + to;
        var key2 = to + '->' + from;
        var removed = false;
        if (this.edges.has(key1)) { this.edges.delete(key1); removed = true; }
        if (this.edges.has(key2)) { this.edges.delete(key2); removed = true; }
        if (removed) this._rebuildAdjList();
        return removed;
    };

    /**
     * 获取两个节点间的边（如果存在）
     */
    Graph.prototype.getEdge = function(from, to) {
        var key = from + '->' + to;
        return this.edges.get(key) || null;
    };

    /**
     * 重建邻接表
     */
    Graph.prototype._rebuildAdjList = function() {
        var self = this;
        this.adjList.clear();
        this.nodes.forEach(function(node, id) {
            self.adjList.set(id, []);
        });
        this.edges.forEach(function(edge) {
            if (self.adjList.has(edge.from)) {
                self.adjList.get(edge.from).push({ to: edge.to, cost: edge.cost });
            }
        });
    };

    /**
     * 获取邻居列表
     */
    Graph.prototype.getNeighbors = function(nodeId) {
        return this.adjList.get(nodeId) || [];
    };

    /**
     * 获取所有节点ID
     */
    Graph.prototype.getNodeIds = function() {
        return Array.from(this.nodes.keys());
    };

    /**
     * 获取节点数量
     */
    Graph.prototype.getNodeCount = function() {
        return this.nodes.size;
    };

    /**
     * 获取链路数量
     */
    Graph.prototype.getEdgeCount = function() {
        return this.edges.size;
    };

    /**
     * 清空图
     */
    Graph.prototype.clear = function() {
        this.nodes.clear();
        this.edges.clear();
        this.adjList.clear();
    };

    /**
     * 获取链路状态数据库 (LSDB)
     * 返回每条链路的信息
     */
    Graph.prototype.getLSDB = function() {
        var lsdb = [];
        var seen = new Set();
        this.edges.forEach(function(edge) {
            var key = edge.from < edge.to ? edge.from + '-' + edge.to : edge.to + '-' + edge.from;
            if (!seen.has(key)) {
                seen.add(key);
                lsdb.push({
                    router1: edge.from,
                    router2: edge.to,
                    cost: edge.cost,
                    network: edge.from + '-' + edge.to
                });
            }
        });
        return lsdb;
    };

    // --- Dijkstra算法 ---

    /**
     * 最小优先队列（二叉堆实现）
     */
    function MinPriorityQueue() {
        this.heap = [];
    }

    MinPriorityQueue.prototype.isEmpty = function() {
        return this.heap.length === 0;
    };

    MinPriorityQueue.prototype.enqueue = function(nodeId, distance) {
        this.heap.push({ id: nodeId, dist: distance });
        this._siftUp(this.heap.length - 1);
    };

    MinPriorityQueue.prototype.dequeue = function() {
        if (this.heap.length === 0) return null;
        var top = this.heap[0];
        var bottom = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = bottom;
            this._siftDown(0);
        }
        return top;
    };

    MinPriorityQueue.prototype._siftUp = function(idx) {
        var heap = this.heap;
        while (idx > 0) {
            var parent = (idx - 1) >>> 1;
            if (heap[idx].dist >= heap[parent].dist) break;
            var tmp = heap[idx]; heap[idx] = heap[parent]; heap[parent] = tmp;
            idx = parent;
        }
    };

    MinPriorityQueue.prototype._siftDown = function(idx) {
        var heap = this.heap;
        var size = heap.length;
        while (true) {
            var smallest = idx;
            var left = (idx << 1) + 1;
            var right = left + 1;
            if (left < size && heap[left].dist < heap[smallest].dist) smallest = left;
            if (right < size && heap[right].dist < heap[smallest].dist) smallest = right;
            if (smallest === idx) break;
            var tmp = heap[idx]; heap[idx] = heap[smallest]; heap[smallest] = tmp;
            idx = smallest;
        }
    };

    /**
     * Dijkstra最短路径算法
     *
     * @param {Graph} graph - 图对象
     * @param {string} sourceId - 源节点ID
     * @param {boolean} recordSteps - 是否记录计算步骤
     * @returns {object} { distances, previous, paths, steps }
     */
    function dijkstra(graph, sourceId, recordSteps) {
        if (!graph.nodes.has(sourceId)) {
            throw new Error('源节点不存在: ' + sourceId);
        }

        var distances = {};
        var previous = {};
        var visited = new Set();
        var steps = [];
        var pq = new MinPriorityQueue();

        // 初始化
        graph.nodes.forEach(function(node, id) {
            distances[id] = Infinity;
            previous[id] = null;
        });
        distances[sourceId] = 0;
        pq.enqueue(sourceId, 0);

        if (recordSteps) {
            steps.push({
                action: 'init',
                desc: '初始化: 设置所有节点距离为∞, 源节点 ' + sourceId + ' 距离=0'
            });
        }

        var stepCount = 0;
        while (!pq.isEmpty()) {
            var current = pq.dequeue();
            var u = current.id;

            if (visited.has(u)) continue;
            visited.add(u);

            stepCount++;
            if (recordSteps) {
                steps.push({
                    action: 'visit',
                    stepNum: stepCount,
                    node: u,
                    distance: distances[u],
                    desc: '步骤' + stepCount + ': 选取距离最小的节点 ' + u +
                          ' (距离=' + (distances[u] === Infinity ? '∞' : distances[u]) + ')，标记为已访问'
                });
            }

            var neighbors = graph.getNeighbors(u);
            for (var i = 0; i < neighbors.length; i++) {
                var v = neighbors[i].to;
                var cost = neighbors[i].cost;
                if (visited.has(v)) continue;

                var alt = distances[u] + cost;
                if (alt < distances[v]) {
                    var oldDist = distances[v];
                    distances[v] = alt;
                    previous[v] = u;
                    pq.enqueue(v, alt);

                    if (recordSteps) {
                        steps.push({
                            action: 'relax',
                            stepNum: stepCount,
                            from: u,
                            to: v,
                            cost: cost,
                            oldDistance: oldDist,
                            newDistance: alt,
                            desc: '  松弛边 ' + u + '→' + v + ': ' +
                                  'dist[' + v + '] = min(' +
                                  (oldDist === Infinity ? '∞' : oldDist) + ', ' +
                                  distances[u] + '+' + cost + ') = ' + alt +
                                  (alt < oldDist && oldDist !== Infinity ? ' ✨更新!' : '')
                        });
                    }
                }
            }
        }

        // 重建路径
        var paths = {};
        graph.nodes.forEach(function(node, id) {
            if (id === sourceId) {
                paths[id] = [sourceId];
            } else if (previous[id] !== null) {
                var path = [];
                var cur = id;
                while (cur !== null) {
                    path.unshift(cur);
                    cur = previous[cur];
                }
                paths[id] = path;
            } else {
                paths[id] = null; // 不可达
            }
        });

        return {
            source: sourceId,
            distances: distances,
            previous: previous,
            paths: paths,
            steps: steps
        };
    }

    /**
     * 生成单个路由器的路由表
     *
     * @param {Graph} graph - 图对象
     * @param {string} routerId - 路由器ID
     * @returns {Array} 路由表条目数组
     */
    function generateRoutingTable(graph, routerId) {
        var result = dijkstra(graph, routerId, false);
        var table = [];

        graph.nodes.forEach(function(node, id) {
            if (id === routerId) {
                // 直连路由
                table.push({
                    destination: id,
                    nextHop: '— (本地)',
                    cost: 0,
                    path: [id],
                    type: 'local'
                });
            } else if (result.paths[id]) {
                var path = result.paths[id];
                var nextHop = path.length > 1 ? path[1] : '—';
                table.push({
                    destination: id,
                    nextHop: nextHop,
                    cost: result.distances[id],
                    path: path,
                    type: (path.length === 2) ? 'direct' : 'remote'
                });
            } else {
                table.push({
                    destination: id,
                    nextHop: '不可达',
                    cost: Infinity,
                    path: null,
                    type: 'unreachable'
                });
            }
        });

        // 按代价排序
        table.sort(function(a, b) {
            if (a.cost === Infinity && b.cost === Infinity) return 0;
            if (a.cost === Infinity) return 1;
            if (b.cost === Infinity) return -1;
            return a.cost - b.cost;
        });

        return table;
    }

    /**
     * 生成所有路由器的完整路由表
     *
     * @param {Graph} graph - 图对象
     * @returns {Map} routerId -> routingTable[]
     */
    function generateAllRoutingTables(graph) {
        var allTables = new Map();
        graph.nodes.forEach(function(node, id) {
            allTables.set(id, generateRoutingTable(graph, id));
        });
        return allTables;
    }

    /**
     * 获取最短路径树中使用的边
     *
     * @param {object} dijkstraResult - Dijkstra结果
     * @returns {Array} [{ from, to }]
     */
    function getSPFEdges(dijkstraResult) {
        var edges = [];
        for (var nodeId in dijkstraResult.previous) {
            if (dijkstraResult.previous.hasOwnProperty(nodeId)) {
                var prev = dijkstraResult.previous[nodeId];
                if (prev !== null) {
                    edges.push({ from: prev, to: nodeId });
                }
            }
        }
        return edges;
    }

    // --- 公开API ---
    return {
        Graph: Graph,
        dijkstra: dijkstra,
        generateRoutingTable: generateRoutingTable,
        generateAllRoutingTables: generateAllRoutingTables,
        getSPFEdges: getSPFEdges
    };

})();
