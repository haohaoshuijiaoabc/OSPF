package com.code.ospf.model;

import lombok.Data;

@Data
public class StepInfo {
    private String action;
    private int stepNum;
    private String node;
    private int distance;
    private String from;
    private String to;
    private int cost;
    private int oldDistance;
    private int newDistance;
    private String desc;
}
