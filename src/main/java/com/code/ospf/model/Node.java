package com.code.ospf.model;

import lombok.Data;

@Data
public class Node {
    private String id;
    private String label;
    private double x;
    private double y;

    public Node() {}

    public Node(String id, String label, double x, double y) {
        this.id = id;
        this.label = label;
        this.x = x;
        this.y = y;
    }
}
