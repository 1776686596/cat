# Linux 桌面后台流量观测器技术实现文档（定稿）

## 1. 文档目标

本文档定义首版的技术实现方案，用于把需求文档转成可直接编码的工程设计。

本文档重点回答：

- 仓库如何组织
- 守护进程和桌面端如何通信
- 流量如何采集、归因、聚合和存储
- 前台挂件和后台主界面如何实现
- 首版如何分阶段落地

本文档默认以 [requirements.md](requirements.md) 为产品真源。

## 2. 总体架构

首版采用“系统守护进程 + 桌面 UI + 共享 Rust 领域层”的结构。

```text
┌──────────────────────────────────────────────────────────┐
│                      desktop-ui                          │
│  Tauri 主窗口 / 小猫挂件 / 前端状态管理 / 交互桥接      │
└───────────────┬──────────────────────────────────────────┘
                │ Tauri Rust Command + 事件转发
                ▼
┌──────────────────────────────────────────────────────────┐
│                desktop-ui/src-tauri                     │
│  UDS 客户端 / 实时事件订阅 / 本地设置 / 窗口控制        │
└───────────────┬──────────────────────────────────────────┘
                │ Unix Domain Socket
                ▼
┌──────────────────────────────────────────────────────────┐
│                        agentd                            │
│  Capture / Resolver / Aggregator / Alerts / Store / API │
└───────────────┬──────────────────────────────────────────┘
                │
                ├── eBPF 采集器（首选）
                ├── /proc + 连接表回退采集器
                └── SQLite 持久化
```

核心设计原则：

- 采集与展示解耦
- 所有高权限能力都放在 `agentd`
- 前端不直接碰系统能力和原始采集逻辑
- 实时流与历史查询走同一领域模型，避免双套逻辑

## 3. 仓库结构

项目采用 Rust workspace + Tauri 应用的混合结构。

```text
.
├── README.md
├── docs/
│   ├── requirements.md
│   └── technical-design.md
├── Cargo.toml
├── rust-toolchain.toml
├── apps/
│   ├── agentd/
│   └── desktop-ui/
│       ├── package.json
│       ├── src/
│       └── src-tauri/
├── crates/
│   ├── domain/
│   ├── store/
│   ├── capture/
│   ├── alerts/
│   ├── ipc/
│   └── settings/
└── scripts/
    ├── install.sh
    └── dev-run.sh
```

模块职责固定如下：

- `apps/agentd`
  - 守护进程入口
  - 运行时调度
  - UDS API 服务
- `apps/desktop-ui`
  - Tauri 前端工程
  - 小猫挂件和主界面
- `crates/domain`
  - 共享领域类型
  - 流量事件、会话、告警、状态枚举
- `crates/store`
  - SQLite 模型、迁移、查询仓库
- `crates/capture`
  - eBPF 采集与回退采集抽象
- `crates/alerts`
  - 告警规则引擎
- `crates/ipc`
  - 请求响应模型、事件模型、客户端封装
- `crates/settings`
  - 配置加载与本地设置

## 4. 技术选型

### 4.1 后端与守护进程

- 语言：`Rust stable`
- 异步运行时：`tokio`
- API 框架：`axum`
- 序列化：`serde`
- 日志：`tracing` + `tracing-subscriber`
- 数据库：`SQLite`
- 数据访问：`sqlx`
- 时间处理：`time`
- 唯一标识：`uuid`

### 4.2 采集层

- 首选 eBPF 框架：`aya`
- 回退采集：
  - `/proc/net/tcp*`
  - `/proc/net/udp*`
  - `/proc/<pid>/fd`
  - `procfs` 读取进程元信息

### 4.3 桌面端

- 桌面壳：`Tauri v2`
- 前端：`React + TypeScript + Vite`
- 路由：`react-router`
- 服务端状态：`@tanstack/react-query`
- UI 本地状态：`zustand`
- 图表：`Recharts`
- 动画：CSS + 少量 `motion`

### 4.4 工程与质量

- Rust 格式化：`cargo fmt`
- Rust 静态检查：`cargo clippy`
- 前端格式化：`prettier`
- 前端静态检查：`eslint`
- 单元测试：
  - Rust：`cargo test`
  - 前端：`vitest`

## 5. 运行形态与系统资源

### 5.1 进程模型

首版只运行两个长期进程：

- `agentd`
- `desktop-ui`

`agentd` 负责：

- 采集内核与进程网络事件
- 维护实时状态窗口
- 存储历史
- 输出告警
- 响应 UI 查询

`desktop-ui` 负责：

- 小猫挂件窗口
- 后台主界面窗口
- 把实时事件转成 UI 更新
- 保存用户侧窗口位置和展示偏好

### 5.2 文件与目录

系统级目录：

