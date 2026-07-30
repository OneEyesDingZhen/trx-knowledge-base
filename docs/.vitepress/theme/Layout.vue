<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import ViewToggles from './ViewToggles.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <!-- 全局右下角：左右栏折叠开关（桌面/iPad 横屏） -->
    <template #layout-bottom>
      <ViewToggles />
    </template>
  </Layout>
</template>
