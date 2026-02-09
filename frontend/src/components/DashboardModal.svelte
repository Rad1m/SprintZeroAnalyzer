<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
		children: Snippet;
	}

	let { open, onclose, children }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onclose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="modal-backdrop" onclick={handleBackdrop}>
		<div class="modal-content">
			<button class="modal-close" onclick={onclose} aria-label="Close">&times;</button>
			<div class="modal-body">
				{@render children()}
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.75);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.15s ease-out;
	}

	.modal-content {
		width: 92vw;
		height: 85vh;
		background: #0d1117;
		border: 1px solid #30363d;
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		position: relative;
		animation: scaleIn 0.15s ease-out;
	}

	.modal-close {
		position: absolute;
		top: 0.5rem;
		right: 0.75rem;
		background: none;
		border: none;
		color: #8b949e;
		font-size: 1.5rem;
		cursor: pointer;
		z-index: 1;
		line-height: 1;
		padding: 0.25rem;
	}

	.modal-close:hover {
		color: #f0f0f0;
	}

	.modal-body {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 1.5rem;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes scaleIn {
		from { transform: scale(0.95); opacity: 0; }
		to { transform: scale(1); opacity: 1; }
	}
</style>
