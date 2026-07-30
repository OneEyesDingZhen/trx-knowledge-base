# Ubuntu 开发私服完全指南（VMware + Win11 宿主机实战版）

> **适用场景**：9800X3D / 48GB 内存主机，VMware Workstation + Ubuntu 虚拟机（6 核 / 32GB / 独占三星 980 1TB），
> 目标是「一台安静跑在角落的开发私服」：JDK、Node、MySQL、PostgreSQL、Redis 全装好，笔记本随时随地连进来写代码，
> 娱乐时关机释放全部性能。
>
> **命令适用版本**：Ubuntu 24.04 LTS 与 26.04 LTS 通用。
>
> **使用约定**：下文出现 `<用户名>` 一律替换为你的 Ubuntu 登录名（不确定就执行 `whoami` 查看）；
> 出现 `192.168.1.x` 的网段按你家路由器实际情况替换（VM 里执行 `ip route` 第一行就能看到网段）。

---

## 目录

- 第 0 章：开工前 5 分钟核对
- 第 1 章：系统初始化（换源 / 更新 / 基础工具）
- 第 2 章：网络规划——拿到一个固定 IP
- 第 3 章：SSH 密钥登录与安全加固
- 第 4 章：远程开发体验（VS Code / JetBrains / 文件管理）
- 第 5 章：开发环境全家桶（Docker / 数据库 / JDK / Node）
- 第 6 章：防火墙与自动安全更新
- 第 7 章：OpenCode 安装与 Kimi API 配置
- 第 8 章：给朋友、同事临时演示的三种方案
- 第 9 章：性能调优与「游戏 / 开发」双模式切换
- 第 10 章：备份与快照策略
- 第 11 章：日常速查表
- 第 12 章：排错 FAQ

---

## 第 0 章：开工前 5 分钟核对

在动 Ubuntu 之前，先确认 VMware 侧这几项都对了：

| 核对项 | 期望状态 | 在哪看 |
|---|---|---|
| CPU 虚拟化（SVM） | 已启用 | Win11 任务管理器 → 性能 → CPU → 右下角「虚拟化：已启用」 |
| 虚拟机内存 | 32GB | 虚拟机设置 → 硬件 → 内存 |
| 处理器 | 6 核 | 虚拟机设置 → 处理器（建议 1 个插槽 × 6 核） |
| 磁盘位置 | 三星 980 那块盘上 | 虚拟机设置 → 硬盘 → 右侧显示 .vmdk 路径 |
| 磁盘控制器 | NVMe（性能最好） | 虚拟机设置 → 硬盘 → 高级 |
| 网络适配器 | 先保持默认，第 2 章再定 | 虚拟机设置 → 网络适配器 |
| 处理器 → 虚拟化引擎 | 勾选「虚拟化 AMD-V/RVI」 | 给将来嵌套虚拟化（KVM、安卓模拟器）留后手，跑 Docker 本身不需要 |

> 如果 SVM 显示「已禁用」：关机 → 开机按 Del 进 BIOS → Advanced → CPU Configuration → SVM Mode → Enabled → F10 保存。
> 装好 VMware 再开 SVM 也没关系，不需要重装 VMware 或虚拟机。

---

## 第 1 章：系统初始化

### 1.1 换国内镜像源（必做，不然 apt 慢到怀疑人生）

24.04 起 Ubuntu 改用 `/etc/apt/sources.list.d/ubuntu.sources` 新格式，下面这条命令新旧格式一起处理：

```bash
sudo sed -i.bak \
  -e 's|http://cn.archive.ubuntu.com/ubuntu|https://mirrors.tuna.tsinghua.edu.cn/ubuntu|g' \
  -e 's|http://archive.ubuntu.com/ubuntu|https://mirrors.tuna.tsinghua.edu.cn/ubuntu|g' \
  -e 's|http://security.ubuntu.com/ubuntu|https://mirrors.tuna.tsinghua.edu.cn/ubuntu|g' \
  /etc/apt/sources.list /etc/apt/sources.list.d/ubuntu.sources 2>/dev/null

sudo apt update && sudo apt full-upgrade -y
```

