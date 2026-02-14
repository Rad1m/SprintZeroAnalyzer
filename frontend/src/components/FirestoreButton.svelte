<script lang="ts">
	interface Props {
		onclick: () => void;
		loading: boolean;
		disabled: boolean;
	}

	let { onclick, loading, disabled }: Props = $props();
</script>

<button
	class="firestore-btn"
	{onclick}
	disabled={disabled || loading}
>
	{#if loading}
		<span class="spinner"></span>
		Loading...
	{:else}
		<span class="firestore-icon">&#9729;</span>
		Load from Firestore
	{/if}
</button>

<style>
	.firestore-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1.25rem;
		background: #1c2128;
		border: 1px solid #FF9F0A;
		border-radius: 6px;
		color: #FF9F0A;
		font-family: inherit;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s, border-color 0.2s;
	}

	.firestore-btn:hover:not(:disabled) {
		background: #2a1f0d;
		border-color: #ffb340;
	}

	.firestore-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.firestore-icon {
		font-size: 1.1rem;
	}

	.spinner {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 2px solid #FF9F0A;
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
