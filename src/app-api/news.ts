import axios from "axios";

export type NewsAuthor = {
	id: string;
	firstName: string | null;
	lastName: string | null;
	profilePhoto?: string | null;
	userColor?: string | null;
	role?: string | null;
};

export interface NewsArticle {
	id: number;
	userId: string;
	externalId: string | null;
	title: string;
	article: string;
	createdAt: string;
	author: NewsAuthor | null;
}

export interface NewsPagination {
	current_page: number;
	per_page: number;
	total_count: number;
	total_pages: number;
	has_next_page: boolean;
	has_prev_page: boolean;
}

export interface GetNewsParams {
	page?: number;
	limit?: number;
}

export interface GetNewsResponse {
	data: {
		results: NewsArticle[];
		pagination: NewsPagination;
	};
}

export interface CreateNewsPayload {
	title: string;
	article: string;
}

function unwrapNews(body: { data: NewsArticle } | NewsArticle): NewsArticle {
	if (body && typeof body === "object" && "data" in body) {
		return body.data;
	}
	return body as NewsArticle;
}

export async function getNewsList(params: GetNewsParams = {}): Promise<GetNewsResponse> {
	const res = await axios.get<GetNewsResponse>("/api/news", {
		params: {
			page: params.page ?? 1,
			limit: params.limit ?? 10,
		},
		withCredentials: true,
	});
	return res.data;
}

export async function createNews(payload: CreateNewsPayload): Promise<NewsArticle> {
	const res = await axios.post<{ data: NewsArticle } | NewsArticle>("/api/news", payload, {
		withCredentials: true,
	});
	return unwrapNews(res.data);
}

export async function updateNews(id: number, payload: CreateNewsPayload): Promise<NewsArticle> {
	const res = await axios.patch<{ data: NewsArticle } | NewsArticle>(`/api/news/${id}`, payload, {
		withCredentials: true,
	});
	return unwrapNews(res.data);
}

export async function deleteNews(id: number): Promise<void> {
	await axios.delete(`/api/news/${id}`, {
		withCredentials: true,
	});
}