> 提示某个文件不存在可忽略（说明你系统只有一种源配置文件）。备份自动存为 `.bak` 后缀，出问题可还原。
> 换完顺手重启一次：`sudo reboot`（内核大概率也更新了）。

### 1.2 基础工具一把梭

```bash
sudo apt install -y \
  open-vm-tools \
  openssh-server \
  build-essential git curl wget vim unzip zip \
  htop btop net-tools dnsutils tree jq \
  ca-certificates gnupg lsb-release \
  fail2ban
```

- `open-vm-tools`：VMware 官方开源增强工具（时间同步、性能统计、优雅关机都靠它），Ubuntu Server 版装这个就够，不用装 desktop 版。
- `openssh-server`：远程连接的命根子，第 3 章细讲。
- `fail2ban`：防暴力破解，第 3 章启用。

### 1.3 时区与小设置

```bash
# 时区
sudo timedatectl set-timezone Asia/Shanghai
timedatectl   # 验证，应显示 Time zone: Asia/Shanghai

# （可选）改个好认的主机名
sudo hostnamectl set-hostname dev-server

# （可选）sudo 免密，私服自用图省事可以开
echo "<用户名> ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/99-<用户名>
```

### 1.4 目录约定（全手册统一，后面脚本都按这个来）

```bash
mkdir -p ~/projects ~/data ~/backup ~/apps
```

| 目录 | 用途 |
|---|---|
| `~/projects` | 所有代码仓库 |
| `~/data` | Docker 数据库的数据文件（好备份、好迁移） |
| `~/backup` | 数据库定时备份输出 |
| `~/apps` | docker-compose 等编排文件 |

> ✅ 走到这里，可以在 VMware 菜单 **虚拟机 → 快照 → 拍摄快照**，命名 `基线-系统初始化完成`。
> 后面每完成一个大阶段就打一个，翻车随时回滚。

---

## 第 2 章：网络规划——拿到一个固定 IP

这一步直接决定「笔记本能不能优雅地连进来」，先花一分钟做决策：

| 模式 | 原理 | 优点 | 缺点 | 适合谁 |
|---|---|---|---|---|
| **桥接（推荐）** | 虚拟机像一台独立电脑，直接从路由器拿局域网 IP | 笔记本、手机、同 WiFi 设备全都能直接访问 | 换路由器网段要改配置 | 你：要从笔记本连进来 |
| NAT + 端口转发 | 虚拟机藏在宿主机后面，靠宿主机转发端口 | 不依赖路由器 | 笔记本连不进来（只能宿主机自己玩），每开个端口都要配转发 | 只在宿主机本机用 |

### 2.1 桥接模式设置（推荐路线）

1. 关闭虚拟机。
2. VMware 菜单 **编辑 → 虚拟网络编辑器 → 更改设置（管理员）** → 选中 `VMnet0` →
   「桥接到」下拉框**手动选择你的有线网卡**（Realtek PCIe 2.5GbE），**不要选「自动」**——
   自动经常桥到 WiFi 网卡上导致玄学断网。
3. 虚拟机设置 → 网络适配器 → 选「桥接模式」→ 开机。

### 2.2 配置静态 IP

先看网卡名和当前拿到的 IP：

```bash
ip a   # 找到形如 ens33 / ens34 的网卡名，记下当前 DHCP 分到的 IP
```

编辑 netplan（文件名可能是 `50-cloud-init.yaml` 或 `01-netcfg.yaml`，用 `ls /etc/netplan/` 看）：

```bash
sudo vim /etc/netplan/50-cloud-init.yaml
```

