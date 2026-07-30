# Docker 实操入门笔记

> 环境：Win11 物理机 → VMware 虚拟机（Ubuntu，6 核 / 30G 内存，桥接网络）→ Docker 29.1.3
> 目标场景：为「Nest + Prisma + PG」对账系统 MVP 的部署打底
> 日期：2026-07-23

---

## 0. 安装（Ubuntu 官方源方式）

不要用 `apt install docker.io`（版本旧），走官方源：

```bash
# 1. 装依赖
sudo apt update
sudo apt install -y ca-certificates curl

# 2. 加 Docker 官方 GPG key 和源
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 3. 安装引擎 + compose 插件
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 4. 免 sudo 敲 docker（把自己加进 docker 组）
sudo usermod -aG docker $USER
newgrp docker   # 或注销重登录

# 5. 验证
docker run hello-world
```

---

## 1. 核心概念模型

| 概念 | 类比（前端视角） | 本质 |
|---|---|---|
| 镜像（Image） | 打好的只读压缩包 / 类（class） | 应用 + 运行环境的只读快照 |
| 容器（Container） | 类的实例 / 一次 `npm start` 的进程 | 镜像跑起来的一个隔离进程 |
| 仓库（Registry） | npm registry | 镜像的远程仓库，默认 Docker Hub |

**关键认知：**

1. **容器不是虚拟机**。容器是宿主机上被 namespace 隔离的普通进程，共享宿主机内核，毫秒级启动、近零损耗。层级关系：物理机 → VMware 虚拟机（Ubuntu）→ Docker 容器，两层各管各的。
2. **镜像分层 + overlayfs**：镜像由一叠只读层组成，多镜像可共享相同层。容器启动时顶部盖一层**可写层**，容器内的一切写操作都在这层；`docker rm` 删掉的就是这层——**镜像本身从未被修改**。
   - 推论 1：容器里改的文件，删容器即丢失（除非挂了卷）。
   - 推论 2：想固化变更，正路是写进 Dockerfile，不是 `docker commit`（脏办法，不用）。
3. **Dockerfile 不是「配置单」，是构建配方**；compose 不是「多个 Dockerfile 集成」，而是编排多个**容器/服务**（可以直接引用现成镜像，不必每个都自己 build）。

---

## 2. 排障实录：拉镜像报 `unexpected EOF`

**症状**：

```
docker: short read: expected 8584 bytes but got 0: unexpected EOF
```

**诊断**：国内直连 Docker Hub 传输被掐断。小镜像（hello-world）可能侥幸成功，大镜像必挂。

**验证**：

```bash
curl -I https://registry-1.docker.io/v2/ --max-time 10   # 超时/重置即实锤
```

**解法：配置国内镜像加速器**，编辑 `/etc/docker/daemon.json`：

```json
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me",
    "https://dockerproxy.net"
  ]
}
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
docker info   # 确认 Registry Mirrors 已挂上
```

**经验**：
- 镜像站存活率变化快，某层卡住不动就 `Ctrl+C`，调整源顺序、重启 docker 再试；
- 备选：走宿主机代理（宿主机代理软件开「允许局域网连接」，给 docker 的 systemd service 配 `HTTP_PROXY`/`HTTPS_PROXY` 环境变量）。

---

## 3. 容器生命周期（核心四连 + 排障两连）

```bash
docker run -d --name web -p 8080:80 nginx:1.27
#   -d 后台运行   --name 起名   -p 宿主机端口:容器端口

docker ps            # 运行中的容器（-a 看全部含已停止）
docker logs -f web   # 看日志，排障第一命令
docker exec -it web bash   # 进容器（alpine 系镜像用 sh）
docker stop web      # 优雅停止（SIGTERM，10 秒后 SIGKILL）
docker start web
docker rm web        # 删容器（须先停）
docker rmi nginx:1.27  # 删镜像
```

**端口映射 `-p 8080:80`**：容器有独立网络命名空间，内部端口外界摸不到，`-p` 把宿主机 8080 转发到容器 80。桥接网络下，Win11 宿主机可直接访问 `http://虚拟机IP:8080`——这也是以后给人演示应用的链路。

---

## 4. 数据持久化：Volume

```bash
docker volume create pgdata

docker run -d --name pg \
  -e POSTGRES_PASSWORD=dev123 \
  -e POSTGRES_DB=recon \
  -v pgdata:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:16
```

**核心结论**：命名卷的生命周期独立于容器。`docker rm` 不碰卷；只有 `docker volume rm` 或 `docker compose down -v` 才删数据。命名卷实际存在宿主机 `/var/lib/docker/volumes/` 下，由 Docker 管理。

**两种挂载方式：**

