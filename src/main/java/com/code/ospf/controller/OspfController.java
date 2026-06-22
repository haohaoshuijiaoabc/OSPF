package com.code.ospf.controller;

import com.code.ospf.model.*;
import com.code.ospf.service.OspfService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * OSPF仿真系统 REST API 控制器
 */
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class OspfController {

    @Autowired
    private OspfService ospfService;

    // ==================== 拓扑管理 ====================

    /**
     * 获取当前拓扑（所有节点和边）
     */
    @GetMapping("/topology")
    public ResponseEntity<TopologyData> getTopology() {
        return ResponseEntity.ok(ospfService.getTopology());
    }

    /**
     * 添加节点
     */
    @PostMapping("/topology/node")
    public ResponseEntity<Node> addNode(@RequestBody Node node) {
        return ResponseEntity.ok(
            ospfService.addNode(node.getId(), node.getLabel(), node.getX(), node.getY())
        );
    }

    /**
     * 删除节点（级联删除关联边）
     */
    @DeleteMapping("/topology/node/{id}")
    public ResponseEntity<Map<String, Object>> removeNode(@PathVariable String id) {
        boolean ok = ospfService.removeNode(id);
        Map<String, Object> resp = new HashMap<>();
        resp.put("success", ok);
        resp.put("message", ok ? "节点 " + id + " 已删除" : "节点不存在");
        return ResponseEntity.ok(resp);
    }

    /**
     * 添加链路
     */
    @PostMapping("/topology/edge")
    public ResponseEntity<Edge> addEdge(@RequestBody Edge edge) {
        Edge result = ospfService.addEdge(edge.getFrom(), edge.getTo(), edge.getCost());
        if (result == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(result);
    }

    /**
     * 删除链路
     */
    @DeleteMapping("/topology/edge")
    public ResponseEntity<Map<String, Object>> removeEdge(@RequestBody Edge edge) {
        boolean ok = ospfService.removeEdge(edge.getFrom(), edge.getTo());
        Map<String, Object> resp = new HashMap<>();
        resp.put("success", ok);
        resp.put("message", ok ? "链路已删除" : "链路不存在");
        return ResponseEntity.ok(resp);
    }

    /**
     * 更新链路代价
     */
    @PutMapping("/topology/edge/cost")
    public ResponseEntity<Edge> updateEdgeCost(@RequestBody Edge edge) {
        Edge result = ospfService.updateEdgeCost(edge.getFrom(), edge.getTo(), edge.getCost());
        return ResponseEntity.ok(result);
    }

    /**
     * 清空拓扑
     */
    @DeleteMapping("/topology")
    public ResponseEntity<Map<String, String>> clearTopology() {
        ospfService.clearTopology();
        Map<String, String> resp = new HashMap<>();
        resp.put("message", "拓扑已清空");
        return ResponseEntity.ok(resp);
    }

    /**
     * 载入预设拓扑
     */
    @PostMapping("/topology/preset")
    public ResponseEntity<TopologyData> loadPreset() {
        ospfService.loadPreset();
        return ResponseEntity.ok(ospfService.getTopology());
    }

    /**
     * 获取拓扑统计
     */
    @GetMapping("/topology/stats")
    public ResponseEntity<Map<String, Integer>> getStats() {
        Map<String, Integer> resp = new HashMap<>();
        resp.put("nodeCount", ospfService.getNodeCount());
        resp.put("edgeCount", ospfService.getEdgeCount());
        return ResponseEntity.ok(resp);
    }

    // ==================== OSPF / Dijkstra 计算 ====================

    /**
     * 运行Dijkstra算法
     *
     * @param sourceId 源节点ID
     * @param steps    是否记录步骤 (默认true)
     */
    @GetMapping("/ospf/dijkstra")
    public ResponseEntity<DijkstraResult> runDijkstra(
            @RequestParam String source,
            @RequestParam(defaultValue = "true") boolean steps) {
        try {
            DijkstraResult result = ospfService.runDijkstra(source, steps);
            // 附带路由表
            result.setRoutingTable(ospfService.getRoutingTable(source));
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * 获取单个路由器的路由表
     */
    @GetMapping("/ospf/routing-table/{routerId}")
    public ResponseEntity<List<RoutingTableEntry>> getRoutingTable(@PathVariable String routerId) {
        return ResponseEntity.ok(ospfService.getRoutingTable(routerId));
    }

    /**
     * 获取所有路由器的路由表
     */
    @GetMapping("/ospf/routing-tables")
    public ResponseEntity<Map<String, List<RoutingTableEntry>>> getAllRoutingTables() {
        return ResponseEntity.ok(ospfService.getAllRoutingTables());
    }

    /**
     * 获取链路状态数据库 (LSDB)
     */
    @GetMapping("/ospf/lsdb")
    public ResponseEntity<List<LSDBEntry>> getLSDB() {
        return ResponseEntity.ok(ospfService.getLSDB());
    }
}
