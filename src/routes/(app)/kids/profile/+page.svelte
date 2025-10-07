<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { showSidebar } from '$lib/stores';
  import Navbar from '$lib/components/chat/Navbar.svelte';

  // Child profile data structure
  interface ChildProfileItem {
    name: string;
    age: string;
    gender: string;
    characteristics: string;
    parentingStyle: string;
  }

  // State variables
  let childProfiles: ChildProfileItem[] = [];
  let selectedChildIndex = 0;
  
  // Form data
  let childName = '';
  let childAge = '';
  let childGender = '';
  let childCharacteristics = '';
  let parentingStyle = '';

  // Load child profiles from localStorage
  function loadChildProfiles() {
    const savedProfiles = localStorage.getItem('childProfiles');
    if (savedProfiles) {
      try {
        childProfiles = JSON.parse(savedProfiles);
        if (childProfiles.length > 0) {
          hydrateFormFromSelectedChild();
        }
      } catch (error) {
        console.error('Error parsing child profiles:', error);
        childProfiles = [];
      }
    } else {
      childProfiles = [];
    }
  }

  // Save child profile to localStorage
  function saveChildProfile() {
    if (childProfiles.length === 0) {
      // Create new profile if none exist
      const newProfile: ChildProfileItem = {
        name: childName,
        age: childAge,
        gender: childGender,
        characteristics: childCharacteristics,
        parentingStyle: parentingStyle
      };
      childProfiles = [newProfile];
      selectedChildIndex = 0;
    } else {
      // Update existing profile
      applyFormToSelectedChild();
    }
    
    localStorage.setItem('childProfiles', JSON.stringify(childProfiles));
    
    // Clear the popup flag so it shows updated data
    sessionStorage.removeItem('childProfilePopupShown');
    
    // Navigate back to chat
    goto('/');
  }

  // Apply form data to selected child
  function applyFormToSelectedChild() {
    if (childProfiles[selectedChildIndex]) {
      childProfiles[selectedChildIndex] = {
        name: childName,
        age: childAge,
        gender: childGender,
        characteristics: childCharacteristics,
        parentingStyle: parentingStyle
      };
    }
  }

  // Populate form with selected child's data
  function hydrateFormFromSelectedChild() {
    if (childProfiles[selectedChildIndex]) {
      const child = childProfiles[selectedChildIndex];
      childName = child.name;
      childAge = child.age;
      childGender = child.gender;
      childCharacteristics = child.characteristics;
      parentingStyle = child.parentingStyle;
    }
  }

  // Delete a child profile
  function deleteChild(index: number) {
    childProfiles.splice(index, 1);
    
    if (childProfiles.length === 0) {
      // Clear form if no children left
      childName = '';
      childAge = '';
      childGender = '';
      childCharacteristics = '';
      parentingStyle = '';
      selectedChildIndex = 0;
    } else {
      // Adjust selected index
      if (selectedChildIndex >= childProfiles.length) {
        selectedChildIndex = childProfiles.length - 1;
      }
      hydrateFormFromSelectedChild();
    }
    
    localStorage.setItem('childProfiles', JSON.stringify(childProfiles));
  }

  // Add a new child profile
  function addNewChild() {
    const newChild: ChildProfileItem = {
      name: '',
      age: '',
      gender: '',
      characteristics: '',
      parentingStyle: ''
    };
    childProfiles = [...childProfiles, newChild];
    selectedChildIndex = childProfiles.length - 1;
    hydrateFormFromSelectedChild();
  }

  // Select a child profile
  function selectChild(index: number) {
    selectedChildIndex = index;
    hydrateFormFromSelectedChild();
  }

  // Back to chat
  function backToChat() {
    goto('/');
  }

  onMount(() => {
    loadChildProfiles();
  });
</script>

<div class="flex flex-col w-full h-screen max-h-[100dvh] transition-width duration-200 ease-in-out {$showSidebar ? 'md:max-w-[calc(100%-260px)]' : ''} max-w-full">
  <!-- Navigation Bar -->
  <Navbar />

  <!-- Main Content -->
  <div class="flex-1 overflow-auto">
    <div class="container mx-auto px-4 py-6 max-w-4xl">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Child Profile Setup</h1>
        <p class="text-gray-600 dark:text-gray-400">Set up your child's profile for a personalized experience</p>
      </div>

      <!-- Select Your Profile Section -->
      {#if childProfiles.length > 0}
        <div class="mb-8">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Select Your Profile</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each childProfiles as child, index}
              <button
                type="button"
                class="relative p-4 border-2 rounded-lg transition-all duration-200 {selectedChildIndex === index 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'}"
                on:click={() => selectChild(index)}
              >
                <div class="text-center">
                  <div class="w-12 h-12 mx-auto mb-2 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {child.name ? child.name.charAt(0).toUpperCase() : 'K'}
                  </div>
                  <h3 class="font-medium text-gray-900 dark:text-white">
                    {child.name || `Kid ${index + 1}`}
                  </h3>
                  {#if child.age}
                    <p class="text-sm text-gray-600 dark:text-gray-400">Age: {child.age}</p>
                  {/if}
                  {#if child.gender}
                    <p class="text-sm text-gray-600 dark:text-gray-400">Gender: {child.gender}</p>
                  {/if}
                </div>
                
                <!-- Delete button -->
                <button
                  type="button"
                  class="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                  on:click|stopPropagation={() => deleteChild(index)}
                >
                  ×
                </button>
              </button>
            {/each}
            
            <!-- Add Profile button -->
            <button
              type="button"
              class="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 transition-colors flex flex-col items-center justify-center min-h-[120px]"
              on:click={addNewChild}
            >
              <div class="text-2xl text-gray-400 mb-2">+</div>
              <span class="text-gray-600 dark:text-gray-400">Add Profile</span>
            </button>
          </div>
        </div>
      {/if}

      <!-- Form Section -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          {childProfiles.length > 0 ? 'Edit Profile Information' : 'Child Information'}
        </h2>

        <form on:submit|preventDefault={saveChildProfile} class="space-y-6">
          <!-- Child Information -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Child Information</h3>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Name -->
              <div>
                <label for="childName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Child's Name *
                </label>
                <input
                  id="childName"
                  type="text"
                  bind:value={childName}
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter child's name"
                />
              </div>

              <!-- Age -->
              <div>
                <label for="childAge" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Age *
                </label>
                <input
                  id="childAge"
                  type="text"
                  bind:value={childAge}
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="e.g., 8 years old"
                />
              </div>

              <!-- Gender -->
              <div>
                <label for="childGender" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Gender *
                </label>
                <select
                  id="childGender"
                  bind:value={childGender}
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <!-- Characteristics -->
              <div class="lg:col-span-2">
                <label for="childCharacteristics" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Characteristics & Interests *
                </label>
                <textarea
                  id="childCharacteristics"
                  bind:value={childCharacteristics}
                  required
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Describe your child's personality, interests, learning style, etc."
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Parent Information -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Parent Information</h3>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Parenting Style -->
              <div class="lg:col-span-2">
                <label for="parentingStyle" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Parenting Style *
                </label>
                <textarea
                  id="parentingStyle"
                  bind:value={parentingStyle}
                  required
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Describe your parenting approach, values, and preferences for your child's education and development"
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              class="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Save Profile
            </button>
            
            <button
              type="button"
              class="flex-1 bg-gray-500 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              on:click={backToChat}
            >
              Back to Chat
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>
