import { WEBUI_API_BASE_URL } from '$lib/constants';

export interface ConsentFormModel {
	id: string;
	slug: string;
	study_ids: string[];
	version: string;
	title: string;
	pi_name: string | null;
	irb_number: string | null;
	body_html: string;
	is_active: boolean;
	effective_date: number | null;
	created_at: number;
	updated_at: number;
}

export interface ConsentFormCreate {
	slug: string;
	study_ids: string[];
	version?: string;
	title: string;
	pi_name?: string | null;
	irb_number?: string | null;
	body_html: string;
	is_active?: boolean;
	effective_date?: number | null;
}

export interface ConsentFormUpdate {
	slug?: string;
	study_ids?: string[];
	version?: string;
	title?: string;
	pi_name?: string | null;
	irb_number?: string | null;
	body_html?: string;
	is_active?: boolean;
	effective_date?: number | null;
}

export const getConsentForms = async (token: string): Promise<ConsentFormModel[]> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/prolific/consent-forms`, {
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

	if (error) throw error;
	return res ?? [];
};

export const createConsentForm = async (
	token: string,
	data: ConsentFormCreate
): Promise<ConsentFormModel | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/prolific/consent-forms`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify(data)
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

	if (error) throw error;
	return res;
};

export const updateConsentForm = async (
	token: string,
	formId: string,
	data: ConsentFormUpdate
): Promise<ConsentFormModel | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/prolific/consent-forms/${formId}`, {
		method: 'PUT',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify(data)
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

	if (error) throw error;
	return res;
};

export const deleteConsentForm = async (token: string, formId: string): Promise<boolean> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/prolific/consent-forms/${formId}`, {
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
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) throw error;
	return res?.success ?? false;
};