| 方式 | 写法 | 适用 |
|---|---|---|
| 命名卷（named volume） | `-v pgdata:/var/lib/postgresql/data` | 数据库等不需要直接看内部文件的场景 |
| 目录挂载（bind mount） | `-v /home/rtx/app:/app` | 开发期挂代码，宿主机直接可见可编辑 |

**验证实验（值得亲手做一遍）**：建表插入数据 → 删容器 → 同卷重建容器 → 查询，数据仍在。

---

## 5. Dockerfile：把应用打成镜像

最小示例（nginx 托管静态页）：

```dockerfile
FROM nginx:1.27
COPY index.html /usr/share/nginx/html/index.html
```

```bash
docker build -t my-web:0.1 .   # -t 起名打标签，. 是构建上下文
docker run -d --name myweb -p 8081:80 my-web:0.1
```

生产级模板（Nest/Node 两阶段构建）：

```dockerfile
# ---- 构建阶段 ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- 运行阶段 ----
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

配套 `.dockerignore`（同 `.gitignore` 思路）：

```
node_modules
dist
.git
```

**要点：**
- 每个指令产生一层；`FROM` 选地基，`RUN` 执行命令，`COPY` 拷文件，`CMD` 是容器启动命令。
- **分层缓存**：未变化的层显示 `CACHED` 直接复用。所以变化少的步骤（装依赖）放前面，天天变的（拷源码）放后面——缓存命中率直接决定构建速度。
- **两阶段构建**：构建要 devDependencies，运行不需要。最终镜像只带生产依赖 + dist，体积从 ~1GB 压到 ~200MB。

---

## 6. docker compose：编排整个服务栈

`docker-compose.yml`（PG + 自构建应用）：

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: dev123
      POSTGRES_DB: recon
    volumes:
      - pgdata:/var/lib/postgresql/data
    # 注意：不发布端口，只在内部网络可达

  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:dev123@db:5432/recon
    depends_on:
      - db

volumes:
  pgdata:
```

```bash
docker compose up -d        # 一把全起
docker compose ps
docker compose logs -f api
docker compose down         # 全停删容器（卷保留）
docker compose down -v      # 连卷一起删（重置数据库用）
```

**两个最值钱的知识点：**

1. **服务名即域名**：compose 自动建内部网络，同网络容器用服务名互相解析。`DATABASE_URL` 里写 `db:5432` 直连；写 `localhost:5432` 指的是 api 容器自己，永远连不上——新手第一大坑。
2. **「发布」与「内部可达」的区别**（看 `compose ps` 输出）：
   - `0.0.0.0:8082->80/tcp`：发布了端口，外界可达；
   - `5432/tcp`（无箭头）：仅内部网络可达。
   - **生产姿势：数据库永远不对外发布端口**，只暴露应用层入口，攻击面最小化。

---

## 7. 命令速查表（按使用频率）

| 场景 | 命令 |
|---|---|
| 看日志排障 | `docker logs -f --tail 100 容器名` |
| 进容器排查 | `docker exec -it 容器名 bash`（alpine 用 `sh`） |
| 看在跑什么 | `docker ps` / `docker compose ps` |
| 磁盘占用 | `docker system df` |
| 清理垃圾 | `docker system prune`（停掉的容器/悬空镜像/缓存） |
| 看容器细节 | `docker inspect 容器名`（IP、挂载、环境变量） |
| 拷文件进出容器 | `docker cp 容器名:/path ./local` |
| 验证镜像加速 | `docker info` 看 Registry Mirrors |

---

## 8. 常见坑清单

1. 拉镜像 `unexpected EOF` → 网络问题，配镜像加速器（见第 2 节）。
2. 容器里改了文件，删容器后「丢失」→ 可写层随容器销毁，不是 bug 是机制。
3. compose 里应用连数据库写 `localhost` → 应写服务名（如 `db`）。
4. 数据库 `-p 5432:5432` 发布到公网 → 调试可以，生产禁止。
5. `docker compose down -v` 会连数据卷一起删 → 想清楚再敲。
6. PG 容器起来后立刻连报拒绝 → 首次初始化要几秒，`docker logs pg` 等 `ready to accept connections`。

---

## 9. Backlog（用到再学）

- `docker compose exec`（进 compose 管的服务排障）
- 镜像推送到远程 registry（`docker tag` + `docker push`）
- 多环境 compose 文件拆分（`docker-compose.override.yml`）
- 容器资源限制（memory / cpus）

## 10. 衔接对账 MVP 的部署形态

Nest 应用写好后，把 compose 里的 `web`/`api` 服务换成：

```yaml
  api:
    build: ../nest项目目录
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:dev123@db:5432/recon
    depends_on:
      - db
```

`docker compose up -d` 一把起，即为完整部署。Dockerfile 用第 5 节的两阶段模板。
