<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { Motion } from 'svelte-motion';
	import { onMount } from 'svelte';

	export let className: string | undefined = undefined;

	let inView1 = false;
	let motionRef1: HTMLDivElement | null = null;

	onMount(() => {
		const observer1 = new IntersectionObserver(([entry]) => {
			inView1 = entry.isIntersecting;
		}, { threshold: 0.1 });
		if (motionRef1) observer1.observe(motionRef1);
	});
</script>

<div class={cn('...', className)}>
	<div class="...">
		<!-- 변경점: let:motion 으로 받고, use:motion 디렉티브 사용 -->
		<Motion
			let:motion
			initial={{ opacity: 0.5, width: '15rem' }}
			animate={{
				opacity: inView1 ? 1 : 0.5,
				width: inView1 ? '30rem' : '15rem'
			}}
			transition={{
				delay: 0.3,
				duration: 0.8,
				ease: 'easeInOut'
			}}
			style={{
				backgroundImage: `conic-gradient(var(--conic-position), var(--tw-gradient-stops))`
			}}
		>
			<div
				use:motion
				bind:this={motionRef1}
				class="bg-gradient-conic absolute inset-auto right-1/2 h-56 w-[30rem] ..."
			>
				<!-- ... -->
			</div>
		</Motion>
	</div>
</div>
