package com.code.ospf.model;

import lombok.Data;
import java.util.List;

@Data
public class TopologyData {
    private List<Node> nodes;
    private List<Edge> edges;

    public TopologyData() {}

    public TopologyData(List<Node> nodes, List<Edge> edges) {
        this.nodes = nodes;
        this.edges = edges;
    }
}
