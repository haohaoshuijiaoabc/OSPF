/**
 * ============================================================
 * OSPF API 通信层 — 所有后端REST调用
 * ============================================================
 */
var OSPF_API = (function() {
    'use strict';

    var BASE = '/api';

    function request(method, url, data) {
        var opts = {
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (data !== undefined) {
            opts.body = JSON.stringify(data);
        }
        return fetch(BASE + url, opts).then(function(res) {
            if (!res.ok) {
                return res.text().then(function(txt) {
                    throw new Error(txt || res.statusText);
                });
            }
            return res.json();
        });
    }

    // ---- 拓扑管理 ----

    function getTopology() {
        return request('GET', '/topology');
    }

    function addNode(id, label, x, y) {
        return request('POST', '/topology/node', { id: id, label: label, x: x, y: y });
    }

    function removeNode(id) {
        return request('DELETE', '/topology/node/' + encodeURIComponent(id));
    }

    function addEdge(from, to, cost) {
        return request('POST', '/topology/edge', { from: from, to: to, cost: cost });
    }

    function removeEdge(from, to) {
        return request('DELETE', '/topology/edge', { from: from, to: to });
    }

    function updateEdgeCost(from, to, cost) {
        return request('PUT', '/topology/edge/cost', { from: from, to: to, cost: cost });
    }

    function clearTopology() {
        return request('DELETE', '/topology');
    }

    function loadPreset() {
        return request('POST', '/topology/preset');
    }

    function getStats() {
        return request('GET', '/topology/stats');
    }

    // ---- OSPF / Dijkstra ----

    function runDijkstra(source, recordSteps) {
        return request('GET', '/ospf/dijkstra?source=' + encodeURIComponent(source) +
                       '&steps=' + (recordSteps ? 'true' : 'false'));
    }

    function getRoutingTable(routerId) {
        return request('GET', '/ospf/routing-table/' + encodeURIComponent(routerId));
    }

    function getAllRoutingTables() {
        return request('GET', '/ospf/routing-tables');
    }

    function getLSDB() {
        return request('GET', '/ospf/lsdb');
    }

    return {
        getTopology: getTopology,
        addNode: addNode,
        removeNode: removeNode,
        addEdge: addEdge,
        removeEdge: removeEdge,
        updateEdgeCost: updateEdgeCost,
        clearTopology: clearTopology,
        loadPreset: loadPreset,
        getStats: getStats,
        runDijkstra: runDijkstra,
        getRoutingTable: getRoutingTable,
        getAllRoutingTables: getAllRoutingTables,
        getLSDB: getLSDB
    };

})();
