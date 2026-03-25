# Traffic Cat 桌面后台联网观察器

这是一个面向桌面平台的后台联网观察器项目。

当前版本以 `Linux` 桌面为首发落地点，后续计划支持 `Windows` 和 `macOS`。

当前阶段：

- 产品需求已定稿
- 技术实现方案已定稿
- 尚未开始正式实现
- 后续实现将基于守护进程 `agentd` 与桌面端 `desktop-ui` 进行拆分
- 安装与卸载统一通过 `scripts/install.sh` 管理

正式需求文档见 [docs/requirements.md](docs/requirements.md)。
技术实现文档见 [docs/technical-design.md](docs/technical-design.md)。