- UDS：`/run/traffic-cat/agentd.sock`
- 数据库：`/var/lib/traffic-cat/traffic.db`
- 运行日志：`journald`

用户级目录：

- UI 配置：`~/.config/traffic-cat/ui.json`
- 自动启动文件：`~/.config/autostart/traffic-cat.desktop`

### 5.3 systemd 单元

首版使用系统服务：

- `traffic-cat-agentd.service`

启动顺序：

1. 安装脚本注册守护进程
2. 守护进程开机可用
3. 用户登录后启动 `desktop-ui`
4. UI 连接 `agentd`，拉取状态并订阅实时事件

## 6. agentd 内部设计

### 6.1 子系统拆分

`agentd` 固定由以下子系统组成：

- `capture_manager`
  - 选择 eBPF 或回退采集器
  - 输出统一 `FlowSample`
- `process_registry`
  - 缓存进程名、父进程、执行路径
- `host_resolver`
  - 维护 DNS 与 TLS 主机名关联缓存
- `flow_aggregator`
  - 将样本聚合成实时连接与历史会话
- `alert_engine`
  - 根据聚合结果判断提醒
- `store_service`
  - 异步刷盘 SQLite
- `api_server`
  - 通过 UDS 暴露查询与控制接口
- `health_service`
  - 汇总权限、采集模式、数据库状态

### 6.2 数据流

```text
采集器 → 样本标准化 → 进程补全 → 主机名解析 → 实时聚合
     → 告警判断 → 事件广播
     → 批量落库 → 历史查询
```

流水线规则：

- 实时事件优先进入内存窗口
- 落库采用批量写入，默认 `1` 秒刷盘一次
- UI 读取实时数据优先从内存窗口，不直接查询数据库
- 历史查询只走数据库

### 6.3 并发模型

- 采集器单独异步任务运行
- 解析、聚合、告警通过 `tokio::mpsc` 串接
- 广播给 UI 的事件通过 `tokio::broadcast`
- 数据库写入走单独 writer task，避免并发写锁竞争

## 7. 流量采集实现

### 7.1 首选 eBPF 方案

首版 eBPF 目标不是做全量抓包，而是抓“连接和字节变化的元信息”。

采集重点：

- TCP 外连建立
- TCP 连接状态变化
- UDP 外发活动
- 发送字节增量
- 接收字节增量

标准化输出字段：

- `pid`
- `tgid`
- `comm`
- `parent_pid`
- `protocol`
- `local_addr`
- `local_port`
- `remote_addr`
- `remote_port`
- `direction`
- `tx_bytes_delta`
- `rx_bytes_delta`
- `timestamp`
- `capture_mode`

实现约束：

- 首版以 TCP 为主，UDP 先满足“活跃与字节统计”
- 不解析包内容
- 不在 eBPF 程序里做复杂字符串处理
- 域名解析在用户态完成

### 7.2 回退采集方案

当 eBPF 不可用时，使用轮询式回退：

- 定期扫描 `/proc/net/tcp*`、`/proc/net/udp*`
- 通过 inode 与 `/proc/<pid>/fd` 建立 socket 到进程的映射
- 读取 `/proc/<pid>/stat`、`/proc/<pid>/comm` 补全进程信息

回退模式保证：

- 仍然能展示主要外连进程
- 仍然能展示远端 IP、端口、协议和时间
- 精度下降会写入运行状态

回退模式允许缺失：

- 部分父进程信息
- 域名命中率
- 更精细的连接状态

### 7.3 主机名解析策略

主机名来源有三类：

- `dns_cache`
- `tls_sni`
- `ip_only`

实现顺序：

1. 采集 DNS 请求与响应，建立短期映射
2. 如后续接入 TLS 主机名能力，则用更高优先级覆盖
3. 两者都没有时回退到 IP

首版 UI 必须明确展示主机名来源。

## 8. 数据模型与存储

### 8.1 SQLite 表设计

首版固定包含以下核心表：

#### `process_snapshot`

- `id`
- `pid`
- `parent_pid`
- `process_name`
- `process_path`
- `first_seen_at`
- `last_seen_at`

#### `flow_session`

- `id`
- `process_snapshot_id`
- `protocol`
- `direction`
- `remote_host`
- `host_source`
- `remote_ip`
- `remote_port`
- `first_seen_at`
- `last_seen_at`
- `tx_bytes`
- `rx_bytes`
- `state`
- `capture_mode`

#### `flow_event_rollup`

- `id`
- `flow_session_id`
- `bucket_start_at`
- `tx_bytes_delta`
- `rx_bytes_delta`

#### `alert_record`

- `id`
- `process_snapshot_id`
- `alert_type`
- `severity`
- `title`
- `body`
- `created_at`
- `dedupe_key`

