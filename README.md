# OSPF协议仿真系统

基于 **Spring Boot + Canvas** 的 OSPF（开放最短路径优先）路由协议仿真系统，完整实现图拓扑构建 → 链路状态数据库 → Dijkstra最短路径计算 → 路由表生成的全流程。

## 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/haohaoshuijiaoabc/OSPF.git
cd OSPF

# 2. 编译运行（需要 JDK 8+）
mvn clean compile
mvn spring-boot:run

# 3. 打开浏览器
open http://localhost:8084
```

## 环境要求

| 依赖 | 版本 |
|------|------|
| JDK | 1.8+ |
| Maven | 3.6+ |

## 功能

- 🖱 **交互式拓扑编辑** — 画布上点击添加节点、拖拽连线、双击修改代价
- 🧮 **Dijkstra算法** — 二叉堆 + 懒删除优化，逐步展示松弛过程
- 📋 **路由表生成** — 目的网络 → 下一跳 → 代价 → 完整路径
- 🌳 **SPF最短路径树** — Canvas绿色高亮显示
- 📝 **链路状态数据库 (LSDB)** — 实时展示所有链路信息
- 🔌 **REST API** — 前后端分离，算法由Java后端计算

## 操作说明

| 操作 | 方式 |
|------|------|
| 添加节点 | 选"添加节点"模式，点击画布空白处 |
| 添加链路 | 选"添加链路"模式，依次点击两个节点 |
| 移动节点 | 选"选择/移动"模式，拖拽节点 |
| 修改代价 | 双击链路上的数字 |
| 删除 | 选"删除"模式，点击节点或链路 |
| 运行算法 | 选择源节点，点"运行Dijkstra" |
| 键盘快捷键 | `1/2/3/4` 切换模式，`R` 运行Dijkstra，`A` 计算全部路由表 |

## 项目结构

```
src/main/java/com/code/ospf/
├── algorithm/
│   ├── Graph.java          # 图数据结构（邻接表）
│   └── Dijkstra.java       # Dijkstra最短路径算法
├── model/                  # 数据模型
│   ├── Node.java           # 路由器节点
│   ├── Edge.java           # 链路
│   └── ...                 # DijkstraResult, RoutingTableEntry 等
├── service/
│   └── OspfService.java    # 业务逻辑层
├── controller/
│   └── OspfController.java # REST API (12个接口)
└── ospf.txt                # 算法详解文档

src/main/resources/static/
├── index.html              # 前端页面
├── css/style.css
└── js/
    ├── app.js              # Canvas可视化 + 交互
    ├── api.js              # 后端API通信
    └── ospf.js             # 前端算法（备用）
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/topology` | 获取完整拓扑 |
| POST | `/api/topology/node` | 添加节点 |
| DELETE | `/api/topology/node/{id}` | 删除节点 |
| POST | `/api/topology/edge` | 添加链路 |
| DELETE | `/api/topology/edge` | 删除链路 |
| PUT | `/api/topology/edge/cost` | 更新链路代价 |
| POST | `/api/topology/preset` | 载入示例拓扑 |
| GET | `/api/ospf/dijkstra?source={id}&steps=true` | 运行Dijkstra |
| GET | `/api/ospf/routing-table/{id}` | 单个路由表 |
| GET | `/api/ospf/routing-tables` | 全部路由表 |
| GET | `/api/ospf/lsdb` | 链路状态数据库 |
