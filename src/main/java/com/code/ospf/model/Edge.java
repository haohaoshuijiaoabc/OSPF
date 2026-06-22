package com.code.ospf.model;

import lombok.Data;

@Data
public class Edge {
    private String from;
    private String to;
    private int cost;

    public Edge() {}

    public Edge(String from, String to, int cost) {
        this.from = from;
        this.to = to;
        this.cost = cost;
    }

    public String getPairKey() {
        return from.compareTo(to) < 0 ? from + "-" + to : to + "-" + from;
    }
}
