<script setup lang="ts">
import { ref, onMounted } from 'vue'

const KEY = 'trx-view-prefs'
const sidebarHidden = ref(false)
const asideHidden = ref(false)

function apply() {
  const el = document.documentElement
  el.classList.toggle('hide-sidebar', sidebarHidden.value)
  el.classList.toggle('hide-aside', asideHidden.value)
  localStorage.setItem(KEY, JSON.stringify({ s: sidebarHidden.value, a: asideHidden.value }))
}

onMounted(() => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || '{}')
    sidebarHidden.value = !!p.s
    asideHidden.value = !!p.a
  } catch { /* 忽略损坏的本地配置 */ }
  apply()
})

function toggleSidebar() {
  sidebarHidden.value = !sidebarHidden.value
  apply()
}

function toggleAside() {
  asideHidden.value = !asideHidden.value
  apply()
}
</script>

<template>
  <div class="view-toggles" role="group" aria-label="视图开关">
    <button
      class="vt-btn vt-sidebar"
      :class="{ off: sidebarHidden }"
      :title="sidebarHidden ? '显示左侧目录' : '隐藏左侧目录'"
      :aria-label="sidebarHidden ? '显示左侧目录' : '隐藏左侧目录'"
      @click="toggleSidebar"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="9" y1="3" x2="9" y2="21" />
      </svg>
    </button>
    <button
      class="vt-btn vt-aside"
      :class="{ off: asideHidden }"
      :title="asideHidden ? '显示章节概览' : '隐藏章节概览'"
      :aria-label="asideHidden ? '显示章节概览' : '隐藏章节概览'"
      @click="toggleAside"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="15" y1="3" x2="15" y2="21" />
      </svg>
    </button>
  </div>
</template>
