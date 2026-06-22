package com.code.ospf.algorithm;

import com.code.ospf.model.*;

import java.util.*;

/**
 * Dijkstra最短路径算法 — OSPF的核心算法
 *
 * 参考标准竞赛写法：
 *   - 用 JDK 自带的 PriorityQueue（不是手写堆）
 *   - 用 "懒删除" 代替 visited 集合：if (disX > dis[x]) continue
 *   - 时间复杂度 O((V+E) log V)
 */
public class Dijkstra {

    /**
     * 运行Dijkstra算法
     *
     * @param graph       图
     * @param sourceId    源节点ID（如 "1"）
     * @param recordSteps 是否记录每一步
     * @return DijkstraResult 包含 distances / previous / paths / steps / spfEdges
     */
    public static DijkstraResult run(Graph graph, String sourceId, boolean recordSteps) {
        if (graph.getNode(sourceId) == null) {
            throw new IllegalArgumentException("源节点不存在: " + sourceId);
        }

        // ============ 1. 初始化 ============

        Map<String, Integer> dis = new HashMap<>();      // dis[x] = 起点到 x 的最短距离
        Map<String, String> prev = new HashMap<>();      // prev[x] = 最短路径上 x 的前驱节点
        List<StepInfo> steps = recordSteps ? new ArrayList<>() : null;

        for (String id : graph.getNodeIds()) {
            dis.put(id, Integer.MAX_VALUE);              // 初始化为 "无穷大"
            prev.put(id, null);
        }

        // 优先队列：元素是 int[] {起点到节点x的距离, 节点x的...编号}
        // 但节点ID是String，所以用一个简单的 Pair 类存 (距离, ID)
        // 按距离从小到大排序
        PriorityQueue<QNode> pq = new PriorityQueue<>(Comparator.comparingInt(a -> a.dist));

        dis.put(sourceId, 0);                            // 起点到自己的距离 = 0
        pq.offer(new QNode(0, sourceId));                // 起点入堆

        if (recordSteps) {
            steps.add(makeStep("init", 0, sourceId, 0, null, null, 0, 0, 0,
                "初始化: 所有节点距离=∞, 源节点 " + sourceId + " 距离=0"));
        }

        // ============ 2. 主循环 ============

        int stepCount = 0;
        while (!pq.isEmpty()) {
            QNode p = pq.poll();                         // 取出堆中 "距离最小" 的元素
            int disX = p.dist;                           // 这个元素记录的 "从起点到 x 的距离"
            String x = p.id;                             // 节点ID

            // ★ 懒删除（关键！）
            // 同一个节点 x 可能多次入堆（每次发现更短的路径就 offer 一次）
            // 堆里可能残留着 x 的 "旧距离" 记录，那些不是真正的最短距离
            // 如果取出来的 disX 比 dis[x] 大，说明这是旧记录 → 跳过
            if (disX > dis.get(x)) {
                continue;
            }

            // 此时 x 的最短距离已经确定（disX == dis[x]）
            stepCount++;
            if (recordSteps) {
                steps.add(makeStep("visit", stepCount, x, disX, null, null, 0, 0, 0,
                    "步骤" + stepCount + ": 出堆节点 " + x + " (距离=" +
                    (disX == Integer.MAX_VALUE ? "∞" : disX) + ")，最短距离已确定"));
            }

            // ------ 松弛 x 的所有邻居 ------
            for (Graph.Neighbor nb : graph.getNeighbors(x)) {
                String y = nb.to;
                int wt = nb.cost;

                int newDisY = disX + wt;                 // 尝试经过 x 到 y 的新距离
                if (newDisY < dis.get(y)) {              // 比已知的 dis[y] 更短？
                    int oldDis = dis.get(y);
                    dis.put(y, newDisY);                 // 更新 dis[y]
                    prev.put(y, x);                      // 记录 "到 y 的最短路径上，y 的前驱是 x"
                    pq.offer(new QNode(newDisY, y));     // ★ 只插入，不删除旧记录（懒删除）

                    if (recordSteps) {
                        String desc = "  松弛边 " + x + "→" + y +
                            ": dis[" + y + "] = min(" +
                            (oldDis == Integer.MAX_VALUE ? "∞" : oldDis) + ", " +
                            disX + "+" + wt + ") = " + newDisY +
                            (newDisY < oldDis && oldDis != Integer.MAX_VALUE ? " ✨更新!" : "");
                        steps.add(makeStep("relax", stepCount, y, newDisY,
                            x, y, wt, oldDis, newDisY, desc));
                    }
                }
            }
        }

        // ============ 3. 重建路径 ============
        // prev 只记录了 "前驱"，需要反向推导出完整路径

        Map<String, List<String>> paths = new LinkedHashMap<>();
        for (String id : graph.getNodeIds()) {
            if (id.equals(sourceId)) {
                paths.put(id, Collections.singletonList(sourceId));  // 源→源: [R1]
            } else if (prev.get(id) != null) {
                // 从目标往回走（id → prev[id] → prev[prev[id]] → ... → source）
                LinkedList<String> path = new LinkedList<>();
                String cur = id;
                while (cur != null) {
                    path.addFirst(cur);                  // 头部插入，保证顺序
                    cur = prev.get(cur);
                }
                paths.put(id, path);
            } else {
                paths.put(id, null);                     // 不可达（图不连通时）
            }
        }

        // ============ 4. 构建SPF边 ============
        // 最短路径树 = 所有 "前驱→节点" 的边

        List<Edge> spfEdges = new ArrayList<>();
        for (Map.Entry<String, String> e : prev.entrySet()) {
            if (e.getValue() != null) {
                spfEdges.add(new Edge(e.getValue(), e.getKey(), 1));
            }
        }

        // ============ 5. 组装结果 ============

        DijkstraResult result = new DijkstraResult();
        result.setSource(sourceId);
        result.setDistances(dis);
        result.setPrevious(prev);
        result.setPaths(paths);
        result.setSteps(steps);
        result.setSpfEdges(spfEdges);
        return result;
    }

