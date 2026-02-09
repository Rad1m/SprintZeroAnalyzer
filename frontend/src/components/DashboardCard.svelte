<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		wide?: boolean;
		onclick: () => void;
		children: Snippet;
	}

	let { label, wide = false, onclick, children }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onclick();
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="dashboard-card"
	class:wide
	onclick={onclick}
	onkeydown={handleKeydown}
	role="button"
	tabindex="0"
>
	<div class="card-label">{label}</div>
	<div class="card-body">
		{@render children()}
	</div>
</div>

<style>
	.dashboard-card {
		background: #161b22;
		border: 1px solid #21262d;
		border-radius: 8px;
		padding: 0.5rem;
		cursor: pointer;
		transition: border-color 0.2s;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.dashboard-card:hover,
	.dashboard-card:focus-visible {
		border-color: #39FF14;
		outline: none;
	}

	.wide {
		grid-column: span 2;
	}

	.card-label {
		font-size: 0.65rem;
		font-weight: 600;
		color: #8b949e;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.15rem 0.25rem;
		flex-shrink: 0;
	}

	.card-body {
		flex: 1;
		min-height: 0;
		overflow: auto;
		position: relative;
	}
</style>
