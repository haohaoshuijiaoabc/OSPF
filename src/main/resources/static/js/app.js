/**
 * ============================================================
 * OSPF仿真系统 — 前端交互与可视化
 *
 * 所有算法逻辑（Dijkstra、路由表、LSDB）由后端Java API提供
 * 前端负责Canvas可视化与用户交互
 * ============================================================
 */

(function() {
    'use strict';

    // =================== 本地拓扑缓存（用于Canvas渲染） ===================
    var localNodes = {};    // id -> { id, label, x, y }
    var localEdges = {};    // "from->to" -> { from, to, cost }

    var appState = {
        mode: 'addnode',
        addEdgeFirstNode: null,
        selectedNode: null,
        dragNode: null,
        dragOffsetX: 0,
        dragOffsetY: 0,
        spfResult: null,
        spfEdges: [],
        allRoutingTables: null,
        canvasWidth: 0,
        canvasHeight: 0,
        hoveredNode: null,
        mouseX: 0,
        mouseY: 0
    };

    // =================== DOM ===================
    var dom = {};

    function cacheDom() {
        dom.canvas = document.getElementById('topology-canvas');
        dom.ctx = dom.canvas.getContext('2d');
        dom.canvasHint = document.getElementById('canvas-hint');
        dom.statusIndicator = document.getElementById('status-indicator');
        dom.sourceSelect = document.getElementById('source-node-select');
        dom.edgeCostInput = document.getElementById('edge-cost');
        dom.addEdgeControls = document.getElementById('addedge-controls');
        dom.routingTableContainer = document.getElementById('routing-table-container');
        dom.stepsContainer = document.getElementById('steps-container');
        dom.lsdbContainer = document.getElementById('lsdb-container');
        dom.footerNodes = document.getElementById('footer-nodes');
        dom.footerEdges = document.getElementById('footer-edges');
        dom.footerMode = document.getElementById('footer-mode');
        dom.costModal = document.getElementById('cost-modal');
        dom.costModalInfo = document.getElementById('cost-modal-info');
        dom.costModalInput = document.getElementById('cost-modal-input');
        dom.showStep = document.getElementById('show-step');
    }

    // =================== Canvas 绘图（与之前一致） ===================

    var COLORS = {
        nodeFill: '#3498db', nodeStroke: '#2980b9', nodeText: '#ffffff',
        nodeSelected: '#e74c3c', nodeSource: '#27ae60', nodeHover: '#5dade2',
        edgeLine: '#95a5a6', edgeText: '#2c3e50',
        spfEdge: '#2ecc71', spfEdgeWide: 'rgba(46, 204, 113, 0.3)',
        gridLine: '#eef0f2', shadowColor: 'rgba(0,0,0,0.15)'
    };

    var NODE_RADIUS = 25;
    var EDGE_TEXT_OFFSET = 16;

    function resizeCanvas() {
        var wrapper = document.getElementById('canvas-wrapper');
        var rect = wrapper.getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;
        var w = rect.width, h = rect.height;
        if (w !== appState.canvasWidth || h !== appState.canvasHeight) {
            appState.canvasWidth = w;
            appState.canvasHeight = h;
            dom.canvas.width = w * dpr;
            dom.canvas.height = h * dpr;
            dom.canvas.style.width = w + 'px';
            dom.canvas.style.height = h + 'px';
            dom.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
    }

    function draw() {
        resizeCanvas();
        var ctx = dom.ctx;
        var w = appState.canvasWidth, h = appState.canvasHeight;
        ctx.clearRect(0, 0, w, h);
        drawGrid(ctx, w, h);

        // SPF边集合
        var spfEdgeSet = {};
        if (appState.spfEdges) {
            appState.spfEdges.forEach(function(e) {
                spfEdgeSet[e.from + '->' + e.to] = true;
                spfEdgeSet[e.to + '->' + e.from] = true;
            });
        }

        // 绘边
        var drawnEdges = {};
        Object.keys(localEdges).forEach(function(key) {
            var edge = localEdges[key];
            var pairKey = edge.from < edge.to ? edge.from + '->' + edge.to : edge.to + '->' + edge.from;
            if (drawnEdges[pairKey]) return;
            drawnEdges[pairKey] = true;

            var nodeA = localNodes[edge.from];
            var nodeB = localNodes[edge.to];
            if (!nodeA || !nodeB) return;

            drawEdge(ctx, nodeA, nodeB, edge.cost, spfEdgeSet[key]);
        });

        // 添加链路临时线
        if (appState.mode === 'addedge' && appState.addEdgeFirstNode) {
            var firstNode = localNodes[appState.addEdgeFirstNode];
            if (firstNode) {
                ctx.save();
                ctx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.moveTo(firstNode.x, firstNode.y);
                ctx.lineTo(appState.mouseX || firstNode.x + 50, appState.mouseY || firstNode.y + 50);
                ctx.stroke();
                ctx.restore();
            }
        }

        // 绘节点
        Object.keys(localNodes).forEach(function(id) {
            var node = localNodes[id];
            var isSelected = (appState.selectedNode === id);
            var isSource = (appState.spfResult && appState.spfResult.source === id);
            var isAddEdgeFirst = (appState.mode === 'addedge' && appState.addEdgeFirstNode === id);
            var isHovered = (appState.hoveredNode === id);
            drawNode(ctx, node, isSelected || isAddEdgeFirst, isSource, isHovered);
        });

        // 提示
        var count = Object.keys(localNodes).length;
        if (count > 0) {
            dom.canvasHint.classList.add('canvas-hint-hidden');
        } else {
            dom.canvasHint.classList.remove('canvas-hint-hidden');
        }
    }

    function drawGrid(ctx, w, h) {
        ctx.strokeStyle = COLORS.gridLine;
        ctx.lineWidth = 0.5;
        for (var x = 40; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (var y = 40; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    }

    function drawNode(ctx, node, isSelected, isSource, isHovered) {
        var r = NODE_RADIUS;
        if (isSelected || isHovered) {
            ctx.shadowColor = COLORS.shadowColor;
            ctx.shadowBlur = 12;
            ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 2;
        }
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);

        if (isSource) {
            var g1 = ctx.createRadialGradient(node.x - r/3, node.y - r/3, r/5, node.x, node.y, r);
            g1.addColorStop(0, '#2ecc71'); g1.addColorStop(1, '#27ae60');
            ctx.fillStyle = g1;
        } else if (isSelected) {
            var g2 = ctx.createRadialGradient(node.x - r/3, node.y - r/3, r/5, node.x, node.y, r);
            g2.addColorStop(0, '#f08080'); g2.addColorStop(1, COLORS.nodeSelected);
            ctx.fillStyle = g2;
        } else {
            var g3 = ctx.createRadialGradient(node.x - r/3, node.y - r/3, r/5, node.x, node.y, r);
            g3.addColorStop(0, '#5dade2'); g3.addColorStop(1, COLORS.nodeFill);
            ctx.fillStyle = g3;
        }
        ctx.fill();
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
        ctx.strokeStyle = isSelected ? '#c0392b' : (isSource ? '#219a52' : COLORS.nodeStroke);
        ctx.lineWidth = isSelected || isSource ? 3 : 2;
        ctx.stroke();
        if (isHovered && !isSelected && !isSource) {
            ctx.strokeStyle = COLORS.nodeHover; ctx.lineWidth = 3; ctx.stroke();
        }
        ctx.fillStyle = COLORS.nodeText;
        ctx.font = 'bold 13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(node.label, node.x, node.y);

        if (isSource) {
            ctx.font = 'bold 10px sans-serif';
            var tw = ctx.measureText('SRC').width;
            ctx.fillStyle = COLORS.nodeSource;
            roundRect(ctx, node.x - tw/2 - 5, node.y - r - 18, tw + 10, 16, 4, true, false);
            ctx.fillStyle = '#fff';
            ctx.fillText('SRC', node.x, node.y - r - 10);
        }
    }

    function drawEdge(ctx, nodeA, nodeB, cost, isSPF) {
        if (isSPF) {
            ctx.strokeStyle = COLORS.spfEdgeWide; ctx.lineWidth = 8;
            ctx.beginPath(); ctx.moveTo(nodeA.x, nodeA.y); ctx.lineTo(nodeB.x, nodeB.y); ctx.stroke();
        }
        ctx.strokeStyle = isSPF ? COLORS.spfEdge : COLORS.edgeLine;
        ctx.lineWidth = isSPF ? 3 : 2;
        ctx.beginPath(); ctx.moveTo(nodeA.x, nodeA.y); ctx.lineTo(nodeB.x, nodeB.y); ctx.stroke();

        var mx = (nodeA.x + nodeB.x) / 2, my = (nodeA.y + nodeB.y) / 2;
        var dx = nodeB.x - nodeA.x, dy = nodeB.y - nodeA.y;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) { mx += (-dy / len) * EDGE_TEXT_OFFSET; my += (dx / len) * EDGE_TEXT_OFFSET; }

        var text = String(cost);
        ctx.font = 'bold 12px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        var tw = ctx.measureText(text).width;
        ctx.fillStyle = isSPF ? 'rgba(46, 204, 113, 0.9)' : 'rgba(255, 255, 255, 0.92)';
        ctx.strokeStyle = isSPF ? '#27ae60' : '#ccc'; ctx.lineWidth = 1;
        roundRect(ctx, mx - tw/2 - 5, my - 8, tw + 10, 16, 8, true, true);
        ctx.fillStyle = isSPF ? '#fff' : COLORS.edgeText;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, mx, my);
    }

    function roundRect(ctx, x, y, w, h, r, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
        if (fill) ctx.fill();
        if (stroke) ctx.stroke();
    }

    // =================== 碰撞检测 ===================

    function hitTestNode(mx, my) {
        var hit = null;
        Object.keys(localNodes).forEach(function(id) {
            var node = localNodes[id];
            if (Math.hypot(mx - node.x, my - node.y) <= NODE_RADIUS + 4) hit = id;
        });
        return hit;
    }

    function hitTestEdge(mx, my) {
        var hit = null, minDist = 12;
        var drawnEdges = {};
        Object.keys(localEdges).forEach(function(key) {
            var edge = localEdges[key];
            var pairKey = edge.from < edge.to ? edge.from + '->' + edge.to : edge.to + '->' + edge.from;
            if (drawnEdges[pairKey]) return;
            drawnEdges[pairKey] = true;
            var nodeA = localNodes[edge.from], nodeB = localNodes[edge.to];
            if (!nodeA || !nodeB) return;
            var dist = pointToSegDist(mx, my, nodeA.x, nodeA.y, nodeB.x, nodeB.y);
            if (dist < minDist) { minDist = dist; hit = { from: edge.from, to: edge.to }; }
        });
        return hit;
    }

    function pointToSegDist(px, py, ax, ay, bx, by) {
        var dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.hypot(px - ax, py - ay);
        var t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }

    // =================== 同步后端拓扑到本地缓存 ===================

    function syncLocalTopology(data) {
        localNodes = {};
        localEdges = {};
        if (data.nodes) {
            data.nodes.forEach(function(n) { localNodes[n.id] = n; });
        }
        if (data.edges) {
            data.edges.forEach(function(e) { localEdges[e.from + '->' + e.to] = e; });
        }
    }

    function refreshTopology() {
        return OSPF_API.getTopology().then(function(data) {
            syncLocalTopology(data);
            updateUI();
            draw();
        });
    }

    // =================== Canvas事件 ===================

    function getCanvasPos(e) {
        var rect = dom.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onCanvasMouseDown(e) {
        if (e.button !== 0) return;
        var pos = getCanvasPos(e);
        var hitNode = hitTestNode(pos.x, pos.y);

        switch (appState.mode) {
            case 'select':
                if (hitNode) {
                    appState.dragNode = hitNode;
                    appState.dragOffsetX = localNodes[hitNode].x - pos.x;
                    appState.dragOffsetY = localNodes[hitNode].y - pos.y;
                    selectNode(hitNode);
                } else {
                    deselectNode();
                }
                break;

            case 'addnode':
                if (!hitNode) {
                    var newId = getNextNodeId();
                    var label = getNextNodeLabel();
                    OSPF_API.addNode(newId, label, pos.x, pos.y).then(function() {
                        return refreshTopology();
                    }).catch(function(err) {
                        alert('添加节点失败: ' + err.message);
                    });
                }
                break;

            case 'addedge':
                if (hitNode) {
                    if (appState.addEdgeFirstNode === null) {
                        appState.addEdgeFirstNode = hitNode;
                        selectNode(hitNode);
                        draw();
                    } else if (hitNode !== appState.addEdgeFirstNode) {
                        var cost = parseInt(dom.edgeCostInput.value) || 1;
                        var fromNode = appState.addEdgeFirstNode;
                        OSPF_API.addEdge(fromNode, hitNode, cost).then(function() {
                            appState.addEdgeFirstNode = null;
                            deselectNode();
                            return refreshTopology();
                        }).catch(function(err) {
                            alert('添加链路失败: ' + err.message);
                            appState.addEdgeFirstNode = null;
                        });
                    } else {
                        appState.addEdgeFirstNode = null;
                        deselectNode();
                        draw();
                    }
                }
                break;

            case 'delete':
                if (hitNode) {
                    OSPF_API.removeNode(hitNode).then(function() {
                        if (appState.selectedNode === hitNode) deselectNode();
                        if (appState.addEdgeFirstNode === hitNode) appState.addEdgeFirstNode = null;
                        return refreshTopology();
                    }).catch(function(err) {
                        alert('删除失败: ' + err.message);
                    });
                } else {
                    var hitEdge = hitTestEdge(pos.x, pos.y);
                    if (hitEdge) {
                        OSPF_API.removeEdge(hitEdge.from, hitEdge.to).then(function() {
                            return refreshTopology();
                        }).catch(function(err) {
                            alert('删除链路失败: ' + err.message);
                        });
                    }
                }
                break;
        }
    }

    function onCanvasMouseMove(e) {
        var pos = getCanvasPos(e);
        appState.mouseX = pos.x;
        appState.mouseY = pos.y;

        if (appState.dragNode && localNodes[appState.dragNode]) {
            var node = localNodes[appState.dragNode];
            node.x = Math.max(NODE_RADIUS, Math.min(appState.canvasWidth - NODE_RADIUS, pos.x + appState.dragOffsetX));
            node.y = Math.max(NODE_RADIUS, Math.min(appState.canvasHeight - NODE_RADIUS, pos.y + appState.dragOffsetY));
            draw();
        } else {
            var hitNode = hitTestNode(pos.x, pos.y);
            if (hitNode !== appState.hoveredNode) {
                appState.hoveredNode = hitNode;
                if (appState.mode === 'select')
                    dom.canvas.style.cursor = hitNode ? 'grab' : 'default';
                else if (appState.mode === 'addnode')
                    dom.canvas.style.cursor = hitNode ? 'default' : 'crosshair';
                else if (appState.mode === 'addedge')
                    dom.canvas.style.cursor = hitNode ? 'pointer' : 'default';
                else if (appState.mode === 'delete')
                    dom.canvas.style.cursor = hitNode ? 'pointer' : 'default';
                draw();
            }
        }
        if (appState.mode === 'addedge' && appState.addEdgeFirstNode) draw();
    }

    function onCanvasMouseUp(e) {
        if (appState.dragNode) {
            appState.dragNode = null;
            dom.canvas.style.cursor = (appState.mode === 'select') ? 'default' : 'crosshair';
        }
    }

    function onCanvasDblClick(e) {
        var pos = getCanvasPos(e);
        var hitEdge = hitTestEdge(pos.x, pos.y);
        if (hitEdge) showCostModal(hitEdge.from, hitEdge.to);
    }

    // =================== UI更新 ===================

    function updateUI() {
        var prevVal = dom.sourceSelect.value;
        dom.sourceSelect.innerHTML = '<option value="">-- 选择源节点 --</option>';
        var ids = Object.keys(localNodes).sort(function(a, b) {
            var na = parseInt(a), nb = parseInt(b);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return a.localeCompare(b);
        });
        ids.forEach(function(id) {
            dom.sourceSelect.innerHTML += '<option value="' + id + '">路由器 ' + localNodes[id].label + '</option>';
        });
        if (localNodes[prevVal]) dom.sourceSelect.value = prevVal;

        dom.footerNodes.textContent = Object.keys(localNodes).length;
        dom.footerEdges.textContent = Object.keys(localEdges).length;

        // LSDB from backend
        OSPF_API.getLSDB().then(function(lsdb) {
            renderLSDB(lsdb);
        }).catch(function() {});
    }

    function renderLSDB(lsdb) {
        if (!lsdb || lsdb.length === 0) {
            dom.lsdbContainer.innerHTML = '<p class="placeholder-text">当前无链路，请添加节点和链路</p>';
            return;
        }
        var html = '<div style="max-height:160px;overflow-y:auto;">';
        html += '<table class="lsdb-table"><thead><tr><th>网络</th><th>路由器A</th><th>路由器B</th><th>代价</th></tr></thead><tbody>';
        lsdb.forEach(function(e) {
            html += '<tr><td>Net-' + e.network + '</td>';
            html += '<td>' + (localNodes[e.router1] ? localNodes[e.router1].label : e.router1) + '</td>';
            html += '<td>' + (localNodes[e.router2] ? localNodes[e.router2].label : e.router2) + '</td>';
            html += '<td><b>' + e.cost + '</b></td></tr>';
        });
        html += '</tbody></table></div>';
        dom.lsdbContainer.innerHTML = html;
    }

    function selectNode(nodeId) {
        appState.selectedNode = nodeId;
        dom.sourceSelect.value = nodeId;
    }

    function deselectNode() {
        appState.selectedNode = null;
    }

    function getNextNodeId() {
        var maxId = 0;
        Object.keys(localNodes).forEach(function(id) {
            var n = parseInt(id);
            if (!isNaN(n) && n > maxId) maxId = n;
        });
        return String(maxId + 1);
    }

    function getNextNodeLabel() {
        var maxNum = 0;
        Object.keys(localNodes).forEach(function(id) {
            var m = localNodes[id].label.match(/^R(\d+)$/);
            if (m) { var n = parseInt(m[1]); if (n > maxNum) maxNum = n; }
        });
        return 'R' + (maxNum + 1);
    }

    // =================== 模式切换 ===================

    function setMode(mode) {
        appState.mode = mode;
        appState.addEdgeFirstNode = null;
        deselectNode();

        document.querySelectorAll('.btn-mode').forEach(function(btn) { btn.classList.remove('active'); });
        var ab = document.querySelector('.btn-mode[data-mode="' + mode + '"]');
        if (ab) ab.classList.add('active');
        dom.addEdgeControls.style.display = (mode === 'addedge') ? 'block' : 'none';

        if (mode === 'select') dom.canvas.style.cursor = 'default';
        else if (mode === 'addnode') dom.canvas.style.cursor = 'crosshair';
        else if (mode === 'addedge') dom.canvas.style.cursor = 'default';
        else if (mode === 'delete') dom.canvas.style.cursor = 'pointer';

        var names = { 'select': '选择/移动', 'addnode': '添加节点', 'addedge': '添加链路', 'delete': '删除' };
        dom.footerMode.textContent = names[mode] || mode;
        draw();
    }

    // =================== Dijkstra（调用后端API） ===================

    function runDijkstra() {
        var sourceId = dom.sourceSelect.value;
        if (!sourceId || !localNodes[sourceId]) {
            alert('请先在左侧面板中选择一个源节点！');
            return;
        }
        if (Object.keys(localEdges).length === 0) {
            alert('请先添加至少一条链路！');
            return;
        }

        setStatus('running', '● 后端计算中...');

        var recordSteps = dom.showStep.checked;
        OSPF_API.runDijkstra(sourceId, recordSteps).then(function(result) {
            appState.spfResult = result;
            appState.spfEdges = result.spfEdges || [];

            // 显示路由表
            if (result.routingTable) {
                showRoutingTable(result.routingTable, sourceId);
            }

            // 显示步骤
            if (recordSteps && result.steps) {
                showSteps(result.steps);
            } else {
                dom.stepsContainer.innerHTML = '<p class="placeholder-text">步骤显示已关闭</p>';
            }

            draw();
            setStatus('done', '● 计算完成 (Java后端Dijkstra) - 绿色=SPF最短路径树');
        }).catch(function(err) {
            alert('Dijkstra计算失败: ' + err.message);
            setStatus('ready', '● 就绪');
        });
    }

    function runAllRoutingTables() {
        if (Object.keys(localNodes).length === 0) {
            alert('请先添加节点和链路！');
            return;
        }
        setStatus('running', '● 后端计算全部路由表...');

        OSPF_API.getAllRoutingTables().then(function(allTables) {
            appState.allRoutingTables = allTables;
            var html = '';
            Object.keys(allTables).forEach(function(id) {
                var table = allTables[id];
                var node = localNodes[id];
                html += '<div style="margin-bottom:12px;">';
                html += '<span class="routing-source-tag">路由器: ' + (node ? node.label : id) + ' (ID:' + id + ')</span>';
                html += '<div class="routing-table-wrapper"><table class="routing-table"><thead><tr>';
                html += '<th>目的</th><th>下一跳</th><th>代价</th><th>路径</th>';
                html += '</tr></thead><tbody>';
                table.forEach(function(entry) {
                    var nextHopClass = (entry.type === 'direct') ? 'next-hop-direct' : '';
                    var costDisplay = entry.cost >= 2147483647 ? '∞' : entry.cost;
                    var pathDisplay = entry.path ? entry.path.join(' → ') : '—';
                    html += '<tr><td><b>' + entry.destination + '</b></td>';
                    html += '<td class="' + nextHopClass + '">' + entry.nextHop + '</td>';
                    html += '<td>' + costDisplay + '</td>';
                    html += '<td style="font-size:11px;color:#888;">' + pathDisplay + '</td></tr>';
                });
                html += '</tbody></table></div></div>';
            });
            dom.routingTableContainer.innerHTML = html;
            dom.stepsContainer.innerHTML = '<p class="placeholder-text">全部路由表已通过Java后端生成</p>';
            setStatus('done', '● 全部路由表计算完成 (Java后端)');
        }).catch(function(err) {
            alert('计算失败: ' + err.message);
            setStatus('ready', '● 就绪');
        });
    }

    function showRoutingTable(table, sourceId) {
        var node = localNodes[sourceId];
        var html = '<span class="routing-source-tag">源: ' + (node ? node.label : sourceId) + ' (ID:' + sourceId + ')</span>';
        html += '<div class="routing-table-wrapper"><table class="routing-table"><thead><tr>';
        html += '<th>目的</th><th>下一跳</th><th>代价</th><th>路径</th></tr></thead><tbody>';
        table.forEach(function(entry) {
            var nextHopClass = (entry.type === 'direct') ? 'next-hop-direct' : '';
            var costDisplay = entry.cost >= 2147483647 ? '∞' : entry.cost;
            var pathDisplay = entry.path ? entry.path.join(' → ') : '—';
            html += '<tr><td><b>' + entry.destination + '</b></td>';
            html += '<td class="' + nextHopClass + '">' + entry.nextHop + '</td>';
            html += '<td>' + costDisplay + '</td>';
            html += '<td style="font-size:11px;color:#888;">' + pathDisplay + '</td></tr>';
        });
        html += '</tbody></table></div>';
        dom.routingTableContainer.innerHTML = html;
    }

    function showSteps(steps) {
        var html = '<div class="steps-list">';
        steps.forEach(function(step) {
            html += '<div class="step-item">';
            if (step.stepNum) html += '<span class="step-num">' + step.stepNum + '</span>';
            if (step.action === 'visit') html += '<span class="step-action">[访问]</span> ';
            else if (step.action === 'relax') html += '<span class="step-action">[松弛]</span> ';
            else html += '<span class="step-action">[初始化]</span> ';
            html += step.desc + '</div>';
        });
        html += '</div>';
        dom.stepsContainer.innerHTML = html;
    }

    function setStatus(status, text) {
        dom.statusIndicator.className = 'status-' + status;
        dom.statusIndicator.innerHTML = text;
    }

    // =================== 代价弹窗 ===================

    var modalEdge = null;

    function showCostModal(from, to) {
        var key = from + '->' + to;
        var edge = localEdges[key];
        if (!edge) return;
        modalEdge = { from: from, to: to };
        dom.costModalInfo.textContent =
            (localNodes[from] ? localNodes[from].label : from) + ' ↔ ' +
            (localNodes[to] ? localNodes[to].label : to) + ' 的链路代价:';
        dom.costModalInput.value = edge.cost;
        dom.costModal.style.display = 'flex';
        dom.costModalInput.focus();
        dom.costModalInput.select();
    }

    function hideCostModal() {
        dom.costModal.style.display = 'none';
        modalEdge = null;
    }

    function confirmCostModal() {
        if (modalEdge) {
            var newCost = Math.max(1, parseInt(dom.costModalInput.value) || 1);
            OSPF_API.updateEdgeCost(modalEdge.from, modalEdge.to, newCost).then(function() {
                appState.spfResult = null;
                appState.spfEdges = [];
                return refreshTopology();
            }).catch(function(err) {
                alert('更新代价失败: ' + err.message);
            });
        }
        hideCostModal();
    }

    // =================== 预设 / 清空 ===================

    function loadPreset() {
        setStatus('running', '● 加载预设拓扑...');
        OSPF_API.loadPreset().then(function(data) {
            syncLocalTopology(data);
            appState.spfResult = null;
            appState.spfEdges = [];
            appState.allRoutingTables = null;
            appState.selectedNode = null;
            appState.addEdgeFirstNode = null;
            setMode('select');
            updateUI();
            dom.sourceSelect.value = '1';
            draw();

            // 自动运行Dijkstra
            OSPF_API.runDijkstra('1', true).then(function(result) {
                appState.spfResult = result;
                appState.spfEdges = result.spfEdges || [];
                if (result.routingTable) showRoutingTable(result.routingTable, '1');
                if (result.steps) showSteps(result.steps);
                draw();
                setStatus('done', '● 示例拓扑已加载 (源=R1, 绿色=SPF树) - Java后端计算');
            });
        }).catch(function(err) {
            alert('加载预设拓扑失败: ' + err.message);
            setStatus('ready', '● 就绪');
        });
    }

    function clearTopology() {
        if (Object.keys(localNodes).length > 0 && !confirm('确定要清空整个拓扑吗？')) return;
        OSPF_API.clearTopology().then(function() {
            localNodes = {};
            localEdges = {};
            appState.spfResult = null;
            appState.spfEdges = [];
            appState.allRoutingTables = null;
            appState.selectedNode = null;
            appState.addEdgeFirstNode = null;
            dom.sourceSelect.innerHTML = '<option value="">-- 请先添加节点 --</option>';
            dom.routingTableContainer.innerHTML = '<p class="placeholder-text">请先运行Dijkstra算法</p>';
            dom.stepsContainer.innerHTML = '<p class="placeholder-text">请先运行Dijkstra算法</p>';
            updateUI();
            setMode('addnode');
            draw();
            setStatus('ready', '● 就绪 - 请在画布上添加节点');
        });
    }

    // =================== 事件绑定 ===================

    function bindEvents() {
        dom.canvas.addEventListener('mousedown', onCanvasMouseDown);
        dom.canvas.addEventListener('mousemove', onCanvasMouseMove);
        dom.canvas.addEventListener('mouseup', onCanvasMouseUp);
        dom.canvas.addEventListener('dblclick', onCanvasDblClick);
        dom.canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });

        window.addEventListener('resize', function() { resizeCanvas(); draw(); });

        window.addEventListener('keydown', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            switch (e.key) {
                case '1': setMode('select'); break;
                case '2': setMode('addnode'); break;
                case '3': setMode('addedge'); break;
                case '4': setMode('delete'); break;
                case 'Delete': case 'Backspace':
                    if (appState.selectedNode && appState.mode === 'select') {
                        var sid = appState.selectedNode;
                        OSPF_API.removeNode(sid).then(function() {
                            deselectNode();
                            return refreshTopology();
                        });
                    }
                    break;
                case 'Escape':
                    appState.addEdgeFirstNode = null; deselectNode();
                    if (appState.mode === 'addedge') setMode('select');
                    draw();
                    break;
                case 'r': case 'R': if (!e.ctrlKey && !e.metaKey) runDijkstra(); break;
                case 'a': case 'A': if (!e.ctrlKey && !e.metaKey) runAllRoutingTables(); break;
            }
        });

        document.querySelectorAll('.btn-mode').forEach(function(btn) {
            btn.addEventListener('click', function() { setMode(this.dataset.mode); });
        });
        document.getElementById('btn-run-dijkstra').addEventListener('click', runDijkstra);
        document.getElementById('btn-run-all').addEventListener('click', runAllRoutingTables);
        document.getElementById('btn-preset1').addEventListener('click', loadPreset);
        document.getElementById('btn-clear').addEventListener('click', clearTopology);

        dom.sourceSelect.addEventListener('change', function() {
            if (this.value) { selectNode(this.value); draw(); }
        });

        document.getElementById('cost-modal-confirm').addEventListener('click', confirmCostModal);
        document.getElementById('cost-modal-cancel').addEventListener('click', hideCostModal);
        dom.costModal.addEventListener('click', function(e) { if (e.target === dom.costModal) hideCostModal(); });
        dom.costModalInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') confirmCostModal();
            if (e.key === 'Escape') hideCostModal();
        });
    }

    // =================== 初始化 ===================

    function init() {
        cacheDom();
        bindEvents();
        resizeCanvas();
        setMode('addnode');
        updateUI();
        draw();
        setStatus('ready', '● 就绪 (Java后端模式) - 请在画布上添加节点');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
