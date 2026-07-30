# 运维实战学习笔记：Shell → Docker → 计网 → Nginx

> 日期：2026-07-28 ｜ 环境：Ubuntu VM（桥接）+ Docker
> 主线：**Shell 是操作一切的基本功 → Docker 是运行环境 → 计网告诉你流量怎么走 → Nginx 是流量的入口**

---

## 一、Linux Shell 核心概念与脚本

### 1. 三根管子（最核心的心智模型）

每个进程出生自带三根"管子"：

| 管子 | 编号 | 默认连着 |
|---|---|---|
| stdin 标准输入 | 0 | 键盘 |
| stdout 标准输出 | **1** | 屏幕 |
| stderr 标准错误 | **2** | 屏幕 |

命令行程序 = **"输入流 → 加工 → 输出流"的纯函数**，`|` 就是函数组合。

### 2. 管道与重定向

```bash
cat access.log | grep "500" | wc -l
# 等价 JS：readFile().filter(l => l.includes("500")).length
```

- `|`：把左边程序的 **stdout** 接到右边程序的 **stdin**（只接管 stdout，不管 stderr）
- `>`：把 stdout 重定向到**文件**（持久化）
- `2>&1`：把 stderr 合并到 stdout 当前的去向（**顺序敏感**：`> log 2>&1` ✅，`2>&1 > log` ❌）

### 3. 高频命令速查

| 命令 | 作用 | 前端类比 |
|---|---|---|
| `cat` | 文件内容吐到 stdout | readFile + console.log |
| `grep "x"` | 筛选含 x 的行 | lines.filter() |
| `head -5` | 取前 5 行 | slice(0, 5) |
| `wc -l` / `-c` | 数行 / 数字节 | length |
| `sed -i "s/旧/新/g"` | 批量替换（`.` 需转义 `\.`） | replaceAll |
| `chmod +x` | 加执行权限 | — |
| `docker exec` | 钻进容器执行命令 | — |

### 4. 脚本的三种执行方式

| 方式 | 谁是被执行的程序 | 权限要求 | 变量影响 |
|---|---|---|---|
| `./s.sh` | 脚本自己（看 shebang） | 需 +x | 子进程，跑完即焚 |
| `bash s.sh` | bash 读脚本当数据 | 只读 | 子进程，跑完即焚 |
| `source s.sh` | **当前 shell 亲自读** | 只读 | **留在当前进程** |

- `#!/bin/bash`（shebang）：文件第一行，告诉系统用哪个解释器
- 环境变量**只能从父进程传给子进程**，子进程改不了父进程 → 所以 `source ~/.bashrc` 能立即生效

### 5. 脚本语法四件套

```bash
#!/bin/bash
target=$1                              # 参数 $1 $2；变量等号两边【无空格】
date_str=$(date +%Y%m%d)               # $(命令) 抓 stdout，≈ 模板字符串

if [ -z "$target" ]; then              # 方括号两边【必须有空格】
    echo "缺参数"; exit 1              # 退出码：0=成功，非0=失败（CI 门禁的底层）
fi
if [ ! -d "backup/$target" ]; then     # -d 目录存在，-f 文件存在，! 取反
    echo "目录不存在"; exit 2
fi

for code in 200 404 500 502; do        # for x in 列表，≈ for...of
    count=$(grep " $code " "$target" | wc -l)
    echo "状态码 $code: $count 次"
done
```

- 坑：未定义的变量 = **静默空字符串**，不报错 → 必须防守式编程
- 不同失败给不同退出码，CI 可区分失败原因

---

## 二、Docker 回顾

### 1. 核心概念

