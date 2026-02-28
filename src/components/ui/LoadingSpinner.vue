<script setup>
defineProps({
type: {
type: String,
default: 'spinner', // spinner, dots, pulse, wave
validator: (value) => ['spinner', 'dots', 'pulse', 'wave', 'skeleton'].includes(value)
},
size: {
type: String,
default: 'md', // sm, md, lg, xl
validator: (value) => ['sm', 'md', 'lg', 'xl'].includes(value)
},
color: {
type: String,
default: 'indigo' // indigo, blue, green, purple
},
message: {
type: String,
default: ''
},
overlay: {
type: Boolean,
default: false
}
});

const sizeClasses = {
sm: 'w-4 h-4',
md: 'w-8 h-8',
lg: 'w-12 h-12',
xl: 'w-16 h-16'
};

const colorClasses = {
indigo: 'text-indigo-600 dark:text-indigo-400',
blue: 'text-blue-600 dark:text-blue-400',
green: 'text-green-600 dark:text-green-400',
purple: 'text-purple-600 dark:text-purple-400'
};
</script>

<template>
<div 
:class="{ 'fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50': overlay }"
role="status"
aria-live="polite"
aria-busy="true"
>
<div class="flex flex-col items-center gap-4">
<!-- Spinner 加载器 -->
<div v-if="type === 'spinner'" :class="[sizeClasses[size], colorClasses[color]]">
<svg class="animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
</svg>
</div>

<!-- 点点加载器 -->
<div v-else-if="type === 'dots'" class="flex space-x-1">
<div
v-for="i in 3"
:key="i"
:class="[
size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-5 h-5',
'rounded-full animate-bounce',
colorClasses[color].replace('text-', 'bg-')
]"
:style="{ animationDelay: `${i * 0.1}s` }"
></div>
</div>

<!-- 脉冲加载器 -->
<div v-else-if="type === 'pulse'" :class="[sizeClasses[size], 'relative']">
<div :class="[
'absolute inset-0 rounded-full animate-ping',
colorClasses[color].replace('text-', 'bg-'),
'opacity-20'
]"></div>
<div :class="[
'relative rounded-full animate-pulse',
colorClasses[color].replace('text-', 'bg-'),
sizeClasses[size]
]"></div>
</div>

<!-- 波浪加载器 -->
<div v-else-if="type === 'wave'" class="flex items-end space-x-1">
<div
v-for="i in 5"
:key="i"
:class="[
size === 'sm' ? 'w-1' : size === 'md' ? 'w-2' : size === 'lg' ? 'w-3' : 'w-4',
'animate-wave rounded-full',
colorClasses[color].replace('text-', 'bg-')
]"
:style="{
animationDelay: `${i * 0.1}s`,
height: size === 'sm' ? '16px' : size === 'md' ? '32px' : size === 'lg' ? '48px' : '64px'
}"
></div>
</div>

<!-- 加载消息 -->
<p v-if="message" class="text-sm font-medium text-gray-600 dark:text-gray-400 animate-pulse">
{{ message }}
</p>
</div>
</div>
</template>

<style scoped>
</style>