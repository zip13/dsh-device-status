# dsh-device-status

DSH web 插件：在 better-sidebar 中新增「设备状态」标签页，只读展示 DSH 宿主机的运行状态 —— CPU、内存、磁盘、网络接口、系统与 DSH 进程运行时长。

- 不注册任何模型工具（`contributes.tools` 为空），这个面板只给人看。
- 不做任何写操作：没有 mutation 接口，主机信息采集全部来自 Node `os` 与 `fs.statfs`，不 spawn 任何子进程。
- 不替代 better-sidebar 的任何既有标签页。

## 结构

与 `dsh-git-remotes` 相同的双半结构：

| 部分 | 入口 | 说明 |
| --- | --- | --- |
| host | `lib/index.js`（`src/index.ts`） | `/device-status/api` 只读 JSON 路由，Host 信任围栏 + POST/JSON |
| client（profile 渠道） | `lib/client.js` | better-sidebar 标签页，`inject = ['betterSidebar']` |
| client（registry 渠道） | `lib/client-registry.js` | 同上，id 取 `dsh.plugin.json` |

`cordis.patch.yml` 插入一行：

```yaml
- insert:
    - id: device-status
      name: 'dsh-device-status'
```

没有安装 `dsh-better-sidebar` 时 host 路由仍然挂载，标签页保持未激活（`betterSidebar` 是 optional peer）。

## API

`POST /device-status/api/<method>`，`content-type: application/json`。

| method | 返回 |
| --- | --- |
| `system` | `SystemStatus`：主机名、OS、运行时长、负载、CPU（型号/核数/自上次查询的占用率）、内存、磁盘（statfs）、非回环网卡、DSH 进程（pid / node 版本 / RSS） |
| `ping` | `{ pong: true }` |

安全边界（与 dsh-git-remotes 一致）：

- Host 头必须是回环地址或 `connection` 插件 `trustedHosts` 里配置的 authority；
- `sec-fetch-site: cross-site` 与不匹配的 `Origin` 一律 403；
- 只接受 POST + `application/json`（跨站表单无法伪造 content-type）。

CPU 占用率是两次 `os.cpus()` 计数器快照的差值：每次查询报告的是「距上一次查询」的平均占用；插件加载后的首次查询若计数器未推进，会在 150ms 窗口内补采一次。

## 安装（本地 checkout）

```sh
pnpm install
pnpm build
dsh plugin --profile <name> add H:\code2\dsh-device-status
```

## 开发

```sh
pnpm typecheck
pnpm test
pnpm build
```

client bundle 有 purity gate：不允许 Node builtin，也不允许 `@deepseek-ai/*` 值导入（只用 cordis 服务）。样式使用 DSH 设计平台的 `--dsw-alias-*` 变量。
