import { WEBUI_API_BASE_URL } from '$lib/constants';

export interface ChildProfile {
	id: string;
	user_id: string;
	name: string;
	child_age?: string;
	child_gender?: string;
	child_characteristics?: string;
	parenting_style?: string;
	// New optional research fields
	is_only_child?: boolean;
	child_has_ai_use?: 'yes' | 'no' | 'unsure';
	child_ai_use_contexts?: string[];
	parent_llm_monitoring_level?:
		| 'active_rules'
		| 'occasional_guidance'
		| 'plan_to'
		| 'no_monitoring'
		| 'prefer_not_to_say'
		| 'other';
	// "Other" text fields for additional information
	child_gender_other?: string;
	child_ai_use_contexts_other?: string;
	parent_llm_monitoring_other?: string;
	// Cross-reference attention check field: child internet use frequency (1–8 scale)
	child_internet_use_frequency?: string;
	// Current attempt flag - only children with is_current: true are selectable
	is_current?: boolean;
	session_id?: string;
	attempt_number?: number;
	created_at: number;
	updated_at: number;
	child_email?: string;
	// Whitelist / feature control (set by parent)
	selected_features?: string[];
	selected_interface_modes?: string[];
}

export interface ChildProfileForm {
	name: string;
	child_age?: string;
	child_gender?: string;
	child_characteristics?: string;
	// New optional research fields
	is_only_child?: boolean;
	child_has_ai_use?: 'yes' | 'no' | 'unsure';
	child_ai_use_contexts?: string[];
	parent_llm_monitoring_level?:
		| 'active_rules'
		| 'occasional_guidance'
		| 'plan_to'
		| 'no_monitoring'
		| 'prefer_not_to_say'
		| 'other';
	// "Other" text fields for additional information
	child_gender_other?: string;
	child_ai_use_contexts_other?: string;
	parent_llm_monitoring_other?: string;
	// Cross-reference attention check field: child internet use frequency (1–8 scale)
	child_internet_use_frequency?: string;
	session_id?: string;
	child_email?: string;
	selected_features?: string[];
	selected_interface_modes?: string[];
}

export const getChildProfiles = async (token: string = '') => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/child-profiles`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getChildProfileById = async (token: string = '', profileId: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/child-profiles/${profileId}`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const createChildProfile = async (token: string = '', formData: ChildProfileForm) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/child-profiles`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify(formData)
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			if ('detail' in err) {
				error = err.detail;
			} else {
				error = err;
			}
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const updateChildProfile = async (
	token: string = '',
	profileId: string,
	formData: ChildProfileForm
) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/child-profiles/${profileId}`, {
		method: 'PUT',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify(formData)
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			if ('detail' in err) {
				error = err.detail;
			} else {
				error = err;
			}
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const deleteChildProfile = async (token: string = '', profileId: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/child-profiles/${profileId}`, {
		method: 'DELETE',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			if ('detail' in err) {
				error = err.detail;
			} else {
				error = err;
			}
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getChildProfilesForUser = async (token: string = '', userId: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/child-profiles/admin/${userId}`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

/**
 * Fetch the whitelist for the current child user.
 * Calls GET /child-profiles/my-whitelist (uses backend email+parent_id lookup).
 */
export const getMyWhitelist = async (token: string = ''): Promise<string[]> => {
	try {
		const res = await fetch(`${WEBUI_API_BASE_URL}/child-profiles/my-whitelist`, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				authorization: `Bearer ${token}`
			}
		});
		if (!res.ok) return [];
		const data = await res.json();
		return Array.isArray(data?.whitelist_items) ? data.whitelist_items : [];
	} catch {
		return [];
	}
};

export const updateChildProfileWhitelist = async (
	token: string = '',
	profileId: string,
	whitelistItems: string[]
) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/child-profiles/${profileId}/whitelist`, {
		method: 'PATCH',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ whitelist_items: whitelistItems })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			if ('detail' in err) {
				error = err.detail;
			} else {
				error = err;
			}
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};
