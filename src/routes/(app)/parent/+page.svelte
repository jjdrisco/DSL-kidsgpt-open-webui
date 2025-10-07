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
    parentGender: string;
    parentAge: string;
    parentPreferences: string;
  }

  // State variables
  let childProfiles: ChildProfileItem[] = [];
  let selectedChildIndex = 0;
  let profileSubmitted = false;
  let isEditingProfile = false;
  let showProfileModal = false;
  let editInModal = false;

  // Form data
  let childName = '';
  let childAge = '';
  let childGender = '';
  let childCharacteristics = '';
  let childParentInfo = {
    parentingStyle: '',
    parentGender: '',
    parentAge: '',
    parentPreferences: ''
  };

  // Load child profiles from localStorage
  function loadChildProfile() {
    const savedProfiles = localStorage.getItem('childProfiles');
    if (savedProfiles) {
      try {
        childProfiles = JSON.parse(savedProfiles);
        profileSubmitted = childProfiles.length > 0;
        
        // Migration: if we have old single profile format, convert to new format
        if (childProfiles.length > 0 && !childProfiles[0].hasOwnProperty('parentGender')) {
          childProfiles = childProfiles.map(profile => ({
            ...profile,
            parentGender: '',
            parentAge: '',
            parentPreferences: ''
          }));
          localStorage.setItem('childProfiles', JSON.stringify(childProfiles));
        }
        
        if (childProfiles.length > 0) {
          hydrateFormFromSelectedChild();
        }
      } catch (error) {
        console.error('Error parsing child profiles:', error);
        childProfiles = [];
      }
    } else {
      // Check for old single profile format
      const savedProfile = localStorage.getItem('childProfile');
      if (savedProfile) {
        try {
          const oldProfile = JSON.parse(savedProfile);
          childProfiles = [{
            ...oldProfile,
            parentGender: '',
            parentAge: '',
            parentPreferences: ''
          }];
          localStorage.setItem('childProfiles', JSON.stringify(childProfiles));
          localStorage.removeItem('childProfile'); // Remove old format
          profileSubmitted = true;
          hydrateFormFromSelectedChild();
        } catch (error) {
          console.error('Error parsing old profile:', error);
        }
      }
    }
  }

  // Save child profile to localStorage
  function saveChildProfile() {
    applyFormToSelectedChild();
    localStorage.setItem('childProfiles', JSON.stringify(childProfiles));
    profileSubmitted = true;
    isEditingProfile = false;
    showProfileModal = false;
    editInModal = false;
  }

  // Start editing profile
  function startEditingProfile() {
    isEditingProfile = true;
  }

  // Add new child
  function addNewChild() {
    const newChild: ChildProfileItem = {
      name: '',
      age: '',
      gender: '',
      characteristics: '',
      parentingStyle: '',
      parentGender: '',
      parentAge: '',
      parentPreferences: ''
    };
    childProfiles = [...childProfiles, newChild];
    selectedChildIndex = childProfiles.length - 1;
    hydrateFormFromSelectedChild();
    showProfileModal = true;
    editInModal = true;
  }

  // Select child profile
  function selectChildProfile(index: number) {
    selectedChildIndex = index;
    hydrateFormFromSelectedChild();
    showProfileModal = true;
    editInModal = false;
  }

  // Apply form data to selected child
  function applyFormToSelectedChild() {
    if (childProfiles[selectedChildIndex]) {
      childProfiles[selectedChildIndex] = {
        name: childName,
        age: childAge,
        gender: childGender,
        characteristics: childCharacteristics,
        parentingStyle: childParentInfo.parentingStyle,
        parentGender: childParentInfo.parentGender,
        parentAge: childParentInfo.parentAge,
        parentPreferences: childParentInfo.parentPreferences
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
      childParentInfo.parentingStyle = child.parentingStyle;
      childParentInfo.parentGender = child.parentGender;
      childParentInfo.parentAge = child.parentAge;
      childParentInfo.parentPreferences = child.parentPreferences;
    }
  }

  // Get dynamic grid template for child buttons
  function getChildGridTemplate() {
    const count = childProfiles.length;
    if (count === 0) return 'grid-cols-1';
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count === 3) return 'grid-cols-3';
    if (count === 4) return 'grid-cols-2 lg:grid-cols-4';
    return 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
  }

  // Delete child profile
  function deleteChild(index: number) {
    childProfiles.splice(index, 1);
    
    if (childProfiles.length === 0) {
      // Clear form if no children left
      childName = '';
      childAge = '';
      childGender = '';
      childCharacteristics = '';
      childParentInfo.parentingStyle = '';
      childParentInfo.parentGender = '';
      childParentInfo.parentAge = '';
      childParentInfo.parentPreferences = '';
      selectedChildIndex = 0;
      profileSubmitted = false;
    } else {
      // Adjust selected index
      if (selectedChildIndex >= childProfiles.length) {
        selectedChildIndex = childProfiles.length - 1;
      }
      hydrateFormFromSelectedChild();
    }
    
    localStorage.setItem('childProfiles', JSON.stringify(childProfiles));
    
    // Close modal if it's open
    showProfileModal = false;
    editInModal = false;
  }

  onMount(() => {
    loadChildProfile();
  });
