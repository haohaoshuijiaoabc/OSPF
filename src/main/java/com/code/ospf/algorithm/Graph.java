package com.code.ospf.algorithm;

import com.code.ospf.model.*;

import java.util.*;

/**
 * 图数据结构 — OSPF网络拓扑的核心表示
 *
 * 使用邻接表存储无向加权图。
 * 支持节点和边的增删改查。
 */
public class Graph {

    /** 节点映射: id -> Node */
    private final Map<String, Node> nodes = new LinkedHashMap<>();

    /** 边映射: "from->to" -> Edge */
    private final Map<String, Edge> edges = new LinkedHashMap<>();

    /** 邻接表: nodeId -> [ { to, cost } ] */
    private final Map<String, List<Neighbor>> adjList = new HashMap<>();

    // ---- 节点操作 ----

    public boolean addNode(String id, String label, double x, double y) {
        if (nodes.containsKey(id)) return false;
        nodes.put(id, new Node(id, label, x, y));
        adjList.putIfAbsent(id, new ArrayList<>());
        return true;
    }

    public boolean removeNode(String id) {
        if (!nodes.containsKey(id)) return false;
        nodes.remove(id);

        // 删除涉及该节点的所有边
        List<String> toRemove = new ArrayList<>();
        for (String key : edges.keySet()) {
            Edge e = edges.get(key);
            if (e.getFrom().equals(id) || e.getTo().equals(id)) {
                toRemove.add(key);
            }
        }
        for (String key : toRemove) {
            edges.remove(key);
        }
        rebuildAdjList();
        return true;
    }

    public Node getNode(String id) {
        return nodes.get(id);
    }

    public Collection<Node> getAllNodes() {
        return nodes.values();
    }

    public Set<String> getNodeIds() {
        return nodes.keySet();
    }

    public int getNodeCount() {
        return nodes.size();
    }

    // ---- 边操作 ----

    public boolean addEdge(String from, String to, int cost) {
        if (from.equals(to)) return false;
        if (!nodes.containsKey(from) || !nodes.containsKey(to)) return false;
        if (cost < 1) cost = 1;

        String key = from + "->" + to;
        edges.put(key, new Edge(from, to, cost));
        rebuildAdjList();
        return true;
    }

    public boolean removeEdge(String from, String to) {
        String key1 = from + "->" + to;
        String key2 = to + "->" + from;
        boolean removed = false;
        if (edges.containsKey(key1)) { edges.remove(key1); removed = true; }
        if (edges.containsKey(key2)) { edges.remove(key2); removed = true; }
        if (removed) rebuildAdjList();
        return removed;
    }

    public Edge getEdge(String from, String to) {
        String key = from + "->" + to;
        return edges.get(key);
    }

    public Collection<Edge> getAllEdges() {
        return edges.values();
    }

    public int getEdgeCount() {
        return edges.size();
    }

    // ---- 邻接表 ----

    public List<Neighbor> getNeighbors(String nodeId) {
        return adjList.getOrDefault(nodeId, Collections.emptyList());
    }

    private void rebuildAdjList() {
        adjList.clear();
        for (String id : nodes.keySet()) {
            adjList.put(id, new ArrayList<>());
        }
        for (Edge e : edges.values()) {
            // 无向图：两个方向都要加入邻接表
            List<Neighbor> listA = adjList.get(e.getFrom());
            if (listA != null) {
                listA.add(new Neighbor(e.getTo(), e.getCost()));
            }
            List<Neighbor> listB = adjList.get(e.getTo());
            if (listB != null) {
                listB.add(new Neighbor(e.getFrom(), e.getCost()));
            }
        }
    }

    // ---- 清空 ----

    public void clear() {
        nodes.clear();
        edges.clear();
        adjList.clear();
    }

    // ---- LSDB ----

    public List<LSDBEntry> getLSDB() {
        List<LSDBEntry> lsdb = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Edge e : edges.values()) {
            String pairKey = e.getPairKey();
            if (!seen.contains(pairKey)) {
                seen.add(pairKey);
                lsdb.add(new LSDBEntry(
                    e.getFrom(), e.getTo(), e.getCost(),
                    e.getFrom() + "-" + e.getTo()
                ));
            }
        }
        return lsdb;
    }

    /**
     * 邻接表条目
     */
    public static class Neighbor {
        public final String to;
        public final int cost;

        public Neighbor(String to, int cost) {
            this.to = to;
            this.cost = cost;
        }
    }
}
