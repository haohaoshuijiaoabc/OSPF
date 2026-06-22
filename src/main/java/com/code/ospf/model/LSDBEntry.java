package com.code.ospf.model;

import lombok.Data;

@Data
public class LSDBEntry {
    private String router1;
    private String router2;
    private int cost;
    private String network;

    public LSDBEntry() {}

    public LSDBEntry(String router1, String router2, int cost, String network) {
        this.router1 = router1;
        this.router2 = router2;
        this.cost = cost;
        this.network = network;
    }
}