</script>

<div class="flex flex-col w-full h-screen max-h-[100dvh] transition-width duration-200 ease-in-out {$showSidebar ? 'md:max-w-[calc(100%-260px)]' : ''} max-w-full">
  <!-- Navigation Bar -->
  <Navbar />

  <!-- Main Content -->
  <div class="flex-1 overflow-auto">
    <div class="container mx-auto px-4 py-6 max-w-6xl">
      <!-- Header with Add Kid button -->
      <div class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Parent Dashboard</h1>
          <p class="text-gray-600 dark:text-gray-400">Manage your child profiles and settings</p>
        </div>
        
        <!-- Add Kid button in top-right -->
        <button
          type="button"
          class="relative z-10 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-full font-medium hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
          on:click={addNewChild}
        >
          + Add Kid
        </button>
      </div>

      <!-- Child Profile Section -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Child Profiles</h2>
        
        {#if childProfiles.length === 0}
          <!-- No children state -->
          <div class="text-center py-12">
            <div class="mb-6">
              <div class="w-24 h-24 mx-auto bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full flex items-center justify-center">
                <svg class="w-12 h-12 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
              </div>
            </div>
            <h3 class="text-xl font-medium text-gray-900 dark:text-white mb-2">Set up your kids</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-6">Create profiles for your children to get personalized experiences</p>
          </div>
        {:else}
          <!-- Children buttons grid -->
          <div class="grid {getChildGridTemplate()} gap-4 pr-24">
            {#each childProfiles as child, index}
              <button
                type="button"
                class="relative group p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 hover:shadow-lg"
                on:click={() => selectChildProfile(index)}
              >
                <div class="text-center">
                  <div class="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                    {child.name ? child.name.charAt(0).toUpperCase() : 'K'}
                  </div>
                  <h3 class="font-semibold text-gray-900 dark:text-white text-lg mb-1">
                    {child.name || `Kid ${index + 1}`}
                  </h3>
                  {#if child.age}
                    <p class="text-sm text-gray-600 dark:text-gray-400">Age: {child.age}</p>
                  {/if}
                  {#if child.gender}
                    <p class="text-sm text-gray-600 dark:text-gray-400">Gender: {child.gender}</p>
                  {/if}
                </div>
                
                <!-- Delete button (visible on hover) -->
                <button
                  type="button"
                  class="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  on:click|stopPropagation={() => deleteChild(index)}
                >
                  ×
                </button>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Child Profile Modal -->
  {#if showProfileModal}
    <div 
      class="fixed inset-0 z-50 overflow-y-auto"
      on:click={() => showProfileModal = false}
      role="dialog"
      aria-modal="true"
      aria-label="Child Profile Modal"
    >
      <div class="flex min-h-screen items-center justify-center p-4">
        <div 
          class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 {editInModal ? 'max-w-4xl w-full' : 'max-w-md w-full'}"
          on:click|stopPropagation
        >
          <!-- Close button -->
          <button
            type="button"
            class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            on:click={() => showProfileModal = false}
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>

          {#if !editInModal}
            <!-- Preview Mode -->
            <div class="text-center">
              <div class="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                {childProfiles[selectedChildIndex]?.name ? childProfiles[selectedChildIndex].name.charAt(0).toUpperCase() : 'K'}
              </div>
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {childProfiles[selectedChildIndex]?.name || `Kid ${selectedChildIndex + 1}`}
              </h2>
              <div class="text-gray-600 dark:text-gray-400 space-y-1 mb-6">
                {#if childProfiles[selectedChildIndex]?.age}
                  <p><strong>Age:</strong> {childProfiles[selectedChildIndex].age}</p>
                {/if}
                {#if childProfiles[selectedChildIndex]?.gender}
                  <p><strong>Gender:</strong> {childProfiles[selectedChildIndex].gender}</p>
                {/if}
                {#if childProfiles[selectedChildIndex]?.characteristics}
                  <p><strong>Characteristics:</strong> {childProfiles[selectedChildIndex].characteristics}</p>
                {/if}
                {#if childProfiles[selectedChildIndex]?.parentingStyle}
                  <p><strong>Parenting Style:</strong> {childProfiles[selectedChildIndex].parentingStyle}</p>
                {/if}
              </div>
              <button
                type="button"
                class="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                on:click={() => editInModal = true}
              >
                Change Profile
              </button>
            </div>
          {:else}
            <!-- Edit Mode -->
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              {childProfiles.length > 0 ? 'Edit Child Profile' : 'Add Child Profile'}
            </h2>
            
            <form on:submit|preventDefault={saveChildProfile} class="space-y-6">
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Child Information -->
                <div class="space-y-4">
                  <h3 class="text-lg font-medium text-gray-900 dark:text-white">Child Information</h3>
                  
                  <div>
                    <label for="childName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Child's Name *
                    </label>
                    <input
                      id="childName"
                      type="text"
                      bind:value={childName}
                      required
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label for="childAge" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Age *
                    </label>
                    <input
                      id="childAge"
                      type="text"
                      bind:value={childAge}
                      required
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label for="childGender" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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

                  <div>
                    <label for="childCharacteristics" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Characteristics & Interests *
                    </label>
                    <textarea
                      id="childCharacteristics"
                      bind:value={childCharacteristics}
                      required
                      rows="3"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    ></textarea>
                  </div>
                </div>

                <!-- Parent Information -->
                <div class="space-y-4">
                  <h3 class="text-lg font-medium text-gray-900 dark:text-white">Parent Information</h3>
                  
                  <div>
                    <label for="parentingStyle" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Parenting Style *
                    </label>
                    <textarea
                      id="parentingStyle"
                      bind:value={childParentInfo.parentingStyle}
                      required
                      rows="3"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    ></textarea>
                  </div>

                  <div>
                    <label for="parentGender" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Parent Gender
                    </label>
                    <select
                      id="parentGender"
                      bind:value={childParentInfo.parentGender}
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>

                  <div>
                    <label for="parentAge" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Parent Age
                    </label>
                    <input
                      id="parentAge"
                      type="text"
                      bind:value={childParentInfo.parentAge}
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label for="parentPreferences" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Parent Preferences
                    </label>
                    <textarea
                      id="parentPreferences"
                      bind:value={childParentInfo.parentPreferences}
                      rows="2"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    ></textarea>
                  </div>
                </div>
              </div>

              <!-- Action buttons -->
              <div class="flex gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="submit"
                  class="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Save Profile
                </button>
                <button
                  type="button"
                  class="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
                  on:click={() => showProfileModal = false}
                >
                  Cancel
                </button>
              </div>
            </form>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>