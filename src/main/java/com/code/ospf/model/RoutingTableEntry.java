package com.code.ospf.model;

import lombok.Data;
import java.util.List;

@Data
public class RoutingTableEntry {
    private String destination;
    private String nextHop;
    private int cost;
    private List<String> path;
    private String type;
}
