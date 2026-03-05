<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  // code is used internally only to validate the entry — never shown to the user
  export let code: string | null = null;
  // passed tracks whether the user found the code — not shown to the user
  export let passed: boolean | null = null;

  let entry = '';
  let submitting = false;
  let localSubmitted = false;

  // True once submitted locally or once the parent has recorded a result
  $: displaySubmitted = localSubmitted || passed !== null;
  // Reset local state when switching to a fresh (unsubmitted) scenario
  $: if (passed === null) { localSubmitted = false; }

  function submit() {
    const value = entry.trim();
    if (submitting || displaySubmitted || value === '') return;
    submitting = true;
    localSubmitted = true;
    entry = '';
    dispatch('submit', value);
    setTimeout(() => { submitting = false; }, 100);
  }
</script>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background-color: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
    color: #374151;
  }
  :global(.dark) .bar {
    background-color: #1f2937;
    border-color: #374151;
    color: #d1d5db;
  }
  .bar input {
    flex: 1;
    min-width: 0;
    padding: 0.25rem 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    background: white;
    color: #111827;
  }
  :global(.dark) .bar input {
    background: #111827;
    border-color: #374151;
    color: #f9fafb;
  }
  .bar button {
    padding: 0.25rem 0.75rem;
    background: #e5e7eb;
    border: 1px solid #d1d5db;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    cursor: pointer;
    white-space: nowrap;
  }
  :global(.dark) .bar button {
    background: #374151;
    border-color: #4b5563;
    color: #f9fafb;
  }
  .bar button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>

<div class="bar">
  <span>Attention check:</span>
  <input
    type="text"
    bind:value={entry}
    placeholder="enter code if you see one"
    disabled={submitting || displaySubmitted}
    on:keydown={(e) => e.key === 'Enter' && submit()}
  />
  <button on:click={submit} disabled={submitting || displaySubmitted}>Submit</button>
</div>