改成（网卡名、网段按实际替换）：

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    ens33:
      dhcp4: false
      addresses: [192.168.1.200/24]
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses: [223.5.5.5, 119.29.29.29]
```

生效并验证：

```bash
sudo netplan apply
ip a                  # 确认 ens33 已是 192.168.1.200
ping -c 3 baidu.com   # 确认能上网
```

> **坑提示**：如果重启后配置被还原，是 cloud-init 在抢方向盘，执行：
> `echo 'network: {config: disabled}' | sudo tee /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg`
> 再重新 `netplan apply`。
>
> **IP 建议**：选 `.200` 这种大数，避开路由器 DHCP 自动分配池（一般 2–100），防止和别人撞车。
> 更稳妥的做法是顺便在路由器后台把这个 IP 和虚拟机 MAC 绑定（IP/MAC 地址绑定）。

### 2.3 备选路线：NAT + 端口转发

如果你只在宿主机本机连接虚拟机：保持 NAT 即可，宿主机直接 `ssh <用户名>@NAT分到的IP`。
想让局域网其他设备也访问，则在 **虚拟网络编辑器 → VMnet8 → NAT 设置 → 端口转发** 里加映射，
例如把宿主机的 `2222 → 虚拟机:22`，别人连 `宿主机IP:2222` 即可。每个新端口都要来这加一条，所以长期玩还是桥接省心。

---

## 第 3 章：SSH 密钥登录与安全加固

### 3.1 确认 SSH 服务在跑

```bash
sudo systemctl enable --now ssh
sudo systemctl status ssh   # active (running) 即正常
```

### 3.2 生成密钥（在 Windows 上操作，宿主机和笔记本各做一次）

打开 PowerShell：

```powershell
ssh-keygen -t ed25519 -C "dev-laptop"
# 一路回车即可，生成在 C:\Users\<你的Win用户名>\.ssh\

# 把公钥推送到虚拟机（替换成你的信息）
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh <用户名>@192.168.1.200 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

验证免密：`ssh <用户名>@192.168.1.200`，不再要密码即成功。

> 宿主机和笔记本都要连的话，两台各自生成密钥、各自推送一次公钥（会追加，不冲突）。

### 3.3 配个别名，以后 `ssh dev` 直达

编辑 `C:\Users\<你的Win用户名>\.ssh\config`（没有就新建）：

```
Host dev
  HostName 192.168.1.200
  User <用户名>
  IdentityFile ~/.ssh/id_ed25519
```

之后 PowerShell 里 `ssh dev` 直接进私服。VS Code Remote 也认这个别名。

### 3.4 加固（确认密钥能登录之后再做！）

```bash
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf > /dev/null << 'EOF'
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
EOF

sudo systemctl reload ssh
```

> ⚠️ 操作时**保留一个已登录的 SSH 会话别关**，另开一个新连接验证还能登录，再关旧的——防止把自己锁外面。
> 真锁了也不慌：VMware 控制台窗口还能用密码登进去改回来。

### 3.5 fail2ban 启动

```bash
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd   # 能看到 sshd jail 即生效
```

默认策略（连错几次封 10 分钟）对私服够用，不用调。

---

## 第 4 章：远程开发体验——「笔记本的便携 + 工作站的性能」

这一章是整个方案的核心兑现点。配完之后：**代码存在虚拟机、编译跑在虚拟机、数据库在虚拟机，
你的笔记本（或宿主机）只出一块屏幕和一个键盘**，风扇都不带转的。

### 4.1 VS Code Remote-SSH（首选）

1. 笔记本/宿主机装好 VS Code，扩展商店搜索安装 **Remote - SSH**（微软官方，`ms-vscode-remote.remote-ssh`）。
2. `F1` → 输入 `Remote-SSH: Connect to Host` → 选 `dev`（就是第 3.3 节配的别名）。
3. 第一次连接会在虚拟机里自动安装 VS Code Server（约 1–2 分钟，虚拟机需能上网）。
4. 连上后 `文件 → 打开文件夹` → 选 `/home/<用户名>/projects`，开干。

要点：

- **扩展分两端**：主题类扩展装在本地，语言类（Java、ESLint、Prettier）要点击「在 SSH: dev 中安装」装到虚拟机端——代码分析、跑测试都在私服上执行。
- **终端即私服终端**：VS Code 内置终端打开就是虚拟机的 shell，编译、跑脚本全部发生在 6 核 32GB 上。
- **端口自动转发**：在虚拟机里启动一个 3000 端口的 Web 服务，VS Code 会自动转发，浏览器访问 `localhost:3000` 就能看，无需任何配置（「端口」面板里可管理）。
- 手动转发（VS Code 之外用）：`ssh -L 8080:localhost:8080 dev`。

### 4.2 JetBrains Gateway（IDEA 用户）

IDEA 系的重型 Java 开发远程方案是 Gateway：