    // ==================== 路由表生成 ====================

    /**
     * 生成单个路由器的路由表（目的 → 下一跳 → 代价 → 路径）
     *
     * 从 Dijkstra 的 paths 结果推导 "下一跳"：
     *   路径 [R1, R2, R4, R6] → 对目的 R6，下一跳 = R2（路径第2个元素）
     */
    public static List<RoutingTableEntry> generateRoutingTable(Graph graph, String routerId) {
        DijkstraResult dr = run(graph, routerId, false);
        List<RoutingTableEntry> table = new ArrayList<>();

        for (String destId : graph.getNodeIds()) {
            RoutingTableEntry entry = new RoutingTableEntry();
            entry.setDestination(destId);

            if (destId.equals(routerId)) {
                // 自己到自己
                entry.setNextHop("— (本地)");
                entry.setCost(0);
                entry.setPath(Collections.singletonList(routerId));
                entry.setType("local");
            } else {
                List<String> path = dr.getPaths().get(destId);
                if (path != null && path.size() >= 2) {
                    entry.setNextHop(path.get(1));           // path[1] = 下一跳
                    entry.setCost(dr.getDistances().get(destId));
                    entry.setPath(path);
                    entry.setType(path.size() == 2 ? "direct" : "remote");
                } else {
                    entry.setNextHop("不可达");
                    entry.setCost(Integer.MAX_VALUE);
                    entry.setPath(null);
                    entry.setType("unreachable");
                }
            }
            table.add(entry);
        }

        // 按代价从小到大排序（不可达放最后）
        table.sort(Comparator.comparingInt(e ->
            e.getCost() == Integer.MAX_VALUE ? Integer.MAX_VALUE : e.getCost()));

        return table;
    }

    /**
     * 生成所有路由器的完整路由表
     */
    public static Map<String, List<RoutingTableEntry>> generateAllRoutingTables(Graph graph) {
        Map<String, List<RoutingTableEntry>> all = new LinkedHashMap<>();
        for (String id : graph.getNodeIds()) {
            all.put(id, generateRoutingTable(graph, id));
        }
        return all;
    }

    // ==================== 辅助方法 ====================

    private static StepInfo makeStep(String action, int stepNum, String node, int distance,
                                      String from, String to, int cost,
                                      int oldDistance, int newDistance, String desc) {
        StepInfo s = new StepInfo();
        s.setAction(action);
        s.setStepNum(stepNum);
        s.setNode(node);
        s.setDistance(distance);
        s.setFrom(from);
        s.setTo(to);
        s.setCost(cost);
        s.setOldDistance(oldDistance);
        s.setNewDistance(newDistance);
        s.setDesc(desc);
        return s;
    }

    /**
     * 优先队列元素：{起点到节点id的距离, 节点id}
     * 用 JDK 的 PriorityQueue，按 dist 升序
     */
    private static class QNode {
        final int dist;
        final String id;

        QNode(int dist, String id) {
            this.dist = dist;
            this.id = id;
        }
    }
}