#### `app_setting`

- `key`
- `value`
- `updated_at`

### 8.2 落库策略

- 实时窗口保留最近 `60` 秒明细
- `flow_event_rollup` 以 `10` 秒粒度聚合
- 活跃会话结束后刷新 `flow_session`
- 每天启动一次清理任务：
  - 删除超过 `30` 天数据
  - 或当数据库超过 `512MB` 时按时间顺序清理

### 8.3 查询策略

- 实时页：内存窗口 + 活跃会话缓存
- 历史页：`flow_session` + `flow_event_rollup`
- 进程详情：以 `process_snapshot` 为主表反查所有会话和告警

## 9. IPC 与接口设计

### 9.1 通信方式

`agentd` 与 Tauri Rust 侧通过 Unix Domain Socket 通信。

原因：

- 不暴露本地 TCP 监听端口
- 权限边界更清晰
- 桌面端无需自行处理鉴权网页接口

### 9.2 接口形式

控制与查询接口采用 UDS 上的 HTTP API。  
实时事件采用同一 UDS 上的事件流接口，由 Tauri 后端转发给前端。

### 9.3 HTTP 接口

- `GET /health`
- `GET /status`
- `GET /flows/live`
- `GET /flows/history`
- `GET /processes/:id/summary`
- `GET /processes/:id/flows`
- `GET /alerts`
- `POST /settings/ui`
- `POST /settings/mute-alerts`

### 9.4 关键响应模型

#### `AgentStatus`

- `service_status`
- `capture_mode`
- `permission_status`
- `db_status`
- `degraded_reason`

#### `LiveFlowItem`

- `session_id`
- `process_name`
- `pid`
- `parent_process_name`
- `direction`
- `remote_host`
- `remote_port`
- `protocol`
- `current_tx_rate`
- `current_rx_rate`
- `first_seen_at`
- `last_seen_at`
- `state`
- `host_source`

#### `AlertItem`

- `id`
- `alert_type`
- `process_name`
- `pid`
- `remote_host`
- `created_at`
- `title`
- `body`

### 9.5 实时事件

事件类型固定为：

- `flow_tick`
- `status_changed`
- `alert_created`
- `settings_changed`

Tauri Rust 层负责：

- 连接 UDS 事件流
- 解析后通过 `app.emit` 推给前端
- 断线自动重连

## 10. 告警引擎设计

### 10.1 告警类型实现

#### 首次联网

- 使用 `process_name + remote_host` 生成去重基准
- 最近 `30` 天内未见则触发

#### 流量突增

- 比较最近 `60` 秒均值与前 `10` 分钟滚动基线
- 需满足最小字节阈值和倍数阈值双条件

#### 持续后台通信

- 活跃窗口连续超过 `10` 分钟
- 且持续字节变化高于最小活跃阈值

### 10.2 抑制规则

- 同一进程同一类型告警 `30` 分钟内只保留一条通知
- 系统基础进程默认在降噪名单
- 静音状态保存在 `app_setting`

## 11. desktop-ui 设计

### 11.1 窗口模型

首版使用双窗口：

- `widget`
  - 透明、无边框、常驻右下角、始终置顶
- `dashboard`
  - 正常主窗口，承载后台详细分析

暂不增加第三个独立诊断窗口，诊断页放在 `dashboard` 内。

### 11.2 前端页面

- `/live`
  - 实时流向列表
- `/processes`
  - 进程聚合
- `/processes/:id`
  - 单进程详情
- `/history`
  - 历史检索
- `/alerts`
  - 最近提醒
- `/diagnostics`
  - 守护进程状态与权限诊断

### 11.3 状态管理

- React Query
  - 拉取历史、详情、状态查询
- Zustand
  - 挂件状态
  - 当前过滤条件
  - 悬停与静音状态

实时事件处理规则：

- `flow_tick` 直接更新挂件状态和实时列表缓存
- `alert_created` 更新提醒角标与提醒列表
- `status_changed` 驱动挂件进入正常、降级或离线态

### 11.4 小猫挂件实现

挂件窗口固定特性：

- 透明背景
- 不显示系统标题栏
- 默认大小 `220x84`
- 支持拖拽
- 位置存入 `ui.json`

视觉实现规则：

- 小猫使用矢量插画或内嵌 SVG 组件
- 动画只使用 `transform` 和 `opacity`
- 每秒最多更新一次主状态
- 空闲态降低透明度，不隐藏窗口

### 11.5 主界面视觉方向

首版采用“轻工业仪表 + 宠物陪伴”混合风格：

- 主色：偏暖灰 + 铜橙强调色
- 字体：展示字体与正文分离，不使用默认系统字体作为唯一方案
- 页面避免卡片套卡片
- 重点突出实时列表与进程排行
- 小猫元素只在局部点缀，不侵入数据区阅读

