package com.code.ospf.model;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class DijkstraResult {
    private String source;
    private Map<String, Integer> distances;
    private Map<String, String> previous;
    private Map<String, List<String>> paths;
    private List<StepInfo> steps;
    private List<Edge> spfEdges;
    private List<RoutingTableEntry> routingTable;
}
