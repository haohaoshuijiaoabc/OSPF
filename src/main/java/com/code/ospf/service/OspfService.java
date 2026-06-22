package com.code.ospf.service;

import com.code.ospf.algorithm.Dijkstra;
import com.code.ospf.algorithm.Graph;
import com.code.ospf.model.*;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * OSPF仿真服务 — 管理网络拓扑状态，提供Dijkstra计算和路由表生成
 */
@Service
public class OspfService {

    private final Graph graph = new Graph();

    // ==================== 拓扑管理 ====================

    public TopologyData getTopology() {
        return new TopologyData(
            new ArrayList<>(graph.getAllNodes()),
            new ArrayList<>(graph.getAllEdges())
        );
    }

    public Node addNode(String id, String label, double x, double y) {
        graph.addNode(id, label, x, y);
        return graph.getNode(id);
    }

    public boolean removeNode(String id) {
        return graph.removeNode(id);
    }

    public Edge addEdge(String from, String to, int cost) {
        if (graph.addEdge(from, to, cost)) {
            return graph.getEdge(from, to);
        }
        return null;
    }

    public boolean removeEdge(String from, String to) {
        return graph.removeEdge(from, to);
    }

    public Edge updateEdgeCost(String from, String to, int cost) {
        graph.addEdge(from, to, cost);
        return graph.getEdge(from, to);
    }

    public void clearTopology() {
        graph.clear();
    }

    // ==================== 预设拓扑 ====================

    public void loadPreset() {
        graph.clear();

        // 8节点经典OSPF网络
        double cx = 420, cy = 300;
        Object[][] nodeDefs = {
            {"1", "R1", cx - 220, cy - 70},
            {"2", "R2", cx - 60,  cy - 70},
            {"3", "R3", cx - 140, cy - 190},
            {"4", "R4", cx + 100, cy - 20},
            {"5", "R5", cx + 40,  cy - 190},
            {"6", "R6", cx + 230, cy + 20},
            {"7", "R7", cx - 110, cy + 110},
            {"8", "R8", cx + 90,  cy + 130},
        };
        for (Object[] nd : nodeDefs) {
            graph.addNode((String) nd[0], (String) nd[1], (Double) nd[2], (Double) nd[3]);
        }

        String[][] edgeDefs = {
            {"1", "2", "3"}, {"1", "3", "2"},
            {"2", "3", "1"}, {"2", "4", "2"}, {"2", "7", "5"},
            {"3", "5", "4"},
            {"4", "5", "2"}, {"4", "6", "1"}, {"4", "8", "2"},
            {"5", "6", "3"},
            {"7", "8", "6"},
        };
        for (String[] ed : edgeDefs) {
            graph.addEdge(ed[0], ed[1], Integer.parseInt(ed[2]));
        }
    }

    // ==================== Dijkstra / OSPF计算 ====================

    public DijkstraResult runDijkstra(String sourceId, boolean recordSteps) {
        return Dijkstra.run(graph, sourceId, recordSteps);
    }

    public List<RoutingTableEntry> getRoutingTable(String routerId) {
        DijkstraResult dr = runDijkstra(routerId, false);
        // 直接使用Dijkstra.generateRoutingTable避免重复计算
        List<RoutingTableEntry> table = Dijkstra.generateRoutingTable(graph, routerId);
        return table;
    }

    public Map<String, List<RoutingTableEntry>> getAllRoutingTables() {
        return Dijkstra.generateAllRoutingTables(graph);
    }

    public List<LSDBEntry> getLSDB() {
        return graph.getLSDB();
    }

    public int getNodeCount() {
        return graph.getNodeCount();
    }

    public int getEdgeCount() {
        return graph.getEdgeCount();
    }
}