- **镜像 = class（只读模板），容器 = instance（活进程）**
- **分层缓存**：每行指令一层；某层变了 → 它和后面所有层重建 → Dockerfile 按"变化频率从低到高"排列：

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./    # 依赖清单：偶尔变
RUN npm ci               # 上面没变 → 缓存命中秒过
COPY . .                 # 业务代码：天天变（放最后）
```

### 2. 三条铁律

1. **端口映射 `-p 宿主机:容器`**：`-p 8080:80` → 浏览器访问 `localhost:8080`
2. **不挂 volume = 数据即删即毁**：MySQL 必须 `-v mysql_data:/var/lib/mysql`
3. **容器启动返回 ID ≠ 活着**：排查第一板斧是 `docker ps -a` + `docker logs <容器>`

### 3. 容器网络（本次最大增量）

- 容器是**独立网络世界**：容器里的 `localhost` 是容器自己
- 跨容器通信：`docker network create lab-net` + `docker network connect`，**容器名即域名**（Docker 内置 DNS）
- 生产推论：后端容器**不需要 `-p` 暴露端口**，只对 Nginx 内部可见

---

## 三、计网（运维视角三条线）

1. **DNS**：浏览器拿到域名第一件事是解析成 IP
2. **端口独占**：OS 按 `IP:端口` 分发，一个端口只能一个进程 → **一台机器只有一个 80，Nginx 是唯一入口**（Node 去监听 3000，安全组只放行 80/443）
3. **Host 头**：一个 IP 可挂 N 个域名，Nginx 靠 `Host` 匹配 `server_name` 分发；没有匹配的 → 交给该端口的**默认 server**（配置里第一个，或 `default_server` 显式指定）→ 生产上常配"兜底 server"返回 403

---

## 四、Nginx

### 1. 配置三层模型

```
http → server（按 Host 匹配）→ location（按 URL 匹配）→ 指令决定干什么
```

### 2. location 优先级

```
精确 =  >  前缀 ^~  >  正则 ~  >  普通前缀  >  兜底 /
```

`location /` 匹配一切但优先级最低，是兜底不是通吃。

### 3. 两大角色（合体 = 中后台部署标准答案）

```nginx
upstream backend_group {          # 服务器组：负载均衡
    server backend:3000;
    server backend2:3000;         # 默认轮询
}

server {
    listen 80;
    server_name _;

    # 角色二：反向代理
    location /api/ {
        proxy_pass http://backend_group;    # 后面光秃秃 = 原样转发；带 / = 替换前缀
        proxy_set_header Host $host;                        # 原始域名
        proxy_set_header X-Real-IP $remote_addr;            # 真实用户IP
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 角色一：静态托管（SPA 必配 try_files）
    location / {
        root /var/www/finance/dist;
        try_files $uri $uri/ /index.html;   # 文件找不到 → 回退 index.html 交给前端路由
    }
}
```

### 4. 安全三部曲（肌肉记忆）

```bash
nginx -t                  # ① 体检（不碰线上）
systemctl reload nginx    # ② 热加载：新 worker 上新配置，老 worker 处理完退休，无缝
curl localhost            # ③ 验证
# 容器版：docker exec my-nginx nginx -t && docker exec my-nginx nginx -s reload
```

### 5. 高频指令 & 坑

- `client_max_body_size 20m;` —— 默认仅 **1m**，文件上传必改（否则 413）
- **Nginx 只在 reload/启动时解析 upstream 域名**：解析失败会**静默降级**（语法检查查不出、请求被 failover 吞掉，症状只有"负载不均"）→ 现象不对先重 reload，再查 `docker logs` 和 error.log
- 容器里 `$remote_addr` 可能是网桥 IP（Docker DNAT 换乘），生产直连时才是真实用户 IP

### 6. 负载均衡算法与"有状态"难题

| 算法 | 配置 | 特点 |
|---|---|---|
| 轮询 | 默认 | 严格交替 |
| ip_hash | `ip_hash;` | 同 IP 固定一台，简单但可能不均 |
| least_conn | `least_conn;` | 打向连接数最少的 |

- **session 存单机内存 + 轮询 = 薛定谔的登录** → 正解是**无状态化**：session/JWT 放 Redis 共享

---

## 五、今日实战产物（~/nginx-lab）

```
nginx-lab/
├── finance.conf        # Nginx 站点配置（挂载进容器）
├── html/index.html     # 静态首页
├── backend/server.js   # Node 后端 1
├── backend/server2.js  # Node 后端 2（验证轮询）
└── update_proxy.sh     # 代理 IP 批量替换脚本
```

```bash
# 一键还原架构（3 容器 + 1 网络）
docker network create lab-net
docker run -d --name my-nginx -p 8080:80 --network lab-net \
  -v ~/nginx-lab/finance.conf:/etc/nginx/conf.d/default.conf \
  -v ~/nginx-lab/html:/usr/share/nginx/html nginx
docker run -d --name backend  --network lab-net -v ~/nginx-lab/backend/server.js:/app/server.js  node:20-alpine node /app/server.js
docker run -d --name backend2 --network lab-net -v ~/nginx-lab/backend/server2.js:/app/server.js node:20-alpine node /app/server.js
```

## 六、下次预告

- **docker-compose**：把今天手搓的 3 容器 + 网络写成一个 YAML，`docker compose up` 一键起
- Nginx 进阶：HTTPS 证书、gzip、缓存策略、按请求头分流
- 代理排障：`curl --noproxy "*"`、VM 桥接网络、Windows Allow LAN（治本法：路由器静态 DHCP 绑定）