1. 笔记本装 **JetBrains Gateway**（免费，Toolbox App 里就有）。
2. 新建连接 → SSH → 填 `192.168.1.200` + 用户名 → 选择要用的 IDE 版本（如 IntelliJ IDEA Ultimate）。
3. 首次连接会把 IDE 后端（约 1GB+）下载安装到虚拟机，之后笔记本上跑的是一个瘦客户端 UI，
   索引、编译、调试全在私服完成——这正是「6000 元轻薄本吊打重型本」的场景。

> Gateway 对内存敏感的其实是虚拟机端（后端吃 2–4GB），你 32GB 随便造。

### 4.3 文件管理（之前问的「服务器文件怎么管」）

按顺手程度三选一，可以都用：

| 场景 | 工具 | 说明 |
|---|---|---|
| 日常改代码 | VS Code Remote | 左侧文件树直接拖拽上传/下载，最无感 |
| 大文件搬运、可视化目录 | **WinSCP** | 装好后新建站点：协议 SFTP、主机 `192.168.1.200`、用户名 + 密钥登录，双栏拖拽 |
| 想在资源管理器里当本地盘用 | SSHFS-Win | 把 `~/projects` 映射成 Windows 盘符（可选，非必需） |

> 不建议装 Samba 或折腾 VMware Shared Folders：前者配置繁琐，后者在无 GUI 的 Server 版上体验差且性能一般。SFTP 开箱即用还加密。

### 4.4 数据库可视化管理

宿主机/笔记本上装 **DBeaver**（免费）或 **DataGrip**，直接填 `192.168.1.200:3306` / `5432` 连接——
前提是第 5 章数据库装好 + 第 6 章防火墙放行，后面都会带到。

---

## 第 5 章：开发环境全家桶

策略先说清：**运行环境（MySQL/PG/Redis）一律走 Docker，语言工具链（JDK/Node/Maven）装宿主机式原包**。

- Docker 装数据库：不污染系统、版本随便换、删库重来一条命令、备份只认 `~/data` 一个目录。
- 语言工具链装系统级：IDE 集成最顺，编译路径最短。

### 5.1 Git

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
git config --global init.defaultBranch main
ssh-keygen -t ed25519 -C "dev-server"   # 用于推 GitHub/Gitee，公钥贴到平台后台
```

### 5.2 Docker 安装

```bash
# 一键脚本（走阿里云镜像，国内稳）
curl -fsSL https://get.docker.com | sudo sh -s -- --mirror Aliyun

# 免 sudo 用 docker（重连 SSH 后生效）
sudo usermod -aG docker <用户名>