## 12. 安装与启动流程

### 12.1 安装脚本职责

`scripts/install.sh` 负责：

- 检查 Linux 发行版基础依赖
- 检查内核版本与 eBPF 能力
- 创建 `/var/lib/traffic-cat`
- 创建 `/run/traffic-cat`
- 安装 `traffic-cat-agentd.service`
- 为可执行文件配置所需 capability，或退回 sudo 运行提示
- 作为统一入口处理安装、卸载、修复与重装

脚本命令固定为：

- `scripts/install.sh install`
- `scripts/install.sh uninstall`
- `scripts/install.sh uninstall --purge`

无参数启动时进入交互模式，提供：

- 安装
- 卸载
- 修复或重装

安装或重装流程固定为：

1. 检查系统依赖、内核能力与 `systemd`
2. 停止旧服务（如已存在）
3. 安装或覆盖二进制文件
4. 注册并启用 `traffic-cat-agentd.service`
5. 创建 `/var/lib/traffic-cat` 与 `/run/traffic-cat`
6. 初始化数据库目录
7. 安装桌面端自启动入口
8. 启动服务并做健康检查

当检测到已安装但状态残缺时，`install` 自动转入修复流程。

### 12.2 卸载与重装流程

默认卸载行为：

1. 停止并禁用 `traffic-cat-agentd.service`
2. 删除已安装的可执行文件
3. 删除 service 文件
4. 删除桌面自启动项
5. 删除 `/run/traffic-cat`
6. 保留 `/var/lib/traffic-cat/traffic.db`
7. 保留 `~/.config/traffic-cat/ui.json`

`uninstall --purge` 额外执行：

1. 删除 `/var/lib/traffic-cat`
2. 删除 `~/.config/traffic-cat`
3. 删除项目自身缓存目录

重装规则：

- 默认卸载后再次执行 `install` 时，自动复用历史数据库与 UI 配置
- 使用 `--purge` 卸载后再次安装时，按全新安装处理
- 检测到残留 service、目录或部分安装状态时，脚本先清理残留再继续安装

### 12.3 启动流程

1. `agentd` 启动
2. 执行环境检查
3. 初始化数据库
4. 加载采集器
5. 开启 API 与事件流
6. `desktop-ui` 登录自动启动
7. UI 拉取 `/status`
8. 成功后进入正常模式，失败则进入诊断页

## 13. 开发阶段拆分

### Phase 1：工程骨架

- 建立 workspace
- 建立 `agentd`、`desktop-ui`、共享 crates
- 打通 UDS 通信
- 小猫挂件窗口可展示静态状态

### Phase 2：采集与实时流

- 接入首版采集器
- 完成实时事件广播
- 完成实时流向页
- 完成挂件状态切换

### Phase 3：历史与告警

- SQLite 落库
- 历史检索页
- 告警引擎
- 最近提醒列表

### Phase 4：安装与诊断

- systemd 服务
- 安装脚本
- 卸载与重装流程
- 权限与降级诊断页
- 数据清理与导出

## 14. 测试策略

### 14.1 Rust 侧

- `domain`、`alerts`、`store` 做单元测试
- `ipc` 做接口序列化与协议测试
- `agentd` 做集成测试，覆盖：
  - 实时事件广播
  - SQLite 写入
  - 降级状态切换

### 14.2 采集侧

- 使用模拟样本测试聚合与告警
- 在具备权限的环境中做手工验证：
  - 浏览器外连
  - 下载行为
  - 长连行为

### 14.3 前端侧

- `vitest` 测试状态机、格式化函数、过滤逻辑
- 组件测试覆盖：
  - 挂件摘要
  - 实时列表
  - 告警条目
  - 诊断页

### 14.4 安装脚本侧

- 验证 `install` 可完成全新安装
- 验证已安装场景下再次执行 `install` 可完成修复或重装
- 验证 `uninstall` 会移除服务和入口，但保留数据库与配置
- 验证 `uninstall --purge` 会彻底删除数据和配置
- 验证“卸载后重新安装”可以正常恢复或重建环境

## 15. 非目标与约束

- 首版不做流量拦截
- 首版不做完整 Wayland 支持
- 首版不做多用户协同或云端同步
- 首版不保证所有 UDP 场景都能高精度归因
- 首版优先保证“外连观测可用”，再逐步增强精度

## 16. 与 OpenSpec 的衔接

当进入正式编码阶段时，应基于本文档创建首个变更提案：

- 建议 change-id：`add-linux-traffic-observer`

建议拆分能力：

- `agent-service`
- `desktop-widget`
- `history-and-alerts`

后续实现以本文档作为技术真源，以 OpenSpec proposal 作为变更真源。
