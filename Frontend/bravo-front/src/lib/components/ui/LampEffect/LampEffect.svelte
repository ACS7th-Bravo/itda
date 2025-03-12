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
			
		>
			<div
				
			>
				<!-- ... -->
			</div>
		</Motion>
	</div>
</div>
