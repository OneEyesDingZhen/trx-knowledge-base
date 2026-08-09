import { defineConfig } from 'vitepress'

// GitHub Pages 部署时 workflow 会注入 DOCS_BASE（如 /仓库名/），本地预览默认为 /dist/（配合根目录跳转页）
const base = process.env.DOCS_BASE || '/dist/'

export default defineConfig({
  base,
  lang: 'zh-CN',
  title: 'TRX 知识库',
  description: '前端 / 后端 / 财务业务 / 运维 —— 个人学习与项目文档集',
  lastUpdated: true,
  cleanUrls: true,
  outDir: '../dist',
  appearance: 'dark', // 默认深色，灰黑基调；用户可手动切换

  themeConfig: {
    logo: '📚',
    siteTitle: 'TRX 知识库',

    nav: [
      { text: '首页', link: '/' },
      { text: '前端', link: '/frontend/' },
      { text: '后端', link: '/backend/' },
      { text: '财务业务', link: '/finance/' },
      { text: '运维', link: '/devops/' },
      {
        text: '专题研读',
        items: [
          { text: 'AR/AP 财务实战课', link: '/arap-course/index' },
          { text: 'ERPNext FI/AR 调研', link: '/erpnext-fi-ar-research/README' },
          { text: 'Vendure 深度内化', link: '/vendure/README' },
          { text: '高并发高可用认知手册', link: '/高并发高可用认知手册/README' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/OneEyesDingZhen/trx-knowledge-base' },
    ],

    editLink: {
      pattern: 'https://github.com/OneEyesDingZhen/trx-knowledge-base/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页',
    },

    footer: {
      message: '基于 VitePress 构建 · 自动部署于 GitHub Pages',
      copyright: 'TRX Knowledge Base',
    },

    sidebar: {
      '/frontend/': [
        {
          text: '前端',
          items: [
            { text: '分类总览', link: '/frontend/' },
            { text: '中后台构建 SOP · 主手册', link: '/frontend/admin-sop' },
            { text: 'SOP 附录 · 页面套路库', link: '/frontend/admin-sop-pages' },
            { text: '浏览器渲染管线集训', link: '/frontend/browser-rendering-pipeline' },
          ],
        },
      ],
      '/backend/': [
        {
          text: '后端',
          items: [
            { text: '分类总览', link: '/backend/' },
            { text: '后端核心能力 Case Demo', link: '/backend/backend-core-cases' },
            { text: 'Elasticsearch 学习手册', link: '/backend/elasticsearch' },
          ],
        },
      ],
      '/高并发高可用认知手册/': [
        {
          text: '高并发高可用认知手册',
          collapsed: false,
          items: [
            { text: '阅读指南', link: '/高并发高可用认知手册/README' },
            { text: '00 导论：并发与可用性的本质矛盾', link: '/高并发高可用认知手册/00-导论：并发与可用性的本质矛盾' },
            {
              text: '高并发篇',
              collapsed: true,
              items: [
                { text: '01 缓存体系', link: '/高并发高可用认知手册/高并发篇/01-缓存体系' },
                { text: '02 限流', link: '/高并发高可用认知手册/高并发篇/02-限流' },
                { text: '03 削峰与异步化', link: '/高并发高可用认知手册/高并发篇/03-削峰与异步化' },
                { text: '04 负载均衡与水平扩展', link: '/高并发高可用认知手册/高并发篇/04-负载均衡与水平扩展' },
                { text: '05 分库分表与热点问题', link: '/高并发高可用认知手册/高并发篇/05-分库分表与热点问题' },
              ],
            },
            {
              text: '高可用篇',
              collapsed: true,
              items: [
                { text: '06 冗余设计', link: '/高并发高可用认知手册/高可用篇/06-冗余设计' },
                { text: '07 熔断降级与超时控制', link: '/高并发高可用认知手册/高可用篇/07-熔断降级与超时控制' },
                { text: '08 容灾与备份恢复', link: '/高并发高可用认知手册/高可用篇/08-容灾与备份恢复' },
                { text: '09 灰度发布与容量规划', link: '/高并发高可用认知手册/高可用篇/09-灰度发布与容量规划' },
              ],
            },
            {
              text: '架构演进篇',
              collapsed: true,
              items: [
                { text: '10 分布式架构基础', link: '/高并发高可用认知手册/架构演进篇/10-分布式架构基础' },
                { text: '11 微服务架构', link: '/高并发高可用认知手册/架构演进篇/11-微服务架构' },
                { text: '12 微前端', link: '/高并发高可用认知手册/架构演进篇/12-微前端' },
                { text: '13 演进路线与取舍', link: '/高并发高可用认知手册/架构演进篇/13-演进路线与取舍' },
              ],
            },
            { text: '附录-面试速查QA（40题）', link: '/高并发高可用认知手册/附录-面试速查QA' },
          ],
        },
      ],
      '/arap-course/': [
        {
          text: 'AR/AP 财务实战课',
          items: [
            { text: '课程总览与数据导入', link: '/arap-course/index' },
            { text: '01 会计最小知识包', link: '/arap-course/01-会计最小知识' },
            { text: '02 主数据：系统的地基', link: '/arap-course/02-主数据' },
            { text: '03 应收全流程：开票与收款', link: '/arap-course/03-应收全流程' },
            { text: '04 应付全流程：收票与付款', link: '/arap-course/04-应付全流程' },
            { text: '05 对账与账龄', link: '/arap-course/05-对账与账龄' },
            { text: '06 红冲与更正', link: '/arap-course/06-红冲与更正' },
            { text: '07 期末结账与三大报表', link: '/arap-course/07-期末结账' },
            { text: '08 从 Frappe Books 到 ERPNext', link: '/arap-course/08-走向ERPNext' },
          ],
        },
      ],
      '/erpnext-fi-ar-research/': [
        {
          text: 'ERPNext FI/AR 调研',
          items: [
            { text: '调研文档总览', link: '/erpnext-fi-ar-research/README' },
            { text: '01 模块地图与页面设计', link: '/erpnext-fi-ar-research/01-module-map-and-page-design' },
            { text: '02 业务流程', link: '/erpnext-fi-ar-research/02-business-processes' },
            { text: '03 数据模型', link: '/erpnext-fi-ar-research/03-data-model' },
            { text: '04 架构与高可用', link: '/erpnext-fi-ar-research/04-architecture-and-ha' },
            { text: '05 映射到你的系统', link: '/erpnext-fi-ar-research/05-mapping-to-your-system' },
          ],
        },
      ],
      '/vendure/': [
        {
          text: 'Vendure 深度内化',
          items: [
            { text: '文档总览', link: '/vendure/README' },
            { text: '01 业务模型与流程闭环', link: '/vendure/01-business-model' },
            { text: '02 架构与技术栈', link: '/vendure/02-architecture' },
            { text: '03 心智模型与方法论', link: '/vendure/03-mental-model' },
            { text: '04 源码上手方法论', link: '/vendure/04-source-playbook' },
          ],
        },
      ],
      '/finance/': [
        {
          text: '财务业务',
          items: [
            { text: '分类总览', link: '/finance/' },
            { text: '财务系统详细设计文档', link: '/finance/finance-system-design' },
          ],
        },
      ],
      '/devops/': [
        {
          text: '运维',
          items: [
            { text: '分类总览', link: '/devops/' },
            { text: '运维实战笔记（Shell/Docker/计网/Nginx）', link: '/devops/ops-notes-shell-docker-nginx' },
            { text: 'Docker 实操入门', link: '/devops/docker-practice' },
            { text: 'Ubuntu 开发私服搭建指南', link: '/devops/ubuntu-dev-server' },
            { text: '个人开发私服运维手册', link: '/devops/dev-server-guide' },
          ],
        },
      ],
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
          },
        },
      },
    },

    outline: { label: '本页目录', level: [2, 3] },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdated: { text: '最后更新' },
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '外观',
  },
})