# 镜像加速器 + 日志瘦身
sudo tee /etc/docker/daemon.json > /dev/null << 'EOF'
{
  "registry-mirrors": ["https://<你的加速器ID>.mirror.aliyuncs.com"],
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF

sudo systemctl restart docker
docker run --rm hello-world   # 验证
```

> 加速器地址免费获取：阿里云控制台搜「容器镜像服务 ACR」→ 镜像工具 → 镜像加速器，每人一个专属地址。
> 不加日志限制，容器日志半年后能吃掉你几十 GB。

### 5.3 数据库三件套（MySQL + PostgreSQL + Redis）

一份 compose 文件全搞定。编辑 `~/apps/docker-compose.yml`：

```yaml
services:
  mysql:
    image: mysql:8.4
    container_name: mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: "改成强密码A"
      TZ: Asia/Shanghai
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_0900_ai_ci
    ports:
      - "3306:3306"
    volumes:
      - ${HOME}/data/mysql:/var/lib/mysql

  postgres:
    image: postgres:17
    container_name: postgres
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: "改成强密码B"
      TZ: Asia/Shanghai
    ports:
      - "5432:5432"
    volumes:
      - ${HOME}/data/postgres:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: redis
    restart: unless-stopped
    command: redis-server --requirepass 改成强密码C --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - ${HOME}/data/redis:/data
```

启动与验证：

```bash
cd ~/apps
docker compose up -d
docker compose ps          # 三个都 Up 即成功

docker exec -it mysql mysql -uroot -p       # 进 MySQL 玩玩
docker exec -it postgres psql -U postgres   # 进 PG 玩玩
docker exec -it redis redis-cli -a 改成强密码C
```

建业务账号（root 别直接给程序用）：

```sql
-- MySQL 里执行
CREATE DATABASE appdb DEFAULT CHARSET utf8mb4;
CREATE USER 'app'@'%' IDENTIFIED BY '业务密码';
GRANT ALL PRIVILEGES ON appdb.* TO 'app'@'%';
FLUSH PRIVILEGES;
```

```bash
# PG 一条命令搞定
docker exec -it postgres psql -U postgres -c "CREATE USER app WITH PASSWORD '业务密码'; CREATE DATABASE appdb OWNER app;"
```

之后 DBeaver / DataGrip / 后端代码都连 `192.168.1.200:3306`（或 5432）。

> 容器设置了 `restart: unless-stopped`，虚拟机重启后数据库自动拉起，零维护。

### 5.4 JDK（Java 后端）

```bash
# 主版本先装 21（当前主流 LTS）
sudo apt install -y openjdk-21-jdk
java -version
```

需要多版本（老项目 Java 8/17）时用 SDKMAN! 管理，切换一条命令：

```bash
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"

sdk install java 17.0.13-tem
sdk install java 8.0.432-tem
sdk use java 17.0.13-tem        # 当前会话临时切
sdk default java 21             # 永久切
```

### 5.5 Maven + 阿里云仓库（必配，否则拉依赖拉到天亮）

```bash
sudo apt install -y maven
mkdir -p ~/.m2
```

编辑 `~/.m2/settings.xml`：

```xml
<settings>
  <mirrors>
    <mirror>
      <id>aliyun</id>
      <name>Aliyun Central</name>
      <url>https://maven.aliyun.com/repository/public</url>
      <mirrorOf>central</mirrorOf>
    </mirror>
  </mirrors>
</settings>
```

> Gradle 用户同理，在 `~/.gradle/init.gradle` 里把仓库换成 `https://maven.aliyun.com/repository/public`。
> Spring Boot 这种依赖大户配上阿里源 + 6 核 32GB，编译体验和办公本完全是两个物种。

### 5.6 Node.js（fnm 管理多版本）

```bash
# 安装 fnm（比 nvm 快）
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc

# 装 LTS 并设为默认
fnm install --lts
fnm default lts-latest
node -v

# 国内镜像 + pnpm
npm config set registry https://registry.npmmirror.com
npm i -g pnpm
```

### 5.7 （可选）Nginx

```bash
sudo apt install -y nginx
```

反代你的前端构建产物、给演示加个统一入口时用得上，不急可以后面再装。

> ✅ 本章完成，打第二个快照：`环境-全家桶装完`。

---

## 第 6 章：防火墙与自动安全更新

虚拟机虽然在内网，但数据库端口裸奔不是好习惯。用 ufw 只放行局域网：

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 按你的网段替换 192.168.1.0/24（ip route 第一行可见）
sudo ufw allow from 192.168.1.0/24 to any port 22 proto tcp comment 'SSH'
sudo ufw allow from 192.168.1.0/24 to any port 3306 proto tcp comment 'MySQL'
sudo ufw allow from 192.168.1.0/24 to any port 5432 proto tcp comment 'PostgreSQL'
sudo ufw allow from 192.168.1.0/24 to any port 6379 proto tcp comment 'Redis'
sudo ufw allow from 192.168.1.0/24 to any port 8000:9999 proto tcp comment '开发调试端口段'
sudo ufw allow 80,443/tcp comment 'HTTP(S)'

sudo ufw enable
sudo ufw status verbose   # 检查规则
```

> 之后跑新项目需要新端口，要么落在 8000–9999 段，要么照格式补一条。

自动安全更新（Ubuntu Server 默认已装，确认一下即可）：

```bash
systemctl status unattended-upgrades   # active 即放心
```

---

## 第 7 章：OpenCode 安装与 Kimi API 配置

之前聊过「Kimi 拿 API Key 走 OpenCode 做项目」——可行，这里落地。**装在虚拟机里**：
它要读代码、跑命令，而代码和运行时都在虚拟机上，装一起才是完全体。你只出 API 调用费，不碰任何本地模型部署。

### 7.1 安装

```bash
# 官方脚本（推荐）
curl -fsSL https://opencode.ai/install | bash

# 或者走 npm（前面已装好 Node）
npm i -g opencode-ai@latest

opencode --version   # 验证
```

### 7.2 接入 Kimi（Moonshot）

1. 去 Moonshot 开放平台（`platform.moonshot.cn`）充值并创建 API Key。
2. 在 OpenCode 里配置。最简单的方式：进入 OpenCode 后输入 `/connect`，看列表里有没有现成的 Moonshot 供应商，有就直接填 Key。
3. 没有现成条目（或想自己掌控）就写配置文件。编辑全局配置 `~/.config/opencode/opencode.json`：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "moonshot": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Moonshot AI",
      "options": {
        "baseURL": "https://api.moonshot.cn/v1",
        "apiKey": "sk-你的Key"
      },
      "models": {
        "kimi-k2-0905-preview": {
          "name": "Kimi K2"
        }
      }
    }
  },
  "model": "moonshot/kimi-k2-0905-preview"
}
```

> 模型 ID 只是示例，以控制台「模型列表」里当前可用的为准（K2 系列更新很快，换新版只需改这两个地方的 ID）。
> Key 不想写明文的话，删掉 `apiKey` 行，改在 `~/.bashrc` 里 `export MOONSHOT_API_KEY=sk-xxx`，OpenCode 会自动读。

### 7.3 日常用法

```bash
cd ~/projects/你的项目
opencode          # 进入 TUI
# 首次进项目先执行 /init，让它扫描项目生成 AGENTS.md 上下文
# /models 可随时切换模型
```

- 在 **VS Code Remote 的内置终端**里直接敲 `opencode`，就是「私服算力 + AI Agent」的合体形态。
- 费用提醒：Agent 干活会大量烧 token，去 Moonshot 控制台设个每月额度上限/余额提醒，图安心。

---

## 第 8 章：给朋友、同事临时演示的三种方案

| 方案 | 适用 | 成本 | 难度 |
|---|---|---|---|
| A. 同局域网直接访问 | 朋友在你家、同事在同一办公室网络 | 0 | ⭐ |
| B. Tailscale 组网 | 异地、长期、要安全 | 免费 | ⭐⭐ |
| C. Cloudflare 临时隧道 | 异地、一次性演示、对方什么都不装 | 免费 | ⭐ |

**方案 A**：桥接模式下虚拟机就是局域网一员，直接发 `http://192.168.1.200:端口号` 给对方，
确认第 6 章 ufw 放行了该端口即可。

**方案 B（推荐长期用）**：

```bash
# 虚拟机里装
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up   # 浏览器登录一次，拿到 100.x.x.x 的固定 IP
```

笔记本也装 Tailscale 客户端登录同一账号——从此**无论在哪，笔记本都能 `ssh 100.x.x.x` 连上私服**，
不受家里网络限制。给朋友看就在 Tailscale 后台把这台机器「共享」到他的账号，演示完一键收回。
另外注意 ufw 加一条：`sudo ufw allow in on tailscale0`。

**方案 C（最省事的一次性演示）**：

```bash
# 装 cloudflared（一次即可）
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# 临时把本地 3000 端口暴露成一个公网 https 随机域名
cloudflared tunnel --url http://localhost:3000
```

终端会打印一个 `https://xxx-yyy.trycloudflare.com` 链接，甩给任何人都能打开，`Ctrl+C` 即关闭。
不用注册、不用域名，演示神器。

---

## 第 9 章：性能调优与「游戏 / 开发」双模式

### 9.1 VMware 侧优化（可选但有效）

关闭虚拟机，用记事本编辑虚拟机目录下的 `.vmx` 文件，追加：

```
mainMem.useNamedFile = "FALSE"
prefvmx.minVmMemPct = "100"
MemTrimRate = "0"
sched.mem.pshare.enable = "FALSE"
```

含义：内存全部预留（48GB 物理内存完全扛得住 32GB 预留）、不回收不气球，换来稳定的低延迟。
网络适配器类型确认是 **VMXNET3**（设置 → 网络适配器 → 高级里看）。

### 9.2 一键启动 / 关闭（vmrun 无头模式）

不用每次开 VMware 界面。在桌面建两个批处理：

**启动私服.bat**

```bat
@echo off
"C:\Program Files (x86)\VMware\VMware Workstation\vmrun.exe" -T ws start "E:\VMs\dev-server\dev-server.vmx" nogui
```

**关闭私服.bat**

```bat
@echo off
"C:\Program Files (x86)\VMware\VMware Workstation\vmrun.exe" -T ws stop "E:\VMs\dev-server\dev-server.vmx" soft
```

- vmrun 路径以你实际安装目录为准；`.vmx` 路径改成三星 980 盘上的实际虚拟机目录。
- `nogui` 表示后台静默跑，不开窗口；`soft` 是优雅关机（等 Ubuntu 正常关机流程走完）。
- 想开机自动跑：任务计划程序 → 创建任务 → 触发器「登录时」→ 操作指向「启动私服.bat」。

### 9.3 游戏 / 开发双模式

- **开发模式**：双击启动，32GB 内存 + 6 核划给私服，宿主还剩 16GB + 2 核，日常办公、浏览器毫无压力。
- **游戏模式**：双击「关闭私服.bat」（或 VMware 里挂起）。32GB 内存和 6 核全部还给 Windows，满血娱乐。
  挂起（Suspend）vs 关机：挂起秒恢复但磁盘要多占 32GB 内存镜像；关机彻底零占用。**建议直接关机**，
  数据库有 `unless-stopped` 自启，开机一分钟内全部就绪，和挂起体验差别不大。
- 之前问的内存超频（4800 → 6000）：BIOS 里开 **EXPO**（AMD 平台的 XMP 等价物）即可，
  与虚拟机互不干扰，建议先开 EXPO 跑稳再进系统折腾上面的内容。

---

## 第 10 章：备份与快照策略

**快照 ≠ 备份**。快照防「手滑改坏系统」，备份防「盘挂掉数据全没」。两者都要。

### 10.1 快照节奏（VMware → 快照管理器）

| 时机 | 命名建议 |
|---|---|
| 系统初始化完 | `基线-系统初始化完成` |
| 全家桶装完 | `环境-全家桶装完` |
| 每次大改前（升级内核、换数据库版本） | `改动前-YYYYMMDD-说明` |

快照留 2–3 个就够，长期挂着一长串快照会拖慢磁盘性能。

### 10.2 数据库自动备份（cron 每日）

新建 `~/backup.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail
DIR="$HOME/backup/$(date +%F)"
mkdir -p "$DIR"

docker exec mysql mysqldump -uroot -p'改成强密码A' --all-databases --single-transaction | gzip > "$DIR/mysql_all.sql.gz"
docker exec postgres pg_dumpall -U postgres | gzip > "$DIR/pg_all.sql.gz"
tar czf "$DIR/redis.tar.gz" -C "$HOME/data" redis

# 只保留最近 14 天
find "$HOME/backup" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
echo "done: $DIR"
```

```bash
chmod +x ~/backup.sh
crontab -e
# 加一行：每天凌晨 3 点备份
# 0 3 * * * /home/<用户名>/backup.sh >> /home/<用户名>/backup/cron.log 2>&1
```

### 10.3 备份再拷一份到 Windows 宿主机（防盘挂）

数据只躺在三星 980 一块盘上不算真备份。让 Windows 也持有一份：

1. Win11 开启 OpenSSH 服务端（管理员 PowerShell）：

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType 'Automatic'
```

2. 虚拟机生成密钥（5.1 已生成可复用），把虚拟机公钥追加到 Windows 的授权文件。
   **注意 Windows 的坑**：如果 Windows 账户是管理员，公钥要写到 `C:\ProgramData\ssh\administrators_authorized_keys`，
   而不是用户目录下的 `authorized_keys`。
3. 在 `~/backup.sh` 末尾加一行推送（IP 换成宿主机局域网 IP）：

```bash
scp -r "$DIR" <Win用户名>@192.168.1.10:/D:/vm-backup/ && echo "pushed to windows"
```

### 10.4 代码

代码不做本地备份——**永远推远端**（GitHub 私有库 / Gitee）。养成下班 `git push` 的肌肉记忆，
私服炸了也就损失一天的未提交改动。

---

## 第 11 章：日常速查表

| 我要干嘛 | 命令 / 入口 |
|---|---|
| 连上私服 | `ssh dev` |
| 看虚拟机状态 | VMware 里 `vmrun list` |
| 数据库起来了没 | `docker compose -f ~/apps/docker-compose.yml ps` |
| 重启数据库三件套 | `cd ~/apps && docker compose restart` |
| 看资源占用 | `btop` |
| 手动备份一次 | `~/backup.sh` |
| 开端口给局域网 | `sudo ufw allow from 192.168.1.0/24 to any port <端口> proto tcp` |
| 临时公网演示 | `cloudflared tunnel --url http://localhost:<端口>` |
| 升级系统 | `sudo apt update && sudo apt full-upgrade -y` |
| 查看服务日志 | `journalctl -u <服务名> -f` 或 `docker logs -f mysql` |

**端口规划表**：

| 端口 | 用途 |
|---|---|
| 22 | SSH |
| 3306 / 5432 / 6379 | MySQL / PostgreSQL / Redis |
| 80 / 443 | Nginx 与演示入口 |
| 8000–9999 | 各项目开发调试（前端 5173、后端 8080 都往这段放） |

---

## 第 12 章：排错 FAQ

**Q1：突然 `ssh dev` 连不上了？**
九成是 IP 变了。进 VMware 控制台 `ip a` 看当前 IP——回了 DHCP 就重做第 2.2 节静态 IP；
另外确认虚拟网络编辑器里桥接绑的是 **Realtek 有线网卡**而不是 WiFi。

**Q2：桥接模式虚拟机拿不到 IP / 没网？**
虚拟网络编辑器 → VMnet0 → 桥接到指定有线网卡，别用「自动」。
公司/校园网有 MAC 绑定时桥接会被拦，那种环境退回 NAT 方案。

**Q3：`apt` 下载龟速或报错？**
源没换成功，重跑 1.1 的命令并 `cat /etc/apt/sources.list.d/ubuntu.sources` 确认域名已变成清华。

**Q4：`docker pull` 拉不动镜像？**
加速器没配或失效：检查 `/etc/docker/daemon.json`，去阿里云控制台重新确认加速器地址，`sudo systemctl restart docker`。

**Q5：虚拟机时间不对？**
`sudo timedatectl set-ntp true`，并确认 open-vm-tools 已装（它负责和宿主机对时）。

**Q6：宿主机变卡？**
看看是不是 32GB 预留 + 一堆浏览器标签把内存顶满了；游戏前直接关掉虚拟机。
长期卡可按 9.1 检查 .vmx 参数是否生效。

**Q7：VMware 和 Hyper-V / WHP 冲突？**
现在的 VMware Workstation 已能跑在 Hyper-V 之上，不用纠结卸载 Hyper-V；
但如果你在 VM 里跑安卓模拟器等嵌套虚拟化场景性能异常，可以考虑关闭 Hyper-V（`bcdedit /set hypervisorlaunchtype off`，重启生效，想开回来改成 `auto`）。

**Q8：把虚拟机整个搬到新电脑？**
直接整块拷贝三星 980 上的虚拟机目录（.vmx + .vmdk 全家），新电脑 VMware「打开」选 .vmx 即可。
网络配置（静态 IP）按新环境的网段改一遍，其余原样可用——这也是当初把虚拟机单独放一块盘的隐藏红利。

---

## 收尾

执行顺序建议：**第 0–3 章（一个晚上）→ 第 4–6 章（一个晚上）→ 第 7–10 章（周末半天）**。
全部走完后你会拥有：一台 6 核 32GB、数据库齐全、AI Agent 待命、每日自动备份、
游戏时一键满血释放的私人开发服务器。周末开工愉快。

---

## 参考来源

[^1^]: OpenCode 官方文档 — 安装方式与配置说明（opencode.ai/docs，2026-07 查阅）
[^2^]: Ubuntu 26.04 LTS 发布计划（2026-04-23 正式版发布，26.04.1 约 2026-08-06）
