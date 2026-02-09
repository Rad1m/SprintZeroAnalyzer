<script lang="ts">
	interface Props {
		onfile: (file: File) => void;
		fileName: string;
	}

	let { onfile, fileName }: Props = $props();

	let dragover = $state(false);
	let fileInput: HTMLInputElement;

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragover = false;
		const file = e.dataTransfer?.files[0];
		if (file) onfile(file);
	}

	function handleChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) onfile(file);
	}
</script>

{#if !fileName}
	<div
		class="upload-zone"
		class:dragover
		role="button"
		tabindex="0"
		ondragover={(e) => { e.preventDefault(); dragover = true; }}
		ondragleave={() => { dragover = false; }}
		ondrop={handleDrop}
		onclick={() => fileInput.click()}
		onkeydown={(e) => { if (e.key === 'Enter') fileInput.click(); }}
	>
		<div class="upload-icon">&#8615;</div>
		<p>Drop a <strong>.sprintzero</strong> file here or click to browse</p>
	</div>
{:else}
	<div
		class="file-info"
		role="button"
		tabindex="0"
		onclick={() => fileInput.click()}
		onkeydown={(e) => { if (e.key === 'Enter') fileInput.click(); }}
	>
		<span class="file-name">{fileName}</span>
		<span class="change-hint">click to change</span>
	</div>
{/if}

<input
	bind:this={fileInput}
	type="file"
	accept=".sprintzero"
	hidden
	onchange={handleChange}
/>
